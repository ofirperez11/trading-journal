import type { Bucket } from '../lib/analytics'

const barColor: Record<string, string> = {
  win: '#34c759',
  loss: '#ff3b30',
  accent: '#0066cc',
}
const textCls: Record<string, string> = {
  win: 'text-win',
  loss: 'text-loss',
  accent: 'text-accent',
}

/**
 * Horizontal bars — clean and readable for a few categories (symbol, side).
 * Bar length is proportional to |value|; color encodes win/loss.
 */
export function HBars({ items, format }: { items: Bucket[]; format: (v: number) => string }) {
  const max = Math.max(...items.map((i) => Math.abs(i.value)), 1)
  return (
    <div className="space-y-4">
      {items.map((it, i) => {
        const tone = it.tone ?? (it.value >= 0 ? 'win' : 'loss')
        const w = (Math.abs(it.value) / max) * 100
        return (
          <div key={it.label}>
            <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
              <span className="flex items-baseline gap-2">
                <span className="font-semibold text-ink">{it.label}</span>
                <span className="num text-xs text-muted">
                  {it.count}
                  {it.winRate != null ? ` · ${Math.round(it.winRate * 100)}%` : ''}
                </span>
              </span>
              <span className={`num font-semibold ${textCls[tone]}`}>{format(it.value)}</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-black/[0.04]">
              <div
                className="bar-grow-x h-full rounded-full"
                style={{ width: `${w}%`, background: barColor[tone], ['--i' as string]: i }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
