/* PSYCH0 — shared types + seed content (used on server AND client) */

export interface SocialLink { label: string; url: string }

export interface FxFlags {
  grid: boolean; scan: boolean; crt: boolean; cross: boolean;
  boot: boolean; sound: boolean; glitch: boolean;
}

export interface SiteData {
  name: string; logo: string; tagline: string; now: string; about: string;
  accent: string; accent2: string; preset: string;
  fx: FxFlags; showDrafts: boolean; customCss: string; socials: SocialLink[];
  showGuestbook?: boolean;
  plugins?: PluginCmd[];
  webring?: SocialLink[];      // friend sites — prev/next ring on the ABOUT page
  hooks?: SocialLink[];        // publish webhooks — POSTed when a post goes live
  feeds?: FeedSrc[];           // read-later clipper subscriptions
  colophon?: string;           // colophon page notes (markdown)
  rules?: OsRule[];            // PSYCH://OS rules engine (fire on item create)
  collections?: OsCollection[];// PSYCH://OS collection builder schemas
  inboxSecret?: string;        // PSYCH://OS capture webhook secret
}

/* read-later clipper subscription */
export interface FeedSrc { id: string; url: string; label: string }

/* console plugins — JSON defined in settings, executed by the CTRL+K terminal */
export interface PluginCmd { cmd: string; label: string; kind: 'goto' | 'url' | 'text'; value: string }

export type GardenStage = 'seed' | 'budding' | 'evergreen';

export interface Post {
  id: string; slug: string; title: string; date: string;
  tags: string[]; cover: string; pinned: boolean; published: boolean; body: string;
  publish_at?: string | null;   // scheduled publishing / time capsule (ISO datetime)
  stage?: GardenStage | null;   // garden state — how alive this post is
  fossil?: boolean;             // fossil mode — old thinking, kept for the record
}

export interface ProjectLink { label: string; url: string }

export interface Project {
  id: string; slug: string; title: string; status: string; year: string;
  role: string; stack: string[]; cover: string; links: ProjectLink[];
  featured: boolean; body: string;
}

export interface Embed { id: string; title: string; url: string; note: string; h: number }

export interface Message {
  id: string; name: string; contact: string; body: string;
  public: boolean; read: boolean; created_at: string;
  loc?: string;                 // guestbook pixel map pin "col,row"
}

export interface MediaItem {
  id: string; path: string; url: string; mime: string; size: number; created_at: string;
}

export interface ApiToken {
  id: string; hash: string; label: string; created_at: string; last_used: string | null;
}

export interface Revision {
  id: number; entity: string; entity_id: string; snapshot: unknown; created_at: string;
}

export interface Bundle { site: SiteData; posts: Post[]; projects: Project[]; embeds: Embed[] }

export const FX_KEYS = ['grid', 'scan', 'crt', 'cross', 'boot', 'sound', 'glitch'] as const;

/* ================= PSYCH://OS — the private vault layer =================
 * One generic item table powers notes, tasks, habits, bookmarks, contacts,
 * money, recipes, ideas, flashcards… — everything is an item with a type. */

export type ItemKind =
  | 'note' | 'journal' | 'task' | 'event' | 'bookmark' | 'contact' | 'habit'
  | 'habitlog' | 'mood' | 'expense' | 'sub' | 'recipe' | 'idea' | 'media'
  | 'trip' | 'goal' | 'secret' | 'card' | 'persona' | 'template' | 'capsule'
  | 'session' | string;              // 'col.<id>' for custom collections

export interface VaultItem {
  id: string; type: ItemKind;
  title: string; body: string;
  data: Record<string, unknown>;    // per-type fields (amount, rating, due, front/back…)
  tags: string[];
  folder: string;                   // drive/note folder path
  done: boolean;
  pinned: boolean;
  secure: boolean;                  // encrypted at rest (secrets / document vault)
  cipher: string; iv: string; salt: string;   // AES-GCM material when secure
  share: string;                    // public share token (note / file / burn)
  burns: number;                    // self-destruct after N reads (0 = never)
  reads: number;
  share_expires: string | null;     // ISO datetime — share dies after this
  deliver_at: string | null;        // letters to future self
  created_at: string; updated_at: string;
}

export interface DriveFile {
  id: string; name: string; folder: string;
  mime: string; size: number;
  path: string; url: string;        // storage path + public URL (when shared or media)
  text: string;                     // extracted text (chat-with-doc, search)
  share: string; share_expires: string | null;
  created_at: string; updated_at: string;
}

export interface ShortLink { id: string; slug: string; url: string; clicks: number; created_at: string }

/* collection builder schema — stored in site.data.collections */
export interface OsField { key: string; label: string; kind: 'text' | 'num' | 'date' | 'select' | 'stars' | 'url'; opts?: string }
export interface OsCollection { id: string; name: string; icon: string; fields: OsField[]; view?: 'table' | 'cards' | 'board' }

/* rules engine — stored in site.data.rules; applied server-side on item create */
export interface OsRule {
  id: string; label: string; on: boolean;
  match: { type?: string; contains?: string; tag?: string };
  act: { addTags?: string[]; setType?: ItemKind; folder?: string };
}

/* AI personas — VaultItem.type='persona', data.system = the prompt */

export function uid(): string {
  return Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
}

export function slugify(s: string): string {
  return String(s || '').toLowerCase().trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9\u00c0-\u024f]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'untitled';
}

export function uniqueSlug<T extends { slug: string; id: string }>(arr: T[], slug: string, id: string): string {
  const base = slugify(slug);
  let s = base, n = 2;
  while (arr.some(x => x.slug === s && x.id !== id)) { s = base + '-' + n; n++; }
  return s;
}

export function newPost(): Post {
  return { id: uid(), slug: 'untitled-' + Date.now().toString(36).slice(-4), title: 'UNTITLED POST', date: new Date().toISOString().slice(0, 10), tags: [], cover: '', pinned: false, published: false, body: 'Start typing markdown…\n\n## a heading\n\n@embed https://example.com 420\n', stage: 'seed' };
}

/** garden state auto-suggest — young posts are seedlings, old ones evergreen */
export function suggestStage(date: string): GardenStage {
  const days = (Date.now() - new Date(date + 'T12:00:00Z').getTime()) / 86400000;
  if (days < 30) return 'seed';
  if (days < 120) return 'budding';
  return 'evergreen';
}

export const STAGE_META: Record<GardenStage, { glyph: string; label: string }> = {
  seed: { glyph: '🌱', label: 'SEED' },
  budding: { glyph: '🌿', label: 'BUDDING' },
  evergreen: { glyph: '🌲', label: 'EVERGREEN' },
};

export function newProject(): Project {
  return { id: uid(), slug: 'untitled-' + Date.now().toString(36).slice(-4), title: 'UNTITLED PROJECT', status: 'WIP', year: String(new Date().getFullYear()), role: '', stack: [], cover: '', links: [], featured: false, body: 'Describe the project…\n\n## stack\n\n- thing one\n- thing two\n' };
}

export function newEmbed(): Embed {
  return { id: uid(), title: 'NEW WINDOW', url: 'https://example.com', note: '', h: 420 };
}

export function newMessage(name: string, contact: string, body: string, loc = ''): Message {
  return {
    id: 'm_' + uid(), name: (name || 'ANON').slice(0, 60), contact: (contact || '').slice(0, 120),
    body: (body || '').slice(0, 2000), public: true, read: false,
    created_at: new Date().toISOString(),
    loc: /^([0-5][0-9]|[0-9]),(1[0-4]|[0-9])$/.test(loc) ? loc : '',
  };
}

/* ================= seed content ================= */
export function seed(): Bundle {
  return {
    site: {
      name: 'Psych0', logo: 'PSYCH0',
      tagline: 'hand-crafted web den — blog // portfolio // lab',
      now: '- building: **Psych0**, now on Next.js + Supabase\n- listening: night drive mixes on repeat\n- reading: everything about small web / indieweb\n- status: ONLINE and caffeinated',
      about: 'Hi. I go by **Psych0** online.\n\nThis site is my den: a place to log what I build, think and break. It runs on **Next.js** with a serverless backend and a Supabase database — but it wears the same hand-made, terminal-punk skin as the original one-file version.\n\n## what you will find here\n\n- **BLOG** — field notes, manuals, rants, long thoughts\n- **PROJECTS** — the things I make, with status, stack and galleries\n- **LAB** — live windows into other websites, embedded right here\n\n## contact\n\nEverything below is editable in STUDIO → settings. Put your real links in.',
      accent: '#ff5c00', accent2: '#00e0c8', preset: 'psych0',
      fx: { grid: true, scan: true, crt: false, cross: true, boot: true, sound: true, glitch: true },
      showDrafts: true, customCss: '', showGuestbook: true, plugins: [],
      webring: [
        { label: '100 RABBITS', url: 'https://100r.co' },
        { label: 'EXAMPLE DEN', url: 'https://example.com' },
      ],
      hooks: [],
      feeds: [{ id: 'f_100r', url: 'https://100r.co/updates/rss.xml', label: '100 RABBITS' }],
      colophon: 'This den is hand-made: no trackers, no analytics, no cookies — just a text editor and an accent color.\n\nEverything here is written in markdown directives and shipped as plain HTML.',
      socials: [
        { label: 'GITHUB', url: 'https://github.com/' },
        { label: 'MAIL', url: 'mailto:you@example.com' },
        { label: 'RSS', url: '#/blog' },
      ],
    },
    posts: [
      {
        id: 'p_welcome', slug: 'welcome-to-psych0', title: 'WELCOME TO PSYCH0 — THE MANUAL',
        date: '2026-11-20', tags: ['meta', 'manual'], cover: 'https://picsum.photos/seed/psych0hero/1200/500',
        pinned: true, published: true,
        body: 'You just booted your own web den. This post is the manual — read it once, then **delete it** and write your own thing.\n\n## the stack\n\n| part | what it is |\n| --- | --- |\n| FRONTEND | Next.js 16, React 19, Tailwind — the CRT terminal skin |\n| BACKEND | serverless API routes — `/api/posts`, `/api/projects`, `/api/embeds`, `/api/site` |\n| DATABASE | **Supabase** (Postgres). add your keys and it just works |\n\nEverything is editable. Press <kbd>CTRL+K</kbd> — the console opens. Type a command or just search. It also understands a little terminal language:\n\n~~~\n> help\n> theme matrix\n> fx scanlines off\n> new post\n~~~\n\n## the studio\n\nEnter the passcode at `#/studio` and you get the dashboard: **live side-by-side preview**, autosave, word count, tag chips, covers, pins, drafts and slug control for posts, projects and embeds — plus site identity, theme and effect settings.\n\n### directives — the fun part\n\nThe markdown engine knows a few spells. Type these on their own line:\n\n~~~\n@embed https://en.wikipedia.org/wiki/100_Rabbits 480\n@youtube dQw4w9WgXcQ\n@img https://picsum.photos/seed/a1/900/500 | a caption, optional\n@gallery https://picsum.photos/seed/g1/600/450 | https://picsum.photos/seed/g2/600/450\n@html <b>raw html, sanitized of scripts</b>\n@endhtml\n:::tip A TIP TITLE\ncallout boxes in four flavors: note, tip, warn, danger\n:::\n:::warn CAREFUL\nsome sites refuse to be embedded (X-Frame-Options). the framebox always has an OPEN ↗ button as fallback.\n:::\n~~~\n\n@youtube 5qap5aO4i9A\n\nStandard markdown works too: **bold**, *italic*, ==highlight==, ~~strike~~, `code`, [links](https://example.com), images, tables, lists, quotes, ~~~ code fences, and <kbd>CTRL+K</kbd> style inline HTML.\n\n## the two modes\n\nPress <kbd>M</kbd> or the mode button in the header:\n\n- **◐ STUDIO** — owner view. drafts visible, edit buttons everywhere, studio unlocked. this is where you build.\n- **○ PUBLIC** — visitor view. drafts hidden, editing locked, the den looks finished. this is what the world sees.\n\n## your data\n\n- **no Supabase yet?** you are in LOCAL MODE — edits live in this browser\'s localStorage, exports work, nothing reaches a server.\n- **add Supabase** (STUDIO → DATA shows the steps): run `supabase/schema.sql` in the SQL editor, drop `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` into env, restart — every edit now persists in your database and every visitor sees the same den.\n\n:::tip FREEDOM\nin STUDIO you can inject raw **custom CSS**, swap themes, toggle scanlines / CRT / grid / sounds / crosshair cursor. the site is a canvas, not a cage.\n:::\n\nNow go to STUDIO and rename the den. It is yours.',
      },
      {
        id: 'p_singlefile', slug: 'why-one-html-file', title: 'WHY THIS SITE USED TO BE ONE HTML FILE',
        date: '2026-11-21', tags: ['meta', 'web', 'philosophy'], cover: '',
        pinned: false, published: true, stage: 'budding', fossil: true,
        body: 'There is something deeply satisfying about a website that is a **file**. Not a repo with 900 dependencies. Not an app that phones home. A file. You can read it, copy it, email it, put it on a USB stick, open it in ten years.\n\n## what that buys you\n\n- **zero cost, forever** — any static host serves it free\n- **zero build** — no npm, no framework churn, no dependencies to rot\n- **zero lock-in** — your content exports as JSON any time\n- **full ownership** — view-source is the documentation\n\n## and yet…\n\nA file has no memory beyond one browser. So the den grew a **serverless backend**: Next.js API routes that talk to **Supabase** when you connect it. The aesthetic survived the move — dark, sharp, orange-on-black, hand-made. The data finally outlives the browser.\n\n> Small web, slow web, hand-made web. The 100 Rabbits studio built their whole world this way — off-grid tools, plain files, radical self-reliance. This site is still a love letter to that; it just keeps its diary in Postgres now.',
      },
      {
        id: 'p_draft1', slug: 'field-notes-01', title: 'FIELD NOTES #01',
        date: '2026-11-22', tags: ['notes'], cover: '',
        pinned: false, published: false,
        body: 'This is a **draft** — drafts only exist in **STUDIO mode**. Press M (or tap ○ PUBLIC in the header) and I vanish: no drafts, no edit buttons, no studio. That is exactly what visitors see.\n\nUse drafts as a scratchpad. When it is ready, tick *published* in the editor and it ships to everyone. Delete me when you start writing.',
      },
    ],
    projects: [
      {
        id: 'pr_psych0', slug: 'psych0', title: 'PSYCH0', status: 'ACTIVE', year: '2026', role: 'design + code', featured: true,
        stack: ['next.js 16', 'react 19', 'tailwind 4', 'supabase', 'serverless'],
        cover: 'https://picsum.photos/seed/psych0proj/1200/600',
        links: [{ label: 'INSPIRATION', url: 'https://hundredrabbits.100r.fr' }, { label: 'SOURCE', url: '#/about' }],
        body: 'A personal web den: blog, portfolio and a lab of live embeds, styled after the 100 Rabbits aesthetic — dark, sharp, hand-made. Rebuilt on Next.js with a serverless backend and Supabase storage.\n\n## features\n\n- hash router over React 19, markdown + custom directives\n- serverless API: `/api/posts`, `/api/projects`, `/api/embeds`, `/api/site`\n- Supabase-ready: add env keys → instant Postgres persistence with RLS\n- passcode studio gate (upgrade path: Supabase Auth)\n- command palette and a mini terminal\n- theme engine with presets and raw CSS injection\n- iframe lab: show any website inside the site\n\n## status log\n\n- **2026.11** — one-file boot sequence, theme engine, editor, console\n- **2026.11** — LAB opens: iframes with click-to-load\n- **2026.11** — NEXT.JS REBUILD: serverless backend, Supabase layer, studio\n\n@img https://picsum.photos/seed/psych0shot/1000/520 | the den, booting',
      },
      {
        id: 'pr_signal', slug: 'signal-lost', title: 'SIGNAL LOST', status: 'WIP', year: '2026', role: 'concept / noise', featured: false,
        stack: ['noise', 'radio', 'field recording'],
        cover: 'https://picsum.photos/seed/signallost/1200/600',
        links: [{ label: 'PLAYLIST', url: 'https://archive.org' }],
        body: 'A slowly-growing archive of shortwave recordings and electromagnetic noise from my corner of the world. Nothing commercial, just weather of the airwaves.\n\n@gallery https://picsum.photos/seed/sl1/600/450 | https://picsum.photos/seed/sl2/600/450 | https://picsum.photos/seed/sl3/600/450',
      },
      {
        id: 'pr_shell', slug: 'archive-shell', title: 'ARCHIVE SHELL', status: 'SHIPPED', year: '2025', role: 'tools', featured: false,
        stack: ['bash', 'rclone', 'cron'],
        cover: '',
        links: [],
        body: 'A tiny bash kit that mirrors my bookmarks, photos and notes to cold storage every night. Boring, reliable, forgotten — the best kind of tool.',
      },
    ],
    embeds: [
      { id: 'e_wiki', title: 'WIKIPEDIA — 100 RABBITS', url: 'https://en.wikipedia.org/wiki/100_Rabbits', note: 'the studio that inspired this den', h: 460 },
      { id: 'e_map', title: 'OPENSTREETMAP — SOMEWHERE COASTAL', url: 'https://www.openstreetmap.org/export/embed.html?bbox=-10.8%2C51.2%2C0.4%2C52.2&layer=mapnik', note: 'maps are born to be embedded', h: 420 },
      { id: 'e_yt', title: 'YOUTUBE — NIGHT DRIVE MIX', url: 'https://www.youtube.com/watch?v=5qap5aO4i9A', note: 'watch urls auto-convert to the embed player', h: 380 },
      { id: 'e_ia', title: 'INTERNET ARCHIVE', url: 'https://archive.org', note: 'a library that lets itself be framed', h: 460 },
      { id: 'e_ex', title: 'EXAMPLE.COM', url: 'https://example.com', note: 'the calmest page on the web', h: 260 },
    ],
  };
}
