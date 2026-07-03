import { useEffect, useRef, useState } from 'react'

function prefersReduced() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  )
}

/**
 * Counts up to `value` on mount (ease-out-quart) for a little life on the
 * landing / dashboard hero. When `value` later changes (e.g. an analytics
 * filter), it snaps to the new value synchronously via a render-phase sync —
 * so the number is ALWAYS correct at rest, independent of rAF timing.
 */
export function CountUp({
  value,
  durationMs = 1200,
  format,
}: {
  value: number
  durationMs?: number
  format: (n: number) => string
}) {
  const [display, setDisplay] = useState(() => (prefersReduced() ? value : 0))
  const [tracked, setTracked] = useState(value)

  // Prop changed after mount → snap to the correct value immediately.
  if (value !== tracked) {
    setTracked(value)
    setDisplay(value)
  }

  // One-time count-up animation on mount only.
  const target = useRef(value)
  useEffect(() => {
    if (prefersReduced()) {
      setDisplay(target.current)
      return
    }
    let raf = 0
    const start = performance.now()
    const to = target.current
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      const eased = 1 - Math.pow(1 - t, 4)
      setDisplay(to * eased)
      if (t < 1) raf = requestAnimationFrame(tick)
      else setDisplay(to)
    }
    raf = requestAnimationFrame(tick)
    const timer = setTimeout(() => setDisplay(to), durationMs + 80)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <>{format(display)}</>
}
