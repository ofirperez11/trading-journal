import type { PineLevel, Trade } from '../types'

// Pine's "יעדים (מרחק וזמן מהכניסה)" block — price levels around the entry
// (Td, Tny, T23, Buy Side 5m, …) with their distance and when price got
// there, one per row (older reports have no time):
//   "Td: 29755.00 · 73.50 נק' מתחת · הגיע אחרי 31 דק' (17:01)"
//   "Buy Side 5m: 29853.00 · 24.50 נק' מעל · לא הגיע"
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
    if (!Number.isFinite(price) || !Number.isFinite(points)) return []
    const level: PineLevel = { name: m[1].trim(), price, points, above: m[4] === 'מעל' }
    const rest = l.slice(m[0].length)
    const after = rest.match(/הגיע אחרי\s*(\d+(?:\.\d+)?)\s*דק/)
    if (/לא הגיע/.test(rest)) level.reach = { minutes: null, at: null }
    else if (after) level.reach = { minutes: num(after[1]), at: rest.match(/\((\d{1,2}:\d{2})\)/)?.[1] ?? null }
    return [level]
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
    if (typeof m.name !== 'string' || !Number.isFinite(price) || !Number.isFinite(points)) return []
    const level: PineLevel = { name: m.name, price, points, above: m.above === true }
    if (m.reach && typeof m.reach === 'object') {
      const r = m.reach as Record<string, unknown>
      level.reach = {
        minutes: typeof r.minutes === 'number' && Number.isFinite(r.minutes) ? r.minutes : null,
        at: typeof r.at === 'string' ? r.at : null,
      }
    }
    return [level]
  })
  return out.length ? out : null
}

// The stats count a level as reached only within this many minutes of the entry.
export const REACH_WINDOW_MIN = 30
/** Reached within the window — or null when the report has no time for it. */
export const reachedInWindow = (l: PineLevel) => (l.reach ? l.reach.minutes != null && l.reach.minutes <= REACH_WINDOW_MIN : null)

/** Is the level on the trade's side — where the trade goes to profit? */
export const ahead = (t: Trade, l: PineLevel) => (t.side === 'LONG') === l.above
/** A liquidity level (Buy Side 5m / Sell Side 5m) rather than a target (Td / Tny / T23). */
export const isLiquidityLevel = (l: PineLevel) => /\bside\b/i.test(l.name)

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
  reached: number // targets price got to within REACH_WINDOW_MIN of the entry
  reachKnown: number // targets whose report says when (or that it didn't)
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
      const known = on.filter(({ l }) => reachedInWindow(l) != null)
      return {
        name,
        on: on.length,
        of: reported.length,
        avgR: rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : null,
        reached: known.filter(({ l }) => reachedInWindow(l)).length,
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
