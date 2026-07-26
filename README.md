# Trading Journal

A full-stack, multi-tenant **trading journal** web app that turns every logged trade into a clear, honest picture of performance. Traders record trades — manually, from a chart **screenshot**, or via CSV — and get rigorous, beautiful analytics to review after the session and improve the next one.

Built as a real product used daily by me and fellow futures day traders.

> **Stack:** React · TypeScript · Vite · Tailwind CSS · Zustand · React Router · Supabase (PostgreSQL, Auth, Edge Functions, Storage) · PWA · Vercel

---

## Highlights

- **Multi-tenant by design.** Every row is owned by a user, and PostgreSQL **Row-Level Security (RLS)** guarantees each user can read/write only their own data — the security model lives in the database, not just the UI.
- **Three ways to log a trade.** Manual entry, **Tradovate CSV import**, or **screenshot import** — a Supabase **Edge Function** sends the chart image to a vision model and returns structured trade fields (entry, stop, target, exit) for one-tap confirmation.
- **Analytics, hand-built.** Equity curve, win-rate, P&L distributions and a weekly summary — custom-coded charts with no charting library.
- **Multiple journals & accounts.** Separate backtest / live / partner journals, each with its own stats.
- **Installable PWA.** Works offline, updates silently on tab return, and is optimized to minimize backend egress (incremental sync + dedicated image storage).

## Architecture

```
React + Vite (TypeScript)        ← SPA, Zustand for state, React Router
        │  supabase-js
        ▼
Supabase
  ├─ PostgreSQL + Row-Level Security   ← profiles, accounts, trades (per-user)
  ├─ Auth                              ← email/password sessions
  ├─ Storage                           ← trade screenshots
  └─ Edge Functions (Deno)             ← extract-trade (vision), import, backup, migrate
        │
        ▼
Deployed on Vercel
```

## Running locally

```bash
npm install
cp .env.example .env        # fill in your Supabase URL + anon key
npm run dev                 # http://localhost:5173
```

To enable auth & data, create a Supabase project, run `supabase/schema.sql` in the SQL editor, and set the env vars from `.env.example`. The app runs without credentials too (UI-only demo mode).

## Project structure

```
src/
  pages/         Dashboard, Trades, Analytics, Calendar, TradeForm, ScreenshotImport, …
  components/    Charts (EquityCurve, Donut, BarChart), AppShell, dialogs
  lib/           supabase client, auth, trades, analytics, CSV, image handling
supabase/
  schema.sql     Postgres schema + RLS policies + triggers
  functions/     Edge Functions (extract-trade, import-journal, backup, …)
```

## Notes

Built with modern tooling and an AI-assisted workflow; all product and architecture decisions — data model, RLS security, the screenshot-extraction pipeline, and the analytics — are my own.
