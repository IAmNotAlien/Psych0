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
