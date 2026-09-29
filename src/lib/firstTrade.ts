import { useSyncExternalStore } from 'react'
import type { Trade } from '../types'
import { cleanSymbol } from './trades'
import { SESSION_TIMES, sessionOf } from './lookback'

// Strategy rule "first trade per opportunity". Each day has two opportunities,
// 16:30 and 17:00. In each, only the trade that filled first is taken (NQ before
// ES on the same minute); the rest of that opportunity were not taken. A win at
// 16:30 ends the day, so 17:00 is only taken after a 16:30 loss / BE / no trade.
// Trades outside both opportunities are left alone.

/** NQ family first, then ES, then the rest — the tie-break on the same minute. */
const assetRank = (t: Trade) => {
  const s = cleanSymbol(t.symbol)
  return s.endsWith('NQ') ? 0 : s.endsWith('ES') ? 1 : 2
}

/**
 * The trade's fill time "HH:MM". Pine trades imported before fill times were
 * used sit at the session time; their notes still say "שעת מילוי: 16:34".
 */
export function fillTimeOf(t: Pick<Trade, 'date' | 'notes'>): string {
  const time = t.date.slice(11, 16)
  const m = t.notes?.match(/שעת מילוי:\s*(\d{1,2}:\d{2})/)
  return m && (SESSION_TIMES as readonly string[]).includes(time) ? m[1].padStart(5, '0') : time
}

export function firstTradesOnly(trades: Trade[]): Trade[] {
  const keep = new Set<string>()
  const byDay = new Map<string, Trade[]>()
  for (const t of trades) {
    if (!sessionOf(t)) keep.add(t.id)
    else byDay.set(t.date.slice(0, 10), [...(byDay.get(t.date.slice(0, 10)) ?? []), t])
  }
  const first = (ts: Trade[]) =>
    [...ts].sort(
      (a, b) => fillTimeOf(a).localeCompare(fillTimeOf(b)) || assetRank(a) - assetRank(b) || a.id.localeCompare(b.id),
    )[0]
  for (const ts of byDay.values()) {
    const early = first(ts.filter((t) => sessionOf(t) === '16:30'))
    if (early) keep.add(early.id)
    if (early?.status === 'WIN') continue // the day is done
    const late = first(ts.filter((t) => sessionOf(t) === '17:00'))
    if (late) keep.add(late.id)
  }
  return trades.filter((t) => keep.has(t.id))
}

// The switch is a standing preference: once on it stays on (this browser) until
// turned off. Shared live, so every filter bar and page agrees.
const KEY = 'tj_first_trade_only'
const listeners = new Set<() => void>()
let current = (() => {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
})()
function setFirstTradeOnly(next: boolean) {
  current = next
  try {
    if (next) localStorage.setItem(KEY, '1')
    else localStorage.removeItem(KEY)
  } catch {
    /* storage blocked — the switch still works for this visit */
  }
  listeners.forEach((l) => l())
}
function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}
export function useFirstTradeOnly(): [boolean, (on: boolean) => void] {
  return [useSyncExternalStore(subscribe, () => current), setFirstTradeOnly]
}
