# PSYCH0 — hand-crafted web den (Next.js edition)

The terminal-punk personal site — **blog // portfolio // lab** — rebuilt on
**Next.js 16 + React 19 + Tailwind 4** with a **serverless backend** and a
**Supabase-ready data layer**. Same orange-on-black CRT soul, now with a real
database behind it.

## The stack

| layer | what it is |
| --- | --- |
| FRONTEND | Next.js 16 App Router, React 19, hash-routed single-page den, hand-written CRT theme (`src/app/psych0.css`) |
| BACKEND | serverless API routes under `src/app/api/*` — deploy free on Vercel |
| DATABASE | **Supabase** (Postgres). Add your keys → everything persists. No keys yet → LOCAL MODE (seed content, browser-only edits) |
| STUDIO | passcode-gated owner area: editors with live preview + autosave, settings, theme engine |

## Quickstart

```bash
bun install        # or npm install
bun run dev        # dev server on :3000 (logs → dev.log)
```

Open the den. Default content ships with the app (LOCAL MODE — nothing leaves
your browser until you connect Supabase).

## Connect Supabase (2 minutes)

1. Create a free project at **supabase.com**
2. **SQL editor** → paste `supabase/schema.sql` → Run
   (creates `site` / `posts` / `projects` / `embeds`, enables RLS: anon gets
   read-only access to published content, writes only via the server)
   → then run `supabase/migrate-1.sql` and `supabase/migrate-2.sql`
   (revisions, guestbook, media, tokens, counters, scheduled posts +
   garden states, fossils, pixel-map pins — both idempotent).
3. **Project Settings → API** → copy the **URL** and the **service_role** key
4. Add env vars — `.env.local` locally, or Vercel → Settings → Environment Variables:

```
SUPABASE_URL=https://YOURPROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

5. Restart the dev server / redeploy. The boot screen and footer now read
   **SUPABASE**; every studio edit persists in your Postgres and every visitor
   sees the same content.

`.env.example` documents every variable. The service key is used **server-side
only** (API routes) — it never reaches the browser.

## The studio

`#/studio` — passcode gate (default **`psych0`**; set `STUDIO_PASSCODE` in env
to change it). Inside:

- **log entries** — posts with markdown + directives, tags, covers, pins,
  drafts, slugs, live side-by-side preview, autosave, word count
- **projects** — status / stack / links / featured, galleries in the body
- **lab** — iframe embeds with height control
- **settings** — identity, NOW feed, socials, 6 theme presets + custom accent
  colors, effect toggles (grid / scanlines / CRT / crosshair / glitch / sounds /
  boot), raw **custom CSS** injection, JSON export/import

### the two modes

Press **`M`** or the header button:

- **◐ STUDIO** — owner view: drafts visible, edit buttons everywhere
- **○ PUBLIC** — visitor view: drafts hidden, studio locked to the passcode gate

## Markdown directives

```
@embed https://en.wikipedia.org/wiki/100_Rabbits 480   ← click-to-load iframe
@youtube dQw4w9WgXcQ                                   ← watch URLs auto-convert
@img https://… | caption                               ← figure with caption
@gallery url1 | url2 | url3                            ← image grid
@html <b>raw html, sanitized</b> @endhtml              ← scripts stripped
:::tip TITLE … :::                                     ← note/tip/warn/danger callouts
```

Plus standard markdown: tables, lists, quotes, `~~~` fences, `==highlight==`,
`~~strike~~`, <kbd>kbd</kbd> inline HTML.

## Console

`CTRL+K` — command palette + terminal mode (`>` prefix):

```
> help
> goto lab
> theme matrix        (or: theme #ff0000)
> fx crt off
> new post
```

Keyboard: `CTRL+K` console · `S` full-text search · `M` mode · `N`/`P` new post/project · `E` edit
current · `?` shortcuts · `ESC` close.

## The serverless API

| route | auth | what |
| --- | --- | --- |
| `GET /api/health` | — | status + mode (supabase / local) + migrate-2 column probe |
| `GET /api/site` · `PUT` | PUT: studio | site identity/theme/fx (single jsonb row) |
| `GET /api/posts[?drafts=1]` · `POST` | drafts/POST: studio | list (public = published only) / upsert — fires publish webhooks on draft→live |
| `PATCH/DELETE /api/posts/[id]` | studio | update / delete |
| `GET/POST /api/projects`, `PATCH/DELETE /api/projects/[id]` | writes: studio | same pattern |
| `GET/POST /api/embeds`, `PATCH/DELETE /api/embeds/[id]` | writes: studio | same pattern |
| `POST /api/studio/login` · `logout` · `GET /api/studio/session` | — | HMAC-signed httpOnly cookie |
| `GET /api/fetch?url=` | — | text proxy for the read-later clipper (public http(s) only, SSRF-guarded, 8s timeout, 400 KB cap) |
| `POST /api/hook` | Bearer token | post-from-anything: scripts, iOS Shortcuts, the `psych0` CLI |
| `GET /share` | — | PWA share-target landing — the OS "share → PSYCH0" becomes a draft |

Auth is a hobby-grade passcode gate (timing-safe compare, signed httpOnly
cookie, 30-day TTL). **Upgrade path:** Supabase Auth magic links — swap
`src/lib/studio.ts` for a Supabase session check when you want real accounts.

## Mega update — the 24 new powers (features 19–42)

**In the studio**

- **19 · Focus mode** — `◌ FOCUS` in the post editor dims everything that isn't your body text and typewriter-scrolls the caret to 40% viewport height.
- **20 · Post doctor** — `#/doctor`: lints every post (broken `[[wikilinks]]`, duplicate slugs, stuck schedules, ghost drafts, missing tags/covers/alt text, too-short posts) with a health score per post, plus an async dead-image scan.
- **21 · Writing heatmap** — dashboard: GitHub-style 26-week grid of save events (owner's browser + post dates), current + longest streak.
- **22 · Split preview 2.0** — scroll-synced editor↔preview in post/project/about editors, plus a `◫ SPLIT / ⇕ STACK` layout toggle.
- **23 · Conflict shield** — two tabs editing the same post? The editor polls revisions (or watches localStorage in local mode), warns "saved from somewhere else", offers KEEP MINE / LOAD THEIRS — the loser version stays in ⏱ HISTORY.
- **24 · Import engine** — `#/import`: drop markdown files (with front-matter), pasted HTML pages, or a WordPress WXR export → converted to clean reviewable drafts.
- **25 · On this day** — dashboard widget: "2y ago you wrote…" for same-day posts from earlier years.
- **26 · Read-later clipper** — `#/feeds`: subscribe to RSS/Atom feeds (pulled through `/api/fetch` — no CORS pain), clip any item into a draft with source + date.

**Reader-facing**

- **27 · /now page** — `#/now`: nownownow-style status page with moon phase, local time, last-tended date and the fresh log.
- **28 · Garden states** — every post is 🌱 seed / 🌿 budding / 🌲 evergreen (auto-suggested by age, overridable in the editor, shown in lists).
- **29 · Fossil mode** — mark a post ⛏ fossil: it stays up with a "thinking from 2024, kept for the record" banner. Never delete, archive.
- **30 · Take a copy** — every post: ⤓ .MD (with front-matter), ⤓ .TXT (stripped), ⤓ PDF (print-ready popup), ⧉ COPY MD. Zero lock-in.
- **31 · Reader controls** — the `Aa` button: font size, narrow/wide measure, mono/serif — saved per visitor in their browser.
- **32 · Full-text search** — press `S` (or the ⌕ button): fuzzy search over all post bodies + projects, with snippets.
- **33 · Webring** — configure friend sites in SETTINGS → WEBRING; ABOUT page gets ◀ PREV · ring · NEXT ▶.
- **34 · Colophon page** — `#/colophon`: stack, fonts, fx count, live-measured page weight + CO₂e estimate, machine-room links. Intro text editable in settings.
- **35 · Moon ticker** — header moon glyph + phase (hover for illumination %), moon/local-time/last-log chips on the homepage.
- **36 · Guestbook pixel map** — visitors drop a pin on a 60×15 pixel world map; pins persist on messages and show as 📍 on entries.
- **37 · Zine factory** — `#/zine`: compile a year of posts into a printable zine (cover, TOC, one entry per page) → print to PDF, or download as .md.
- **38 · Low-power mode** — footer `⚡ LOW-POWER`: strips every effect/animation and shows the live page-weight badge. Permacomputing flex.
- **39 · Time machine** — footer `⏮`: scrub the whole den back to any date — posts, projects, graph and the homepage all obey. A banner marks the time travel.
- **40 · PWA + share target** — installable app (`manifest.webmanifest` + service worker + icons); share any link/text to PSYCH0 from your phone → lands in `/share` → becomes a draft.
- **41 · psych0 CLI** — `psych0-cli.sh`: `psych0 quick "thought"` / `psych0 post "TITLE" -b "body"` / `psych0 list` / `psych0 health` from any terminal, via API tokens.
- **42 · Publish webhooks** — SETTINGS → WEBHOOKS: when a post goes live, every URL gets `POST {event:'post.published', slug, title, url}`. Discord pings, Zapier, whatever.

## Deploy to Vercel

```bash
npm i -g vercel
vercel            # login, accept defaults
vercel --prod     # → https://psych0-<you>.vercel.app
```

Or push to GitHub and import at **vercel.com/new** (zero config). Then add
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STUDIO_PASSCODE` in Project →
Settings → Environment Variables and redeploy. `/api/*` routes deploy as
serverless functions automatically.

## Project map

```
src/lib/types.ts        shared types + seed content
src/lib/markdown.ts     markdown engine + directives (XSS-safe by escaping)
src/lib/moon.ts         moon phase math          src/lib/worldmap.ts   pixel world map
src/lib/lint.ts         post doctor checks       src/lib/feeds.ts      RSS/Atom parser
src/lib/importer.ts     md/html/WXR → posts      src/lib/zine.ts       zine compiler
src/lib/pageweight.ts   page weight + CO₂e est.  src/lib/presets.ts    theme presets
src/lib/supabase.ts     server-only Supabase client factory
src/lib/repo.ts         repository: Supabase when configured, seed fallback otherwise
src/lib/studio.ts       passcode gate (cookie sign/verify, server+route helpers)
src/app/api/*           serverless backend (24 routes)
src/app/share/page.tsx  PWA share-target landing
src/components/psych0/  store (zustand) · shell · views · studio · studio2 (doctor/feeds/import/zine) · power · ui · webc
src/app/psych0.css      the whole CRT theme
public/manifest.webmanifest + public/sw.js + public/icons/   PWA
supabase/schema.sql     tables + RLS policies
supabase/migrate-1.sql  revisions/messages/media/tokens/counters/publish_at
supabase/migrate-2.sql  garden stage/fossil columns + guestbook map pins
```

## Notes

- The site is a hash-routed SPA on `/` (`#/blog/…`, `#/projects/…`) — deep
  links, the console and the lab all work the same on Vercel as locally.
- LOCAL MODE edits live in `localStorage` (`psych0.data.v2`); export/import
  JSON round-trips them. Connecting Supabase later does not lose the seed.
- No trackers, no analytics, one accent color at a time — as intended.

## PSYCH://OS — the personal operating system layer

The den's private half, at `#/os` (studio-gated). Everything is an **item** —
one generic table (`items`) powers notes, tasks, habits, expenses, flashcards
and your own custom collections, so there is one editor, one search, one AI
and one export over all of it.

**THINK** — THE BRAIN (AI chat over your whole vault with cited sources,
daily briefing, semantic search, AI personas, voice dictation) · CAPTURE
inbox (console `> cap`, phone share, Telegram bot, email-in webhook) · NOTES
([[wikilinks]], backlinks, templates, version history, outliner, share +
burn-after-reading links) · JOURNAL (daily pages + letters to your future self).

**KEEP** — DRIVE (folders, drag-drop + paste upload, gallery, OCR on images,
expiring share links, chat-with-doc) · VAULT (AES-256-GCM secrets + sealed
documents) · BOOKMARKS (AI descriptions) · COLLECTIONS (build your own
databases with any fields, table/card views).

**DO** — TASKS (GTD inbox → priority kanban) · CALENDAR (month grid with
tasks, events, countdowns) · HABITS (56-day grids, streaks, mood/sleep
graphs) · FOCUS (pomodoro with a session log) · GOALS (progress rings) ·
FLASHCARDS (SM-2 spaced repetition + generate-from-note) · REVIEW (AI weekly
review assembled from every log).

**DATA** — MONEY (expenses, categories, subscription alarms) · PEOPLE (CRM
with silence nudges) · SHELF (watch/read/play tracker) · TRAVEL (pixel world
map pins) · RECIPES (with a dinner decider) · IDEAS (incubator with
resurfacing).

**SYS** — SHORT LINKS (`/l/<slug>` on your own domain) · RULES (if-this-
then-that on every capture, server-side) · IMPORT (CSV → any type) ·
PLUMBING (capture webhook + secret, Telegram setup, mega backup).

Server pieces: `/api/items`, `/api/brain` (RAG + offline retrieval mode),
`/api/files` (+ storage bucket `drive`), `/api/links` + `/l/[slug]`,
`/api/share/[token]` (powers `/p/<token>` and `/burn/<token>`), `/api/inbox`
(secret-gated capture from anywhere), `/api/backup`. Public pages:
`/p/<token>` shared note, `/burn/<token>` self-destructing note, `/l/<slug>`
redirect.

Setup: run `supabase/migrate-3.sql`, then (optional) set `OPENAI_API_KEY`
(any OpenAI-compatible provider works; `OPENAI_VISION_MODEL` for OCR,
`OPENAI_EMBED_MODEL` for semantic search, `TELEGRAM_BOT_TOKEN` for bot
replies). Without Supabase everything runs in LOCAL MODE with a seeded demo
vault; without an AI key the brain answers in honest retrieval mode.
