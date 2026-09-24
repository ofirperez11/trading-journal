import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Bucket } from '../../lib/analytics'

// ---------------------------------------------------------------------------
// Chart kit for the analytics page. One visual language: hairline solid grids,
// 2px lines, ≤24px bars with a 4px rounded data-end, a white tooltip, and a
// draw/grow animation that plays when the chart scrolls into view.
// Colours were run through the dataviz palette validator (light surface).
// ---------------------------------------------------------------------------

export const CHART = {
  win: '#2f855a', // profit marks
  loss: '#c9503d', // loss marks
  winText: '#27704b', // profit numbers (≥4.5:1 on white)
  lossText: '#b4432f',
  cat1: '#2b7fd0', // categorical slot 1 (blue)
  cat2: '#d9730d', // categorical slot 2 (orange)
  neutral: '#c9c7c1', // neutral / BE
  grid: '#efeeec',
  axis: '#8a8984',
  ink: '#37352f',
}

export const toneColor = (v: number) => (v >= 0 ? CHART.win : CHART.loss)

const reduceMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** True once the element has scrolled (20%) into view — animations wait for it. */
export function useInView<T extends Element>(): [React.RefObject<T>, boolean] {
  const ref = useRef<T>(null)
  const [seen, setSeen] = useState(() => reduceMotion() || typeof IntersectionObserver === 'undefined')
  useEffect(() => {
    if (seen || !ref.current) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setSeen(true)
          io.disconnect()
        }
      },
      { threshold: 0.2 },
    )
    io.observe(ref.current)
    return () => io.disconnect()
  }, [seen])
  return [ref, seen]
}

/** Width of an element in CSS px, kept current with a ResizeObserver. */
function useWidth<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null)
  const [w, setW] = useState(0)
  useLayoutEffect(() => {
    if (!ref.current) return
    setW(ref.current.clientWidth)
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

/** Round axis ticks: 0 / 1K / 2K … covering [min, max]. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) max = min + 1
  const span = max - min
  const raw = span / count
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= count) ?? 10 * mag
  const lo = Math.floor(min / step) * step
  const hi = Math.ceil(max / step) * step
  const out: number[] = []
  for (let v = lo; v <= hi + step / 2; v += step) out.push(Math.round(v * 1e6) / 1e6)
  return out
}

export const compactMoney = (v: number) => {
  const a = Math.abs(v)
  const s = v < 0 ? '-' : ''
  if (a >= 1000) return `${s}$${(a / 1000).toFixed(a >= 10000 || a % 1000 === 0 ? 0 : 1)}K`
  return `${s}$${Math.round(a)}`
}

/** Floating tooltip, clamped inside its chart. */
function Tip({ x, y, width, children }: { x: number; y: number; width: number; children: ReactNode }) {
  const left = Math.max(70, Math.min(x, width - 70))
  return (
    <div
      className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-border bg-bg px-3 py-2 text-center shadow-[0_8px_24px_-8px_rgba(15,15,15,.25)]"
      style={{ left, top: y - 10 }}
      dir="rtl"
    >
      {children}
    </div>
  )
}

/* ---- Line / area -------------------------------------------------------- */

/**
 * Time-series line. `mode="equity"` fills a light wash under the line and
 * marks the peak; `mode="underwater"` hangs from 0 downward (drawdown).
 * Chronological left→right regardless of page direction.
 */
export function LineChart({
  data,
  labels,
  height = 240,
  color = CHART.win,
  mode = 'equity',
  format,
  showXAxis = true,
}: {
  data: number[]
  labels?: string[]
  height?: number
  color?: string
  mode?: 'equity' | 'underwater'
  format: (n: number) => string
  showXAxis?: boolean
}) {
  const [wrapRef, width] = useWidth<HTMLDivElement>()
  const [viewRef, play] = useInView<HTMLDivElement>()
  const [hi, setHi] = useState<number | null>(null)

  const padL = 48
  const padR = 12
  const padT = 12
  const padB = 8
  const W = Math.max(width, 200)
  const H = height

  const { ticks, lo, hi: top } = useMemo(() => {
    const mn = Math.min(0, ...data)
    const mx = Math.max(0, ...data)
    const t = niceTicks(mn, mx, mode === 'underwater' ? 2 : 4)
    return { ticks: t, lo: t[0], hi: t[t.length - 1] }
  }, [data, mode])

  if (data.length < 2) {
    return <div className="flex items-center justify-center text-sm text-muted" style={{ height }}>אין מספיק נתונים לגרף</div>
  }

  const xOf = (i: number) => padL + (i / (data.length - 1)) * (W - padL - padR)
  const yOf = (v: number) => padT + (1 - (v - lo) / (top - lo || 1)) * (H - padT - padB)
  let line = ''
  data.forEach((v, i) => (line += `${i ? 'L' : 'M'}${xOf(i).toFixed(1)} ${yOf(v).toFixed(1)}`))
  const zeroY = yOf(0)
  const area = `${line}L${xOf(data.length - 1)} ${zeroY}L${xOf(0)} ${zeroY}Z`

  let peakI = 0
  data.forEach((v, i) => {
    if (mode === 'equity' ? v > data[peakI] : v < data[peakI]) peakI = i
  })

  const xTicks = labels
    ? [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * (data.length - 1)))
    : []

  function onMove(e: React.MouseEvent) {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const rel = (e.clientX - r.left - padL) / (r.width - padL - padR)
    setHi(Math.max(0, Math.min(data.length - 1, Math.round(rel * (data.length - 1)))))
  }

  return (
    <div ref={viewRef}>
      <div
        ref={wrapRef}
        dir="ltr"
        className="relative select-none"
        style={{ height }}
        onMouseMove={onMove}
        onMouseLeave={() => setHi(null)}
      >
        {width > 0 && (
          <svg width={W} height={H} className="block overflow-visible">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={padL} x2={W - padR} y1={yOf(t)} y2={yOf(t)} stroke={t === 0 ? '#dcdad5' : CHART.grid} />
                <text x={padL - 8} y={yOf(t) + 4} textAnchor="end" fontSize="11" fill={CHART.axis} className="tabular-nums">
                  {compactMoney(t)}
                </text>
              </g>
            ))}
            <path
              d={area}
              fill={color}
              fillOpacity={mode === 'equity' ? 0.09 : 0.14}
              style={{ opacity: play ? 1 : 0, transition: 'opacity 1s ease .6s' }}
            />
            <path
              d={line}
              pathLength={1}
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              style={{
                strokeDasharray: 1,
                strokeDashoffset: play ? 0 : 1,
                transition: 'stroke-dashoffset 1.6s cubic-bezier(.65,0,.35,1)',
              }}
            />
            {/* Peak (equity) or deepest point (drawdown), direct-labelled */}
            <g style={{ opacity: play ? 1 : 0, transition: 'opacity .4s ease 1.5s' }}>
              <circle cx={xOf(peakI)} cy={yOf(data[peakI])} r={4} fill={color} stroke="#fff" strokeWidth={2} />
            </g>
            {hi != null && (
              <g>
                <line x1={xOf(hi)} x2={xOf(hi)} y1={padT} y2={H - padB} stroke="#cfcdc8" />
                <circle cx={xOf(hi)} cy={yOf(data[hi])} r={5} fill={color} stroke="#fff" strokeWidth={2} />
              </g>
            )}
          </svg>
        )}
        {width > 0 && (
          <div
            className="pointer-events-none absolute whitespace-nowrap text-[11px] font-semibold text-ink"
            style={{
              left: Math.min(xOf(peakI), W - 60),
              top: mode === 'equity' ? yOf(data[peakI]) - 22 : yOf(data[peakI]) + 8,
              transform: 'translateX(-50%)',
              opacity: play && hi == null ? 1 : 0,
              transition: 'opacity .4s ease',
            }}
          >
            {mode === 'equity' ? 'שיא ' : 'הכי עמוק '}
            <span className="tabular-nums">{format(data[peakI])}</span>
          </div>
        )}
        {hi != null && width > 0 && (
          <Tip x={xOf(hi)} y={yOf(data[hi])} width={W}>
            {labels?.[hi] && <div className="text-[11px] text-muted">{labels[hi]}{hi > 0 && ` · עסקה ${hi}`}</div>}
            <div dir="ltr" className="text-sm font-bold tabular-nums" style={{ color: data[hi] < 0 ? CHART.lossText : CHART.ink }}>
              {format(data[hi])}
            </div>
          </Tip>
        )}
      </div>
      {showXAxis && labels && width > 0 && (
        <div dir="ltr" className="relative mt-1.5 h-4 text-[11px] text-[#8a8984]">
          {xTicks.map((i, k) => (
            <span
              key={k}
              className="absolute tabular-nums"
              style={{ left: xOf(i), transform: k === 0 ? 'none' : k === xTicks.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)' }}
            >
              {labels[i]}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/* ---- Vertical columns (diverging around 0) ------------------------------ */

export function Columns({
  items,
  format,
  height = 180,
  colorOf,
  meta,
  highlight = true,
  minSlot = 30,
  tick,
}: {
  items: Bucket[]
  format: (v: number) => string
  height?: number
  /** override bar colour (default: by sign) */
  colorOf?: (b: Bucket, i: number) => string
  /** extra tooltip line */
  meta?: (b: Bucket) => string
  /** direct-label the best & worst column */
  highlight?: boolean
  minSlot?: number
  /** custom x-axis label (e.g. month + year on January) */
  tick?: (b: Bucket, i: number) => ReactNode
}) {
  const [viewRef, play] = useInView<HTMLDivElement>()
  const [hi, setHi] = useState<number | null>(null)
  const [tip, setTip] = useState<{ x: number; y: number; w: number } | null>(null)
  // When the columns overflow (many months on a phone), open on the latest.
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [items.length])

  const mn = Math.min(0, ...items.map((i) => i.value))
  const mx = Math.max(0, ...items.map((i) => i.value))
  const ticks = niceTicks(mn, mx, 3)
  const lo = ticks[0]
  const top = ticks[ticks.length - 1]
  const yPct = (v: number) => (1 - (v - lo) / (top - lo || 1)) * 100
  const zero = yPct(0)

  const best = items.reduce((b, it, i) => (it.value > items[b].value ? i : b), 0)
  const worst = items.reduce((b, it, i) => (it.value < items[b].value ? i : b), 0)
  const axisW = 44

  return (
    <div ref={viewRef} dir="ltr" className="relative">
      <div className="flex">
        {/* y axis */}
        <div className="relative shrink-0" style={{ width: axisW, height }}>
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute right-2 -translate-y-1/2 text-[11px] tabular-nums text-[#8a8984]"
              style={{ top: `${yPct(t)}%` }}
            >
              {compactLike(format, t)}
            </span>
          ))}
        </div>
        <div ref={scrollRef} className="min-w-0 flex-1 overflow-x-auto overflow-y-visible">
          <div style={{ minWidth: items.length * minSlot }}>
            <div className="relative" style={{ height }}>
              {ticks.map((t) => (
                <div
                  key={t}
                  className="absolute inset-x-0 h-px"
                  style={{ top: `${yPct(t)}%`, background: t === 0 ? '#dcdad5' : CHART.grid }}
                />
              ))}
              <div className="absolute inset-0 flex" data-plot>
                {items.map((it, i) => {
                  const pos = it.value >= 0
                  const h = Math.abs(yPct(it.value) - zero)
                  const c = colorOf ? colorOf(it, i) : toneColor(it.value)
                  const label = highlight && items.length > 2 && (i === best || (i === worst && it.value < 0))
                  return (
                    <div
                      key={it.label + i}
                      className="relative flex-1"
                      onMouseEnter={() => setHi(i)}
                      onMouseMove={(e) => {
                        const r = (e.currentTarget.closest('[data-plot]') as HTMLElement).getBoundingClientRect()
                        setTip({ x: e.clientX - r.left, y: e.clientY - r.top, w: r.width })
                      }}
                      onMouseLeave={() => {
                        setHi(null)
                        setTip(null)
                      }}
                    >
                      {hi === i && <div className="absolute inset-y-0 inset-x-[8%] rounded bg-[#f5f4f1]" />}
                      <div
                        className="absolute left-1/2 w-[62%] max-w-[24px] -translate-x-1/2"
                        style={{
                          height: `${h}%`,
                          ...(pos ? { bottom: `${100 - zero}%` } : { top: `${zero}%` }),
                          background: c,
                          borderRadius: pos ? '4px 4px 0 0' : '0 0 4px 4px',
                          transformOrigin: pos ? 'bottom' : 'top',
                          transform: `translateX(-50%) scaleY(${play ? 1 : 0})`,
                          transition: `transform .7s cubic-bezier(.16,1,.3,1) ${i * 35}ms, opacity .15s`,
                          opacity: hi == null || hi === i ? 1 : 0.4,
                        }}
                      />
                      {label && (
                        <span
                          className="pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-semibold tabular-nums text-ink"
                          style={{
                            ...(pos ? { bottom: `calc(${100 - zero + h}% + 4px)` } : { top: `calc(${zero + h}% + 4px)` }),
                            opacity: play && hi == null ? 1 : 0,
                            transition: 'opacity .4s ease .8s',
                          }}
                        >
                          {format(it.value)}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="mt-2 flex">
              {items.map((it, i) => (
                <span
                  key={it.label + i}
                  className={`flex-1 whitespace-nowrap text-center text-[11px] leading-tight ${hi === i ? 'font-semibold text-ink' : 'text-[#8a8984]'}`}
                >
                  {tick ? tick(it, i) : it.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
      {hi != null && tip && (
        <Tip x={tip.x + axisW} y={tip.y} width={tip.w + axisW}>
          <div className="text-[11px] text-muted">{items[hi].label}</div>
          <div dir="ltr" className="text-sm font-bold tabular-nums" style={{ color: items[hi].value < 0 ? CHART.lossText : CHART.ink }}>
            {format(items[hi].value)}
          </div>
          <div className="text-[11px] text-muted">
            {meta
              ? meta(items[hi])
              : `${items[hi].count} עסקאות${items[hi].winRate != null ? ` · ${Math.round(items[hi].winRate! * 100)}% הצלחה` : ''}`}
          </div>
        </Tip>
      )}
    </div>
  )
}

// Axis ticks use the compact money form when the formatter is a money formatter.
function compactLike(format: (v: number) => string, t: number) {
  const s = format(1000)
  return s.includes('$') ? compactMoney(t) : format(t)
}

/* ---- Horizontal bar rows ------------------------------------------------ */

export interface Row {
  label: string
  value: number
  /** shown under the label, e.g. "161 עסקאות · 53%" */
  sub?: string
  color?: string
}

/**
 * Ranked horizontal bars (RTL: grow from the right). With `domain` fixed
 * (e.g. 0–100 for win rates) and a `reference` line (50%), it answers
 * "above or below coin-flip?" at a glance. Mixed signs diverge from a centre.
 */
export function BarRows({
  rows,
  format,
  domain,
  reference,
  referenceLabel,
  compact = false,
}: {
  rows: Row[]
  format: (v: number) => string
  domain?: [number, number]
  reference?: number
  referenceLabel?: string
  /** narrow containers (stat tiles): tighter label/value columns */
  compact?: boolean
}) {
  const cols = compact ? 'grid-cols-[76px_minmax(0,1fr)_58px] gap-2' : 'grid-cols-[150px_minmax(0,1fr)_84px] gap-3'
  const [viewRef, play] = useInView<HTMLDivElement>()
  const hasNeg = rows.some((r) => r.value < 0)
  const maxAbs = Math.max(...rows.map((r) => Math.abs(r.value)), 1e-9)
  const [d0, d1] = domain ?? [0, maxAbs]
  const frac = (v: number) => Math.max(0, Math.min(1, (v - d0) / (d1 - d0 || 1)))

  return (
    <div ref={viewRef} className="flex flex-col">
      {reference != null && (
        <div className={`grid ${cols} px-1.5 text-[11px] text-[#8a8984]`}>
          <span />
          <div className="relative h-4">
            <span className="absolute translate-x-1/2 whitespace-nowrap" style={{ right: `${frac(reference) * 100}%` }}>
              {referenceLabel ?? format(reference)}
            </span>
          </div>
          <span />
        </div>
      )}
      {rows.map((r, i) => {
        const c = r.color ?? toneColor(r.value)
        const w = hasNeg ? (Math.abs(r.value) / maxAbs) * 50 : frac(r.value) * 100
        return (
          <div
            key={r.label}
            className={`group grid ${cols} items-center rounded-md ${compact ? 'px-0 py-1' : 'px-1.5 py-2'} transition-colors hover:bg-[#f7f6f3]`}
          >
            <div className="min-w-0">
              <div className={`truncate font-medium ${compact ? 'text-[12px] text-muted' : 'text-sm'}`}>{r.label}</div>
              {r.sub && <div className="text-[11px] leading-snug text-muted">{r.sub}</div>}
            </div>
            <div className="relative h-2.5 rounded bg-[#f1f0ed]">
              {reference != null && (
                <div className="absolute -inset-y-1.5 z-10 w-px bg-[#b9b7b1]" style={{ right: `${frac(reference) * 100}%` }} />
              )}
              {hasNeg && <div className="absolute -inset-y-1 right-1/2 w-px bg-[#b9b7b1]" />}
              <div
                className="absolute inset-y-0"
                style={{
                  width: `${w}%`,
                  ...(hasNeg
                    ? r.value >= 0
                      ? { left: '50%', borderRadius: '0 4px 4px 0', transformOrigin: 'left' }
                      : { right: '50%', borderRadius: '4px 0 0 4px', transformOrigin: 'right' }
                    : { right: 0, borderRadius: '4px 0 0 4px', transformOrigin: 'right' }),
                  background: c,
                  transform: `scaleX(${play ? 1 : 0})`,
                  transition: `transform .8s cubic-bezier(.16,1,.3,1) ${i * 70}ms`,
                }}
              />
            </div>
            <div
              className={`text-left font-semibold tabular-nums ${compact ? 'text-[12px]' : 'text-sm'}`}
              dir="ltr"
              style={{ color: r.value < 0 ? CHART.lossText : CHART.ink }}
            >
              {format(r.value)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ---- Split bar (part-to-whole) ----------------------------------------- */

export function SplitBar({
  parts,
  height = 10,
}: {
  parts: { label: string; value: number; color: string }[]
  height?: number
}) {
  const [viewRef, play] = useInView<HTMLDivElement>()
  const total = parts.reduce((s, p) => s + p.value, 0) || 1
  return (
    <div ref={viewRef}>
      <div className="flex gap-[2px] overflow-hidden rounded" style={{ height }}>
        {parts
          .filter((p) => p.value > 0)
          .map((p, i) => (
            <div
              key={p.label}
              title={`${p.label}: ${p.value}`}
              style={{
                width: `${(p.value / total) * 100}%`,
                background: p.color,
                transformOrigin: 'right',
                transform: `scaleX(${play ? 1 : 0})`,
                transition: `transform .8s cubic-bezier(.16,1,.3,1) ${i * 120}ms`,
              }}
            />
          ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-muted">
        {parts.map((p) => (
          <span key={p.label} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm" style={{ background: p.color }} />
            {p.label} <b className="font-semibold tabular-nums text-ink">{p.value}</b>
          </span>
        ))}
      </div>
    </div>
  )
}
