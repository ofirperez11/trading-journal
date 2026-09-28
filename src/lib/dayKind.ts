import type { Trade } from '../types'

// "סוג יום" — one of Main / Semi / ATH. Stored in the trade's `tags` (the Pine
// import has always tagged the day kind there), so there's no schema change and
// earlier Pine trades — and trades marked ATH before — already carry it.
export const DAY_KINDS = ['Main', 'Semi', 'ATH'] as const
export type DayKind = (typeof DAY_KINDS)[number]

/** "Main 🤖" / "main" → 'Main'; anything else → null. */
export function toDayKind(s: string): DayKind | null {
  const k = s.trim().toLowerCase()
  return DAY_KINDS.find((d) => k === d.toLowerCase() || k.startsWith(d.toLowerCase() + ' ')) ?? null
}

export function dayKindOf(t: Pick<Trade, 'tags'>): DayKind | null {
  for (const tag of t.tags ?? []) {
    const k = toDayKind(tag)
    if (k) return k
  }
  return null
}

/** The tags with exactly this day kind (or none) — the other kinds are removed. */
export function withDayKind(tags: string[], kind: DayKind | null): string[] {
  const rest = tags.filter((tag) => !toDayKind(tag))
  return kind ? [...rest, kind] : rest
}
