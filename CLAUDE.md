# Trading Journal — Project Context

> Standalone project, unrelated to `vista_project`. Keep them separate.

## What this is
A **trading journal** web app (PWA) for futures day traders (MNQ/MES/ES/YM) — TradeZella-style, Hebrew RTL UI, Notion-style design. The **live site is used every day by real traders with real data**:
https://trading-journal-rho-silk.vercel.app

The owner is **Ofir** (`ofirperez11`). Talk to people in **Hebrew**, explain plainly (they are non-technical), recommend rather than list options.

**Top priority:** statistics/analytics must be the most beautiful and clear part of the product.

## Stack
React 18 + TypeScript + Vite + Tailwind, vite-plugin-pwa, react-router v6.
Backend: Supabase (Postgres + Row Level Security, Auth, Storage, Edge Functions in `supabase/functions/`). Hosting: Vercel.
Repo is **public** — never commit secrets, `.env*`, or personal trade data.

## Who does what — HARD RULES
There are two roles. Figure out which one you are serving before doing anything.

**Owner (Ofir)** — merges to `main`, applies database changes, deploys. Deploy = `npx vercel --prod --yes` from his machine (Vercel is NOT connected to git — merging or pushing does not deploy). Always `git pull` before deploying so collaborators' merged work is included.

**Collaborator (a partner adding features)** — code only, through Pull Requests:
- Work on a branch: `git checkout main && git pull && git checkout -b feature/<short-name>`.
- Open a PR (`gh pr create`); Ofir reviews and merges. **Never** push to `main`, merge your own PR, or deploy.
- **No Supabase access.** Never connect to the live project (ref `catjnfnosutdiqudmecu`) — no `.env` with its keys, no `supabase` CLI commands, no SQL, no function deploys. Do not ask for keys.
- Run locally in **demo mode**: no `.env` file → `npm install && npm run dev`, sign in with any name/email (it's fake, stored in the browser). Data comes from `public/sample/trades.json` (synthetic trades). Demo mode persists to localStorage only.
- Database changes: write `supabase/migrations/<YYYY-MM-DD>_<name>.sql` (idempotent: `add column if not exists`, `create ... if not exists`), mirror it in `supabase/schema.sql`, and put **"דורש מיגרציה"** in the PR title. Ofir applies it before deploying.

## Why the guardrails exist — the egress incident
Screenshots were stored as base64 inside a `trades` column and the app re-downloaded the whole table every 60s per user. Within days the project used 19 GB of egress (free quota: 5 GB) and Supabase restricted the site. Never repeat this:
- **Images live in Storage only**, via `uploadTradeImages` (`src/lib/uploadImages.ts`). Never `data:`/base64 in a DB column.
- **No new polling, refetch loops, or Realtime subscriptions.** `src/lib/useTrades.tsx` is the one sync path: paginated initial load + incremental `updated_at > lastSync` refresh on focus / 90s while visible. Read trades via `useTrades()` / `useTrade()` — don't add your own `supabase.from('trades').select()`.
- Beware `useEffect` fetch loops (dependencies that change every render).
- Don't load images in lists/tables — only on the single-trade page.
- Any new Supabase query must be scoped (filter + select only needed columns) and run once, not per render.

## Data & security rules
- Never bypass RLS. The service-role key exists only inside Edge Functions, never in browser code.
- Updates never change `user_id` / `account_id` (a DB trigger enforces it; `updateTrade` strips them).
- Shared journals: a trade belongs to the journal owner (`active.user_id`), not whoever created it.
- New trade field = nullable column, default null. Follow the `liquidity` / `zone` / `bias` pattern end to end: `src/types/index.ts` → `normalizeTrade` (`src/lib/trades.ts`) → forms (`TradeForm`, `ScreenshotImport`) → `TradeDetail` → `Trades` table + CSV (`src/lib/csv.ts`) → `src/lib/analytics.ts` + `Analytics.tsx`.
- Dates: `trade.date` is a wall-clock string. For display never `new Date(trade.date)` — slice the string (`formatTradeDateTime`), or hours shift by timezone.

## Design & code conventions
- Keep the existing Notion-style design (`DESIGN.md`, tokens in `tailwind.config.js`): reuse existing components and classes (`tag tag-*`, `border-border`, `text-muted`, `field-label`, …). No new colours, fonts, or visual language. No emojis in the product UI.
- Hebrew RTL everywhere; check layouts on mobile width too (it's installed on iPhones).
- Filters live in the URL (`useSearchParams`); back-navigation uses `state.backTo`.
- Strict TypeScript, no needless `any`, no dead code. Match the surrounding code style.
- `npm run build` must pass (CI runs it on every PR).
- One feature per PR, small and focused. Describe what changed, how you tested it, screenshots for UI changes.

## Before opening a PR
- [ ] `npm run build` passes
- [ ] Tested in demo mode; no live Supabase keys used
- [ ] No base64 in DB, no new polling; DevTools → Network is quiet after the page loads
- [ ] `user_id` / `account_id` untouched, RLS not bypassed
- [ ] No secrets, `.env`, or personal data committed
- [ ] Existing design preserved, Hebrew RTL correct
- [ ] DB change (if any) = migration file + schema.sql + "דורש מיגרציה" in the PR title

## More docs
`README.md` (overview), `DESIGN.md` (design system), `PRODUCT.md`, `SPEC.md` (original plan — partly outdated; the code is the source of truth).
