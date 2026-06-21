# Trading Journal — Project Context

> **This is a standalone personal project, completely unrelated to `vista_project` (the owner's school project). Keep them separate.** All work for this app lives under `~/Desktop/trading-journal/`.

## What this is
A personal **trading journal** web app for a day trader (Ofir) who trades futures (MNQ/MES) on **Tradovate**. Intuitive & beautiful, **TradeZella**-style. The owner communicates in Hebrew and is non-technical — explain plainly, recommend rather than list options, and lead the build.

## Direction (decided 2026-06-21)
- **Web app / PWA** (not native) — runs on Mac + iPhone, installable from browser, no App Store.
- **Multi-user** (partners will use it; may be **sold** later — build a strong, sale-ready / multi-tenant foundation, but no payment system yet).
- **Backend: Supabase** free tier (Auth + Postgres + Storage + Row Level Security). Cloud data per-user → free Mac↔iPhone sync; IndexedDB offline cache.
- **Stack:** React + TypeScript + Vite, Tailwind, advanced charts lib, Tesseract.js (OCR).
- **Free to start** (Supabase free tier). The owner does not want to spend money now.

## Top priority
**Statistics/analytics must be the most beautiful & clear part of the product — it's the backbone.**

## Two flagship features
- **A — Screenshot → trade:** upload a trade image → app extracts fields → **confirmation screen** (every field editable) + exact-time checkbox → save. Works in backtest AND live. v1 = free in-browser OCR (Tesseract.js); v2 = Claude Vision API.
- **B — Auto-log live trades from Tradovate:** v1 = CSV import; v2 = Tradovate API (owner unsure if he has API access).

## Data already exported
`data_export/` holds the owner's existing history pulled from StonkJournal: **289 trades** (`trades.json` / `trades.csv`, rich fields incl. executions, target, stoploss, r_multiple, notes) + **271 linked screenshots** (`linked_images/`). All 524 raw images across accounts in `images/`. See `data_export/README.md`.

## Full spec
See **`SPEC.md`** (v2.0) for the complete plan, data model, screens, and 7-step build plan. Step 0 = scaffold (React+Vite+Tailwind+PWA) + connect Supabase + data model + RLS.
