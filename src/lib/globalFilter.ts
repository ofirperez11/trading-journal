import { useMemo, useSyncExternalStore } from 'react'
import type { Trade } from '../types'
import { EXCLUDE, FACETS, RANGE_FACETS, activeRanges, csv, passesFacets, passesRanges, readFacets, readRanges } from './facets'
import { firstTradesOnly, useFirstTradeOnly } from './firstTrade'

// The global filter: one selection (facets + number ranges + the first-trade
// rule) that every page — dashboard, trades, analytics, calendar — applies, so
// switching pages keeps the same trades. It lives for the browser session (it
// survives navigation and refresh, and resets when the browser is closed), in
// the same "key=a,b" form the facets already use. Page-only filters (search,
// symbol / year / month on the trades page, the analytics date range) stay in
// each page's URL.

const KEY = 'tj_global_filter'
const listeners = new Set<() => void>()
let query = (() => {
  try {
    return sessionStorage.getItem(KEY) ?? ''
  } catch {
    return ''
  }
})()
function write(next: URLSearchParams) {
  query = next.toString()
  try {
    if (query) sessionStorage.setItem(KEY, query)
    else sessionStorage.removeItem(KEY)
  } catch {
    /* storage blocked — still filters for this visit */
  }
  listeners.forEach((l) => l())
}
function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

const NONE: Trade[] = []

/** The global filter's state and actions; pass the page's trades to get `filtered`. */
export function useGlobalFilter(trades: Trade[] = NONE) {
  const q = useSyncExternalStore(subscribe, () => query)
  const [firstOnly, setFirstOnly] = useFirstTradeOnly()
  const facetSel = useMemo(() => readFacets(new URLSearchParams(q)), [q])
  const ranges = useMemo(() => readRanges(new URLSearchParams(q)), [q])
  // The first-trade rule runs on all trades first, so the other filters can't change which one was first.
  const filtered = useMemo(
    () => (firstOnly ? firstTradesOnly(trades) : trades).filter((t) => passesFacets(t, facetSel) && passesRanges(t, ranges)),
    [trades, firstOnly, facetSel, ranges],
  )
  const edit = (mut: (p: URLSearchParams) => void) => {
    const next = new URLSearchParams(query)
    mut(next)
    write(next)
  }
  return {
    facetSel,
    ranges,
    firstOnly,
    setFirstOnly,
    /** Selections that narrow the trades (the first-trade rule is shown on its own). */
    activeCount: FACETS.reduce((n, f) => n + facetSel[f.key].size, 0) + activeRanges(ranges),
    toggleFacet: (key: string, v: string) =>
      edit((p) => {
        const cur = new Set(csv(p.get(key)))
        cur.has(v) ? cur.delete(v) : cur.add(v)
        if (cur.size) p.set(key, [...cur].join(','))
        else p.delete(key)
      }),
    setRange: (key: string, r: [number, number] | null) => edit((p) => (r ? p.set(key, `${r[0]}-${r[1]}`) : p.delete(key))),
    /** Replace the whole selection with exactly these facet values (e.g. a "הכי מצליח" pick). */
    select: (picks: { key: string; v: string }[]) =>
      edit((p) => {
        for (const f of FACETS) p.delete(f.key)
        for (const f of RANGE_FACETS) p.delete(f.key)
        for (const pick of picks) p.set(pick.key, pick.v)
      }),
    /** Replace the whole selection with "without" these values (a "מסנן חכם" step). */
    exclude: (drops: { key: string; v: string }[]) =>
      edit((p) => {
        for (const f of FACETS) p.delete(f.key)
        for (const f of RANGE_FACETS) p.delete(f.key)
        for (const d of drops) p.set(d.key, [...csv(p.get(d.key)), EXCLUDE + d.v].join(','))
      }),
    clear: () =>
      edit((p) => {
        for (const f of FACETS) p.delete(f.key)
        for (const f of RANGE_FACETS) p.delete(f.key)
      }),
    /** The page's trades that pass. */
    filtered,
  }
}
