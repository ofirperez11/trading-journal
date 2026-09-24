import { useMemo } from 'react'
import { useTrades } from '../lib/useTrades'
import { imageUrl } from '../lib/trades'

/**
 * Full-width page cover for the dashboard — the chart screenshot of the most
 * recent trade that has one. Falls back to a quiet neutral band.
 */
export function DashboardCover() {
  const { trades } = useTrades()
  const src = useMemo(() => {
    const t = [...trades]
      .filter((x) => x.images && x.images.length > 0)
      .sort((a, b) => b.date.localeCompare(a.date))[0]
    return t ? imageUrl(t.images![0]) : null
  }, [trades])

  return (
    <div className="relative h-[140px] overflow-hidden bg-[#e9e8e4] sm:h-[200px]">
      {src && (
        <img
          src={src}
          alt=""
          className="h-full w-full animate-[fade-up_0.8s_ease_both] object-cover"
          style={{ objectPosition: '50% 32%', filter: 'saturate(0.85)' }}
        />
      )}
    </div>
  )
}
