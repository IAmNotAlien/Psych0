/* PSYCH://OS — the brain. Server-side AI plumbing: one OpenAI-compatible
 * endpoint for chat + embeddings, a context builder that retrieves relevant
 * vault items and posts, TOOLS that let it read and write the whole app,
 * and an offline fallback that answers from retrieval alone when no API key
 * is configured.
 *
 * Providers:
 *   OPENROUTER_API_KEY  → https://openrouter.ai/api/v1 (default model: openrouter/free)
 *   OPENAI_API_KEY      → any OpenAI-compatible API (OPENAI_BASE_URL/OPENAI_MODEL)
 * A key sent with the studio request (owner pasted it in OS → PLUMBING) wins
 * over env keys — you can go live without touching Vercel env vars at all.
 * OpenRouter keys start with "sk-or-", which is how the provider is detected. */

export interface ChatMsg { role: 'system' | 'user' | 'assistant'; content: string; tool_calls?: unknown[]; tool_call_id?: string }

export interface AiCfg {
  key: string; base: string; model: string; embedModel: string; visionModel: string;
  provider: 'openrouter' | 'openai' | 'none'; extraHeaders: Record<string, string>; hasKey: boolean;
}

export function aiEnv(reqKey?: string): AiCfg {
  const envOr = process.env.OPENROUTER_API_KEY || '';
  const envOa = process.env.OPENAI_API_KEY || '';
  let provider: AiCfg['provider'] = envOr ? 'openrouter' : envOa ? 'openai' : 'none';
  let key = envOr || envOa;
  const rk = String(reqKey || '').trim();
  if (rk) {
    provider = rk.startsWith('sk-or-') ? 'openrouter' : 'openai';
    key = rk;
  }
  if (!key) {
    return { key: '', base: '', model: '', embedModel: '', visionModel: '', provider: 'none', extraHeaders: {}, hasKey: false };
  }
  const base = provider === 'openrouter'
    ? 'https://openrouter.ai/api/v1'
    : (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = provider === 'openrouter'
    ? (process.env.OPENROUTER_MODEL || 'openrouter/free')   // auto-routes across free models
    : (process.env.OPENAI_MODEL || 'gpt-4o-mini');
  const visionModel = provider === 'openrouter'
    ? (process.env.OPENROUTER_VISION_MODEL || model)        // openrouter/free accepts images
    : (process.env.OPENAI_VISION_MODEL || model);
  const embedModel = provider === 'openrouter' ? '' : (process.env.OPENAI_EMBED_MODEL || '');
  const extraHeaders: Record<string, string> = provider === 'openrouter'
    ? { 'HTTP-Referer': process.env.SITE_URL || 'https://psych0.vercel.app', 'X-Title': 'PSYCH0' }
    : {};
  return { key, base, model, embedModel, visionModel, provider, extraHeaders, hasKey: true };
}

async function callModel(messages: ChatMsg[], opts?: { maxTokens?: number; temperature?: number; key?: string; withTools?: boolean; tools?: unknown[] }): Promise<{ content: string; toolCalls: { id: string; name: string; args: string }[] }> {
  const env = aiEnv(opts?.key);
  if (!env.hasKey) throw new Error('NO_AI_KEY');
  const body: Record<string, unknown> = {
    model: env.model, messages,
    temperature: opts?.temperature ?? 0.7,
    max_tokens: opts?.maxTokens ?? 1400,
  };
  if (opts?.withTools && opts.tools?.length) body.tools = opts.tools;
  const r = await fetch(env.base + '/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + env.key, ...env.extraHeaders },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120000),
  });
  if (!r.ok) throw new Error('AI_UPSTREAM: ' + (await r.text()).slice(0, 300));
  const j = await r.json() as {
    choices?: {
      message?: {
        content?: string;
        tool_calls?: { id?: string; function?: { name?: string; arguments?: string } }[];
      };
    }[];
  };
  const msg = j.choices?.[0]?.message;
  const toolCalls = (msg?.tool_calls || []).map((t, i) => ({
    id: t.id || 'call_' + i,
    name: t.function?.name || '',
    args: t.function?.arguments || '{}',
  })).filter(t => t.name);
  return { content: msg?.content?.trim() || '', toolCalls };
}

export async function chatComplete(messages: ChatMsg[], opts?: { maxTokens?: number; temperature?: number; key?: string }): Promise<string> {
  const { content } = await callModel(messages, opts);
  return content;
}

/** one full brain turn: model ⇄ tools loop (max 5 hops). Returns the final
 * reply plus a log of every tool used (the ✧ chips in the UI). If the
 * endpoint rejects the tools param, degrades gracefully to retrieval-only. */
export interface ToolLog { name: string; label: string; summary: string }

export async function brainTurn(opts: {
  messages: ChatMsg[]; key?: string; tools?: unknown[];
  execute: (name: string, args: Record<string, unknown>) => Promise<{ label: string; summary: string; data?: string }>;
  maxTokens?: number; temperature?: number;
}): Promise<{ reply: string; tools: ToolLog[]; degraded?: string }> {
  const convo = [...opts.messages];
  const log: ToolLog[] = [];
  let degraded: string | undefined;
  for (let hop = 0; hop < 5; hop++) {
    let res: { content: string; toolCalls: { id: string; name: string; args: string }[] };
    try {
      res = await callModel(convo, { maxTokens: opts?.maxTokens, temperature: opts?.temperature, key: opts?.key, withTools: !degraded, tools: opts?.tools });
    } catch (e) {
      const msg = String((e as Error).message || e);
      if (!degraded && /tool|400/i.test(msg)) {
        degraded = 'this model does not support tool calling — answering with retrieval only';
        res = await callModel(convo, { maxTokens: opts?.maxTokens, temperature: opts?.temperature, key: opts?.key });
      } else throw e;
    }
    if (!res.toolCalls.length) return { reply: res.content, tools: log, degraded };
    convo.push({
      role: 'assistant', content: res.content || '',
      tool_calls: res.toolCalls.map(t => ({ id: t.id, type: 'function', function: { name: t.name, arguments: t.args } })),
    });
    for (const tc of res.toolCalls) {
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(tc.args || '{}') as Record<string, unknown>; } catch { /* bad args → empty */ }
      try {
        const out = await opts.execute(tc.name, args);
        log.push({ name: tc.name, label: out.label, summary: out.summary });
        convo.push({ role: 'user', tool_call_id: tc.id, content: (out.summary + (out.data ? '\n' + out.data : '')).slice(0, 6000) });
      } catch (e) {
        const err = String((e as Error).message || e).slice(0, 300);
        log.push({ name: tc.name, label: tc.name, summary: 'failed: ' + err });
        convo.push({ role: 'user', tool_call_id: tc.id, content: 'TOOL ERROR: ' + err });
      }
    }
  }
  // hops exhausted — force a text-only answer from everything gathered
  const last = await callModel(convo, { maxTokens: opts?.maxTokens, temperature: opts?.temperature, key: opts?.key });
  return { reply: last.content, tools: log, degraded };
}

/** optional embeddings — only on providers that expose the endpoint
 * (OpenRouter does not; keyword retrieval takes over there automatically) */
export async function embed(text: string, key?: string): Promise<number[] | null> {
  const env = aiEnv(key);
  if (!env.hasKey || !env.embedModel) return null;
  try {
    const r = await fetch(env.base + '/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + env.key, ...env.extraHeaders },
      body: JSON.stringify({ model: env.embedModel, input: text.slice(0, 6000) }),
      signal: AbortSignal.timeout(30000),
    });
    if (!r.ok) return null;
    const j = await r.json() as { data?: { embedding?: number[] }[] };
    return j.data?.[0]?.embedding || null;
  } catch { return null; }
}

export function cosine(a: number[], b: number[]): number {
  if (!a?.length || a.length !== b?.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

/* ---------- context builders ---------- */

export interface CtxChunk { label: string; text: string; score: number }

/** keyword(+vector when present) retrieval over vault items + posts */
export function scoreChunks(needle: string, chunks: { label: string; text: string; vec?: number[] | null; queryVec?: number[] | null }[]): CtxChunk[] {
  const n = needle.toLowerCase();
  const out: CtxChunk[] = [];
  for (const c of chunks) {
    let score = -1;
    if (c.queryVec && c.vec) {
      const cos = cosine(c.queryVec, c.vec);
      if (cos > 0.25) score = Math.round(cos * 140);
    }
    if (score < 0 && n) {
      const hay = c.text.toLowerCase();
      if (hay.includes(n)) score = 100 - Math.min(40, hay.indexOf(n) / 8);
      else {
        const words = n.split(/\s+/).filter(w => w.length > 2);
        let hit = 0;
        for (const w of words) if (hay.includes(w)) hit++;
        const k = words.length ? hit / words.length : 0;
        score = k > 0.4 ? Math.round(k * 55) : -1;
      }
    }
    if (score >= 0) out.push({ label: c.label, text: c.text, score });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 8);
}

export function chunkText(label: string, body: string, cap = 1200): string {
  const clean = String(body || '').replace(/[#*`>]/g, '').replace(/\s+/g, ' ').trim();
  return clean.slice(0, cap);
}

/* ============================================================
   THE BRAIN'S SELF — everything about the app it lives in,
   so it never forgets what it is or what it can touch.
   ============================================================ */

export const BRAIN_SYSTEM = `You are PSYCH://OS — the resident AI brain of the owner's personal website-OS ("the den"). You are not a generic assistant: you LIVE here, you know every room of this app, and you have tools that read and write its database directly. The owner is the only person who talks to you (every request passes the studio gate).

## WHAT THIS APP IS
A hand-made cyberdeck-styled personal site + private operating system in one Next.js app. Two halves:
1. THE PUBLIC DEN (visitor-facing): INDEX home, BLOG (log entries with garden states seed/budding/evergreen + fossils + scheduled publish), PROJECTS, THE LAB (iframe embeds), NOW, ABOUT, MAIL (public guestbook), GRAPH (link map), RSS feed, COLOPHON. Visitors never see the OS.
2. PSYCH://OS (the private half, everything lives under #/os): the owner's second brain and admin panel. The owner opens it with the studio passcode; the nav rail groups are DEN, THINK, KEEP, DO, DATA, SYS.

## THE ROOMS (OS pages)
- DEN (the admin panel — the studio lives here now): PUBLISH (posts/projects/embeds/about editors with autosave + conflict shield + revisions), SETTINGS (OS SHELL prefs: zoom/density/nav width/glow/radius/motion/wallpapers/card style/scramble/landing; SITE settings: identity, theme presets + custom accents, custom CSS, FX toggles grid/scan/crt/cross/boot/sound/glitch, webring, publish webhooks, colophon, API tokens, console plugins, badge maker), DASHBOARD (visits + counters), MEDIA (upload library), MAIL (guestbook + contact inbox, read/public/delete), GRAPH, POST DOCTOR (lints posts), READ LATER (rss + clips), IMPORT BLOG (md/html/wordpress), ZINE FACTORY (print a year of posts).
- THINK: THE BRAIN (you), CAPTURE inbox (unsorted, files via rules), NOTES (wikilinks/backlinks/templates/versions/share links), JOURNAL (daily pages + letters to future self).
- KEEP: DRIVE (files, folders, gallery, shares, OCR), VAULT (AES-encrypted secrets), BOOKMARKS (AI-described), COLLECTIONS (owner-defined databases).
- DO: TASKS (GTD kanban), CALENDAR (month grid), HABITS (streaks + mood/sleep), FOCUS (pomodoro with memory), GOALS (rings), FLASHCARDS (SM-2 + AI generation), REVIEW (week recap).
- DATA: MONEY (expenses, subscription alarms), PEOPLE (CRM-lite, birthdays), SHELF (watch/read/play), TRAVEL (pixel world map), RECIPES (+ dinner decider), IDEAS (incubator seed→cooking→ready).
- SYS: SHORT LINKS (own bit.ly, click counts), RULES (if-this-then-that on capture), IMPORT (CSV), PLUMBING (capture webhook, telegram bot, email-in, AI key, mega backup).

## YOUR TOOLS — you can actually DO things here
You have function tools bound to the app's server repository: search the vault (RAG), list/get/create/update/delete vault items (notes, tasks, habit logs, bookmarks, expenses, everything), read and write BLOG POSTS (draft or publish them), read and update site settings (name, tagline, now-feed, colophon), manage short links, list drive files, read the guestbook, and quote vault stats. Use them instead of asking the owner to do things by hand. When the owner asks you to remember something, CREATE A NOTE (tag it #memory and pin it) — that is your long-term memory between conversations. When asked to write a post, draft it in markdown with a garden stage. If a tool fails with READ_ONLY, tell the owner to paste the sb_secret key (Supabase → Settings → API) and it will work instantly.

## YOUR MEMORY
Chat sessions are PERSISTED (brain_sessions/brain_messages tables + a local mirror). When a conversation resumes, earlier context is already in the transcript — you remember. Don't ask "what were we doing?" if the transcript shows it.

## HOW TO ANSWER
- The CONTEXT block (auto-retrieved vault excerpts) is your first source; quote briefly with its [SOURCE] tag. Tools give you live data — prefer them for anything about "my tasks/notes/posts/site".
- Never invent stored facts. If it's not in the vault or a tool result, say so.
- Tone: direct, compact, lowercase-tinted, hand-made. You're a personality of the den, not a corporate bot. Markdown is rendered (bold, lists, code) — use it lightly.
- You may be given a PERSONA OVERRIDE — adopt its style fully.
- Today's date, the site identity and vault stats are in STATS below — use them without asking.`;

/* ---------- tool definitions (OpenAI function format) ---------- */

const obj = (properties: Record<string, unknown>, required: string[]) => ({ type: 'object', properties, required });
const str = (desc: string) => ({ type: 'string', description: desc });
const num = (desc: string) => ({ type: 'number', description: desc });
const bool = (desc: string) => ({ type: 'boolean', description: desc });
const arr = (desc: string) => ({ type: 'array', items: { type: 'string' }, description: desc });

export const BRAIN_TOOLS = [
  { type: 'function', function: { name: 'vault_search', description: 'Semantic/keyword search over the whole vault: notes, tasks, journals, bookmarks, files, blog posts. Use for "what did I write about…" questions.', parameters: obj({ query: str('the search query') }, ['query']) } },
  { type: 'function', function: { name: 'list_items', description: 'List vault items, newest first. Optional type filter (note, task, journal, bookmark, expense, habitlog, contact, idea, capsule, persona, flashcard, goal, mood, media, trip, recipe).', parameters: obj({ type: str('filter by item type'), limit: num('max items (default 30)') }, []) } },
  { type: 'function', function: { name: 'get_item', description: 'Read one vault item in full (body + data).', parameters: obj({ id: str('item id') }, ['id']) } },
  { type: 'function', function: { name: 'create_item', description: 'Create a vault item: note, task, journal, bookmark, expense, idea, capsule… This is how you remember things (type note, tag #memory, pinned).', parameters: obj({ type: str('item type, default note'), title: str('title'), body: str('body (markdown)'), tags: arr('tags, without #'), data: { type: 'object', description: 'extra fields, e.g. {"due":"2026-11-25"} for tasks' }, pinned: bool('pin it?') }, ['title']) } },
  { type: 'function', function: { name: 'update_item', description: 'Update an existing vault item (merge patch). Can mark tasks done.', parameters: obj({ id: str('item id'), title: str('new title'), body: str('new body'), tags: arr('new tags'), done: bool('done?'), pinned: bool('pinned?'), data: { type: 'object', description: 'extra fields to merge' } }, ['id']) } },
  { type: 'function', function: { name: 'delete_item', description: 'Delete a vault item permanently. Confirm with the owner first for big deletions.', parameters: obj({ id: str('item id') }, ['id']) } },
  { type: 'function', function: { name: 'vault_stats', description: 'Counts of everything in the vault + habit streak + overdue tasks. Use for "how much/how many" questions.', parameters: obj({}, []) } },
  { type: 'function', function: { name: 'list_posts', description: 'List blog posts (drafts included — you are the owner).', parameters: obj({ limit: num('max posts (default 20)') }, []) } },
  { type: 'function', function: { name: 'get_post', description: 'Read one blog post in full by id or slug.', parameters: obj({ id: str('post id'), slug: str('or slug') }, []) } },
  { type: 'function', function: { name: 'create_post', description: 'Write a NEW blog post (markdown body). published=false → draft; stage: seed/budding/evergreen.', parameters: obj({ title: str('title'), body: str('markdown body'), tags: arr('tags'), published: bool('publish now? default draft'), stage: str('seed | budding | evergreen'), pinned: bool('pin?') }, ['title', 'body']) } },
  { type: 'function', function: { name: 'update_post', description: 'Update an existing blog post (merge patch by id).', parameters: obj({ id: str('post id'), title: str('title'), body: str('body'), tags: arr('tags'), published: bool('published?'), pinned: bool('pinned?'), stage: str('garden stage') }, ['id']) } },
  { type: 'function', function: { name: 'delete_post', description: 'Delete a blog post permanently.', parameters: obj({ id: str('post id') }, ['id']) } },
  { type: 'function', function: { name: 'get_site', description: 'Read the site identity/settings: name, logo, tagline, now feed, socials, theme, fx, webring, hooks.', parameters: obj({}, []) } },
  { type: 'function', function: { name: 'set_site', description: 'Update site text settings: name, logo, tagline, now (markdown), colophon (markdown). Only these fields — nothing destructive.', parameters: obj({ name: str('site name'), logo: str('logo text'), tagline: str('tagline'), now: str('now feed markdown'), colophon: str('colophon markdown') }, []) } },
  { type: 'function', function: { name: 'list_links', description: 'List short links (the owner\'s bit.ly) with click counts.', parameters: obj({}, []) } },
  { type: 'function', function: { name: 'create_link', description: 'Create a short link.', parameters: obj({ url: str('destination url'), slug: str('optional custom slug') }, ['url']) } },
  { type: 'function', function: { name: 'delete_link', description: 'Delete a short link by id.', parameters: obj({ id: str('link id') }, ['id']) } },
  { type: 'function', function: { name: 'list_files', description: 'List drive files (name, folder, size, when).', parameters: obj({ limit: num('max files (default 30)') }, []) } },
  { type: 'function', function: { name: 'list_messages', description: 'Read guestbook/contact messages. Private ones included — you are the owner.', parameters: obj({ limit: num('max messages (default 30)') }, []) } },
];

export const TOOL_LABELS: Record<string, string> = {
  vault_search: 'searched the vault', list_items: 'listed vault items', get_item: 'read an item',
  create_item: 'created an item', update_item: 'updated an item', delete_item: 'deleted an item',
  vault_stats: 'counted the vault', list_posts: 'listed posts', get_post: 'read a post',
  create_post: 'wrote a post', update_post: 'edited a post', delete_post: 'deleted a post',
  get_site: 'read site settings', set_site: 'updated site settings',
  list_links: 'listed short links', create_link: 'created a short link', delete_link: 'deleted a link',
  list_files: 'listed drive files', list_messages: 'read the mail',
};
