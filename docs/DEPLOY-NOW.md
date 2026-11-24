# PSYCH0 is LIVE — full stack 🚀

## Your site

**https://psych0.vercel.app** (production alias — permanent)

Deployed: 2026-11-23 · account `gunter404` · project `psych0`
Stack: Next.js 16 on Vercel + Supabase (Postgres) · **BACKEND SUPABASE**
(PERSISTENT mode — studio edits now save for every visitor)

## Database

- Vercel Marketplace resource **`supabase-beige-ocean`** (region us-east-1),
  tied to your Vercel login — manage it at the Supabase dashboard or via
  Vercel → Integrations → Supabase.
- Schema applied: `posts`, `projects`, `embeds`, `site` (with RLS — public
  read-only, writes only via the service-role API routes).
- Seeded with the demo content (3 posts, 3 projects, 5 embeds, site settings).
- All `SUPABASE_*` / `POSTGRES_*` env vars are injected automatically by the
  integration on Production, Preview and Development.

## Studio passcode

Set your own (never stored in the repo):

```bash
printf "%s" "YOUR-PASSCODE" | vercel env add STUDIO_PASSCODE production
vercel deploy --prod --yes
```

Until you set one, the studio accepts the demo passcode `psych0` and shows a
warning — change it before sharing the site.

Studio: https://psych0.vercel.app/#/studio

## Everyday update flow

- Edit in the studio (blog, projects, lab, settings) → saves straight to
  Supabase, live immediately. No redeploy needed for content.
- Code changes: `vercel deploy --prod --yes`.
- The `.vercelignore` keeps uploads clean (never remove `.next/` from it —
  the turbopack dev cache can exceed Vercel's 100 MB file limit).

## Verified at deploy time

- `/api/health` → `{"ok":true,"mode":"supabase","supabaseUrl":"<your-ref>.supabase.co"}` ✅
- Studio login (passcode) → create post → persisted in Supabase → delete ✅
- Public reads: 2 published posts, 3 projects, 5 embeds ✅
- Home + studio render in a real browser, `BACKEND SUPABASE` badge, zero
  console errors ✅
- Fixed during setup: `getBundle()` site-row double-unwrap bug (only
  triggered in PERSISTENT mode).

## Fonts (restored from the original HTML version)

- Big PSYCH0 hero + all brand/heading marks: **Silkscreen** (pixel font)
- Body/base font: **JetBrains Mono** (replaced Geist Mono)
- Font-variable classes live on `<html>` (src/app/layout.tsx) — required so
  the `--p0disp` var chain resolves on `:root`.

## POWER FEATURES (added 2026-11-23) — everything verified live ✅

| Feature | Where | Notes |
| --- | --- | --- |
| Version history | every editor → ⏱ HISTORY → ⟲ RESTORE | last 20 snapshots per item, taken on every save |
| Media library | `#/media` (studio) | drag-drop, paste, browse → Supabase Storage, copy URL / @img |
| Visitor inbox + guestbook | `#/mail` | public form + guestbook; studio sees inbox, mark read, hide, delete |
| Post-from-anything | `POST /api/hook` + Bearer token | create tokens in SETTINGS → API TOKENS; drafts by default |
| Dashboard | `#/dash` (studio) | visits, top paths, scheduled queue, quick actions |
| Scheduled posts | editor → PUBLISH AT | future posts hidden from visitors until go-live (time capsules) |
| AI writing assistant | editor sidebar ✦ | needs `OPENAI_API_KEY` (+ optional `OPENAI_BASE_URL`, `OPENAI_MODEL`) in env — degrades gracefully without |
| Wiki-links + graph | `[[slug]]` in any post → `#/graph` | backlinks appear as MENTIONED IN on post pages |
| RSS + sitemap + robots | `/feed.xml`, `/sitemap.xml` | footer RSS link |
| OG social cards | `/api/og?title=…` | Silkscreen pixel-font cards, edge-rendered |
| 88×31 badge maker | SETTINGS → BADGE | SVG, copy embed code |
| Console plugins | SETTINGS → PLUGINS | JSON commands in CTRL+K (`goto` / `url` / `text`) |
| Web components | `<psych0-counter to="99">`, `<psych0-vote id="x">` | paste inside `@html … @endhtml` blocks |
| 404 rescue shell | any broken `#/route` | playable mini-terminal with a guessing game |
| Konami glitch storm | ↑↑↓↓←→←→BA | try it on the 404 page |
| Rare boot lines | 1-in-14 boots | easter egg |
| 3 new themes | ◍ cycle / palette | vaporwave, c64, toxic |
| Read aloud | post view ▶ READ ALOUD | browser speech synthesis |
| Visit counter | automatic | per-path + total, shown on dashboard |

### Fix shipped with this build

`.vercelignore` used a bare `upload/` pattern which (gitignore-style) also
excluded `src/app/api/upload/` — uploads 404'd. Now anchored to `/upload/`.

---

# MEGA UPDATE (features 19–42) — 24 new powers 🚀

**Shipped in code + build-verified. Live site needs 2 steps: run migration 2,
redeploy.**

## 1. Database migration (required once — 30 seconds)

Supabase Dashboard → SQL editor → paste **`supabase/migrate-2.sql`** → Run.
Idempotent (safe to re-run). Adds:

- `posts.stage` — garden states (🌱 seed / 🌿 budding / 🌲 evergreen)
- `posts.fossil` — fossil mode
- `messages.loc` — guestbook pixel-map pins

Until it runs, saves still work (the API auto-strips the new columns) but
garden/fossil/pin values won't persist. `GET /api/health` reports the column
state in `columns.stage` / `columns.loc`, and the POST DOCTOR page shows a
banner while the migration is missing.

## 2. Redeploy

```bash
vercel deploy --prod --yes
```

## What's new

**Studio:** ◌ FOCUS typewriter mode · ◫ SPLIT/⇕ STACK scroll-synced preview ·
⚠ CONFLICT SHIELD (two-tab edit protection — loser kept in history) ·
`#/doctor` POST DOCTOR with health scores + dead-image scan · `#/feeds`
READ-LATER clipper (RSS/Atom → drafts, via new SSRF-guarded `/api/fetch`) ·
`#/import` IMPORT ENGINE (markdown+front-matter / HTML / WordPress WXR) ·
`#/zine` ZINE FACTORY (printable PDF zine of any year) · dashboard WRITING
HEATMAP + streaks + ON THIS DAY · SETTINGS gains WEBRING / PUBLISH WEBHOOKS /
COLOPHON editors.

**Public:** `#/now` page (nownownow-style, with moon phase) · `#/colophon`
page (stack, fonts, live page weight + CO₂e estimate) · garden + fossil chips
everywhere · ⛏ fossil banner · take-a-copy row on every post (⤓ .MD / .TXT /
PDF / ⧉ COPY MD) · press `S` = full-text search with snippets · footer
⚡ LOW-POWER (kills all effects, shows page weight) + ⏮ TIME MACHINE (scrub
the whole den to any date) · header Aa reader controls (font size / width /
serif, per-visitor) · moon phase in the header + status chips on home ·
guestbook PIXEL MAP pins (📍) · webring prev/next on ABOUT.

**Phone:** PWA — installable app (manifest + service worker + icons), and
**share target**: share any link/text to PSYCH0 on your phone → it lands in
`/share` → saved as a draft when you're signed into the studio.

**Terminal:** `download/psych0-cli.sh` — post to your den from bash:

```bash
export PSYCH0_URL="https://psych0.vercel.app"
export PSYCH0_TOKEN="p0k_…"        # SETTINGS → API TOKENS
psych0 quick "thought that just happened"
psych0 post "TITLE" -b "markdown body" --publish
psych0 list        # recent public posts
psych0 health
```

Webhooks (42): SETTINGS → WEBHOOKS, one `LABEL :: URL` per line. When a post
goes live the server POSTs `{event:'post.published', slug, title, url, at}`
as JSON to each URL (5s timeout, failures never block publishing).

---

# PSYCH://OS — the personal OS layer (new)

Your den is now also a private operating system: second brain, drive, notes,
journal, tasks, habits, money, collections, vault. Open it at
**https://psych0.vercel.app/#/os** (CTRL+K → `OS ▸ OPEN PSYCH://OS` works too).
Full feature map: `FEATURES-OS.md` in this folder.

## 1. Run migration 3 (required, 10 seconds)

Supabase dashboard → SQL editor → paste `supabase/migrate-3.sql` → RUN.
Creates the `items`, `files`, `links` tables + the private `drive` storage
bucket. Idempotent — safe to re-run. Until it runs, the OS falls back to
browser-local storage on each device (works, but doesn't sync).

## 2. Add the AI key — OpenRouter free (optional, unlocks the brain)

You said you'll use **OpenRouter free** — two ways, pick one:

**A. zero-config (fastest):** deploy, open OS → PLUMBING → `✦ AI KEY`,
paste your OpenRouter key (starts `sk-or-`). It's stored only in your
browser and sent per request — the Brain, OCR, flashcard generator and AI
reviews work immediately, on every device where you paste it once.

**B. site-wide env key (works for any visitor of the studio, any browser):**

```bash
vercel env add OPENROUTER_API_KEY production    # your sk-or-… key
vercel deploy --prod --yes
```

That's it. The OS auto-detects OpenRouter and defaults to
`openrouter/free` — an auto-router that serves the best currently-free model
and accepts images, so **OCR works on the free tier too**. Optional extras:

```bash
vercel env add OPENROUTER_MODEL production        # pin a specific model (default openrouter/free)
vercel env add OPENROUTER_VISION_MODEL production # OCR model (defaults to MODEL)
vercel env add TELEGRAM_BOT_TOKEN production      # bot replies "filed ✓"
```

Notes:
- OpenRouter has no embeddings endpoint → semantic search automatically falls
  back to keyword retrieval (still searches everything; add
  `OPENAI_EMBED_MODEL` + `OPENAI_API_KEY` instead if you ever want vectors).
- An OpenAI-compatible key also works: `OPENAI_API_KEY` (+ optional
  `OPENAI_BASE_URL`, `OPENAI_MODEL`). Request keys from the UI win over env
  keys, so you can swap providers without redeploying.
- No key at all? The brain still answers in honest retrieval mode (it shows
  the matching notes instead of making things up).

## 3. Mint your capture secret

Studio → OS → PLUMBING → `⚡ MINT CAPTURE SECRET`. That unlocks:

- **Webhook capture** — `POST /api/inbox?secret=…` with `{"text":"…","kind":"task"}`
  from anything (curl, iOS Shortcuts, IFTTT, email parsers).
- **Telegram bot** — BotFather → new bot → set webhook per the instructions
  shown on the PLUMBING page → DM your bot, it files a capture and replies.
- **Phone share** — install the site as an app, share anything to PSYCH0;
  the share target now takes `kind=note|task|bookmark`.
- **Rules** — OS → RULES: e.g. "contains 'invoice' → tag #money". Fires on
  every new capture, server-side.

## OS pages (all under #/os)

BRAIN (chat+briefing+semantic search+personas) · CAPTURE inbox · NOTES
(wikilinks/backlinks/templates/versions/burn links) · JOURNAL (+letters to
future self) · DRIVE (folders/gallery/paste/OCR/shares) · VAULT (AES-256
secrets) · BOOKMARKS · COLLECTIONS (your own databases) · TASKS (kanban) ·
CALENDAR · HABITS (+mood/sleep graphs) · FOCUS (pomodoro) · GOALS ·
FLASHCARDS (SM-2, generate from notes) · REVIEW (AI weekly review) · MONEY ·
PEOPLE (CRM nudges) · SHELF · TRAVEL (pixel map) · RECIPES · IDEAS (incubator)
· SHORT LINKS (/l/slug) · RULES · IMPORT (CSV→anything) · PLUMBING.
