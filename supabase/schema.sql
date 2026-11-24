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
