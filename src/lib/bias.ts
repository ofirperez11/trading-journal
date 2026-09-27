import type { Bias, BiasGroup } from '../types'

// The HTF bias pairs the indicator actually produces, in engine priority order.
// Each main pair has sub-combinations by whether each block has a wick
// (בלי פתיל = no wick, עם פתיל = with wick). `label` is the short chip text
// (the wick config); `group` is the main pair; `desc` is the full explanation.
export const BIAS_GROUPS: { g: BiasGroup; label: string }[] = [
  { g: '6-3', label: '6 ל-3' },
  { g: '3-body90', label: '3 לנר 90' },
  { g: '3-wick90', label: '3 לפתיל 90' },
  { g: '6-body90', label: '6 לנר 90 · חריג' },
]

export const BIASES: { v: Bias; group: BiasGroup; label: string; desc: string }[] = [
  { v: '6-3_nn', group: '6-3', label: '6 בלי פתיל / 3 בלי פתיל', desc: 'זוג 6 ל-3' },
  { v: '6-3_nw', group: '6-3', label: '6 בלי פתיל / 3 עם פתיל', desc: 'זוג 6 ל-3' },
  { v: '6-3_wn', group: '6-3', label: '6 עם פתיל / 3 בלי פתיל', desc: 'זוג 6 ל-3' },
  { v: '6-3_ww', group: '6-3', label: '6 עם פתיל / 3 עם פתיל', desc: 'זוג 6 ל-3' },

  { v: '3b90_nn', group: '3-body90', label: '3 בלי פתיל / 90 בלי פתיל', desc: 'זוג 3 ל-נר 90' },
  { v: '3b90_nw', group: '3-body90', label: '3 בלי פתיל / 90 עם פתיל', desc: 'זוג 3 ל-נר 90' },
  { v: '3b90_wn', group: '3-body90', label: '3 עם פתיל / 90 בלי פתיל', desc: 'זוג 3 ל-נר 90' },
  { v: '3b90_ww', group: '3-body90', label: '3 עם פתיל / 90 עם פתיל', desc: 'זוג 3 ל-נר 90' },

  { v: '3w90_n', group: '3-wick90', label: '3 בלי פתיל / פתיל 90', desc: 'זוג 3 ל-פתיל 90 (90 רק פתיל)' },
  { v: '3w90_w', group: '3-wick90', label: '3 עם פתיל / פתיל 90', desc: 'זוג 3 ל-פתיל 90 (90 רק פתיל)' },

  { v: '6b90_nn', group: '6-body90', label: '6 בלי פתיל / 90 בלי פתיל', desc: 'זוג 6 ל-נר 90 · מקרה חריג' },
  { v: '6b90_nw', group: '6-body90', label: '6 בלי פתיל / 90 עם פתיל', desc: 'זוג 6 ל-נר 90 · מקרה חריג' },
  { v: '6b90_wn', group: '6-body90', label: '6 עם פתיל / 90 בלי פתיל', desc: 'זוג 6 ל-נר 90 · מקרה חריג' },
  { v: '6b90_ww', group: '6-body90', label: '6 עם פתיל / 90 עם פתיל', desc: 'זוג 6 ל-נר 90 · מקרה חריג' },
]

/** Short chip label — used inside the grouped picker. */
export const BIAS_LABEL: Record<Bias, string> = Object.fromEntries(
  BIASES.map((b) => [b.v, b.label]),
) as Record<Bias, string>

/** Standalone label — used in the table, detail, CSV and charts. The label
 * already names both blocks, so it is self-sufficient. */
export const BIAS_FULL_LABEL: Record<Bias, string> = Object.fromEntries(
  BIASES.map((b) => [b.v, b.label]),
) as Record<Bias, string>
