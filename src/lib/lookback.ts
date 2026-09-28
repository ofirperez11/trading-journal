// Shared "Lookback" (entry-model) definitions, used by both the manual trade
// form and the screenshot-import confirmation screen.

export const SESSION_TIMES = ['16:30', '17:00'] as const
export type SessionTime = (typeof SESSION_TIMES)[number]

// Each session time reveals its own six time markers (aligned by position).
export const LOOKBACKS: Record<SessionTime, string[]> = {
  '16:30': ['4:30', '10:30', '13:30', '16:30', '19:30', '22:30', 'פתיל 90'],
  '17:00': ['5:00', '11:00', '14:00', '17:00', '20:00', '23:00', 'פתיל 90'],
}

// Which part of the candle the lookback was taken on. Each piece is its own
// entry model everywhere (analytics, table, filters), so it's stored in the
// same field as a prefix: "פתיל 17:00", "גאפ 19:30". No piece = just the marker.
export const PIECES = ['גאפ', 'פתיל', 'גוף'] as const
export type Piece = (typeof PIECES)[number]
const MARKERS = new Set([...LOOKBACKS['16:30'], ...LOOKBACKS['17:00']])

export function withPiece(marker: string, piece: Piece | null): string {
  return piece ? `${piece} ${marker}` : marker
}
/** "פתיל 17:00" → { base: '17:00', piece: 'פתיל' }. The marker "פתיל 90" alone has no piece. */
export function splitPiece(lb: string): { base: string; piece: Piece | null } {
  for (const p of PIECES) {
    const rest = lb.slice(p.length + 1)
    if (lb.startsWith(p + ' ') && MARKERS.has(rest)) return { base: rest, piece: p }
  }
  return { base: lb, piece: null }
}
/** The piece named in free text (a Pine report's Lookback line), gap first. */
export function pieceIn(text: string): Piece | null {
  const t = text.replace('פתיל 90', '') // the marker's own name isn't a piece
  return PIECES.find((p) => t.includes(p)) ?? null
}

// The session-open markers are blue; every other lookback is red (any piece).
const BLUE_LOOKBACKS = new Set(['16:30', '4:30', '17:00', '5:00'])
export function lookbackColor(lb: string): string {
  return BLUE_LOOKBACKS.has(splitPiece(lb).base) ? '#5B9DF9' : '#F26D6D'
}
