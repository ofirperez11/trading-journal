import type { Bias } from '../types'

// Higher-timeframe bias pairs (the ordered pair of HTF blocks used for the entry).
// `label` is the short chip text; `desc` explains the pair.
export const BIASES: { v: Bias; label: string; desc: string }[] = [
  { v: '6h-3h', label: '3H', desc: 'זוג 6H + 3H' },
  { v: '3h-90', label: '90 דק', desc: 'זוג 3H + 90' },
  { v: '3h-90-no6h', label: '90 דק · בלי 6H', desc: 'זוג 3H + 90 (כשאין בלוק 6H)' },
  { v: '3h-wick90', label: 'פתיל 90 בלבד ⚠️', desc: 'זוג 3H + פתיל 90' },
  { v: '3h-wick90-no6h', label: 'פתיל 90 בלבד · בלי 6H ⚠️', desc: 'זוג 3H + פתיל 90 (כשאין בלוק 6H)' },
  { v: '6h-90', label: '90 מתוך 6H ⚠️', desc: 'זוג 6H + 90' },
]

export const BIAS_LABEL: Record<Bias, string> = Object.fromEntries(
  BIASES.map((b) => [b.v, b.label]),
) as Record<Bias, string>
