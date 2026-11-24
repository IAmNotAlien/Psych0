# PSYCH://OS — every feature, and where it lives

The private operating system layer under your Psych0 den. Everything below
works in **LOCAL MODE** (browser-only, seeded demo vault) and upgrades
automatically when Supabase is connected. AI features need `OPENAI_API_KEY`
(any OpenAI-compatible provider); retrieval still works without one.

Studio URL: **`#/os`** (or press CTRL+K → `OS ▸ OPEN PSYCH://OS`, or type `> os`)

---

## 🧠 THE BRAIN (1–10)

| # | Idea | Where |
|---|------|-------|
| 1 | Talk to my brain (AI chat over everything, with sources) | `#/os/brain` — chat panel; server pulls context from vault + files + posts (`/api/brain`) |
| 2 | Semantic search (find by meaning) | Brain page → SEMANTIC SEARCH box (+ optional embeddings via `OPENAI_EMBED_MODEL`); the whole vault is also in the `S` full-text search |
| 3 | Auto-tag + auto-link | Notes editor → `⚡ AI TAG` adds tags; `[[wikilinks]]` with dead-link detection; LINKS OUT / BACKLINKS panels |
| 4 | Capture inbox | `#/os/inbox` + Brain page capture box + console `> cap <text>` + `/share?kind=note` + bot + email-in — everything lands tagged `#inbox` |
| 5 | Daily briefing | Top of the Brain page: tasks due, habit streak, note count, journal status, capsules delivered, on-this-day posts |
| 6 | AI personas | Items of type `persona` — create in the vault, select in Brain chat ("bare brain" by default) |
| 7 | Voice notes | `🎙 DICTATE` in Brain chat, Notes editor, Journal (browser speech recognition) |
| 8 | Chat with a doc | Drive → `✦ CHAT` on any file → Brain pins that file's text as context (`#/os/brain/<fileId>`) |
| 9 | Study generator | Flashcards → GENERATOR: pick a note → `⚡ GENERATE CARDS` (3–6 `QUESTION :: ANSWER` cards) |
| 10 | Lecture/meeting summarizer | Notes → `⚡ SUMMARIZE` prepends a TL;DR; `⚡ CLEAN VOICE` tidies dictation transcripts |

## 📁 FILES (11–20)

| # | Idea | Where |
|---|------|-------|
| 11 | Drive (folders, drag-drop, previews) | `#/os/drive` — list + gallery views, image/video/audio inline |
| 12 | Paste-to-upload | CTRL+V anywhere on the Drive page |
| 13 | Gallery + audio shelf | Drive → `▤ GALLERY` toggle |
| 14 | Share links for files | Drive → `⇗ 7d` / `⇗ 7d+` copies a link, optional expiry |
| 15 | Document vault | `#/os/vault` → DOCUMENT VAULT section (sealed notes live with your secrets) |
| 16 | PDF reader + highlights | PDFs open in-tab from Drive; highlights = notes linked to the file (chat-with-doc searches file text too) |
| 17 | Web clipper bookmarklet | Phone/share target + `/share` files any page as a note/draft; Feeds page clips RSS |
| 18 | Link shortener | `#/os/links` — `yourdomain/l/<slug>` with click counts (`/l/[slug]` route) |
| 19 | Whiteboard OCR | Drive → `⌘ OCR` on any image (vision model) → text saved to file + a note |
| 20 | Mega backup | `#/os/plumbing` → `⬇ EVERYTHING (site + vault)` (JSON via `/api/backup`) + `⬇ VAULT JSON` |

## 🗂️ NOTES (21–30)

| # | Idea | Where |
|---|------|-------|
| 21 | Private notes universe | `#/os/notes` — tags-as-filters, pinned, autosave |
| 22 | Daily journal | `#/os/journal` — one page per day, streak counter |
| 23 | Zettelkasten | `[[wikilinks]]`, backlinks, related-by-tag, dead-link chips |
| 24 | Templates | `template` items → NOTES → `＋ FROM TEMPLATE…` |
| 25 | Outliner mode | Notes → `≡ OUTLINE` collapsible heading/bullet tree |
| 26 | Spaced repetition | `#/os/flashcards` — SM-2 with due queue + interval previews |
| 27 | Note version history | NOTES → `⏱ HISTORY` (20 snapshots per note, load any into the editor) |
| 28 | Note doctor | NOTES → `⚕ CHECKUP`: orphans + dead links from the open note |
| 29 | Self-destructing notes | NOTES → `🔥 BURN LINK` → `#/burn/<token>` — deleted from the DB after N reads |
| 30 | Private share links | NOTES → `⇗ SHARE` → `#/p/<token>` read-only page, optional expiry |

## 🗃️ YOUR DATABASES (31–41)

| # | Idea | Where |
|---|------|-------|
| 31 | Collection builder | `#/os/collections` — define fields (text/num/date/select/stars/url), table + card views |
| 32 | Contacts / CRM | `#/os/people` — birthdays, 60-day silence alarms, touch-base logging |
| 33 | Bookmarks library | `#/os/bookmarks` — `✦ DESCRIBE` AI blurbs, tags, URL capture |
| 34 | Media shelf | `#/os/shelf` — books/movies/shows/games/albums, status, ratings, stats |
| 35 | Secrets locker | `#/os/vault` — AES-256-GCM encrypted, passphrase stays in the tab session |
| 36 | Budget tracker | `#/os/money` — expenses by day/category charts, subscription renewal alarms |
| 37 | Habit tracker | `#/os/habits` — 56-day tap grids, streaks, weekly score |
| 38 | Mood / health log | Habits page → daily mood 😄/sleep/workout + 14-day line & bar charts |
| 39 | Travel map | `#/os/travel` — click the pixel world map to drop pins |
| 40 | Recipe box | `#/os/recipes` + `⧉ COOK SOMETHING` randomizer |
| 41 | Idea incubator | `#/os/ideas` — seed→cooking→ready + resurfacing of neglected ideas |

## ⚡ LIFE OPS (42–48)

| # | Idea | Where |
|---|------|-------|
| 42 | Tasks + GTD | `#/os/tasks` — inbox → kanban (now/soon/later/someday), due dates, done log |
| 43 | Calendar | `#/os/calendar` — month grid, events, countdowns, journal days, task chips |
| 44 | Reminders + daily digest | Due chips everywhere, overdue counters, tasks in the daily briefing |
| 45 | Pomodoro + time log | `#/os/focus` — 25/5/15/50 presets, session ring, minutes chart |
| 46 | Goals | `#/os/goals` — target/progress rings, deadline countdowns |
| 47 | Weekly review generator | `#/os/review` — assembles the week from every log, AI turns it into a review |
| 48 | Letters to future self | Journal → `✉ SEAL CAPSULE` — blurred until the delivery date |

## 🔌 PLUMBING (49–55)

| # | Idea | Where |
|---|------|-------|
| 49 | Phone capture | Install as PWA → OS share menu → `/share?kind=note\|task\|bookmark`; iOS Shortcut → webhook |
| 50 | Messenger bot | `#/os/plumbing` → Telegram webhook setup (bot replies "filed ✓" with `TELEGRAM_BOT_TOKEN`) |
| 51 | Email-in | Wire any email parser (Zapier/Make/IMAP script) to `POST /api/inbox?secret=…` |
| 52 | Rules engine | `#/os/rules` — IF type/contains/tag THEN add tags/change type/move folder; fires server-side on create |
| 53 | Importers | `#/os/import` — CSV → any type or collection (auto header mapping); blog .md/.html/WXR in STUDIO → IMPORT |
| 54 | Full export | Plumbing → 3 export buttons (vault / everything / blog); local mode = your data is already in localStorage |
| 55 | Offline PWA | `sw.js` caches the shell — the den still opens offline; local-mode vault keeps working from localStorage |

---

## Setup (production)

1. **Database**: run `supabase/migrate-3.sql` in the Supabase SQL editor
   (creates `items`, `files`, `links` + the `drive` storage bucket — private by RLS).
2. **AI with OpenRouter free (optional but recommended)** — two ways:
   - zero-config: OS → PLUMBING → `✦ AI KEY` → paste your OpenRouter key
     (starts `sk-or-`). Stored in your browser only, sent per request.
   - site-wide: `vercel env add OPENROUTER_API_KEY production` + redeploy.
   Default model is `openrouter/free` (auto-router, accepts images → OCR
   works on the free tier). OpenRouter has no embeddings endpoint, so
   semantic search uses keyword retrieval automatically.
   OpenAI-compatible keys also work: `OPENAI_API_KEY` (+ `OPENAI_BASE_URL`,
   `OPENAI_MODEL`, `OPENAI_VISION_MODEL`, `OPENAI_EMBED_MODEL`).
3. **Capture secret**: studio → OS → PLUMBING → `⚡ MINT CAPTURE SECRET`.

Without Supabase: everything runs in LOCAL MODE (browser localStorage, ~4 MB
drive cap, share/short links disabled). Without an AI key: the brain answers
in honest retrieval mode (shows matching notes instead of pretending).
