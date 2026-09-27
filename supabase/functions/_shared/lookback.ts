// Shared "Lookback" (entry-model) definitions, used by both the manual trade
// form and the screenshot-import confirmation screen.

export const SESSION_TIMES = ['16:30', '17:00'] as const
export type SessionTime = (typeof SESSION_TIMES)[number]

// Each session time reveals its own six time markers (aligned by position).
export const LOOKBACKS: Record<SessionTime, string[]> = {
  '16:30': ['4:30', '10:30', '13:30', '16:30', '19:30', '22:30', 'פתיל 90'],
  '17:00': ['5:00', '11:00', '14:00', '17:00', '20:00', '23:00', 'פתיל 90'],
}

// The session-open markers are blue; every other lookback is red.
const BLUE_LOOKBACKS = new Set(['16:30', '4:30', '17:00', '5:00'])
export function lookbackColor(lb: string): string {
  return BLUE_LOOKBACKS.has(lb) ? '#5B9DF9' : '#F26D6D'
}
