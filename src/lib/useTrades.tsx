import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Trade } from '../types'
import { normalizeTrade } from './trades'
import { isSupabaseConfigured, supabase } from './supabase'
import { useJournals } from './journals'
import { useAuth } from './auth'

// ---------------------------------------------------------------------------
// Trades store. Loads the base set (demo JSON or Supabase) and layers local
// create/edit/delete mutations on top so the demo is fully interactive.
// When Supabase is connected these mutations will write to the DB instead;
// for now they persist to localStorage.
// ---------------------------------------------------------------------------

let baseCache: Trade[] | null = null
let inflight: Promise<Trade[]> | null = null

async function loadBase(): Promise<Trade[]> {
  if (baseCache) return baseCache
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.from('trades').select('*').order('date', { ascending: false })
    if (error) throw error
    baseCache = (data ?? []).map((r) => normalizeTrade(r as Record<string, unknown>))
    return baseCache
  }
  const res = await fetch('/demo/trades.json')
  if (!res.ok) throw new Error('failed to load demo trades')
  const raw = (await res.json()) as Record<string, unknown>[]
  baseCache = raw.map(normalizeTrade).sort((a, b) => b.date.localeCompare(a.date))
  return baseCache
}

const M_ADDED = 'tj_trades_added'
const M_EDITED = 'tj_trades_edited'
const M_DELETED = 'tj_trades_deleted'

// Fields on the app's Trade type that are not real DB columns.
const NON_COLUMNS = new Set(['exits', 'created_at', 'updated_at'])
export function toDbRow(t: Partial<Trade>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(t)) if (!NON_COLUMNS.has(k)) out[k] = v
  return out
}

function read<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '') as T
  } catch {
    return fallback
  }
}

type Edits = Record<string, Partial<Trade>>

function compose(base: Trade[], added: Trade[], edited: Edits, deleted: string[]): Trade[] {
  const del = new Set(deleted)
  const merged = base
    .filter((t) => !del.has(t.id))
    .map((t) => (edited[t.id] ? { ...t, ...edited[t.id] } : t))
  return [...added.filter((t) => !del.has(t.id)), ...merged].sort((a, b) =>
    b.date.localeCompare(a.date),
  )
}

interface TradesContextValue {
  all: Trade[]
  loading: boolean
  error: string | null
  addTrade: (trade: Trade) => void
  updateTrade: (id: string, patch: Partial<Trade>) => void
  deleteTrade: (id: string) => void
}

const TradesContext = createContext<TradesContextValue | undefined>(undefined)

export function TradesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [base, setBase] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [added, setAdded] = useState<Trade[]>(() => read<Trade[]>(M_ADDED, []))
  const [edited, setEdited] = useState<Edits>(() => read<Edits>(M_EDITED, {}))
  const [deleted, setDeleted] = useState<string[]>(() => read<string[]>(M_DELETED, []))

  // Reload the base set whenever the signed-in user changes. Crucially, we do
  // NOT cache an anonymous (pre-login) empty result — that would leave the app
  // blank after login. Each user gets a fresh query.
  useEffect(() => {
    let active = true
    if (isSupabaseConfigured) {
      if (!user) {
        setBase([])
        setLoading(false)
        return
      }
      setLoading(true)
      supabase
        .from('trades')
        .select('*')
        .order('date', { ascending: false })
        .then(({ data, error: err }) => {
          if (!active) return
          if (err) setError(err.message)
          else setBase((data ?? []).map((r) => normalizeTrade(r as Record<string, unknown>)))
          setLoading(false)
        })
      return () => {
        active = false
      }
    }
    // Demo mode: bundled JSON, cached across mounts.
    if (baseCache) {
      setBase(baseCache)
      setLoading(false)
      return () => {
        active = false
      }
    }
    inflight = inflight ?? loadBase()
    inflight
      .then((t) => active && (setBase(t), setLoading(false)))
      .catch((e) => active && (setError(String(e)), setLoading(false)))
      .finally(() => {
        inflight = null
      })
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const all = useMemo(() => compose(base, added, edited, deleted), [base, added, edited, deleted])

  function persistAdded(next: Trade[]) {
    setAdded(next)
    localStorage.setItem(M_ADDED, JSON.stringify(next))
  }
  function persistEdited(next: Edits) {
    setEdited(next)
    localStorage.setItem(M_EDITED, JSON.stringify(next))
  }
  function persistDeleted(next: string[]) {
    setDeleted(next)
    localStorage.setItem(M_DELETED, JSON.stringify(next))
  }

  function addTrade(trade: Trade) {
    if (isSupabaseConfigured) {
      setBase((b) => [trade, ...b])
      baseCache = null
      supabase
        .from('trades')
        .insert(toDbRow(trade))
        .then(({ error }) => error && setError(error.message))
      return
    }
    persistAdded([trade, ...added])
  }

  function updateTrade(id: string, patch: Partial<Trade>) {
    if (isSupabaseConfigured) {
      setBase((b) => b.map((t) => (t.id === id ? { ...t, ...patch } : t)))
      baseCache = null
      supabase
        .from('trades')
        .update(toDbRow(patch))
        .eq('id', id)
        .then(({ error }) => error && setError(error.message))
      return
    }
    if (added.some((t) => t.id === id)) {
      persistAdded(added.map((t) => (t.id === id ? { ...t, ...patch } : t)))
    } else {
      persistEdited({ ...edited, [id]: { ...edited[id], ...patch } })
    }
  }

  function deleteTrade(id: string) {
    if (isSupabaseConfigured) {
      setBase((b) => b.filter((t) => t.id !== id))
      baseCache = null
      supabase
        .from('trades')
        .delete()
        .eq('id', id)
        .then(({ error }) => error && setError(error.message))
      return
    }
    if (added.some((t) => t.id === id)) {
      persistAdded(added.filter((t) => t.id !== id))
      return
    }
    if (!deleted.includes(id)) persistDeleted([...deleted, id])
    if (edited[id]) {
      const next = { ...edited }
      delete next[id]
      persistEdited(next)
    }
  }

  return (
    <TradesContext.Provider value={{ all, loading, error, addTrade, updateTrade, deleteTrade }}>
      {children}
    </TradesContext.Provider>
  )
}

function useTradesCtx() {
  const ctx = useContext(TradesContext)
  if (!ctx) throw new Error('useTrades must be used within <TradesProvider>')
  return ctx
}

/** Trades scoped to the active journal. */
export function useTrades(): { trades: Trade[]; loading: boolean; error: string | null } {
  const { activeId } = useJournals()
  const { all, loading, error } = useTradesCtx()
  const trades = useMemo(() => all.filter((t) => t.account_id === activeId), [all, activeId])
  return { trades, loading, error }
}

export function useTrade(id: string | undefined): { trade: Trade | null; loading: boolean } {
  const { all, loading } = useTradesCtx()
  return { trade: all.find((t) => t.id === id) ?? null, loading }
}

export function useTradeActions() {
  const { addTrade, updateTrade, deleteTrade } = useTradesCtx()
  return { addTrade, updateTrade, deleteTrade }
}
