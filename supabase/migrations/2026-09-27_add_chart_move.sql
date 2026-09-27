-- "מהלך גרף": points price moved for / against the trade on each chart
-- timeframe (by candle close), written by the Pine Logs import.
-- Shape: {"1":{"for":60.75,"against":0},"2":{...},"5":{...},"15":{...},"30":{...}}
-- Nullable, no default — existing trades stay null. Safe to run more than once.
alter table public.trades add column if not exists chart_move jsonb;
