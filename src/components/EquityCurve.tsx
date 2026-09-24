import { useId, useRef, useState } from 'react'

interface Props {
  data: number[]
  /** kept for API compatibility; the equity line is the amber phosphor by default */
  positive?: boolean
  /** animate the line drawing in on mount */
  draw?: boolean
  /** line/fill color (default amber phosphor) */
  color?: string
  /** format the hovered value (default rounded integer) */
  format?: (n: number) => string
  /** optional x labels (e.g. dates) shown in the hover tooltip */
  labels?: string[]
  className?: string
  height?: number
}

/**
 * SVG area chart with a hover crosshair + tooltip. Used for the equity curve
 * (amber) and the drawdown (red).
 */
export function EquityCurve({
  data,
  draw = false,
  color = '#448361',
  format = (n) => String(Math.round(n)),
  labels,
  className,
  height = 220,
}: Props) {
  const id = useId()
  const ref = useRef<HTMLDivElement>(null)
  const [hi, setHi] = useState<number | null>(null)
  const W = 640
  const H = height
  const pad = 6

  if (data.length < 2) {
    return (
      <div style={{ height }} className={`flex items-center justify-center text-sm text-muted ${className ?? ''}`}>
        אין מספיק נתונים לגרף עדיין
      </div>
    )
  }

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const xOf = (i: number) => (i / (data.length - 1)) * (W - pad * 2) + pad
  const yOf = (v: number) => H - pad - ((v - min) / range) * (H - pad * 2)
  const pts = data.map((v, i) => [xOf(i), yOf(v)] as const)

  let line = `M ${pts[0][0]} ${pts[0][1]}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    const c1x = p1[0] + (p2[0] - p0[0]) / 6
    const c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6
    const c2y = p2[1] - (p3[1] - p1[1]) / 6
    line += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2[0]} ${p2[1]}`
  }
  const area = `${line} L ${W - pad} ${H} L ${pad} ${H} Z`

  function onMove(e: React.MouseEvent) {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const rel = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    setHi(Math.round(rel * (data.length - 1)))
  }

  const hx = hi != null ? (xOf(hi) / W) * 100 : 0
  const hy = hi != null ? (yOf(data[hi]) / H) * 100 : 0

  return (
    <div
      ref={ref}
      className={`relative ${className ?? ''}`}
      style={{ height }}
      onMouseMove={onMove}
      onMouseLeave={() => setHi(null)}
    >
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height }}>
        <defs>
          <linearGradient id={`fill-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#fill-${id})`} className={draw ? 'equity-fill--draw' : undefined} />
        <path
          d={line}
          pathLength={1}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          className={draw ? 'equity-line--draw' : undefined}
        />
      </svg>

      {hi != null && (
        <>
          <div className="pointer-events-none absolute top-0 bottom-0 w-px bg-black/20" style={{ left: `${hx}%` }} />
          <div
            className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-bg"
            style={{ left: `${hx}%`, top: `${hy}%`, background: color }}
          />
          <div
            className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-black/[0.12] bg-surface-2 px-2.5 py-1.5 text-center shadow-panel"
            style={{ left: `${Math.min(88, Math.max(12, hx))}%`, top: `${Math.max(14, hy - 6)}%` }}
          >
            {labels?.[hi] && <div className="font-mono text-[10px] text-muted">{labels[hi]}</div>}
            <div className="num text-sm font-bold" style={{ color }}>
              {format(data[hi])}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/** A believable upward equity sample for previews. */
export const sampleEquity = [
  0, 120, 90, 240, 210, 380, 350, 520, 610, 540, 700, 880, 820, 1010, 1180, 1120,
  1340, 1290, 1520, 1700, 1640, 1880, 2050, 1980, 2230, 2410, 2350, 2620, 2840,
  2780, 3050, 3280, 3210, 3520, 3760, 3690, 4010, 4210,
]
