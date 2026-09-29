-- Break-even from the Pine Logs report:
--   be_triggered  — "ברייק-איבן: הופעל אחרי 9 דק'" → true, "ברייק-איבן: לא" → false
--   be_minutes    — minutes after entry it kicked in
--   no_be_points  — "תוצאה בלי ברייק-איבן: טרגט +60" → the result without break-even, points
-- Nullable, no default — existing trades stay null. Safe to run more than once.
alter table public.trades add column if not exists be_triggered boolean;
alter table public.trades add column if not exists be_minutes numeric;
alter table public.trades add column if not exists no_be_points numeric;
