// ---------------------------------------------------------------------------
// Core data model for the trading journal.
// Mirrors the StonkJournal export (data_export/trades.json) and the Supabase
// schema in supabase/schema.sql. Every row is scoped to a user_id (RLS).
// ---------------------------------------------------------------------------

export type TradeSide = 'LONG' | 'SHORT'
export type TradeStatus = 'WIN' | 'LOSS' | 'WASH'
export type MarketType = 'FUTURES' | 'STOCK' | 'OPTION' | 'CRYPTO' | 'FOREX'

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
  tags: string[] | null
  notes: string | null
  mood: string | null
  discipline_score: number | null // 0-10
  executions: Execution[] | null
  images: string[] | null // storage paths
  created_at?: string
  updated_at?: string
}

export interface Account {
  id: string
  user_id: string
  name: string
  broker: string | null
  currency: string // e.g. 'USD'
  starting_balance: number | null
  is_default: boolean
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
