-- "שבוע בחודש": week of the month (1-5), from the Pine Logs report
-- ("שבוע בחודש: 3") or picked in the trade form's context section.
-- Nullable, no default — existing trades stay null. Safe to run more than once.
alter table public.trades add column if not exists week_of_month smallint;
