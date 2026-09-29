import type { Trade } from '../types'

// "What if" on target and stop, replayed from each trade's MFE / MAE (Pine).
// Everything is in R of the trade's own stop, so NQ and ES mix fine. For a
// target of T·R and a stop of S × the original stop:
//   win  (+T)  if the MFE reached the target and the adverse move before the
//              peak ("נגד עד השיא") stayed inside the stop — it got there first;
//   loss (−S)  else if the MAE went past the stop;
//   otherwise the trade closed as it did (EOD / BE), capped to [−S, T] —
//   unless it originally exited at its own target / stop and the new level is
//   further away. MFE / MAE only cover the trade while it was open, so what
//   came after is unknown: a stopped trade under a wider stop counts as hitting
//   that wider stop (−S), and a trade that took its target, under a further
//   target, counts 0R.
// When target and stop could both have been hit we can't tell the order, so it
// counts as a loss — the replay leans conservative.

export const STOP_MULTS = [0.5, 0.75, 1, 1.25]
export const TARGET_RS = [1, 1.5, 2, 2.5, 3, 4]
/** Below this many replayable trades the grid isn't shown. */
export const MIN_WHATIF = 5

export interface Replay {
  risk: number // original stop distance, points
  mfe: number
  mae: number
  maeToPeak: number
  realized: number // points actually taken, in the trade's direction
  origTarget: number | null // original target distance, points
}

/** Trades with everything the replay needs (MFE / MAE, stop, exit). */
export function replayable(trades: Trade[]): Replay[] {
  return trades.flatMap((t) => {
    if (t.mfe == null || t.mae == null || t.stoploss == null || t.exit == null) return []
    const risk = Math.abs(t.entry - t.stoploss)
    if (!risk) return []
    const dir = t.side === 'LONG' ? 1 : -1
    const origTarget = t.target == null ? null : Math.abs(t.target - t.entry)
    // Without "against before the peak", assume the whole MAE came first (conservative).
    return [{ risk, mfe: t.mfe, mae: t.mae, maeToPeak: t.mae_to_peak ?? t.mae, realized: (t.exit - t.entry) * dir, origTarget }]
  })
}

/** One trade's result in R (of its original stop) under stop × stopMult and a targetR target. */
export function replay(r: Replay, stopMult: number, targetR: number): number {
  const stop = stopMult * r.risk
  const target = targetR * r.risk
  if (r.mfe >= target && r.maeToPeak < stop) return targetR
  if (r.mae >= stop) return -stopMult
  const eps = 1e-6
  const exitedAtTarget = r.origTarget != null && r.realized >= r.origTarget - eps
  const exitedAtStop = r.realized <= -r.risk + eps
  if (exitedAtStop && stop > r.risk + eps) return -stopMult // unknown after the old stop — assume the worst
  if (exitedAtTarget && target > r.origTarget! + eps) return 0 // unknown after the old target
  return Math.max(-stopMult, Math.min(targetR, r.realized / r.risk))
}

export interface WhatIfCell {
  stopMult: number
  targetR: number
  winRate: number // 0..1, wins / (wins + losses)
  expectancy: number // average R per trade
}

export function whatIfGrid(trades: Trade[]): { n: number; cells: WhatIfCell[][]; best: WhatIfCell | null } {
  const rs = replayable(trades)
  if (rs.length < MIN_WHATIF) return { n: rs.length, cells: [], best: null }
  let best: WhatIfCell | null = null
  const cells = STOP_MULTS.map((stopMult) =>
    TARGET_RS.map((targetR) => {
      const out = rs.map((r) => replay(r, stopMult, targetR))
      const w = out.filter((x) => x > 0).length
      const l = out.filter((x) => x < 0).length
      const cell = { stopMult, targetR, winRate: w + l ? w / (w + l) : 0, expectancy: out.reduce((a, b) => a + b, 0) / out.length }
      if (!best || cell.expectancy > best.expectancy) best = cell
      return cell
    }),
  )
  return { n: rs.length, cells, best }
}
