import type { Trade } from '../types'

// Yes/no marks ticked on a trade (checkboxes above the notes). Stored in the
// trade's `tags`, so adding a mark needs no schema change — just list it here.
export const TRADE_MARKS = ['ATH'] as const
export type TradeMark = (typeof TRADE_MARKS)[number]

export function hasMark(t: Pick<Trade, 'tags'>, mark: TradeMark): boolean {
  return t.tags?.includes(mark) ?? false
}
