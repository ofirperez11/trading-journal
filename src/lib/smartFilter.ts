import type { Trade } from '../types'
import { FACETS } from './facets'

// "מסנן חכם": keep as many trades as possible at the highest win rate. Start
// from every trade and, step by step, drop the weakest group — the facet value
// with the lowest win rate. Dropping the worst trades first raises the win rate
// while losing the fewest trades (going for the biggest jump instead would
// happily drop half the journal for a few points). Each step is "without" that
// value (an exclusion), so untagged trades stay. The user picks where to stop —
// more steps = higher win rate, fewer trades. Win rate = wins / (wins + losses),
// BE not counted, as everywhere. "Result" is never dropped.

/** Only a value with at least this many decided trades can be dropped (no chasing 1-trade noise). */
export const MIN_DROP = 5
/** Never go below this many decided trades. */
export const MIN_LEFT = 20
const MAX_STEPS = 12
const SEARCHED = FACETS.filter((f) => f.key !== 'result')

export interface SmartStep {
  drops: { key: string; v: string; label: string }[] // everything dropped so far
  dropped: { key: string; v: string; label: string } | null // this step's drop (null = start)
  winRate: number // 0..1
  trades: number // all trades left (incl. BE)
}

const rate = (ts: Trade[]) => {
  const w = ts.filter((t) => t.return_amount > 0).length
  const l = ts.filter((t) => t.return_amount < 0).length
  return { winRate: w + l ? w / (w + l) : 0, decided: w + l }
}

export function smartSteps(trades: Trade[]): SmartStep[] {
  const labels = new Map(SEARCHED.map((f) => [f.key, new Map(f.options(trades).map((o) => [o.v, o.label]))]))
  let cur = trades
  const steps: SmartStep[] = [{ drops: [], dropped: null, winRate: rate(cur).winRate, trades: cur.length }]
  while (steps.length <= MAX_STEPS) {
    const now = rate(cur).winRate
    let best: { f: (typeof SEARCHED)[number]; v: string; next: Trade[]; winRate: number; groupRate: number } | null = null
    for (const f of SEARCHED) {
      for (const v of new Set(cur.map(f.of))) {
        if (v == null || !labels.get(f.key)?.has(v)) continue
        const g = rate(cur.filter((t) => f.of(t) === v))
        if (g.decided < MIN_DROP || g.winRate >= now) continue // too small, or not dragging the rate down
        const next = cur.filter((t) => f.of(t) !== v)
        const r = rate(next)
        if (r.decided < MIN_LEFT) continue
        // The weakest group first; on a tie, the one that costs fewer trades.
        if (!best || g.winRate < best.groupRate || (g.winRate === best.groupRate && next.length > best.next.length)) {
          best = { f, v, next, winRate: r.winRate, groupRate: g.winRate }
        }
      }
    }
    if (!best || best.winRate <= now + 1e-9) break // nothing left that helps
    const dropped = { key: best.f.key, v: best.v, label: `${best.f.label}: בלי ${labels.get(best.f.key)!.get(best.v)}` }
    cur = best.next
    steps.push({ drops: [...steps[steps.length - 1].drops, dropped], dropped, winRate: best.winRate, trades: cur.length })
  }
  return steps
}
