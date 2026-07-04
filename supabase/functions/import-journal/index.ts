// Supabase Edge Function: import-journal (one-time migration helper)
// Creates a new account (journal) under the user resolved from `email`, then
// bulk-inserts the given trades into it. Returns the new account id and the
// inserted trade ids IN INPUT ORDER (so images can be attached by index).
// Service role (bypasses RLS). --no-verify-jwt.
// Input: { email, accountName, trades: [{ date, symbol, market, side, status,
//          qty, entry, exit, target, stoploss, return_amount, r_multiple, notes }] }

const URL_ = Deno.env.get('SUPABASE_URL')!
const SVC = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const svc = { apikey: SVC, Authorization: `Bearer ${SVC}` }
const NON = new Set(['_i', 'exits'])

function json(o: unknown, s = 200) {
  return new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json' } })
}

Deno.serve(async (req) => {
  try {
    const { email, accountName, trades } = await req.json()
    if (!email || !accountName || !Array.isArray(trades)) return json({ error: 'need email, accountName, trades[]' }, 400)

    const users = await (await fetch(`${URL_}/auth/v1/admin/users?per_page=200`, { headers: svc })).json()
    const uid = (users.users || []).find((u: { email: string }) => u.email?.toLowerCase() === email.toLowerCase())?.id
    if (!uid) return json({ error: 'user not found' }, 404)

    const acctRes = await fetch(`${URL_}/rest/v1/accounts`, {
      method: 'POST',
      headers: { ...svc, 'content-type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ user_id: uid, name: accountName, broker: 'Tradovate', currency: 'USD', is_default: false }),
    })
    if (!acctRes.ok) return json({ error: `account insert ${acctRes.status}`, detail: await acctRes.text() }, 500)
    const accountId = (await acctRes.json())[0].id

    const rows = trades.map((t: Record<string, unknown>) => {
      const o: Record<string, unknown> = { user_id: uid, account_id: accountId }
      for (const [k, v] of Object.entries(t)) if (!NON.has(k)) o[k] = v
      return o
    })
    const insRes = await fetch(`${URL_}/rest/v1/trades`, {
      method: 'POST',
      headers: { ...svc, 'content-type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(rows),
    })
    if (!insRes.ok) return json({ error: `trades insert ${insRes.status}`, detail: await insRes.text(), accountId }, 500)
    const inserted = await insRes.json()
    return json({ accountId, count: inserted.length, ids: inserted.map((r: { id: string }) => r.id) })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
