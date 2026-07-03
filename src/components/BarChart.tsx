import { useRef, useState } from 'react'
import type { Bucket } from '../lib/analytics'

const textCls: Record<string, string> = {
  win: 'text-win',
  loss: 'text-loss',
  accent: 'text-accent',
}
const baseColor: Record<string, string> = {
  win: '63,207,142',
  loss: '242,109,109',
  accent: '244,169,60',
}

/**
 * Diverging vertical bar chart (zero baseline) with a cursor-following tooltip.
 * Scrolls horizontally when there are more bars than fit, so labels never
 * smear. Positive bars grow up, negative down.
 */
export function BarChart({
  items,
  format,
  height = 130,
  minBarWidth = 42,
}: {
  items: Bucket[]
  format: (v: number) => string
  height?: number
  minBarWidth?: number
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [tip, setTip] = useState<{ i: number; x: number; y: number } | null>(null)

  const posMax = Math.max(0, ...items.map((i) => i.value))
  const negMax = Math.max(0, ...items.map((i) => -i.value))
  const total = posMax + negMax || 1
  const zeroTop = (posMax / total) * 100

  function move(i: number, e: React.MouseEvent) {
    const r = rootRef.current?.getBoundingClientRect()
    if (!r) return
    setTip({ i, x: e.clientX - r.left, y: e.clientY - r.top })
  }

  const h = tip ? items[tip.i] : null
  const rootW = rootRef.current?.offsetWidth ?? 0
  const tipLeft = tip ? Math.max(72, Math.min(tip.x, rootW - 72)) : 0

  return (
    <div ref={rootRef} className="relative">
      {h && tip && (
        <div
          className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-full rounded-lg border border-black/[0.12] bg-surface-2 px-3 py-2 text-center shadow-panel"
          style={{ left: tipLeft, top: tip.y - 12 }}
        >
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted">{h.label}</div>
          <div className={`num text-sm font-bold ${textCls[h.tone ?? (h.value >= 0 ? 'win' : 'loss')]}`}>
            {format(h.value)}
          </div>
          <div className="num text-[10px] text-muted">
            {h.count} עסקאות{h.winRate != null ? ` · ${Math.round(h.winRate * 100)}%` : ''}
          </div>
        </div>
      )}

      <div className="overflow-x-auto pb-1">
        <div style={{ minWidth: items.length * minBarWidth }}>
          <div className="relative" style={{ height }}>
            <div
              className="absolute inset-x-0 border-t border-dashed border-black/[0.12]"
              style={{ top: `${zeroTop}%` }}
            />
            <div className="flex h-full items-stretch gap-2">
              {items.map((it, i) => {
                const positive = it.value >= 0
                const barH = (Math.abs(it.value) / total) * 100
                const tone = it.tone ?? (positive ? 'win' : 'loss')
                const rgb = baseColor[tone]
                return (
                  <div
                    key={it.label + i}
                    className="group relative flex-1 cursor-default"
                    onMouseMove={(e) => move(i, e)}
                    onMouseLeave={() => setTip(null)}
                  >
                    <div
                      className="bar-grow absolute inset-x-[24%] rounded-[3px] transition-opacity"
                      style={{
                        height: `${barH}%`,
                        opacity: tip === null || tip.i === i ? 1 : 0.4,
                        transformOrigin: positive ? 'bottom' : 'top',
                        backgroundImage: `linear-gradient(to ${positive ? 'top' : 'bottom'}, rgba(${rgb},0.12), rgb(${rgb}))`,
                        boxShadow: `0 0 10px -2px rgba(${rgb},0.5)`,
                        ...(positive ? { bottom: `${100 - zeroTop}%` } : { top: `${zeroTop}%` }),
                        ['--i' as string]: i,
                      }}
                    />
                  </div>
                )
              })}
            </div>
          </div>

          <div className="mt-2.5 flex gap-2">
            {items.map((it, i) => (
              <div key={it.label + i} className="flex-1 text-center font-mono text-[11px] text-muted">
                {it.label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
