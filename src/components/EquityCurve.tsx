import { useId } from 'react'

interface Props {
  data: number[]
  /** color theme of the line + fill */
  positive?: boolean
  className?: string
  height?: number
}

/**
 * Lightweight SVG area chart for an equity curve. No chart library yet —
 * this renders a smooth gradient area from a series of cumulative values.
 */
export function EquityCurve({ data, positive = true, className, height = 220 }: Props) {
  const id = useId()
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

  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * (W - pad * 2) + pad
    const y = H - pad - ((v - min) / range) * (H - pad * 2)
    return [x, y] as const
  })

  // Smooth path via Catmull-Rom → cubic bezier
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

  const color = positive ? '#34d399' : '#f87171'

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={className}
      style={{ width: '100%', height }}
    >
      <defs>
        <linearGradient id={`fill-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#fill-${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

/** A believable upward equity sample for previews. */
export const sampleEquity = [
  0, 120, 90, 240, 210, 380, 350, 520, 610, 540, 700, 880, 820, 1010, 1180, 1120,
  1340, 1290, 1520, 1700, 1640, 1880, 2050, 1980, 2230, 2410, 2350, 2620, 2840,
  2780, 3050, 3280, 3210, 3520, 3760, 3690, 4010, 4210,
]
