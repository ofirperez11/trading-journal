import { TrendingUp, TrendingDown } from 'lucide-react'
import type { TradeSide } from '../types'

/**
 * Direction indicator: a neutral trend arrow — trending up for LONG,
 * trending down for SHORT. In a list row it nudges in its direction on
 * hover (`group-hover`); standalone (e.g. trade header) it bobs with `animate`.
 */
export function SideIndicator({ side, animate = false }: { side: TradeSide; animate?: boolean }) {
  const isLong = side === 'LONG'
  const Icon = isLong ? TrendingUp : TrendingDown
  const motion = animate
    ? isLong
      ? 'animate-bob-up'
      : 'animate-bob-down'
    : isLong
      ? 'group-hover:-translate-y-1'
      : 'group-hover:translate-y-1'

  return (
    <span className="inline-flex items-center justify-center text-muted" title={side} aria-label={side}>
      <Icon className={`h-[18px] w-[18px] transition-transform duration-200 ${motion}`} strokeWidth={2.25} />
    </span>
  )
}
