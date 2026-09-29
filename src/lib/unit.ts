import { useSyncExternalStore } from 'react'
import type { Trade } from '../types'
import { cleanSymbol, formatMoney } from './trades'

// "Show the journal in points": every P&L on the read-only pages switches from
// dollars to index points — how far price moved, per contract (the contract
// count doesn't matter). Forms and imports stay in dollars.

export type Unit = 'usd' | 'pts'

/** Dollar value of one index point per contract. */
const POINT_VALUE: Record<string, number> = { NQ: 20, MNQ: 2, ES: 50, MES: 5, YM: 5, MYM: 0.5 }

/** A trade's result in points per contract (0 when the symbol's point value is unknown). */
export function pointsOf(t: Pick<Trade, 'symbol' | 'qty' | 'return_amount'>): number {
  const pv = POINT_VALUE[cleanSymbol(t.symbol)]
  if (!pv || !t.qty) return 0
  return Math.round((t.return_amount / (t.qty * pv)) * 100) / 100
}

/** Trades whose `return_amount` is in the chosen unit — for display and stats only, never saved. */
export function inUnit(trades: Trade[], unit: Unit): Trade[] {
  return unit === 'usd' ? trades : trades.map((t) => ({ ...t, return_amount: pointsOf(t) }))
}

export function formatPoints(v: number, withSign = true): string {
  const sign = v > 0 && withSign ? '+' : v < 0 ? '-' : ''
  const abs = Math.abs(v)
  return `${sign}${abs.toLocaleString('en-US', { maximumFractionDigits: abs < 100 ? 2 : 0 })} נק׳`
}

// The choice is a standing preference (this browser), shared live by every
// component — flipping it in the sidebar re-renders the open page.
const KEY = 'tj_unit'
const listeners = new Set<() => void>()
function read(): Unit {
  try {
    return localStorage.getItem(KEY) === 'pts' ? 'pts' : 'usd'
  } catch {
    return 'usd'
  }
}
let current: Unit = read()
export function setUnit(u: Unit) {
  current = u
  try {
    if (u === 'pts') localStorage.setItem(KEY, 'pts')
    else localStorage.removeItem(KEY)
  } catch {
    /* storage blocked — still switches for this visit */
  }
  listeners.forEach((l) => l())
}
function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

/**
 * A P&L amount in the current unit ("+$160" / "+8 נק׳"). Reads the live choice,
 * so it's safe anywhere under a page that calls useUnit() (that page re-renders
 * on a switch, and its children with it).
 */
export function formatPnl(v: number, withSign = true): string {
  return current === 'pts' ? formatPoints(v, withSign) : formatMoney(v, withSign)
}

/** The current unit; the calling component re-renders when it's switched. */
export function useUnit(): Unit {
  return useSyncExternalStore(subscribe, () => current)
}
