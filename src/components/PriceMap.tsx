import type { TradeSide } from '../types'
import { useInView, CHART } from './charts'

/**
 * A trade on one price line: the risk band (entry→stop), the planned reward
 * (entry→target), and the realised move (entry→each exit) drawn on top.
 * Price rises to the right. Animates in when scrolled into view.
 */
export function PriceMap({
  side,
  entry,
  stop,
  target,
  exits,
}: {
  side: TradeSide
  entry: number | null
  stop: number | null
  target: number | null
  exits: number[]
}) {
  const [ref, play] = useInView<HTMLDivElement>()
  if (entry == null || (stop == null && target == null && exits.length === 0)) {
    return (
      <div className="flex h-[96px] items-center justify-center rounded-lg border border-dashed border-border px-4 text-center text-[13px] text-faint">
        מלא כניסה וסטופ או יציאה כדי לראות את מפת העסקה
      </div>
    )
  }

  const values = [entry, stop, target, ...exits].filter((v): v is number => v != null)
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const pad = (hi - lo || Math.abs(entry) * 0.001 || 1) * 0.14
  const min = lo - pad
  const max = hi + pad
  const x = (v: number) => ((v - min) / (max - min)) * 100
  const dir = side === 'LONG' ? 1 : -1
  const last = exits.length ? exits[exits.length - 1] : null
  const won = last != null ? (last - entry) * dir > 0 : null

  const band = (a: number, b: number) => ({ left: `${Math.min(x(a), x(b))}%`, width: `${Math.abs(x(a) - x(b))}%` })

  // Markers; an exit that sits on the target merges with it.
  type Tone = 'ink' | 'loss' | 'win'
  const marks: { v: number; label: string; tone: Tone; above: boolean }[] = [{ v: entry, label: 'כניסה', tone: 'ink', above: true }]
  if (stop != null) marks.push({ v: stop, label: 'סטופ', tone: 'loss', above: false })
  if (target != null && !exits.includes(target)) marks.push({ v: target, label: 'יעד', tone: 'win', above: false })
  exits.forEach((e, i) =>
    marks.push({
      v: e,
      label: e === target ? 'יציאה = יעד' : exits.length > 1 ? `יציאה ${i + 1}` : 'יציאה',
      tone: (e - entry) * dir >= 0 ? 'win' : 'loss',
      // A single exit that lands on the target sits below with the target row.
      above: e !== target,
    }),
  )
  const toneColor: Record<Tone, string> = { ink: CHART.ink, loss: CHART.lossText, win: CHART.winText }
  const markColor: Record<Tone, string> = { ink: CHART.ink, loss: CHART.loss, win: CHART.win }

  return (
    <div ref={ref} dir="ltr" className="relative h-[96px] select-none" role="img" aria-label="מפת העסקה: סטופ, כניסה, יציאה ויעד על ציר המחיר">
      <div className="absolute inset-x-0 top-[46px] h-1 rounded-full bg-[#efeeec]" />
      {stop != null && <div className="absolute top-[42px] h-3 rounded-sm bg-[#c9503d]/15" style={band(entry, stop)} />}
      {target != null && <div className="absolute top-[42px] h-3 rounded-sm bg-[#2f855a]/15" style={band(entry, target)} />}
      {last != null && (
        <div
          className="absolute top-[45px] h-1.5 rounded-full"
          style={{
            ...band(entry, last),
            background: won ? CHART.win : CHART.loss,
            transformOrigin: last > entry ? 'left' : 'right',
            transform: `scaleX(${play ? 1 : 0})`,
            transition: 'transform 1s cubic-bezier(.16,1,.3,1) .2s',
          }}
        />
      )}
      {marks.map((m, i) => (
        <div
          key={i}
          className="absolute flex -translate-x-1/2 flex-col items-center"
          style={{
            left: `${x(m.v)}%`,
            top: m.above ? 0 : 40,
            opacity: play ? 1 : 0,
            transition: `opacity .4s ease ${0.3 + i * 0.08}s`,
          }}
        >
          {m.above && (
            <span className="mb-0.5 whitespace-nowrap text-center text-[11px] leading-tight">
              <span className="block text-muted">{m.label}</span>
              <b className="tabular-nums" style={{ color: toneColor[m.tone] }}>{m.v}</b>
            </span>
          )}
          <span className="h-4 w-[3px] rounded-full ring-2 ring-white" style={{ background: markColor[m.tone] }} />
          {!m.above && (
            <span className="mt-0.5 whitespace-nowrap text-center text-[11px] leading-tight">
              <b className="tabular-nums" style={{ color: toneColor[m.tone] }}>{m.v}</b>
              <span className="block text-muted">{m.label}</span>
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
