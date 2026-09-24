import type { Trade, Execution, TradeSide, TradeStatus, MarketType } from '../types'

// ---------------------------------------------------------------------------
// Trade normalization + analytics.
// Works on the StonkJournal export shape today (demo) and the Supabase row
// shape later — both go through `normalizeTrade`.
// ---------------------------------------------------------------------------

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * Resolve true entry + exit prices from the fills, in trade-direction terms.
 * StonkJournal stored entry/exit as buy/sell averages, which (a) smears
 * partial exits into an ugly weighted average and (b) reads reversed for
 * shorts. Deriving from executions fixes both.
 */
function pricesFromExecutions(
  side: TradeSide,
  executions: Execution[],
  fallbackEntry: number,
  fallbackExit: number | null,
): { entry: number; exits: number[] } {
  if (!executions.length) {
    return { entry: fallbackEntry, exits: fallbackExit != null ? [fallbackExit] : [] }
  }
  const openAction = side === 'LONG' ? 'BUY' : 'SELL'
  const opens = executions.filter((e) => String(e.action).toUpperCase() === openAction)
  const closes = executions.filter((e) => String(e.action).toUpperCase() !== openAction)

  // Single entry fill in practice; weighted-average defensively if more.
  let entry = fallbackEntry
  if (opens.length) {
    const q = opens.reduce((s, e) => s + Number(e.qty), 0)
    entry = q ? Math.round((opens.reduce((s, e) => s + Number(e.price) * Number(e.qty), 0) / q) * 100) / 100 : Number(opens[0].price)
  }
  const exits = closes.map((e) => Number(e.price)).filter((n) => Number.isFinite(n))
  return { entry, exits: exits.length ? exits : fallbackExit != null ? [fallbackExit] : [] }
}

/** Normalize one raw record (loose shape) into a clean Trade. */
export function normalizeTrade(raw: Record<string, unknown>): Trade {
  const side = String(raw.side ?? 'LONG') as TradeSide
  const executions = Array.isArray(raw.executions) ? (raw.executions as Execution[]) : []
  const { entry, exits } = pricesFromExecutions(side, executions, num(raw.entry) ?? 0, num(raw.exit))

  return {
    id: String(raw.id ?? crypto.randomUUID()),
    user_id: String(raw.user_id ?? 'demo-user'),
    account_id: String(raw.account_id ?? ''),
    date: String(raw.date ?? ''),
    symbol: String(raw.symbol ?? ''),
    market: (String(raw.market ?? 'FUTURES') as MarketType),
    side,
    status: (String(raw.status ?? 'WASH') as TradeStatus),
    qty: num(raw.qty) ?? 0,
    entry,
    exit: exits.length ? exits[exits.length - 1] : null,
    exits: exits.length ? exits : null,
    target: num(raw.target),
    stoploss: num(raw.stoploss),
    entry_total: num(raw.entry_total),
    exit_total: num(raw.exit_total),
    return_amount: num(raw.return_amount) ?? 0,
    return_percent: num(raw.return_percent),
    r_multiple: num(raw.r_multiple),
    hold_time: num(raw.hold_time),
    confidence: num(raw.confidence),
    lookback: raw.lookback ? String(raw.lookback) : null,
    liquidity: (raw.liquidity as Trade['liquidity']) ?? null,
    zone: (raw.zone as Trade['zone']) ?? null,
    bias: (raw.bias as Trade['bias']) ?? null,
    tags: Array.isArray(raw.tags) ? (raw.tags as string[]) : null,
    notes: raw.notes ? String(raw.notes) : null,
    mood: raw.mood ? String(raw.mood) : null,
    discipline_score: num(raw.discipline_score),
    executions: Array.isArray(raw.executions) ? (raw.executions as Execution[]) : null,
    images: Array.isArray(raw.images) ? (raw.images as string[]) : null,
  }
}

/** Symbol without the trailing contract digit (MNQ1 → MNQ) for grouping. */
export function cleanSymbol(symbol: string): string {
  return symbol.replace(/\d+$/, '') || symbol
}

export interface Stats {
  totalTrades: number
  wins: number
  losses: number
  washes: number
  winRate: number // 0..1, over win+loss
  netPnl: number
  grossProfit: number
  grossLoss: number // positive number
  profitFactor: number | null
  avgWin: number
  avgLoss: number // positive
  avgWinLossRatio: number | null
  expectancy: number // avg P&L per trade
  bestTrade: number
  worstTrade: number
  maxWinStreak: number
  maxLossStreak: number
}

export function computeStats(trades: Trade[]): Stats {
  const total = trades.length
  let wins = 0
  let losses = 0
  let washes = 0
  let grossProfit = 0
  let grossLoss = 0
  let winSum = 0
  let winN = 0
  let lossSum = 0
  let lossN = 0
  let best = 0
  let worst = 0

  for (const t of trades) {
    if (t.status === 'WIN') wins++
    else if (t.status === 'LOSS') losses++
    else washes++

    const p = t.return_amount
    if (p > 0) {
      grossProfit += p
      winSum += p
      winN++
    } else if (p < 0) {
      grossLoss += -p
      lossSum += -p
      lossN++
    }
    if (p > best) best = p
    if (p < worst) worst = p
  }

  // streaks in chronological order
  const chron = [...trades].sort((a, b) => a.date.localeCompare(b.date))
  let maxWin = 0
  let maxLoss = 0
  let curWin = 0
  let curLoss = 0
  for (const t of chron) {
    if (t.return_amount > 0) {
      curWin++
      curLoss = 0
      maxWin = Math.max(maxWin, curWin)
    } else if (t.return_amount < 0) {
      curLoss++
      curWin = 0
      maxLoss = Math.max(maxLoss, curLoss)
    }
  }

  const netPnl = grossProfit - grossLoss
  return {
    totalTrades: total,
    wins,
    losses,
    washes,
    winRate: wins + losses > 0 ? wins / (wins + losses) : 0,
    netPnl,
    grossProfit,
    grossLoss,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : null,
    avgWin: winN > 0 ? winSum / winN : 0,
    avgLoss: lossN > 0 ? lossSum / lossN : 0,
    avgWinLossRatio: lossN > 0 && winN > 0 ? winSum / winN / (lossSum / lossN) : null,
    expectancy: total > 0 ? netPnl / total : 0,
    bestTrade: best,
    worstTrade: worst,
    maxWinStreak: maxWin,
    maxLossStreak: maxLoss,
  }
}

/** Cumulative P&L over time (chronological), starting at 0. */
export function buildEquityCurve(trades: Trade[]): number[] {
  const chron = [...trades].sort((a, b) => a.date.localeCompare(b.date))
  const out: number[] = [0]
  let acc = 0
  for (const t of chron) {
    acc += t.return_amount
    out.push(acc)
  }
  return out
}

// --- formatting helpers ----------------------------------------------------

export function formatMoney(v: number, withSign = true): string {
  const sign = v > 0 && withSign ? '+' : v < 0 ? '-' : ''
  const abs = Math.abs(v)
  return `${sign}$${abs.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

export function formatPct(v: number): string {
  return `${(v * 100).toFixed(0)}%`
}

const MONTHS_HE_FULL = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
]

/**
 * Format a stored trade datetime EXACTLY as entered — no timezone conversion.
 * The `date` column is a timestamptz, but the wall-clock (e.g. 16:30) IS the
 * meaningful value, so we read the string parts directly instead of `new Date`.
 */
export function formatTradeDateTime(iso: string): string {
  const mo = Number(iso.slice(5, 7))
  const day = Number(iso.slice(8, 10))
  const year = iso.slice(0, 4)
  const time = iso.slice(11, 16)
  const date = `${day} ב${MONTHS_HE_FULL[mo - 1] ?? ''} ${year}`
  return time ? `${date} · ${time}` : date
}

/** R-multiple, rounded to 2 decimals, signed (e.g. "+3.05R", "-1R"). */
export function formatR(r: number | null): string {
  if (r == null) return '—'
  const rounded = Math.round(r * 100) / 100
  return `${rounded > 0 ? '+' : ''}${rounded}R`
}

/** Resolve a stored image path to a servable URL (demo serves from /demo). */
export function imageUrl(path: string): string {
  if (path.startsWith('http') || path.startsWith('data:')) return path
  return `/demo/${path}`
}
