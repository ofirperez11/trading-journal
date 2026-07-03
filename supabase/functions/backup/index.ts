// Supabase Edge Function: backup
// ---------------------------------------------------------------------------
// Exports all trades / accounts / journal_entries to a timestamped JSON file in
// a private "backups" Storage bucket. Runs with the service role (injected by
// Supabase) so it can read everything regardless of RLS. Meant to be invoked on
// a daily schedule (pg_cron + pg_net) — a free restore-point safety net.
// ---------------------------------------------------------------------------

const URL_ = Deno.env.get('SUPABASE_URL')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const BUCKET = 'backups'
const KEEP = 30 // retain the most recent N backups

const svc = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` }

async function selectAll(table: string): Promise<unknown[]> {
  const r = await fetch(`${URL_}/rest/v1/${table}?select=*`, { headers: svc })
  if (!r.ok) throw new Error(`read ${table}: ${await r.text()}`)
  return r.json()
}

async function ensureBucket() {
  await fetch(`${URL_}/storage/v1/bucket`, {
    method: 'POST',
    headers: { ...svc, 'content-type': 'application/json' },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false }),
  }) // 200 on create, 409/400 if it already exists — both fine
}

async function pruneOld() {
  const r = await fetch(`${URL_}/storage/v1/object/list/${BUCKET}`, {
    method: 'POST',
    headers: { ...svc, 'content-type': 'application/json' },
    body: JSON.stringify({ prefix: '', limit: 1000, sortBy: { column: 'name', order: 'asc' } }),
  })
  if (!r.ok) return
  const files = (await r.json()) as { name: string }[]
  const backups = files.filter((f) => f.name.startsWith('backup-')).map((f) => f.name).sort()
  const excess = backups.slice(0, Math.max(0, backups.length - KEEP))
  if (excess.length) {
    await fetch(`${URL_}/storage/v1/object/${BUCKET}`, {
      method: 'DELETE',
      headers: { ...svc, 'content-type': 'application/json' },
      body: JSON.stringify({ prefixes: excess }),
    })
  }
}

Deno.serve(async () => {
  try {
    await ensureBucket()
    const [trades, accounts, journal_entries] = await Promise.all([
      selectAll('trades'),
      selectAll('accounts'),
      selectAll('journal_entries'),
    ])
    const payload = JSON.stringify({
      exportedAt: new Date().toISOString(),
      counts: { trades: trades.length, accounts: accounts.length, journal_entries: journal_entries.length },
      trades,
      accounts,
      journal_entries,
    })
    const name = `backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`
    const up = await fetch(`${URL_}/storage/v1/object/${BUCKET}/${name}`, {
      method: 'POST',
      headers: { ...svc, 'content-type': 'application/json', 'x-upsert': 'true' },
      body: payload,
    })
    if (!up.ok) throw new Error(`upload: ${await up.text()}`)
    await pruneOld()
    return new Response(JSON.stringify({ ok: true, file: name, trades: trades.length }), {
      headers: { 'content-type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }
})
