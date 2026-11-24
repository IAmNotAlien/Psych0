-- ============================================================
-- PSYCH0 — migration 2: garden / fossils / pixel map / 2025 mega update
-- Run in the Supabase SQL editor (Dashboard → SQL → New query).
-- Idempotent — safe to run more than once.
-- ============================================================

-- garden states (seedling / budding / evergreen)
alter table posts add column if not exists stage text;

-- fossil mode — old posts kept for the record
alter table posts add column if not exists fossil boolean not null default false;

-- guestbook pixel map pin ("col,row" on the 60x15 world grid)
alter table messages add column if not exists loc text not null default '';
