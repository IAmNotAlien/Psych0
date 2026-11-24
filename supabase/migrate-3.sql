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
