import type { TradeSide } from '../types'

// The extract-trade Edge Function endpoint. Kept independent from the app-wide
// Supabase config so the screenshot feature can use the real backend while the
// rest of the app stays in demo mode.
const FN_URL = import.meta.env.VITE_SUPABASE_FN_URL as string | undefined
const FN_KEY = import.meta.env.VITE_SUPABASE_KEY as string | undefined
const fnConfigured = Boolean(FN_URL && FN_KEY)

// What Claude Vision returns for a screenshot. Every field is optional / may be
// null — the confirmation screen lets the user fix anything.
export interface ExtractedTrade {
  symbol: string | null
  side: TradeSide | null
  entry: number | null
  stoploss: number | null
  target: number | null
  exit: number | null
  date: string | null // YYYY-MM-DD
  time: string | null // HH:MM
  timeframe: string | null
  uncertain_fields: string[]
  confidence: number
}

export interface ExtractResult {
  trade: ExtractedTrade
  mock: boolean
}

/** Split a data URL ("data:image/webp;base64,AAA…") into media type + payload. */
function splitDataUrl(dataUrl: string): { mediaType: string; base64: string } {
  const match = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl)
  if (!match) return { mediaType: 'image/webp', base64: dataUrl }
  return { mediaType: match[1], base64: match[2] }
}

/**
 * Extract trade fields from a screenshot. Uses the secure `extract-trade` Edge
 * Function (Claude Vision) when Supabase is configured; otherwise returns a
 * mocked result so the whole flow can be built and demoed without a backend.
 */
export async function extractTradeFromImage(dataUrl: string): Promise<ExtractResult> {
  if (!fnConfigured) {
    // Placeholder "brain" — a plausible extraction so the confirmation screen
    // can be exercised. Replaced by real Vision output once the key is set.
    await new Promise((r) => setTimeout(r, 900))
    return {
      mock: true,
      trade: {
        symbol: 'MNQ',
        side: 'LONG',
        entry: 19720,
        stoploss: 19652,
        target: 19742,
        exit: null,
        date: new Date().toISOString().slice(0, 10),
        time: '16:30',
        timeframe: '5m',
        uncertain_fields: ['exit', 'date'],
        confidence: 0.6,
      },
    }
  }

  const { mediaType, base64 } = splitDataUrl(dataUrl)
  const res = await fetch(`${FN_URL}/functions/v1/extract-trade`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: FN_KEY as string,
      Authorization: `Bearer ${FN_KEY}`,
    },
    body: JSON.stringify({ imageBase64: base64, mediaType }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data?.error) {
    throw new Error(typeof data?.error === 'string' ? data.error : `extract_failed (${res.status})`)
  }
  return { mock: false, trade: data.trade as ExtractedTrade }
}
