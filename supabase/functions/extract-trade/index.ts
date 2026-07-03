// Supabase Edge Function: extract-trade
// ---------------------------------------------------------------------------
// Receives a trade screenshot (base64) and returns structured trade fields by
// asking a vision model to "read" the chart. API keys live here as function
// secrets — never exposed to the browser.
//
// Engine is chosen by which secret is set (Gemini preferred — it has a free tier):
//   GEMINI_API_KEY     → Google Gemini   (free tier via Google AI Studio)
//   ANTHROPIC_API_KEY  → Claude          (paid, pay-as-you-go)
//
// Deploy:  supabase functions deploy extract-trade --no-verify-jwt
// Secret:  supabase secrets set GEMINI_API_KEY=... --project-ref <ref>
// ---------------------------------------------------------------------------

const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY')
const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash'
const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY')
const ANTHROPIC_MODEL = Deno.env.get('EXTRACT_MODEL') ?? 'claude-sonnet-4-6'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const PROMPT = `You are extracting a single futures trade from a screenshot.

The image is almost always a TradingView chart with a "Long/Short Position" drawing tool on it: a coloured box whose one edge is the ENTRY line, one end is the TARGET (take-profit) and the other end is the STOP-LOSS. Green shading is the profit side, red shading is the risk side.

How to read it:
- Read prices off the price axis on the RIGHT edge of the chart.
- Side: LONG if the target is ABOVE the entry (green above), SHORT if the target is BELOW the entry.
- entry = the entry line of the position tool.
- target = the take-profit end; stoploss = the stop end.
- exit = the actual close price only if clearly shown; otherwise null.
- Symbol is shown at the top (e.g. "MNQ1!" → MNQ). Normalise to one of: NQ, MNQ, ES, MES, YM, MYM.
- Date and time are on the bottom time axis. time = entry time, "HH:MM" 24h. Israel session opens are usually 16:30 or 17:00 — prefer those if the entry is near one.
- If you cannot read a field with confidence, set it to null and add its name to "uncertain_fields". Never invent a price you cannot actually read.`

const JSON_SHAPE = `Respond with ONLY a JSON object (no markdown, no commentary) with exactly these keys:
{"symbol": one of "NQ"|"MNQ"|"ES"|"MES"|"YM"|"MYM" or null,
 "side": "LONG"|"SHORT" or null,
 "entry": number or null,
 "stoploss": number or null,
 "target": number or null,
 "exit": number or null,
 "date": "YYYY-MM-DD" or null,
 "time": "HH:MM" or null,
 "timeframe": string or null,
 "uncertain_fields": array of field-name strings,
 "confidence": number between 0 and 1}`

function json(obj: unknown, status: number) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, 'content-type': 'application/json' },
  })
}

function extractJson(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  return JSON.parse(cleaned)
}

async function viaGemini(imageBase64: string, mediaType: string) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { inline_data: { mime_type: mediaType, data: imageBase64 } },
              { text: `${PROMPT}\n\n${JSON_SHAPE}` },
            ],
          },
        ],
        generationConfig: { temperature: 0, response_mime_type: 'application/json' },
      }),
    },
  )
  const data = await res.json()
  if (!res.ok) return json({ error: 'gemini_error', detail: data }, 502)
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) return json({ error: 'gemini_no_text', detail: data }, 502)
  return json({ trade: extractJson(text) }, 200)
}

async function viaClaude(imageBase64: string, mediaType: string) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': ANTHROPIC_KEY as string,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
            { type: 'text', text: `${PROMPT}\n\n${JSON_SHAPE}` },
          ],
        },
      ],
    }),
  })
  const data = await res.json()
  if (!res.ok) return json({ error: 'anthropic_error', detail: data }, 502)
  const text = (data.content ?? []).find((c: { type: string }) => c.type === 'text')?.text
  if (!text) return json({ error: 'anthropic_no_text', detail: data }, 502)
  return json({ trade: extractJson(text) }, 200)
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  try {
    if (!GEMINI_KEY && !ANTHROPIC_KEY) {
      return json({ error: 'No extraction key configured (set GEMINI_API_KEY or ANTHROPIC_API_KEY)' }, 500)
    }
    const { imageBase64, mediaType } = await req.json()
    if (!imageBase64) return json({ error: 'missing imageBase64' }, 400)
    const mt = mediaType ?? 'image/webp'

    return GEMINI_KEY ? await viaGemini(imageBase64, mt) : await viaClaude(imageBase64, mt)
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
