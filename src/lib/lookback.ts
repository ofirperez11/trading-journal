// Shared "Lookback" (entry-model) definitions, used by both the manual trade
// form and the screenshot-import confirmation screen.

export const SESSION_TIMES = ['16:30', '17:00'] as const
export type SessionTime = (typeof SESSION_TIMES)[number]

// Each session time reveals its own six time markers (aligned by position).
export const LOOKBACKS: Record<SessionTime, string[]> = {
  '16:30': ['4:30', '10:30', '13:30', '16:30', '19:30', '22:30', 'פתיל 90'],
  '17:00': ['5:00', '11:00', '14:00', '17:00', '20:00', '23:00', 'פתיל 90'],
}

// A lookback taken on a gap is its own entry model everywhere (analytics,
// table, filters), so it's stored in the same field as "<marker> גאפ".
const GAP_SUFFIX = ' גאפ'
export function withGap(lb: string, gap: boolean): string {
  return gap ? lb + GAP_SUFFIX : lb
}
export function splitGap(lb: string): { base: string; gap: boolean } {
  return lb.endsWith(GAP_SUFFIX) ? { base: lb.slice(0, -GAP_SUFFIX.length), gap: true } : { base: lb, gap: false }
}

// The session-open markers are blue; every other lookback is red (gap or not).
const BLUE_LOOKBACKS = new Set(['16:30', '4:30', '17:00', '5:00'])
export function lookbackColor(lb: string): string {
  return BLUE_LOOKBACKS.has(splitGap(lb).base) ? '#5B9DF9' : '#F26D6D'
}
