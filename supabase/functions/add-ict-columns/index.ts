// One-time migration: add ICT context columns to trades (liquidity, zone).
// Uses the direct Postgres connection injected as SUPABASE_DB_URL.
import postgres from 'npm:postgres@3.4.5'

Deno.serve(async () => {
  const url = Deno.env.get('SUPABASE_DB_URL')
  if (!url) return new Response(JSON.stringify({ error: 'no SUPABASE_DB_URL' }), { status: 500 })
  const sql = postgres(url, { prepare: false })
  try {
    await sql`alter table public.trades add column if not exists liquidity text`
    await sql`alter table public.trades add column if not exists zone text`
    const cols = await sql`
      select column_name from information_schema.columns
      where table_schema='public' and table_name='trades' and column_name in ('liquidity','zone')
      order by column_name`
    return new Response(JSON.stringify({ ok: true, added: cols.map((c: { column_name: string }) => c.column_name) }), {
      headers: { 'content-type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { 'content-type': 'application/json' } })
  } finally {
    await sql.end()
  }
})
