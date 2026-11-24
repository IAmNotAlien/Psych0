-- ============================================================
-- PSYCH://OS — migration 4: the brain's memory (persistent chat)
-- brain_sessions + brain_messages — chat survives refreshes and devices.
-- Run in the Supabase SQL editor. Idempotent.
-- RLS is ON with NO policies: the anon/publishable key is locked out
-- (chat is private); only the service key can read/write.
-- ============================================================

create table if not exists brain_sessions (
  id text primary key,
  title text not null default 'new chat',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists brain_messages (
  id bigint generated always as identity primary key,
  session_id text not null references brain_sessions(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  meta jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists brain_messages_session_idx on brain_messages (session_id, created_at);

alter table brain_sessions enable row level security;
alter table brain_messages enable row level security;
-- no policies on purpose: anon/publishable → zero access; service key → full access
