import { useEffect, useMemo, useState } from 'react'
import type { Trade } from '../types'
import { normalizeTrade } from './trades'
import { isSupabaseConfigured, supabase } from './supabase'
import { useJournals } from './journals'

// Module-level cache so navigating between pages doesn't refetch.
let cache: Trade[] | null = null
let inflight: Promise<Trade[]> | null = null

async function loadTrades(): Promise<Trade[]> {
  if (cache) return cache

  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .order('date', { ascending: false })
    if (error) throw error
    cache = (data ?? []).map((r) => normalizeTrade(r as Record<string, unknown>))
    return cache
  }

  // Demo: load the bundled export.
  const res = await fetch('/demo/trades.json')
  if (!res.ok) throw new Error('failed to load demo trades')
  const raw = (await res.json()) as Record<string, unknown>[]
  cache = raw.map(normalizeTrade).sort((a, b) => b.date.localeCompare(a.date))
  return cache
}

interface AllState {
  all: Trade[]
  loading: boolean
  error: string | null
}

/** All of the user's trades across every journal. */
function useAllTrades(): AllState {
  const [state, setState] = useState<AllState>({
    all: cache ?? [],
    loading: !cache,
    error: null,
  })

  useEffect(() => {
    if (cache) {
      setState({ all: cache, loading: false, error: null })
      return
    }
    let active = true
    inflight = inflight ?? loadTrades()
    inflight
      .then((t) => active && setState({ all: t, loading: false, error: null }))
      .catch((e) => active && setState({ all: [], loading: false, error: String(e) }))
      .finally(() => {
        inflight = null
      })
    return () => {
      active = false
    }
  }, [])

  return state
}

interface State {
  trades: Trade[]
  loading: boolean
  error: string | null
}

/** Trades scoped to the currently active journal. */
export function useTrades(): State {
  const { activeId } = useJournals()
  const { all, loading, error } = useAllTrades()
  const trades = useMemo(() => all.filter((t) => t.account_id === activeId), [all, activeId])
  return { trades, loading, error }
}

export function useTrade(id: string | undefined): { trade: Trade | null; loading: boolean } {
  const { all, loading } = useAllTrades()
  return { trade: all.find((t) => t.id === id) ?? null, loading }
}
