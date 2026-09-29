// ---------------------------------------------------------------------------
// Core data model for the trading journal.
// Mirrors the StonkJournal export (data_export/trades.json) and the Supabase
// schema in supabase/schema.sql. Every row is scoped to a user_id (RLS).
// ---------------------------------------------------------------------------

export type TradeSide = 'LONG' | 'SHORT'
export type TradeStatus = 'WIN' | 'LOSS' | 'WASH'
export type MarketType = 'FUTURES' | 'STOCK' | 'OPTION' | 'CRYPTO' | 'FOREX'
export type Liquidity = 'buyside' | 'sellside' | 'none'
export type Zone = 'premium' | 'deadzone' | 'discount'
export type BiasGroup = '6-3' | '3-body90' | '3-wick90' | '6-body90'
export type Bias =
  // 6 → 3
  | '6-3_nn' | '6-3_nw' | '6-3_wn' | '6-3_ww'
  // 3 → body-90
  | '3b90_nn' | '3b90_nw' | '3b90_wn' | '3b90_ww'
  // 3 → wick-90 (90 is wick-only)
  | '3w90_n' | '3w90_w'
  // 6 → body-90 (edge case)
  | '6b90_nn' | '6b90_nw' | '6b90_wn' | '6b90_ww'

/** Chart timeframes (minutes) tracked by the "chart move" field. */
export type ChartMoveTf = '1' | '2' | '5' | '15' | '30'
/** Points price moved for / against the trade on one timeframe (by candle close). */
export interface MoveSplit {
  for: number
  against: number
}
export type ChartMove = Partial<Record<ChartMoveTf, MoveSplit>>
/** A level around the entry from the Pine report ("Td: 29755.00 · 73.50 נק' מתחת"). */
export interface PineLevel {
  name: string // Td / Tny / T23 / Buy Side 5m / …
  price: number
  points: number // distance from the entry
  above: boolean // above the entry (else below)
  /** When price got there: minutes after the entry and the clock time; minutes null = it didn't. Absent in older reports. */
  reach?: { minutes: number | null; at: string | null }
}

/** A single fill that makes up a trade. */
export interface Execution {
  price: number
  qty: number
  action: 'BUY' | 'SELL'
  commission: number
  dateTime: string // ISO
}

export interface Trade {
  id: string
  user_id: string
  account_id: string
  date: string // ISO entry datetime
  symbol: string
  market: MarketType
  side: TradeSide
  status: TradeStatus
  qty: number
  entry: number
  exit: number | null // final exit price (last fill)
  exits: number[] | null // each exit fill price, in order (partials → length > 1)
  target: number | null
  stoploss: number | null
  entry_total: number | null
  exit_total: number | null
  return_amount: number // P&L in account currency
  return_percent: number | null
  r_multiple: number | null
  hold_time: number | null // seconds
  confidence: number | null // 0-5
  lookback: string | null // entry-model time marker, e.g. '16:30' / '5:00'
  lookback_size: number | null // lookback size in points (Pine import or manual)
  mfe: number | null // max favorable excursion during the trade, points (Pine)
  mae: number | null // max adverse excursion during the trade, points (Pine)
  mae_to_peak: number | null // adverse move before the MFE peak, points (Pine)
  be_triggered: boolean | null // did the break-even stop kick in (Pine)
  be_minutes: number | null // minutes after entry it kicked in (Pine)
  no_be_points: number | null // the trade's result without break-even, points (Pine)
  liquidity: Liquidity | null // which side's liquidity was taken
  week_of_month: number | null // week of the month, 1–5
  zone: Zone | null // dealing-range position at entry
  bias: Bias | null // higher-timeframe bias pair used
  chart_move: ChartMove | null // for/against points per timeframe — Pine import only
  lb_touch: boolean | null // price touched the lookback before the session (Pine)
  lb_touch_time: string | null // when it touched, "HH:MM" Israel time (Pine)
  pine_levels: PineLevel[] | null // levels around the entry with their distance — Pine import only
  tags: string[] | null
  notes: string | null
  mood: string | null
  discipline_score: number | null // 0-10
  executions: Execution[] | null
  images: string[] | null // storage paths
  created_at?: string
  updated_at?: string
}

export type ShareRole = 'viewer' | 'editor'

export interface JournalShare {
  email: string
  role: ShareRole
}

export interface Account {
  id: string
  user_id: string
  name: string
  broker: string | null
  currency: string // e.g. 'USD'
  starting_balance: number | null
  is_default: boolean
  shares?: JournalShare[]
  created_at?: string
}

export interface JournalEntry {
  id: string
  user_id: string
  date: string // YYYY-MM-DD
  mood: string | null
  followed_rules: boolean | null
  notes: string | null
  lessons: string | null
  created_at?: string
}

export interface Profile {
  id: string // == auth.users.id
  display_name: string | null
  default_currency: string
  role: 'user' | 'admin'
  created_at?: string
}
