import type { ChartMove, ChartMoveTf } from '../types'

// "מהלך גרף" — how far price moved for / against the trade on each timeframe
// (by candle close), in points. Written by the Pine Logs report only.

export const CHART_MOVE_TFS: ChartMoveTf[] = ['1', '2', '5', '15', '30']

export const CHART_MOVE_LABEL: Record<ChartMoveTf, string> = {
  '1': 'דקה',
  '2': '2 דקות',
  '5': '5 דקות',
  '15': '15 דקות',
  '30': '30 דקות',
}

function isTf(v: string): v is ChartMoveTf {
  return (CHART_MOVE_TFS as string[]).includes(v)
}

/** Clean a stored value (jsonb / localStorage) into a ChartMove, or null. */
export function normalizeChartMove(raw: unknown): ChartMove | null {
  if (!raw || typeof raw !== 'object') return null
  const out: ChartMove = {}
  for (const [tf, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!isTf(tf) || !v || typeof v !== 'object') continue
    const m = v as Record<string, unknown>
    const pro = Number(m.for)
    const con = Number(m.against)
    if (Number.isFinite(pro) && Number.isFinite(con)) out[tf] = { for: pro, against: con }
  }
  return Object.keys(out).length ? out : null
}

/** "1 דק': בעד 60.75 · נגד 0.00" lines of a Pine report → ChartMove, or null. */
export function parseChartMove(lines: string[]): ChartMove | null {
  const out: ChartMove = {}
  for (const l of lines) {
    const m = l.match(/^(\d+)\s*דק['׳]?\s*:\s*בעד\s*(-?[\d.,]+)\s*[·•]\s*נגד\s*(-?[\d.,]+)/)
    if (!m || !isTf(m[1])) continue
    const pro = Number(m[2].replace(/,/g, ''))
    const con = Number(m[3].replace(/,/g, ''))
    if (Number.isFinite(pro) && Number.isFinite(con)) out[m[1]] = { for: pro, against: con }
  }
  return Object.keys(out).length ? out : null
}
