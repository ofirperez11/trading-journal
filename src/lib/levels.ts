import type { PineLevel, Trade } from '../types'

// Pine's "יעדים (מרחק מהכניסה)" block — price levels around the entry
// (Td, Tny, T23, Buy Side 5m, …) with their distance, one per row:
//   "Td: 29755.00 · 73.50 נק' מתחת"
// and the "נגיעה בלוקבק לפני 16:30: כן (08:33)" line. Pine import only.

/** A level row of the report: name, price, distance in points, above / below the entry. */
export const LEVEL_ROW = /^(.+?):\s*(-?[\d.,]+)\s*·\s*([\d.,]+)\s*נק['׳]?\s*(מעל|מתחת)/
/** "נגיעה בלוקבק לפני 16:30: כן (08:33)" — the session in the label varies. */
export const LB_TOUCH_ROW = /^נגיעה בלוקבק(?:\s+לפני\s+\d{1,2}:\d{2})?\s*:\s*(.*)$/

const num = (s: string) => Number(s.replace(/,/g, ''))

export function parseLevels(lines: string[]): PineLevel[] | null {
  const out = lines.flatMap((l) => {
    const m = l.match(LEVEL_ROW)
    if (!m) return []
    const price = num(m[2])
    const points = num(m[3])
    return Number.isFinite(price) && Number.isFinite(points) ? [{ name: m[1].trim(), price, points, above: m[4] === 'מעל' }] : []
  })
  return out.length ? out : null
}

export function parseLbTouch(lines: string[]): { lbTouch: boolean | null; lbTouchTime: string | null } {
  const value = lines.map((l) => l.match(LB_TOUCH_ROW)?.[1]).find((v) => v != null)?.trim() ?? ''
  if (value.startsWith('כן')) return { lbTouch: true, lbTouchTime: value.match(/(\d{1,2}:\d{2})/)?.[1] ?? null }
  if (value.startsWith('לא')) return { lbTouch: false, lbTouchTime: null }
  return { lbTouch: null, lbTouchTime: null }
}

/** Clean a stored value (jsonb / localStorage) into levels, or null. */
export function normalizeLevels(raw: unknown): PineLevel[] | null {
  if (!Array.isArray(raw)) return null
  const out = raw.flatMap((v) => {
    if (!v || typeof v !== 'object') return []
    const m = v as Record<string, unknown>
    const price = Number(m.price)
    const points = Number(m.points)
    return typeof m.name === 'string' && Number.isFinite(price) && Number.isFinite(points)
      ? [{ name: m.name, price, points, above: m.above === true }]
      : []
  })
  return out.length ? out : null
}

/** Is the level on the trade's side — where the trade goes to profit? */
export const ahead = (t: Trade, l: PineLevel) => (t.side === 'LONG') === l.above

const risk = (t: Trade) => (t.stoploss == null ? 0 : Math.abs(t.entry - t.stoploss))
const targetPts = (t: Trade) => (t.target == null ? null : Math.abs(t.target - t.entry))
const rate = (ts: Trade[]) => {
  const w = ts.filter((t) => t.return_amount > 0).length
  const l = ts.filter((t) => t.return_amount < 0).length
  return { n: w + l, winRate: w + l ? w / (w + l) : null }
}

export interface LevelStats {
  name: string
  trades: number // trades that report this level
  ahead: number // …with it on the trade's side
  avgR: number | null // its distance, in R of the trade's stop (ahead only)
  reached: number // ahead and the MFE got there during the trade
  reachKnown: number // ahead, with an MFE
  /** Ahead and closer than the trade's target — it stands in the way. */
  before: { n: number; winRate: number | null }
  /** Ahead and at / past the target — room to the target. */
  after: { n: number; winRate: number | null }
}

/** Per level name (most reported first): where it sits and how the trades did around it. */
export function levelStats(trades: Trade[]): LevelStats[] {
  const names = new Map<string, number>()
  for (const t of trades) for (const l of t.pine_levels ?? []) names.set(l.name, (names.get(l.name) ?? 0) + 1)
  return [...names.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => {
      const rows = trades.flatMap((t) => (t.pine_levels ?? []).filter((l) => l.name === name).map((l) => ({ t, l })))
      const on = rows.filter(({ t, l }) => ahead(t, l))
      const rs = on.flatMap(({ t, l }) => (risk(t) ? [l.points / risk(t)] : []))
      const withMfe = on.filter(({ t }) => t.mfe != null)
      const withTarget = on.filter(({ t }) => targetPts(t) != null)
      return {
        name,
        trades: rows.length,
        ahead: on.length,
        avgR: rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : null,
        reached: withMfe.filter(({ t, l }) => t.mfe! >= l.points).length,
        reachKnown: withMfe.length,
        before: rate(withTarget.filter(({ t, l }) => l.points < targetPts(t)! - 1e-6).map(({ t }) => t)),
        after: rate(withTarget.filter(({ t, l }) => l.points >= targetPts(t)! - 1e-6).map(({ t }) => t)),
      }
    })
}
