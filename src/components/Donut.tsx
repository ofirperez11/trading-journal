export interface DonutSegment {
  label: string
  value: number
  color: string
  /** optional legend text shown instead of the default "value · %" */
  sub?: string
}

/**
 * Donut chart with a center stat and a value/percentage legend.
 * Segments sweep in on mount. Good for composition (counts), not P&L.
 * `legendBelow` stacks the legend under the donut (more room in narrow cards).
 */
export function Donut({
  segments,
  centerValue,
  centerLabel,
  size = 150,
  legendBelow = false,
}: {
  segments: DonutSegment[]
  centerValue: string
  centerLabel: string
  size?: number
  legendBelow?: boolean
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1
  const stroke = Math.round(size * 0.13)
  const r = (size - stroke) / 2
  const cx = size / 2
  const cy = size / 2
  const C = 2 * Math.PI * r

  let acc = 0

  const donut = (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={stroke} />
        {segments.map((s, i) => {
          const arc = (s.value / total) * C
          const rotation = (acc / total) * 360
          acc += s.value
          return (
            <circle
              key={s.label}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={stroke}
              strokeDasharray={`${arc} ${C - arc}`}
              transform={`rotate(${rotation} ${cx} ${cy})`}
              className="donut-seg"
              style={{ ['--arc' as string]: arc, animationDelay: `${i * 130}ms` }}
            />
          )
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="num text-2xl font-bold leading-none text-ink">{centerValue}</span>
        <span className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted">{centerLabel}</span>
      </div>
    </div>
  )

  const legend = (
    <div className={`${legendBelow ? 'w-full' : 'flex-1'} space-y-2`}>
      {segments.map((s) => (
        <div key={s.label} className="flex items-center justify-between gap-2 text-sm">
          <span className={s.sub ? 'text-xs text-muted' : 'num text-xs text-muted'}>
            {s.sub ?? `${s.value} · ${Math.round((s.value / total) * 100)}%`}
          </span>
          <span className="flex items-center gap-2">
            <span className="text-muted">{s.label}</span>
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
          </span>
        </div>
      ))}
    </div>
  )

  return legendBelow ? (
    <div className="flex flex-col items-center gap-4">
      {donut}
      {legend}
    </div>
  ) : (
    <div className="flex items-center gap-5">
      {donut}
      {legend}
    </div>
  )
}
