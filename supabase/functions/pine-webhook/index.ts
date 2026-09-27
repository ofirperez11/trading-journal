// Supabase Edge Function: pine-webhook
// ---------------------------------------------------------------------------
// Receives the trade report that the "full auto NOD indicator" sends through a
// TradingView alert webhook, and saves it as a trade in the journal the URL's
// token belongs to (see public.webhook_tokens, created in Settings).
//
// Webhook URL:  <SUPABASE_URL>/functions/v1/pine-webhook?token=<uuid>
// Deploy:       npm run fn:sync && supabase functions deploy pine-webhook --no-verify-jwt
//               (TradingView can't send an auth header — the token IS the auth.)
// ---------------------------------------------------------------------------
import { createClient } from 'npm:@supabase/supabase-js@2'
import { parsePineLogs, pineTradeRow } from '../_shared/pineLog.ts'

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } })
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
  const token = new URL(req.url).searchParams.get('token') ?? ''
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) return json({ error: 'bad token' }, 401)

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })
  const { data: tok, error: tokErr } = await sb
    .from('webhook_tokens')
    .select('account_id, qty, accounts(user_id)')
    .eq('token', token)
    .maybeSingle()
  if (tokErr) return json({ error: tokErr.message }, 500)
  if (!tok) return json({ error: 'unknown token' }, 401)
  const owner = (tok.accounts as unknown as { user_id: string } | null)?.user_id
  if (!owner) return json({ error: 'journal not found' }, 404)

  const text = await req.text()
  const reports = parsePineLogs(text).filter((t) => t.result !== 'unfilled' && t.result !== 'unknown')
  if (!reports.length) return json({ ok: true, inserted: 0, note: 'no finished trade in message' })

  const inserted: string[] = []
  const skipped: string[] = []
  for (const t of reports) {
    const row = pineTradeRow(t, Number(tok.qty) || 1)
    // TradingView may retry a webhook — never store the same opportunity twice.
    const { data: dup } = await sb
      .from('trades')
      .select('id')
      .eq('account_id', tok.account_id)
      .eq('date', row.date)
      .eq('side', row.side)
      .eq('symbol', row.symbol)
      .limit(1)
    if (dup && dup.length) {
      skipped.push(t.key)
      continue
    }
    const { error } = await sb.from('trades').insert({ ...row, user_id: owner, account_id: tok.account_id })
    if (error) return json({ error: error.message, inserted, skipped }, 500)
    inserted.push(t.key)
  }
  return json({ ok: true, inserted, skipped })
})
