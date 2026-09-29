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
/** The level's distance in R of the trade's stop, or null without a stop. */
export const levelR = (t: Trade, l: PineLevel) => (risk(t) ? l.points / risk(t) : null)

// A level counts as a target only on the trade's side and at least 1:3 away —
// closer ones are shown on the trade page (marked) but left out of the stats
// and filters.
export const MIN_TARGET_R = 3
export const isTarget = (t: Trade, l: PineLevel) => ahead(t, l) && (levelR(t, l) ?? 0) >= MIN_TARGET_R - 1e-9

/** How far price went for the trade by the end of the day (1-minute closes, "מהלך גרף"). */
const eodFor = (t: Trade) => t.chart_move?.['1']?.for ?? null
/** Did price get to the level — during the trade (MFE) or later that day (chart move)? */
export function reachedBy(t: Trade, l: PineLevel): 'trade' | 'eod' | null {
  if (t.mfe != null && t.mfe >= l.points) return 'trade'
  const eod = eodFor(t)
  return eod != null && eod >= l.points ? 'eod' : null
}

const rate = (ts: Trade[]) => {
  const w = ts.filter((t) => t.return_amount > 0).length
  const l = ts.filter((t) => t.return_amount < 0).length
  return { n: w + l, winRate: w + l ? w / (w + l) : null }
}

export interface LevelStats {
  name: string
  on: number // trades where it was a target (trade's side, 1:3+)
  of: number // trades with levels reported
  avgR: number | null // its distance, in R (targets only)
  reached: number // targets that price got to by the end of the day
  reachKnown: number // targets with an MFE or a chart move
  withIt: { n: number; winRate: number | null } // win rate when it was a target
  without: { n: number; winRate: number | null } // …and when it wasn't (missing, the other side, under 1:3)
}

/** Per level name (most often a target first): how far it was and how the trades did with / without it. */
export function levelStats(trades: Trade[]): LevelStats[] {
  const reported = trades.filter((t) => t.pine_levels?.length)
  const names = [...new Set(reported.flatMap((t) => t.pine_levels!.map((l) => l.name)))]
  return names
    .map((name) => {
      const target = (t: Trade) => t.pine_levels!.find((l) => l.name === name && isTarget(t, l)) ?? null
      const on = reported.flatMap((t) => {
        const l = target(t)
        return l ? [{ t, l }] : []
      })
      const rs = on.flatMap(({ t, l }) => {
        const r = levelR(t, l)
        return r == null ? [] : [r]
      })
      const known = on.filter(({ t }) => t.mfe != null || eodFor(t) != null)
      return {
        name,
        on: on.length,
        of: reported.length,
        avgR: rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : null,
        reached: known.filter(({ t, l }) => reachedBy(t, l) != null).length,
        reachKnown: known.length,
        withIt: rate(on.map(({ t }) => t)),
        without: rate(reported.filter((t) => !target(t))),
      }
    })
    .sort((a, b) => b.on - a.on)
}

/** Filter value: "yes" = the level was a target, "no" = it wasn't; null without levels reported. */
export const targetFacetOf = (name: string) => (t: Trade) =>
  !t.pine_levels?.length ? null : t.pine_levels.some((l) => l.name === name && isTarget(t, l)) ? 'yes' : 'no'
