-- MFE / MAE from the Pine Logs report ("MFE / MAE (במהלך העסקה, לפי פתיל):
-- בעד 17.25 · נגד 15.00 · נגד עד השיא 8.75"), in points:
--   mfe          — max favorable excursion during the trade
--   mae          — max adverse excursion during the trade
--   mae_to_peak  — adverse move before the MFE peak
-- Nullable, no default — existing trades stay null. Safe to run more than once.
alter table public.trades add column if not exists mfe numeric;
alter table public.trades add column if not exists mae numeric;
alter table public.trades add column if not exists mae_to_peak numeric;
