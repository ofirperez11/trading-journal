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
  { v: '6-3_nn', group: '6-3', label: 'בלי · בלי', desc: '6 בלי פתיל → 3 בלי פתיל' },
  { v: '6-3_nw', group: '6-3', label: 'בלי · עם', desc: '6 בלי פתיל → 3 עם פתיל' },
  { v: '6-3_wn', group: '6-3', label: 'עם · בלי', desc: '6 עם פתיל → 3 בלי פתיל' },
  { v: '6-3_ww', group: '6-3', label: 'עם · עם', desc: '6 עם פתיל → 3 עם פתיל' },

  { v: '3b90_nn', group: '3-body90', label: 'בלי · בלי', desc: '3 בלי פתיל → נר 90 בלי פתיל' },
  { v: '3b90_nw', group: '3-body90', label: 'בלי · עם', desc: '3 בלי פתיל → נר 90 עם פתיל' },
  { v: '3b90_wn', group: '3-body90', label: 'עם · בלי', desc: '3 עם פתיל → נר 90 בלי פתיל' },
  { v: '3b90_ww', group: '3-body90', label: 'עם · עם', desc: '3 עם פתיל → נר 90 עם פתיל' },

  { v: '3w90_n', group: '3-wick90', label: '3 בלי פתיל', desc: '3 בלי פתיל → פתיל 90 (רק פתיל)' },
  { v: '3w90_w', group: '3-wick90', label: '3 עם פתיל', desc: '3 עם פתיל → פתיל 90 (רק פתיל)' },

  { v: '6b90_nn', group: '6-body90', label: 'בלי · בלי', desc: '6 בלי פתיל → נר 90 בלי פתיל (חריג)' },
  { v: '6b90_nw', group: '6-body90', label: 'בלי · עם', desc: '6 בלי פתיל → נר 90 עם פתיל (חריג)' },
  { v: '6b90_wn', group: '6-body90', label: 'עם · בלי', desc: '6 עם פתיל → נר 90 בלי פתיל (חריג)' },
  { v: '6b90_ww', group: '6-body90', label: 'עם · עם', desc: '6 עם פתיל → נר 90 עם פתיל (חריג)' },
]

const GROUP_LABEL = Object.fromEntries(BIAS_GROUPS.map((g) => [g.g, g.label])) as Record<BiasGroup, string>

/** Short chip label (wick config only) — used inside the grouped picker. */
export const BIAS_LABEL: Record<Bias, string> = Object.fromEntries(
  BIASES.map((b) => [b.v, b.label]),
) as Record<Bias, string>

/** Standalone label (pair · config) — used in the table, detail, CSV and charts. */
export const BIAS_FULL_LABEL: Record<Bias, string> = Object.fromEntries(
  BIASES.map((b) => [b.v, `${GROUP_LABEL[b.group]} · ${b.label}`]),
) as Record<Bias, string>
