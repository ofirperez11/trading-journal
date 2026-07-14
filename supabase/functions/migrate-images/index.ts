// Move any base64 screenshots stored inline in trades.images[] into Storage, so
// trades queries stop re-downloading them (egress). Report by default; with
// ?apply=1 actually migrate. Service role. --no-verify-jwt.

const URL_ = Deno.env.get('SUPABASE_URL')!
const SVC = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const svc = { apikey: SVC, Authorization: `Bearer ${SVC}` }
const TEN_YEARS = 315360000
const j = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json' } })

Deno.serve(async (req) => {
  const apply = new URL(req.url).searchParams.get('apply') === '1'
  const rows = await (await fetch(`${URL_}/rest/v1/trades?select=id,user_id,images&images=not.is.null`, { headers: svc })).json()

  let base64Count = 0, urlCount = 0, base64Bytes = 0
  const report = { tradesWithBase64: 0, migratedTrades: 0, migratedImages: 0, errors: [] as string[] }

  for (const t of rows) {
    const imgs: string[] = t.images || []
    const hasB64 = imgs.some((im) => typeof im === 'string' && im.startsWith('data:'))
    for (const im of imgs) {
      if (typeof im === 'string' && im.startsWith('data:')) { base64Count++; base64Bytes += im.length } else urlCount++
    }
    if (!hasB64) continue
    report.tradesWithBase64++
    if (!apply) continue

    const next: string[] = []
    let changed = false
    for (let i = 0; i < imgs.length; i++) {
      const im = imgs[i]
      if (typeof im !== 'string' || !im.startsWith('data:')) { next.push(im); continue }
      try {
        const m = im.match(/^data:([^;]+);base64,(.*)$/)
        if (!m) { next.push(im); continue }
        const mediaType = m[1]
        const ext = mediaType.includes('png') ? 'png' : mediaType.includes('jpeg') ? 'jpg' : 'webp'
        const bytes = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0))
        const path = `${t.user_id}/${t.id}/mig-${i}.${ext}`
        const up = await fetch(`${URL_}/storage/v1/object/trade-images/${path}`, {
          method: 'POST', headers: { ...svc, 'content-type': mediaType, 'x-upsert': 'true' }, body: bytes,
        })
        if (!up.ok) { report.errors.push(`${t.id}: upload ${up.status}`); next.push(im); continue }
        const signed = await (await fetch(`${URL_}/storage/v1/object/sign/trade-images/${path}`, {
          method: 'POST', headers: { ...svc, 'content-type': 'application/json' }, body: JSON.stringify({ expiresIn: TEN_YEARS }),
        })).json()
        next.push(`${URL_}/storage/v1${signed.signedURL}`)
        report.migratedImages++
        changed = true
      } catch (e) { report.errors.push(`${t.id}: ${e}`); next.push(im) }
    }
    if (changed) {
      const patch = await fetch(`${URL_}/rest/v1/trades?id=eq.${t.id}`, {
        method: 'PATCH', headers: { ...svc, 'content-type': 'application/json' }, body: JSON.stringify({ images: next }),
      })
      if (patch.ok) report.migratedTrades++
      else report.errors.push(`${t.id}: patch ${patch.status}`)
    }
  }

  return j({
    scanned: rows.length,
    base64Images: base64Count,
    urlImages: urlCount,
    base64TotalMB: Math.round((base64Bytes / 1048576) * 10) / 10,
    ...report,
  })
})
