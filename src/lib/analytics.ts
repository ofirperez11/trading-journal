import type { Trade } from '../types'
import { computeStats, cleanSymbol, type Stats } from './trades'
import { BIASES } from './bias'

// ---------------------------------------------------------------------------
// Deeper breakdowns for the analytics page, built on top of computeStats.
// ---------------------------------------------------------------------------

export interface Bucket {
  label: string
  value: number // P&L or count, depending on the chart
  count: number
  winRate?: number
  tone?: 'win' | 'loss' | 'accent'
}

export interface StopStat {
  stop: number // stop size in points
  count: number
  winRate: number
}
export interface AssetStopStats {
  total: number
  winRate: number
  buckets: StopStat[]
}

/** Expected stop sizes (points) per asset — trades snap to the nearest. */
const STOP_SIZES: Record<string, number[]> = { MNQ: [15, 20], MES: [3, 4], YM: [] }
const STOP_ASSETS = ['MNQ', 'MES', 'YM']

function nearest(arr: number[], v: number): number {
  return arr.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a))
}

export interface Analytics extends Stats {
  stopByAsset: Record<string, AssetStopStats>
  expectancy: number // avg P&L per trade
  payoff: number | null // avg win / avg loss
  equity: number[]
  equityLabels: string[]
  drawdown: number[] // running equity − peak (≤ 0)
  maxDrawdown: number // positive magnitude
  byWeekday: Bucket[]
  byHour: Bucket[]
  bySymbol: Bucket[]
  bySide: Bucket[]
  byMonth: Bucket[]
  rDistribution: Bucket[]
  byLookback: Bucket[] // performance per entry-model (lookback)
  byLiquidity: Bucket[] // win rate by liquidity taken — tagged trades only
  byZone: Bucket[] // win rate by side × zone (Long/Short in each zone) — tagged trades only
  byBias: Bucket[] // win rate by HTF bias pair — tagged trades only
  // day-level
  tradingDays: number
  winningDays: number
  losingDays: number
  avgDailyPnl: number
  dayWinRate: number
}

const fmtDay = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

/** Filter to trades whose date falls within [from, to]. */
export function filterTradesByRange(trades: Trade[], from: Date | null, to: Date | null): Trade[] {
  if (!from && !to) return trades
  return trades.filter((t) => {
    const d = new Date(t.date)
    return (!from || d >= from) && (!to || d <= to)
  })
}

const HE_WEEKDAYS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳']

function groupPnl(
  trades: Trade[],
  keyOf: (t: Trade) => string,
): Map<string, { pnl: number; count: number; wins: number; losses: number }> {
  const m = new Map<string, { pnl: number; count: number; wins: number; losses: number }>()
  for (const t of trades) {
    const k = keyOf(t)
    const cur = m.get(k) ?? { pnl: 0, count: 0, wins: 0, losses: 0 }
    cur.pnl += t.return_amount
    cur.count++
    if (t.return_amount > 0) cur.wins++
    else if (t.return_amount < 0) cur.losses++
    m.set(k, cur)
  }
  return m
}

function pnlTone(v: number): 'win' | 'loss' {
  return v >= 0 ? 'win' : 'loss'
}

export function computeAnalytics(trades: Trade[]): Analytics {
  const stats = computeStats(trades)
  const chron = [...trades].sort((a, b) => a.date.localeCompare(b.date))

  // Equity + drawdown (underwater) curves.
  const equity: number[] = [0]
  const equityLabels: string[] = ['התחלה']
  const drawdown: number[] = [0]
  let acc = 0
  let peak = 0
  let maxDD = 0
  for (const t of chron) {
    acc += t.return_amount
    equity.push(acc)
    equityLabels.push(fmtDay(t.date))
    peak = Math.max(peak, acc)
    const dd = acc - peak
    drawdown.push(dd)
    maxDD = Math.min(maxDD, dd)
  }

  // Per-day grouping → daily P&L chart + day-level stats.
  const dayMap = groupPnl(trades, (t) => t.date.slice(0, 10))
  let winningDays = 0
  let losingDays = 0
  for (const g of dayMap.values()) {
    if (g.pnl > 0) winningDays++
    else if (g.pnl < 0) losingDays++
  }
  const tradingDays = dayMap.size
  const avgDailyPnl = tradingDays ? stats.netPnl / tradingDays : 0
  const dayWinRate = winningDays + losingDays > 0 ? winningDays / (winningDays + losingDays) : 0
  // Per-month grouping.
  const monthMap = groupPnl(trades, (t) => t.date.slice(0, 7))
  const byMonth: Bucket[] = [...monthMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([m, g]) => ({
      label: `${m.slice(5, 7)}/${m.slice(2, 4)}`,
      value: g.pnl,
      count: g.count,
      winRate: g.wins + g.losses > 0 ? g.wins / (g.wins + g.losses) : undefined,
      tone: pnlTone(g.pnl),
    }))

  // By weekday (Sun–Sat) — from the stored calendar day, no timezone shift.
  const wd = groupPnl(trades, (t) =>
    String(new Date(Number(t.date.slice(0, 4)), Number(t.date.slice(5, 7)) - 1, Number(t.date.slice(8, 10))).getDay()),
  )
  const byWeekday: Bucket[] = HE_WEEKDAYS.map((label, i) => {
    const g = wd.get(String(i))
    return {
      label,
      value: g?.pnl ?? 0,
      count: g?.count ?? 0,
      winRate: g && g.wins + g.losses > 0 ? g.wins / (g.wins + g.losses) : undefined,
      tone: pnlTone(g?.pnl ?? 0),
    }
  })

  // By hour (only hours that have trades) — the stored wall-clock hour, no tz shift.
  const hr = groupPnl(trades, (t) => String(Number(t.date.slice(11, 13))))
  const byHour: Bucket[] = [...hr.entries()]
    .map(([h, g]) => ({
      label: `${String(h).padStart(2, '0')}`,
      value: g.pnl,
      count: g.count,
      winRate: g.wins + g.losses > 0 ? g.wins / (g.wins + g.losses) : undefined,
      tone: pnlTone(g.pnl),
    }))
    .sort((a, b) => Number(a.label) - Number(b.label))

  // By symbol (grouped, e.g. MNQ1 + MNQ → MNQ).
  const sym = groupPnl(trades, (t) => cleanSymbol(t.symbol))
  const bySymbol: Bucket[] = [...sym.entries()]
    .map(([label, g]) => ({
      label,
      value: g.pnl,
      count: g.count,
      winRate: g.wins + g.losses > 0 ? g.wins / (g.wins + g.losses) : undefined,
      tone: pnlTone(g.pnl),
    }))
    .sort((a, b) => b.value - a.value)

  // Long vs short.
  const sd = groupPnl(trades, (t) => t.side)
  const bySide: Bucket[] = (['LONG', 'SHORT'] as const).map((side) => {
    const g = sd.get(side)
    return {
      label: side,
      value: g?.pnl ?? 0,
      count: g?.count ?? 0,
      winRate: g && g.wins + g.losses > 0 ? g.wins / (g.wins + g.losses) : undefined,
      tone: pnlTone(g?.pnl ?? 0),
    }
  })

  // R-multiple distribution.
  const edges = [-Infinity, -2, -1, 0, 1, 2, 3, 5, Infinity]
  const rLabels = ['≤-2', '-2…-1', '-1…0', '0…1', '1…2', '2…3', '3…5', '5+']
  const rCounts = new Array(rLabels.length).fill(0)
  for (const t of trades) {
    if (t.r_multiple == null) continue
    for (let i = 0; i < rLabels.length; i++) {
      if (t.r_multiple > edges[i] && t.r_multiple <= edges[i + 1]) {
        rCounts[i]++
        break
      }
    }
  }
  const rDistribution: Bucket[] = rLabels.map((label, i) => ({
    label,
    value: rCounts[i],
    count: rCounts[i],
    tone: i < 3 ? 'loss' : 'win',
  }))

  // Win rate by stop size, per asset.
  const stopByAsset: Record<string, AssetStopStats> = {}
  for (const asset of STOP_ASSETS) {
    const ts = trades.filter((t) => cleanSymbol(t.symbol) === asset && t.stoploss != null && t.entry != null)
    const expected = STOP_SIZES[asset] ?? []
    const groups = new Map<number, { count: number; wins: number; losses: number }>()
    let wins = 0
    let losses = 0
    for (const t of ts) {
      const pts = Math.abs(t.entry - (t.stoploss as number))
      const bucket = expected.length ? nearest(expected, pts) : Math.round(pts)
      const g = groups.get(bucket) ?? { count: 0, wins: 0, losses: 0 }
      g.count++
      if (t.return_amount > 0) {
        g.wins++
        wins++
      } else if (t.return_amount < 0) {
        g.losses++
        losses++
      }
      groups.set(bucket, g)
    }
    const buckets: StopStat[] = [...groups.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([stop, g]) => ({
        stop,
        count: g.count,
        winRate: g.wins + g.losses > 0 ? g.wins / (g.wins + g.losses) : 0,
      }))
    stopByAsset[asset] = {
      total: ts.length,
      winRate: wins + losses > 0 ? wins / (wins + losses) : 0,
      buckets,
    }
  }

  // Performance per entry-model (lookback) — bar = avg R, sublabel = win rate.
  const lb = new Map<string, { count: number; wins: number; losses: number; rSum: number }>()
  for (const t of trades) {
    if (!t.lookback) continue
    const g = lb.get(t.lookback) ?? { count: 0, wins: 0, losses: 0, rSum: 0 }
    g.count++
    if (t.return_amount > 0) g.wins++
    else if (t.return_amount < 0) g.losses++
    g.rSum += t.r_multiple ?? (t.return_amount < 0 ? -1 : 0)
    lb.set(t.lookback, g)
  }
  const byLookback: Bucket[] = [...lb.entries()]
    .map(([label, g]) => {
      const avgR = g.count ? g.rSum / g.count : 0
      return {
        label,
        value: Math.round(avgR * 100) / 100,
        count: g.count,
        winRate: g.wins + g.losses > 0 ? g.wins / (g.wins + g.losses) : undefined,
        tone: (avgR >= 0 ? 'win' : 'loss') as 'win' | 'loss',
      }
    })
    .sort((a, b) => b.value - a.value)

  // Win-rate buckets by a categorical key (bar length = win rate %).
  function winRateBuckets(key: (t: Trade) => string | null, order: { v: string; label: string }[]): Bucket[] {
    const g = new Map<string, { count: number; wins: number; losses: number }>()
    for (const t of trades) {
      const k = key(t)
      if (!k) continue
      const e = g.get(k) ?? { count: 0, wins: 0, losses: 0 }
      e.count++
      if (t.return_amount > 0) e.wins++
      else if (t.return_amount < 0) e.losses++
      g.set(k, e)
    }
    return order
      .filter((o) => g.has(o.v))
      .map((o) => {
        const e = g.get(o.v)!
        const wr = e.wins + e.losses > 0 ? e.wins / (e.wins + e.losses) : 0
        return { label: o.label, value: Math.round(wr * 100), count: e.count, tone: (wr >= 0.5 ? 'win' : 'loss') as 'win' | 'loss' }
      })
  }

  // Only trades that were actually tagged count (untagged → excluded), so a
  // partly-tagged backtest isn't diluted by the trades nobody reviewed.
  const byLiquidity = winRateBuckets((t) => t.liquidity, [
    { v: 'buyside', label: 'Buyside' },
    { v: 'sellside', label: 'Sellside' },
    { v: 'none', label: 'לא נלקחה' },
  ])
  // Win rate by side × zone (Long vs Short in each dealing-range zone).
  const byZone = winRateBuckets((t) => (t.zone ? `${t.side}·${t.zone}` : null), [
    { v: 'LONG·premium', label: 'Long · Premium' },
    { v: 'LONG·deadzone', label: 'Long · Deadzone' },
    { v: 'LONG·discount', label: 'Long · Discount' },
    { v: 'SHORT·premium', label: 'Short · Premium' },
    { v: 'SHORT·deadzone', label: 'Short · Deadzone' },
    { v: 'SHORT·discount', label: 'Short · Discount' },
  ])
  const byBias = winRateBuckets((t) => t.bias, BIASES.map((b) => ({ v: b.v, label: b.label })))

  return {
    ...stats,
    stopByAsset,
    expectancy: stats.expectancy,
    payoff: stats.avgLoss > 0 ? stats.avgWin / stats.avgLoss : null,
    equity,
    equityLabels,
    drawdown,
    maxDrawdown: Math.abs(maxDD),
    byWeekday,
    byHour,
    bySymbol,
    bySide,
    byMonth,
    rDistribution,
    byLookback,
    byLiquidity,
    byZone,
    byBias,
    tradingDays,
    winningDays,
    losingDays,
    avgDailyPnl,
    dayWinRate,
  }
}

// ---------------------------------------------------------------------------
// Weekly / monthly summary table (per the owner's StonkJournal-style sheet).
// Weeks are numbered from the calendar week in which the month began.
// ---------------------------------------------------------------------------

const HE_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
]

export interface WeekRow {
  key: string
  weekNo: number
  dateRange: string
  trades: number
  winners: number
  losers: number
  points: Record<string, number> // net index points per instrument family
  rSum: number
  winRate: number
}

export interface MonthSummary {
  month: string // YYYY-MM
  label: string // e.g. "נובמבר 2024"
  weeks: WeekRow[]
  total: WeekRow
}

export interface WeeklySummaryData {
  families: string[] // instrument families present, ordered
  months: MonthSummary[]
}

// Instrument family grouping + $ value per 1.0 index point (per contract).
const FAMILY_NAME: Record<string, string> = {
  NQ: 'נאסד״ק',
  MNQ: 'נאסד״ק',
  ES: 'ES',
  MES: 'ES',
  YM: 'דאו',
  MYM: 'דאו',
}
const POINT_VALUE_A: Record<string, number> = { NQ: 20, MNQ: 2, ES: 50, MES: 5, YM: 5, MYM: 0.5 }
const FAMILY_ORDER = ['נאסד״ק', 'ES', 'דאו']

const familyOf = (t: Trade) => FAMILY_NAME[cleanSymbol(t.symbol)] ?? cleanSymbol(t.symbol)

/** Net index-point move for a trade (independent of contract count). */
function pointsOf(t: Trade): number {
  const pv = POINT_VALUE_A[cleanSymbol(t.symbol)]
  if (!pv || !t.qty) return 0
  return t.return_amount / (t.qty * pv)
}

/** Monday (local) of the week containing d. */
function mondayOf(d: Date): Date {
  const day = (d.getDay() + 6) % 7 // 0 = Monday
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - day)
}
const pad = (n: number) => String(n).padStart(2, '0')

function summaryRow(key: string, weekNo: number, dateRange: string, ts: Trade[]): WeekRow {
  let winners = 0
  let losers = 0
  let rSum = 0
  const points: Record<string, number> = {}
  for (const t of ts) {
    if (t.return_amount > 0) winners++
    else if (t.return_amount < 0) losers++
    rSum += t.r_multiple ?? (t.return_amount < 0 ? -1 : 0)
    const fam = familyOf(t)
    points[fam] = (points[fam] ?? 0) + pointsOf(t)
  }
  for (const k of Object.keys(points)) points[k] = Math.round(points[k])
  return {
    key,
    weekNo,
    dateRange,
    trades: ts.length,
    winners,
    losers,
    points,
    rSum: Math.round(rSum * 100) / 100,
    winRate: winners + losers > 0 ? winners / (winners + losers) : 0,
  }
}

export function monthlyWeekSummary(trades: Trade[]): WeeklySummaryData {
  const present = new Set(trades.map(familyOf))
  const families = FAMILY_ORDER.filter((f) => present.has(f))

  // Group trades into Mon–Fri weeks, keyed by the week's Monday.
  const weekMap = new Map<string, Trade[]>()
  for (const t of trades) {
    const m = mondayOf(new Date(t.date))
    const key = `${m.getFullYear()}-${pad(m.getMonth() + 1)}-${pad(m.getDate())}`
    if (!weekMap.has(key)) weekMap.set(key, [])
    weekMap.get(key)!.push(t)
  }

  // Each week belongs to the month of its Friday; build the DD-DD/MM label.
  type W = { mondayKey: string; monthKey: string; label: string; ts: Trade[] }
  const weeks: W[] = [...weekMap.entries()].map(([mondayKey, ts]) => {
    const [y, mo, dd] = mondayKey.split('-').map(Number)
    const monday = new Date(y, mo - 1, dd)
    const friday = new Date(y, mo - 1, dd + 4)
    return {
      mondayKey,
      monthKey: `${friday.getFullYear()}-${pad(friday.getMonth() + 1)}`,
      label: `${pad(monday.getDate())}-${pad(friday.getDate())}/${pad(friday.getMonth() + 1)}`,
      ts,
    }
  })

  // Show every month that has at least one trade…
  const monthsWithTrades = [...new Set(weeks.map((w) => w.monthKey))]

  const months = monthsWithTrades
    .sort((a, b) => b.localeCompare(a))
    .map((mk) => {
      const [year, month] = mk.split('-').map(Number)
      // …and inside it, ALL its Mon–Fri weeks (one per Friday in the month → 4
      // or 5), padding weeks with no trades so every month has equal-height rows.
      const daysInMonth = new Date(year, month, 0).getDate()
      const calWeeks: { mondayKey: string; label: string }[] = []
      for (let d = 1; d <= daysInMonth; d++) {
        const fri = new Date(year, month - 1, d)
        if (fri.getDay() !== 5) continue // Friday only
        const mon = new Date(year, month - 1, d - 4)
        const mondayKey = `${mon.getFullYear()}-${pad(mon.getMonth() + 1)}-${pad(mon.getDate())}`
        calWeeks.push({ mondayKey, label: `${pad(mon.getDate())}-${pad(fri.getDate())}/${pad(fri.getMonth() + 1)}` })
      }
      const weekRows = calWeeks.map((w, i) => summaryRow(`${mk}-W${i + 1}`, i + 1, w.label, weekMap.get(w.mondayKey) ?? []))
      const allTs = calWeeks.flatMap((w) => weekMap.get(w.mondayKey) ?? [])
      return {
        month: mk,
        label: `${HE_MONTHS[month - 1]} ${year}`,
        weeks: weekRows,
        total: summaryRow(`${mk}-total`, 0, '', allTs),
      }
    })

  return { families, months }
}
