-- ============================================================
-- PSYCH0 — ALL-IN-ONE SETUP (run in ANY Supabase project's SQL editor)
-- Paste this WHOLE FILE in Supabase → SQL editor → Run.
-- Covers schema + migrations 1+2+3+4 (studio, garden, OS vault, drive, brain memory).
-- Idempotent — safe to run more than once.
-- ============================================================

-- ============================================================
-- PSYCH0 — Supabase schema
-- Run this in the Supabase SQL editor (Dashboard → SQL → New query)
-- once, before connecting the app.
-- ============================================================

-- ---------- tables (text ids: the app generates them client-side) ----------

create table if not exists site (
  id         int primary key default 1 check (id = 1),
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists posts (
  id         text primary key,
  slug       text not null unique,
  title      text not null default 'UNTITLED',
  date       date,
  tags       text[] not null default '{}',
  cover      text not null default '',
  pinned     boolean not null default false,
  published  boolean not null default false,
  body       text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists projects (
  id         text primary key,
  slug       text not null unique,
  title      text not null default 'UNTITLED',
  status     text not null default 'WIP',
  year       text not null default '',
  role       text not null default '',
  stack      text[] not null default '{}',
  cover      text not null default '',
  links      jsonb not null default '[]',
  featured   boolean not null default false,
  body       text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists embeds (
  id         text primary key,
  title      text not null default 'NEW WINDOW',
  url        text not null default 'https://example.com',
  note       text not null default '',
  h          int not null default 420,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- row level security ----------
-- The Next.js API routes use the SERVICE ROLE key (server-side only), which
-- bypasses RLS. Anon visitors get read-only access to public content.

alter table site     enable row level security;
alter table posts    enable row level security;
alter table projects enable row level security;
alter table embeds   enable row level security;

drop policy if exists "public read site"     on site;
drop policy if exists "public read posts"    on posts;
drop policy if exists "public read projects" on projects;
drop policy if exists "public read embeds"   on embeds;

create policy "public read site"     on site     for select using (true);
create policy "public read posts"    on posts    for select using (published = true);
create policy "public read projects" on projects for select using (true);
create policy "public read embeds"   on embeds   for select using (true);

-- no anon write policies = anon cannot write. drafts stay server-side only.

-- ---------- seed the site row (the app upserts over this) ----------

insert into site (id, data)
values (1, '{"name":"Psych0","logo":"PSYCH0","tagline":"hand-crafted web den — blog // portfolio // lab","now":"","about":"","accent":"#ff5c00","accent2":"#00e0c8","preset":"psych0","fx":{"grid":true,"scan":true,"crt":false,"cross":true,"boot":true,"sound":true,"glitch":true},"showDrafts":true,"customCss":"","socials":[]}')
on conflict (id) do nothing;

-- ============================================================
-- PSYCH0 — migration 1: studio power features
-- revisions / messages / media / tokens / counters + scheduled posts
-- ============================================================

-- scheduled publishing + time capsules
alter table posts add column if not exists publish_at timestamptz;

-- version history (snapshot taken before every studio save)
create table if not exists revisions (
  id         bigserial primary key,
  entity     text not null,          -- post | project | embed | site
  entity_id  text not null,          -- row id, or 'site'
  snapshot   jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists revisions_entity_idx on revisions (entity, entity_id, created_at desc);

-- visitor inbox + guestbook
create table if not exists messages (
  id         text primary key,
  name       text not null default 'ANON',
  contact    text not null default '',
  body       text not null default '',
  public     boolean not null default true,  -- shown in guestbook
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

-- media library metadata (files live in the storage bucket 'media')
create table if not exists media (
  id         text primary key,
  path       text not null,
  url        text not null,
  mime       text not null default '',
  size       bigint not null default 0,
  created_at timestamptz not null default now()
);

-- API tokens (sha256 hashes only — raw token is shown once at creation)
create table if not exists tokens (
  id         text primary key,
  hash       text not null unique,
  label      text not null default '',
  created_at timestamptz not null default now(),
  last_used  timestamptz
);

-- counters: visits, per-post views, votes
create table if not exists counters (
  key  text primary key,
  n    bigint not null default 0
);

-- ---------- row level security ----------
alter table revisions enable row level security;
alter table messages  enable row level security;
alter table media     enable row level security;
alter table tokens    enable row level security;
alter table counters  enable row level security;

drop policy if exists "public read guestbook" on messages;
create policy "public read guestbook" on messages for select using (public = true);

drop policy if exists "public read counters" on counters;
create policy "public read counters" on counters for select using (true);

-- revisions/media/tokens: no anon policies — service-role API routes only.

-- atomic counter bump
create or replace function bump_counter(k text, by bigint default 1) returns bigint
language sql as $$
  insert into counters (key, n) values (k, by)
  on conflict (key) do update set n = counters.n + by
  returning n;
$$;

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

-- ============================================================
-- PSYCH://OS — migration 3: the private vault layer
-- items (notes/tasks/habits/money/everything), files (drive), links (shortener)
-- Run in the Supabase SQL editor (Dashboard → SQL → New query).
-- Idempotent — safe to run more than once.
-- ============================================================

-- ---------- items: the everything table ----------
create table if not exists items (
  id            text primary key,
  type          text not null default 'note',
  title         text not null default '',
  body          text not null default '',
  data          jsonb not null default '{}',
  tags          text[] not null default '{}',
  folder        text not null default '',
  done          boolean not null default false,
  pinned        boolean not null default false,
  secure        boolean not null default false,
  cipher        text not null default '',
  iv            text not null default '',
  salt          text not null default '',
  share         text not null default '',
  burns         int not null default 0,
  reads         int not null default 0,
  share_expires timestamptz,
  deliver_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists items_type_idx  on items (type, updated_at desc);
create index if not exists items_share_idx on items (share);
create index if not exists items_due_idx   on items (done, updated_at desc);

-- ---------- files: the drive ----------
create table if not exists files (
  id            text primary key,
  name          text not null default 'file',
  folder        text not null default '/',
  mime          text not null default 'application/octet-stream',
  size          bigint not null default 0,
  path          text not null default '',
  url           text not null default '',
  text          text not null default '',
  share         text not null default '',
  share_expires timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists files_share_idx on files (share);

-- ---------- links: the shortener ----------
create table if not exists links (
  id         text primary key,
  slug       text not null unique,
  url        text not null,
  clicks     int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- storage bucket for the drive ----------
insert into storage.buckets (id, name, public)
values ('drive', 'drive', true)
on conflict (id) do nothing;

-- ---------- row level security ----------
-- items / files / links are PRIVATE: the API routes use the service role key
-- (server-side), anon gets NO policies at all. Public shares resolve through
-- /api/share/[token] and /l/[slug] on the server, never direct table reads.
alter table items enable row level security;
alter table files enable row level security;
alter table links enable row level security;

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
