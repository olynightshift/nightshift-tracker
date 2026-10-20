-- ============================================================
-- Enable Row Level Security on all tracker tables.
--
-- After this runs, the anonymous API key can NO longer read or
-- write anything — only signed-in users (see AuthGate in the app)
-- get full access. This is what actually protects the data;
-- the login screen alone is only a door, not a lock.
--
-- How to apply:
--   Supabase Dashboard → SQL Editor → New query → paste this file → Run
--
-- Safe to re-run (policies are dropped first).
-- ============================================================

alter table outreach_calendar enable row level security;
alter table salvage               enable row level security;
alter table donations             enable row level security;
alter table clothing_closet       enable row level security;
alter table receipts              enable row level security;
alter table receipt_items         enable row level security;
alter table donors                enable row level security;

drop policy if exists "auth_full_access" on outreach_calendar;
drop policy if exists "auth_full_access" on salvage;
drop policy if exists "auth_full_access" on donations;
drop policy if exists "auth_full_access" on clothing_closet;
drop policy if exists "auth_full_access" on receipts;
drop policy if exists "auth_full_access" on receipt_items;
drop policy if exists "auth_full_access" on donors;

create policy "auth_full_access" on outreach_calendar for all to authenticated using (true) with check (true);
create policy "auth_full_access" on salvage               for all to authenticated using (true) with check (true);
create policy "auth_full_access" on donations             for all to authenticated using (true) with check (true);
create policy "auth_full_access" on clothing_closet       for all to authenticated using (true) with check (true);
create policy "auth_full_access" on receipts              for all to authenticated using (true) with check (true);
create policy "auth_full_access" on receipt_items         for all to authenticated using (true) with check (true);
create policy "auth_full_access" on donors                for all to authenticated using (true) with check (true);
