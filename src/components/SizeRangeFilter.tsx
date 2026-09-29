// Two-handle slider over the lookback sizes that exist in the journal (like a
// volume control). Each handle snaps to a real size; the full span = no filter.

const THUMB =
  'pointer-events-none absolute inset-x-0 top-0 h-5 w-full appearance-none bg-transparent ' +
  '[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 ' +
  '[&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full ' +
  '[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-accent ' +
  '[&::-webkit-slider-thumb]:shadow [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-4 ' +
  '[&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full ' +
  '[&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-accent'

export function SizeRangeFilter({
  sizes,
  value,
  onChange,
}: {
  sizes: number[] // ascending, distinct
  value: [number, number] | null
  onChange: (range: [number, number] | null) => void
}) {
  if (sizes.length < 2) return null
  const last = sizes.length - 1
  // Handle positions are indexes into `sizes`, so they always land on a real size.
  const idx = (v: number) => {
    const i = sizes.findIndex((s) => s >= v - 1e-9)
    return i < 0 ? last : i
  }
  const lo = value ? idx(value[0]) : 0
  const hi = value ? Math.max(idx(value[1]), lo) : last
  const set = (a: number, b: number) => onChange(a === 0 && b === last ? null : [sizes[a], sizes[b]])
  const pct = (i: number) => (i / last) * 100

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs font-semibold text-muted">
        <span>גודל Lookback</span>
        <span className="num text-ink" dir="ltr">
          {sizes[lo]} – {sizes[hi]} נק׳
        </span>
      </div>
      <div className="relative h-5" dir="ltr">
        <div className="absolute inset-x-0 top-2 h-1 rounded-full bg-border" />
        <div className="absolute top-2 h-1 rounded-full bg-accent" style={{ left: `${pct(lo)}%`, right: `${100 - pct(hi)}%` }} />
        <input
          type="range"
          min={0}
          max={last}
          step={1}
          value={lo}
          aria-label="גודל Lookback מינימלי"
          onChange={(e) => set(Math.min(Number(e.target.value), hi), hi)}
          className={THUMB}
        />
        <input
          type="range"
          min={0}
          max={last}
          step={1}
          value={hi}
          aria-label="גודל Lookback מקסימלי"
          onChange={(e) => set(lo, Math.max(Number(e.target.value), lo))}
          className={THUMB}
        />
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-faint num" dir="ltr">
        <span>{sizes[0]}</span>
        <span>{sizes[last]}</span>
      </div>
    </div>
  )
}
