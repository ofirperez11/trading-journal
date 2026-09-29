import type { Trade } from '../types'
import { FACETS } from './facets'

// "הכי מצליח": which filter — one facet value, or a pair from two facets —
// has the highest win rate. Only groups with at least MIN_TRADES decided trades
// (wins + losses; BE doesn't count, like everywhere else) qualify, so a lucky
// 2-for-2 never tops the list. "Result" is left out (filtering by it is trivially 100%).

export const MIN_TRADES = 10
const SEARCHED = FACETS.filter((f) => f.key !== 'result')

export interface BestFilter {
  picks: { key: string; v: string; label: string }[] // one or two facet values
  winRate: number // 0..1
  count: number // wins + losses
  avgR: number | null
}

export function bestFilters(trades: Trade[], top = 5): BestFilter[] {
  const labels = new Map(SEARCHED.map((f) => [f.key, new Map(f.options(trades).map((o) => [o.v, o.label]))]))
  const groups = new Map<string, { picks: BestFilter['picks']; wins: number; losses: number; rSum: number; rN: number }>()
  for (const t of trades) {
    // This trade's value in each facet (only values the menu offers).
    const vals = SEARCHED.flatMap((f) => {
      const v = f.of(t)
      const label = v == null ? undefined : labels.get(f.key)?.get(v)
      return v != null && label ? [{ key: f.key, v, label: `${f.label}: ${label}` }] : []
    })
    const combos = [...vals.map((a) => [a]), ...vals.flatMap((a, i) => vals.slice(i + 1).map((b) => [a, b]))]
    for (const picks of combos) {
      const id = picks.map((p) => `${p.key}=${p.v}`).join('&')
      const g = groups.get(id) ?? { picks, wins: 0, losses: 0, rSum: 0, rN: 0 }
      if (t.return_amount > 0) g.wins++
      else if (t.return_amount < 0) g.losses++
      if (t.r_multiple != null) {
        g.rSum += t.r_multiple
        g.rN++
      }
      groups.set(id, g)
    }
  }
  return [...groups.values()]
    .filter((g) => g.wins + g.losses >= MIN_TRADES)
    .map((g) => ({
      picks: g.picks,
      winRate: g.wins / (g.wins + g.losses),
      count: g.wins + g.losses,
      avgR: g.rN ? g.rSum / g.rN : null,
    }))
    .sort((a, b) => b.winRate - a.winRate || b.count - a.count)
    .slice(0, top)
}
