// Supabase Edge Function: attach-by-id (one-time migration helper)
// Uploads each image to the private trade-images bucket under the given trade id
// and appends a long-lived signed URL to that trade's images[]. Matches by trade
// id directly (no fuzzy matching). Service role (bypasses RLS). --no-verify-jwt.
// Input: { uid, items: [{ tradeId, filename, mediaType, base64 }] }

const URL_ = Deno.env.get('SUPABASE_URL')!
const SVC = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const svc = { apikey: SVC, Authorization: `Bearer ${SVC}` }
const TEN_YEARS = 315360000

function json(o: unknown, s = 200) {
  return new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json' } })
}

Deno.serve(async (req) => {
  try {
    const { uid, items } = await req.json()
    if (!uid || !Array.isArray(items)) return json({ error: 'need uid + items[]' }, 400)

    const report = { uploaded: 0, errors: [] as string[] }
    // cache current images[] per trade so multiple images accumulate
    const cache = new Map<string, string[]>()
    for (const it of items) {
      const { tradeId, filename, mediaType, base64 } = it
      if (!cache.has(tradeId)) {
        const cur = await (await fetch(`${URL_}/rest/v1/trades?id=eq.${tradeId}&select=images`, { headers: svc })).json()
        cache.set(tradeId, cur[0]?.images || [])
      }
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
      const pathName = `${uid}/${tradeId}/${filename}`
      const up = await fetch(`${URL_}/storage/v1/object/trade-images/${pathName}`, {
        method: 'POST',
        headers: { ...svc, 'content-type': mediaType || 'image/webp', 'x-upsert': 'true' },
        body: bytes,
      })
      if (!up.ok) { report.errors.push(`${tradeId}: upload ${up.status}`); continue }
      const signed = await (await fetch(`${URL_}/storage/v1/object/sign/trade-images/${pathName}`, {
        method: 'POST', headers: { ...svc, 'content-type': 'application/json' }, body: JSON.stringify({ expiresIn: TEN_YEARS }),
      })).json()
      const signedUrl = `${URL_}/storage/v1${signed.signedURL}`
      const next = [...(cache.get(tradeId) || []), signedUrl]
      const patch = await fetch(`${URL_}/rest/v1/trades?id=eq.${tradeId}`, {
        method: 'PATCH', headers: { ...svc, 'content-type': 'application/json' }, body: JSON.stringify({ images: next }),
      })
      if (!patch.ok) { report.errors.push(`${tradeId}: patch ${patch.status}`); continue }
      cache.set(tradeId, next)
      report.uploaded++
    }
    return json(report)
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
