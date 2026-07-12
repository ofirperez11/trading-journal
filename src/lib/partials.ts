import type { Execution, TradeSide, TradeStatus } from '../types'

// Partial-exit support: a trade can be scaled out in several exits, each with its
// own contract quantity. The position size is the sum of the exit quantities.

export interface ExitRow {
  price: string
  qty: string
}

const parse = (v: string) => {
  const n = Number(v)
  return v.trim() !== '' && Number.isFinite(n) ? n : null
}

export interface PartialResult {
  totalQty: number
  pnl: number | null
  rMultiple: number | null
  exitLast: number | null
  exitPrices: number[]
  status: TradeStatus
  executions: Execution[] | null
}

/**
 * Compute P&L, R-multiple, and executions from an entry + a list of partial
 * exits. P&L sums each exit's contribution; R is total P&L over the initial
 * dollar risk (stop distance × total size), which reduces to the plain formula
 * for a single full exit.
 */
export function computePartials(o: {
  entry: number | null
  side: TradeSide
  pv: number
  stop: number | null
  exits: ExitRow[]
  dateTime: string
}): PartialResult {
  const dir = o.side === 'LONG' ? 1 : -1
  const rows = o.exits
    .map((r) => ({ price: parse(r.price), qty: parse(r.qty) }))
    .filter((r): r is { price: number; qty: number } => r.price != null && r.qty != null && r.qty > 0)

  const totalQty = rows.reduce((s, r) => s + r.qty, 0)
  const pnl =
    o.entry != null && rows.length
      ? Math.round(rows.reduce((s, r) => s + (r.price - o.entry!) * dir * r.qty * o.pv, 0) * 100) / 100
      : null
  const riskPts = o.entry != null && o.stop != null ? Math.abs(o.entry - o.stop) : null
  const rMultiple =
    pnl != null && riskPts && totalQty ? Math.round((pnl / (riskPts * totalQty * o.pv)) * 100) / 100 : null

  const exitPrices = rows.map((r) => r.price)
  const exitLast = exitPrices.length ? exitPrices[exitPrices.length - 1] : null
  const status: TradeStatus = pnl == null ? 'WASH' : pnl > 0 ? 'WIN' : pnl < 0 ? 'LOSS' : 'WASH'

  let executions: Execution[] | null = null
  if (o.entry != null && rows.length) {
    const openAct: 'BUY' | 'SELL' = o.side === 'LONG' ? 'BUY' : 'SELL'
    const closeAct: 'BUY' | 'SELL' = o.side === 'LONG' ? 'SELL' : 'BUY'
    executions = [
      { action: openAct, price: o.entry, qty: totalQty, commission: 0, dateTime: o.dateTime },
      ...rows.map((r) => ({ action: closeAct, price: r.price, qty: r.qty, commission: 0, dateTime: o.dateTime })),
    ]
  }

  return { totalQty, pnl, rMultiple, exitLast, exitPrices, status, executions }
}

/** Seed the exits editor from an existing trade (per-exit from executions, else a single row). */
export function seedExits(trade: {
  exit?: number | null
  exits?: number[] | null
  qty?: number
  side?: TradeSide
  executions?: Execution[] | null
} | null): ExitRow[] {
  if (!trade) return [{ price: '', qty: '' }]
  const openAct = trade.side === 'LONG' ? 'BUY' : 'SELL'
  const closes = (trade.executions ?? []).filter((e) => e.action !== openAct)
  if (closes.length) return closes.map((e) => ({ price: String(e.price), qty: String(e.qty) }))
  const price = trade.exit ?? trade.exits?.[0] ?? null
  return [{ price: price != null ? String(price) : '', qty: trade.qty != null ? String(trade.qty) : '' }]
}
