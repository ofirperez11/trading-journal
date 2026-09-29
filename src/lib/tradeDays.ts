import type { Trade } from '../types'
import { sessionOf } from './lookback'

// Days without a trade: every Mon–Fri between the first and the last trade
// counts as a trading day (the backtest is assumed to cover each of them —
// holidays show up as days without a trade), minus the days that have one.

const WEEKDAY_HE = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳']
const pad = (n: number) => String(n).padStart(2, '0')
const key = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export interface TradeDays {
  tradingDays: number // Mon–Fri in the range
  withTrade: number
  without: string[] // YYYY-MM-DD, newest first
  bySession: { session: '16:30' | '17:00'; days: number }[] // days with a trade in that opportunity
  byWeekday: { label: string; days: number; withTrade: number }[] // Mon…Fri
  perMonth: number // average trading days with a trade, per month in the range
}

export function tradeDays(trades: Trade[]): TradeDays | null {
  if (!trades.length) return null
  const days = new Set(trades.map((t) => t.date.slice(0, 10)))
  const sorted = [...days].sort()
  const [y0, m0, d0] = sorted[0].split('-').map(Number)
  const [y1, m1, d1] = sorted[sorted.length - 1].split('-').map(Number)
  const all: Date[] = []
  for (let d = new Date(y0, m0 - 1, d0); d <= new Date(y1, m1 - 1, d1); d.setDate(d.getDate() + 1)) {
    if (d.getDay() >= 1 && d.getDay() <= 5) all.push(new Date(d))
  }
  const withTrade = all.filter((d) => days.has(key(d))).length
  const months = new Set(all.map((d) => key(d).slice(0, 7))).size || 1
  return {
    tradingDays: all.length,
    withTrade,
    without: all.filter((d) => !days.has(key(d))).map(key).reverse(),
    bySession: (['16:30', '17:00'] as const).map((s) => ({
      session: s,
      days: new Set(trades.filter((t) => sessionOf(t) === s).map((t) => t.date.slice(0, 10))).size,
    })),
    byWeekday: [1, 2, 3, 4, 5].map((wd) => {
      const ds = all.filter((d) => d.getDay() === wd)
      return { label: WEEKDAY_HE[wd], days: ds.length, withTrade: ds.filter((d) => days.has(key(d))).length }
    }),
    perMonth: withTrade / months,
  }
}
