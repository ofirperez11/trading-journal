import type { Trade } from '../types'

// Break-even analysis (Pine: "ברייק-איבן: הופעל אחרי N דק'" / "לא", and
// optionally "תוצאה בלי ברייק-איבן: …"). MFE / MAE stop at the exit, so what a
// break-even exit gave up can't be replayed — only the indicator knows, via the
// "without break-even" line. Everything else here is measured, not guessed.

const risk = (t: Trade) => (t.stoploss == null ? 0 : Math.abs(t.entry - t.stoploss))
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

export interface BeGroup {
  count: number
  winRate: number | null // wins / (wins + losses)
  avgR: number | null
}
const group = (ts: Trade[]): BeGroup => {
  const w = ts.filter((t) => t.return_amount > 0).length
  const l = ts.filter((t) => t.return_amount < 0).length
  return { count: ts.length, winRate: w + l ? w / (w + l) : null, avgR: mean(ts.flatMap((t) => (t.r_multiple == null ? [] : [t.r_multiple]))) }
}

export interface BreakevenStats {
  on: BeGroup // break-even kicked in
  off: BeGroup // it didn't
  endedAtBe: number // kicked in and the trade came back to 0
  wonAnyway: number // kicked in and the trade still won
  /** By how soon it kicked in: how many came back to 0 vs still won. */
  byMinutes: { label: string; count: number; endedAtBe: number; won: number }[]
  /** Trades that came back to 0: how far they had gone for you first (MFE in R). */
  beExitMfeR: number | null
  /** Pine's "without break-even" result, where reported: total R with vs without. */
  without: { count: number; withR: number; withoutR: number } | null
}

const BUCKETS: { label: string; lo: number; hi: number }[] = [
  { label: '0–5 דק׳', lo: 0, hi: 5 },
  { label: '5–15 דק׳', lo: 5, hi: 15 },
  { label: '15+ דק׳', lo: 15, hi: Infinity },
]

export function breakevenStats(trades: Trade[]): BreakevenStats | null {
  const known = trades.filter((t) => t.be_triggered != null)
  if (!known.length) return null
  const on = known.filter((t) => t.be_triggered)
  const atBe = (t: Trade) => t.status === 'WASH'
  const beExits = on.filter(atBe).flatMap((t) => (t.mfe != null && risk(t) ? [t.mfe / risk(t)] : []))
  const reported = on.filter((t) => t.no_be_points != null && t.r_multiple != null && risk(t))
  return {
    on: group(on),
    off: group(known.filter((t) => !t.be_triggered)),
    endedAtBe: on.filter(atBe).length,
    wonAnyway: on.filter((t) => t.return_amount > 0).length,
    byMinutes: BUCKETS.map((b) => {
      const ts = on.filter((t) => t.be_minutes != null && t.be_minutes >= b.lo && t.be_minutes < b.hi)
      return { label: b.label, count: ts.length, endedAtBe: ts.filter(atBe).length, won: ts.filter((t) => t.return_amount > 0).length }
    }).filter((b) => b.count > 0),
    beExitMfeR: mean(beExits),
    without: reported.length
      ? {
          count: reported.length,
          withR: reported.reduce((s, t) => s + (t.r_multiple ?? 0), 0),
          withoutR: reported.reduce((s, t) => s + t.no_be_points! / risk(t), 0),
        }
      : null,
  }
}
