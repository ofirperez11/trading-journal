-- ===========================================================================
-- Trading Journal — Supabase schema
-- Multi-tenant from day one: every row is owned by a user, and Row Level
-- Security (RLS) guarantees each user can only read/write their own data.
--
-- How to apply: Supabase dashboard → SQL Editor → paste this file → Run.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- profiles — one row per auth user (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  default_currency text not null default 'USD',
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

-- Auto-create a profile when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- accounts — a trader can have multiple accounts
-- ---------------------------------------------------------------------------
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  broker text,
  currency text not null default 'USD',
  starting_balance numeric,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists accounts_user_idx on public.accounts (user_id);

-- ---------------------------------------------------------------------------
-- trades — the core table
-- ---------------------------------------------------------------------------
create table if not exists public.trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid references public.accounts (id) on delete set null,
  date timestamptz not null,
  symbol text not null,
  market text not null default 'FUTURES',
  side text not null check (side in ('LONG', 'SHORT')),
  status text not null check (status in ('WIN', 'LOSS', 'WASH')),
  qty numeric not null,
  entry numeric not null,
  exit numeric,
  target numeric,
  stoploss numeric,
  entry_total numeric,
  exit_total numeric,
  return_amount numeric not null default 0,
  return_percent numeric,
  r_multiple numeric,
  hold_time integer,           -- seconds
  confidence smallint,         -- 0-5
  lookback text,               -- entry-model time marker (e.g. '16:30')
  peak_price numeric,          -- best price reached in favor (MFE) — for capture analysis
  tags text[],
  notes text,
  mood text,
  discipline_score smallint,   -- 0-10
  executions jsonb,
  images text[],               -- storage paths
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists trades_user_idx on public.trades (user_id);
create index if not exists trades_user_date_idx on public.trades (user_id, date desc);
create index if not exists trades_symbol_idx on public.trades (user_id, symbol);

-- keep updated_at fresh
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trades_touch on public.trades;
create trigger trades_touch before update on public.trades
  for each row execute function public.touch_updated_at();

-- Lock ownership: an UPDATE can never change a trade's owner or journal. Without
-- this, a shared editor's edit would "steal" the trade (its user_id would flip to
-- the editor), hiding it from the journal owner under row-level security.
create or replace function public.trades_lock_ownership()
returns trigger language plpgsql as $$
begin
  new.user_id := old.user_id;
  new.account_id := old.account_id;
  return new;
end; $$;

drop trigger if exists trades_lock_ownership on public.trades;
create trigger trades_lock_ownership before update on public.trades
  for each row execute function public.trades_lock_ownership();

-- ---------------------------------------------------------------------------
-- journal_entries — daily emotional / discipline log
-- ---------------------------------------------------------------------------
create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  mood text,
  followed_rules boolean,
  notes text,
  lessons text,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);
create index if not exists journal_user_idx on public.journal_entries (user_id);

-- ===========================================================================
-- Row Level Security — owner-only access on every table
-- ===========================================================================
alter table public.profiles        enable row level security;
alter table public.accounts        enable row level security;
alter table public.trades          enable row level security;
alter table public.journal_entries enable row level security;

-- profiles: a user can see and edit only their own profile row
create policy "own profile - select" on public.profiles
  for select using (auth.uid() = id);
create policy "own profile - update" on public.profiles
  for update using (auth.uid() = id);

-- generic owner policy for the user-owned tables
do $$
declare t text;
begin
  foreach t in array array['accounts', 'trades', 'journal_entries'] loop
    execute format($f$
      create policy "own rows - select" on public.%1$I
        for select using (auth.uid() = user_id);
      create policy "own rows - insert" on public.%1$I
        for insert with check (auth.uid() = user_id);
      create policy "own rows - update" on public.%1$I
        for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
      create policy "own rows - delete" on public.%1$I
        for delete using (auth.uid() = user_id);
    $f$, t);
  end loop;
end $$;

-- ===========================================================================
-- Storage — private bucket for trade screenshots
-- ===========================================================================
insert into storage.buckets (id, name, public)
values ('trade-images', 'trade-images', false)
on conflict (id) do nothing;

-- Files are stored under a path that starts with the user's id:
--   trade-images/<user_id>/<trade_id>/<file>
-- so we authorize by matching the first path segment to auth.uid().
create policy "own images - all" on storage.objects
  for all
  using (bucket_id = 'trade-images' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'trade-images' and (storage.foldername(name))[1] = auth.uid()::text);

-- ===========================================================================
-- journal_shares — share a journal (account) with another user
-- An owner invites by email; on accept, shared_with_user_id is linked.
-- role 'viewer' = read-only, 'editor' = read + write.
-- ===========================================================================
create table if not exists public.journal_shares (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  shared_with_email text not null,
  shared_with_user_id uuid references auth.users (id) on delete cascade,
  role text not null default 'viewer' check (role in ('viewer', 'editor')),
  created_at timestamptz not null default now(),
  unique (account_id, shared_with_email)
);
create index if not exists shares_account_idx on public.journal_shares (account_id);
create index if not exists shares_recipient_idx on public.journal_shares (shared_with_user_id);

alter table public.journal_shares enable row level security;

-- The owner fully manages a journal's shares.
create policy "owner manages shares" on public.journal_shares
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
-- A recipient can see the share rows that point at them.
create policy "recipient sees own share" on public.journal_shares
  for select using (auth.uid() = shared_with_user_id);

-- Extend access so shared users can read (and editors write) the journal's
-- data. RLS policies are permissive and combine with OR, so these sit
-- alongside the owner-only policies above.
create policy "shared - account select" on public.accounts
  for select using (
    exists (
      select 1 from public.journal_shares s
      where s.account_id = accounts.id and s.shared_with_user_id = auth.uid()
    )
  );
create policy "shared - trades select" on public.trades
  for select using (
    exists (
      select 1 from public.journal_shares s
      where s.account_id = trades.account_id and s.shared_with_user_id = auth.uid()
    )
  );
create policy "shared editor - trades write" on public.trades
  for all
  using (
    exists (
      select 1 from public.journal_shares s
      where s.account_id = trades.account_id
        and s.shared_with_user_id = auth.uid() and s.role = 'editor'
    )
  )
  with check (
    exists (
      select 1 from public.journal_shares s
      where s.account_id = trades.account_id
        and s.shared_with_user_id = auth.uid() and s.role = 'editor'
    )
  );
