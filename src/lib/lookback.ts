// Shared "Lookback" (entry-model) definitions, used by both the manual trade
// form and the screenshot-import confirmation screen.

export const SESSION_TIMES = ['16:30', '17:00'] as const
export type SessionTime = (typeof SESSION_TIMES)[number]

// Each session time reveals its own six time markers (aligned by position).
export const LOOKBACKS: Record<SessionTime, string[]> = {
  '16:30': ['4:30', '10:30', '13:30', '16:30', '19:30', '22:30', 'פתיל 90'],
  '17:00': ['5:00', '11:00', '14:00', '17:00', '20:00', '23:00', 'פתיל 90'],
}

// A lookback can also say which part of the candle it was taken on (piece) and
// on which chart (timeframe). Every combination is its own entry model
// everywhere (analytics, table, filters), so it's all stored in the same field:
// "פתיל 17:00 · 30 דקות", "גאפ 19:30", "17:00 · 15 דקות". Both are optional.
export const PIECES = ['גאפ', 'פתיל', 'גוף'] as const
export type Piece = (typeof PIECES)[number]
export const TIMEFRAMES = ['15', '30'] as const
export type Timeframe = (typeof TIMEFRAMES)[number]
export const timeframeLabel = (tf: Timeframe) => `${tf} דקות`
const MARKERS = new Set([...LOOKBACKS['16:30'], ...LOOKBACKS['17:00']])

export interface LookbackParts {
  base: string // the marker, e.g. '17:00' / 'פתיל 90'
  piece: Piece | null
  tf: Timeframe | null
}
export function formatLookback({ base, piece, tf }: LookbackParts): string {
  return `${piece ? `${piece} ` : ''}${base}${tf ? ` · ${timeframeLabel(tf)}` : ''}`
}
/** "פתיל 17:00 · 30 דקות" → parts. The marker "פתיל 90" alone has no piece. */
export function parseLookback(lb: string): LookbackParts {
  let rest = lb
  let tf: Timeframe | null = null
  const m = lb.match(/ · (\d+) דקות$/)
  if (m && (TIMEFRAMES as readonly string[]).includes(m[1])) {
    tf = m[1] as Timeframe
    rest = lb.slice(0, m.index)
  }
  for (const p of PIECES) {
    const base = rest.slice(p.length + 1)
    if (rest.startsWith(p + ' ') && MARKERS.has(base)) return { base, piece: p, tf }
  }
  return { base: rest, piece: null, tf }
}
/** The piece named in free text (a Pine report's Lookback line), gap first. */
export function pieceIn(text: string): Piece | null {
  const t = text.replace('פתיל 90', '') // the marker's own name isn't a piece
  return PIECES.find((p) => t.includes(p)) ?? null
}
/** The timeframe in free text, e.g. "LB 10:30 30ד פתיל" → '30'. */
export function timeframeIn(text: string): Timeframe | null {
  const m = text.match(/(?:^|\s)(\d+)ד(?=\s|$)/)
  return m && (TIMEFRAMES as readonly string[]).includes(m[1]) ? (m[1] as Timeframe) : null
}

// The session-open markers are blue; every other lookback is red (any variant).
const BLUE_LOOKBACKS = new Set(['16:30', '4:30', '17:00', '5:00'])
export function lookbackColor(lb: string): string {
  return BLUE_LOOKBACKS.has(parseLookback(lb).base) ? '#5B9DF9' : '#F26D6D'
}
