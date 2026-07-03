import { useEffect, useState } from 'react'

function prefersReduced() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  )
}

/**
 * Counts up to `value` on mount (ease-out-quart) — used for the landing's
 * hero readout, so the terminal appears to "come alive". Honors reduced motion
 * by rendering the final value immediately.
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

  useEffect(() => {
    if (prefersReduced()) {
      setDisplay(value)
      return
    }
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      const eased = 1 - Math.pow(1 - t, 4)
      setDisplay(value * eased)
      if (t < 1) raf = requestAnimationFrame(tick)
      else setDisplay(value)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, durationMs])

  return <>{format(display)}</>
}
