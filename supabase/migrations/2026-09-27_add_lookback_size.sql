-- "גודל Lookback": the lookback's size in points, from the Pine Logs report
-- ("גודל Lookback: 3.50 נק'") or entered manually in the trade form.
-- Nullable, no default — existing trades stay null. Safe to run more than once.
alter table public.trades add column if not exists lookback_size numeric;
