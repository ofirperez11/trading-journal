-- New lines of the Pine Logs report:
--   lb_touch       — "נגיעה בלוקבק לפני 16:30: כן (08:33)" → true ("לא" → false)
--   lb_touch_time  — when it touched, 'HH:MM' Israel time ('08:33')
--   pine_levels    — the "יעדים (מרחק מהכניסה)" block, one entry per row:
--                    "Td: 29755.00 · 73.50 נק' מתחת" → {"name":"Td","price":29755,"points":73.5,"above":false}
-- Written by the Pine import only. Nullable, no default — existing trades stay null.
-- Safe to run more than once.
alter table public.trades add column if not exists lb_touch boolean;
alter table public.trades add column if not exists lb_touch_time text;
alter table public.trades add column if not exists pine_levels jsonb;
