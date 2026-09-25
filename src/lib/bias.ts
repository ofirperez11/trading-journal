import type { Bias } from '../types'

// Higher-timeframe bias pairs (the ordered pair of HTF blocks used for the entry).
// `label` is the short chip text; `desc` explains the pair. The last three are
// flagged by the trader as uncertain (may not be produced by the indicator).
export const BIASES: { v: Bias; label: string; desc: string }[] = [
  { v: '6-3', label: '6 ל-3', desc: 'זוג 6 → 3' },
  { v: '6-body90', label: '6 לנר 90', desc: 'זוג 6 → נר 90' },
  { v: '6-wick90', label: '6 לפתיל 90', desc: 'זוג 6 → פתיל 90' },
  { v: '3-body90', label: '3 לנר 90', desc: 'זוג 3 → נר 90' },
  { v: '3-wick90', label: '3 לפתיל 90', desc: 'זוג 3 → פתיל 90' },
  { v: '6body-3body', label: 'גוף 6 ל-גוף 3 ⚠️', desc: 'גוף 6 בלי פתיל → גוף 3 בלי פתיל (ייתכן שלא תקין)' },
  { v: '6body-90body', label: 'גוף 6 ל-גוף 90 ⚠️', desc: 'גוף 6 בלי פתיל → גוף 90 בלי פתיל (ייתכן שלא תקין)' },
  { v: '3body-90body', label: 'גוף 3 ל-גוף 90 ⚠️', desc: 'גוף 3 בלי פתיל → גוף 90 בלי פתיל (ייתכן שלא תקין)' },
]

export const BIAS_LABEL: Record<Bias, string> = Object.fromEntries(
  BIASES.map((b) => [b.v, b.label]),
) as Record<Bias, string>
