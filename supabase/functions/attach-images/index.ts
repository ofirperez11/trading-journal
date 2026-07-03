// Supabase Edge Function: attach-images (one-time migration helper)
// ---------------------------------------------------------------------------
// Attaches trade screenshots to existing DB trades. Runs with the service role
// (bypasses RLS). For each item, matches a trade in the owner's main journal by
// day + symbol + side + entry, uploads the image to the private trade-images
// bucket, and appends a long-lived signed URL to the trade's images[].
// Input: { email, items: [{ day, symbol, side, entry, filename, mediaType, base64 }] }
// ---------------------------------------------------------------------------

const URL_ = Deno.env.get('SUPABASE_URL')!
const SVC = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const svc = { apikey: SVC, Authorization: `Bearer ${SVC}` }
const TEN_YEARS = 315360000
const clean = (s: string) => s.replace(/\d+$/, '') || s

function json(o: unknown, s = 200) {
  return new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json' } })
}

Deno.serve(async (req) => {
  try {
    const { email, items } = await req.json()
    if (!email || !Array.isArray(items)) return json({ error: 'need email + items[]' }, 400)

    // resolve owner + main (oldest) account
    const users = await (await fetch(`${URL_}/auth/v1/admin/users?per_page=200`, { headers: svc })).json()
    const uid = (users.users || []).find((u: { email: string }) => u.email?.toLowerCase() === email.toLowerCase())?.id
    if (!uid) return json({ error: 'user not found' }, 404)
    const accts = await (await fetch(`${URL_}/rest/v1/accounts?user_id=eq.${uid}&order=created_at.asc&select=id`, { headers: svc })).json()
    const accountId = accts[0]?.id
    if (!accountId) return json({ error: 'no account' }, 404)

    // 2026 trades in that account → match map
    const trades = await (await fetch(
      `${URL_}/rest/v1/trades?account_id=eq.${accountId}&date=gte.2026-01-01&date=lt.2027-01-01&select=id,date,symbol,side,entry,images`,
      { headers: svc },
    )).json()
    const key = (day: string, sym: string, side: string, entry: number) => `${day}|${clean(sym)}|${side}|${Math.round(entry)}`
    const byKey = new Map<string, { id: string; images: string[] }>()
    for (const t of trades) {
      byKey.set(key(String(t.date).slice(0, 10), t.symbol, t.side, Number(t.entry)), { id: t.id, images: t.images || [] })
    }

    const report = { matched: 0, uploaded: 0, unmatched: [] as string[], errors: [] as string[] }
    for (const it of items) {
      const k = key(it.day, it.symbol, it.side, Number(it.entry))
      const tr = byKey.get(k)
      if (!tr) { report.unmatched.push(k); continue }
      report.matched++
      const bytes = Uint8Array.from(atob(it.base64), (c) => c.charCodeAt(0))
      const path = `${uid}/${tr.id}/${it.filename}`
      const up = await fetch(`${URL_}/storage/v1/object/trade-images/${path}`, {
        method: 'POST',
        headers: { ...svc, 'content-type': it.mediaType || 'image/webp', 'x-upsert': 'true' },
        body: bytes,
      })
      if (!up.ok) { report.errors.push(`${k}: upload ${up.status}`); continue }
      const signed = await (await fetch(`${URL_}/storage/v1/object/sign/trade-images/${path}`, {
        method: 'POST', headers: { ...svc, 'content-type': 'application/json' }, body: JSON.stringify({ expiresIn: TEN_YEARS }),
      })).json()
      const signedUrl = `${URL_}/storage/v1${signed.signedURL}`
      const nextImages = [...tr.images, signedUrl]
      const patch = await fetch(`${URL_}/rest/v1/trades?id=eq.${tr.id}`, {
        method: 'PATCH', headers: { ...svc, 'content-type': 'application/json' }, body: JSON.stringify({ images: nextImages }),
      })
      if (!patch.ok) { report.errors.push(`${k}: patch ${patch.status}`); continue }
      tr.images = nextImages
      report.uploaded++
    }
    return json(report)
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
