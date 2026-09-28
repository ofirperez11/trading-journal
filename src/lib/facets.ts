import type { Trade } from '../types'
import { cleanSymbol } from './trades'
import { LOOKBACKS, SESSION_TIMES, sessionOf } from './lookback'
import { BIASES, BIAS_FULL_LABEL } from './bias'

// Filter menu facets. Each facet is one URL param (comma-separated values).
// Values inside a facet are OR'ed (NQ or ES), facets are AND'ed (NQ and
// short). Shared by the analytics and trades pages, so a new facet shows up
// in both.
export type FacetOpt = { v: string; label: string }
export interface Facet {
  key: string
  label: string
  of: (t: Trade) => string | null
  options: (trades: Trade[]) => FacetOpt[]
}
const fixed = (opts: FacetOpt[]) => () => opts
/** Only the options that actually occur, in the given order. */
const present = (of: (t: Trade) => string | null, order: FacetOpt[]) => (trades: Trade[]) => {
  const seen = new Set(trades.map(of))
  return order.filter((o) => seen.has(o.v))
}
const LOOKBACK_ORDER = [...new Set([...LOOKBACKS['16:30'], ...LOOKBACKS['17:00']])]
/** Every lookback in the journal (incl. variants like "פתיל 19:30 · 30 דקות"), in marker order. */
const lookbackOptions = (trades: Trade[]): FacetOpt[] => {
  const rank = (v: string) => {
    const i = LOOKBACK_ORDER.findIndex((m) => ` ${v} `.includes(` ${m} `))
    return i < 0 ? LOOKBACK_ORDER.length : i
  }
  return [...new Set(trades.map((t) => t.lookback).filter((v) => v != null))]
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
    .map((v) => ({ v, label: v }))
}

export const FACETS: Facet[] = [
  {
    key: 'asset',
    label: 'נכס',
    // MNQ counts as NQ, MES as ES.
    of: (t) => (cleanSymbol(t.symbol).endsWith('NQ') ? 'NQ' : cleanSymbol(t.symbol).endsWith('ES') ? 'ES' : null),
    options: fixed([
      { v: 'NQ', label: 'NQ' },
      { v: 'ES', label: 'ES' },
    ]),
  },
  {
    key: 'side',
    label: 'כיוון',
    of: (t) => t.side,
    options: fixed([
      { v: 'LONG', label: 'לונג' },
      { v: 'SHORT', label: 'שורט' },
    ]),
  },
  {
    key: 'session',
    label: 'שעת הזדמנות',
    of: sessionOf,
    options: fixed(SESSION_TIMES.map((v) => ({ v, label: v }))),
  },
  {
    key: 'result',
    label: 'תוצאה',
    of: (t) => t.status,
    options: fixed([
      { v: 'WIN', label: 'Win' },
      { v: 'LOSS', label: 'Loss' },
      { v: 'WASH', label: 'BE' },
    ]),
  },
  { key: 'lb', label: 'Lookback', of: (t) => t.lookback, options: lookbackOptions },
  {
    key: 'bias',
    label: 'ביאס',
    of: (t) => t.bias,
    options: present((t) => t.bias, BIASES.map((b) => ({ v: b.v, label: BIAS_FULL_LABEL[b.v] }))),
  },
  {
    key: 'zone',
    label: 'אזור',
    of: (t) => t.zone,
    options: fixed([
      { v: 'premium', label: 'Premium' },
      { v: 'deadzone', label: 'Deadzone' },
      { v: 'discount', label: 'Discount' },
    ]),
  },
  {
    key: 'liq',
    label: 'נזילות',
    of: (t) => t.liquidity,
    options: fixed([
      { v: 'buyside', label: 'Buyside' },
      { v: 'sellside', label: 'Sellside' },
      { v: 'none', label: 'לא נלקחה' },
    ]),
  },
  {
    key: 'ath',
    label: 'ATH',
    of: (t) => (t.tags?.includes('ATH') ? 'ath' : 'no'),
    options: fixed([
      { v: 'ath', label: 'ATH' },
      { v: 'no', label: 'ללא ATH' },
    ]),
  },
  {
    key: 'week',
    label: 'שבוע בחודש',
    of: (t) => (t.week_of_month != null ? String(t.week_of_month) : null),
    options: fixed([1, 2, 3, 4, 5].map((w) => ({ v: String(w), label: `שבוע ${w}` }))),
  },
]
export const csv = (s: string | null) => (s ? s.split(',').filter(Boolean) : [])

/** The selected values of each facet, read from the URL. */
export function readFacets(params: URLSearchParams, facets: Facet[] = FACETS): Record<string, Set<string>> {
  return Object.fromEntries(facets.map((f) => [f.key, new Set(csv(params.get(f.key)))]))
}
/** Does the trade pass every facet that has a selection? */
export function passesFacets(t: Trade, sel: Record<string, Set<string>>, facets: Facet[] = FACETS): boolean {
  return facets.every((f) => !sel[f.key]?.size || sel[f.key].has(f.of(t) ?? ''))
}
