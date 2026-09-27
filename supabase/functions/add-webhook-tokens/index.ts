// One-time migration: webhook_tokens — one secret token per user+journal, used
// by the pine-webhook function to know which journal a TradingView alert feeds.
// Uses the direct Postgres connection injected as SUPABASE_DB_URL.
import postgres from 'npm:postgres@3.4.5'

Deno.serve(async () => {
  const url = Deno.env.get('SUPABASE_DB_URL')
  if (!url) return new Response(JSON.stringify({ error: 'no SUPABASE_DB_URL' }), { status: 500 })
  const sql = postgres(url, { prepare: false })
  try {
    await sql.begin(async (tx) => {
      await tx`
        create table if not exists public.webhook_tokens (
          token uuid primary key default gen_random_uuid(),
          user_id uuid not null references auth.users (id) on delete cascade,
          account_id uuid not null references public.accounts (id) on delete cascade,
          qty numeric not null default 1,
          created_at timestamptz not null default now(),
          unique (user_id, account_id)
        )`
      await tx`alter table public.webhook_tokens enable row level security`
      await tx`drop policy if exists "own webhook tokens" on public.webhook_tokens`
      await tx`
        create policy "own webhook tokens" on public.webhook_tokens
          for all
          using (auth.uid() = user_id)
          with check (
            auth.uid() = user_id and (
              exists (select 1 from public.accounts a where a.id = account_id and a.user_id = auth.uid())
              or exists (
                select 1 from public.journal_shares s
                where s.account_id = webhook_tokens.account_id
                  and s.shared_with_user_id = auth.uid() and s.role = 'editor'
              )
            )
          )`
    })
    const cols = await sql`
      select column_name from information_schema.columns
      where table_schema='public' and table_name='webhook_tokens' order by ordinal_position`
    return new Response(JSON.stringify({ ok: true, columns: cols.map((c: { column_name: string }) => c.column_name) }), {
      headers: { 'content-type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { 'content-type': 'application/json' } })
  } finally {
    await sql.end()
  }
})
