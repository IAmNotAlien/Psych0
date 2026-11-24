import { NextRequest, NextResponse } from 'next/server';
import { isStudioRequest } from '@/lib/studio';
import { listItems, saveItem, deleteItem, listFiles, listLinks, saveLink, deleteLink } from '@/lib/osrepo';
import { listPosts, getPostBySlug, upsertPost, deletePost, upsertSite, listMessages, getBundle } from '@/lib/repo';
import { aiEnv, brainTurn, embed, scoreChunks, chunkText, BRAIN_SYSTEM, BRAIN_TOOLS, TOOL_LABELS, type ChatMsg, type ToolLog } from '@/lib/brain';
import { uid, type VaultItem, type Post } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // hobby plan cap — the tools loop usually needs 2-3 model hops, well under this

/* PSYCH://OS — the brain.
 * GET  /api/brain?q=…     — retrieval only (semantic search over vault + posts)
 * POST /api/brain         — chat with TOOLS. body: { messages, persona?, docId?, key?, session? }
 *                           the server pulls relevant context (RAG), injects live STATS,
 *                           then runs the model ⇄ tools loop so the brain can read and
 *                           write everything: items, posts, site settings, links, mail.
 * No OPENAI_API_KEY? Still works: offline retrieval mode returns matched notes. */

const KIND_LABEL: Record<string, string> = {
  note: 'NOTE', journal: 'JOURNAL', task: 'TASK', bookmark: 'BOOKMARK', contact: 'CONTACT',
  expense: 'EXPENSE', recipe: 'RECIPE', idea: 'IDEA', media: 'SHELF', trip: 'TRIP',
  goal: 'GOAL', capsule: 'CAPSULE', mood: 'MOOD', habit: 'HABIT',
};

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'post';
const nowISO = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);

async function buildChunks(queryVec: number[] | null, docId?: string) {
  const [items, posts, files] = await Promise.all([
    listItems().catch(() => [] as VaultItem[]),
    listPosts({ includeDrafts: true }).catch(() => []),
    listFiles().catch(() => []),
  ]);
  const chunks: { label: string; text: string; vec?: number[] | null; queryVec?: number[] | null }[] = [];
  for (const it of items) {
    if (it.secure && it.cipher) continue; // encrypted never leaves the vault
    if (docId && it.id !== docId) continue;
    const body = it.type === 'card'
      ? 'Q: ' + String((it.data as { front?: string })?.front || it.title) + ' A: ' + String((it.data as { back?: string })?.back || it.body)
      : it.body;
    chunks.push({
      label: `[${KIND_LABEL[it.type] || it.type.toUpperCase()}] ${(it.title || '(untitled)').slice(0, 60)}` +
        (it.tags?.length ? ' #' + it.tags.join(' #') : ''),
      text: chunkText(it.type, body || it.title),
      vec: Array.isArray((it.data as { vec?: number[] })?.vec) ? (it.data as { vec: number[] }).vec : null,
      queryVec,
    });
  }
  // drive files — index their extracted text (OCR / pasted content / text files)
  for (const f of files) {
    if (docId && f.id !== docId) continue;
    if (!f.text && !f.name) continue;
    chunks.push({ label: `[FILE] ${f.name}`, text: chunkText('file', f.text || f.name, 4000), queryVec });
  }
  for (const p of posts) {
    if (docId) continue;
    chunks.push({ label: `[POST] ${p.title}`, text: chunkText('post', p.body), queryVec });
  }
  return chunks;
}

/** live STATS — the brain knows today, the site identity and the vault counts */
async function buildStats(): Promise<string> {
  const [items, posts, site, links, files] = await Promise.all([
    listItems().catch(() => [] as VaultItem[]),
    listPosts({ includeDrafts: true }).catch(() => [] as Post[]),
    getBundle().then(b => b.site).catch(() => null),
    listLinks().catch(() => []),
    listFiles().catch(() => []),
  ]);
  const counts: Record<string, number> = {};
  for (const i of items) counts[i.type] = (counts[i.type] || 0) + 1;
  const todayK = today();
  const overdue = items.filter(i => i.type === 'task' && !i.done && String((i.data as { due?: string })?.due || '') && String((i.data as { due?: string })?.due) <= todayK).length;
  const lines = [
    `today: ${todayK}`,
    `site: "${site?.name || 'the den'}" — ${site?.tagline || ''}`,
    `vault: ${items.length} items (${Object.entries(counts).map(([k, v]) => v + ' ' + k).join(', ') || 'empty'})`,
    `tasks overdue: ${overdue}`,
    `blog: ${posts.length} posts (${posts.filter(p => p.published).length} published)`,
    `short links: ${links.length} · drive files: ${files.length}`,
    `db mode: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'read/write' : 'READ-ONLY (no service key yet — writes will fail until the owner adds SUPABASE_SERVICE_ROLE_KEY)'}`,
  ];
  return 'STATS — live state of the den right now:\n' + lines.join('\n');
}

/* ---------- the tool executor — the brain's hands ---------- */

async function runTool(name: string, a: Record<string, unknown>): Promise<{ label: string; summary: string; data?: string }> {
  const S = (v: unknown, d = '') => String(v ?? d);
  const N = (v: unknown, d: number) => (Number.isFinite(Number(v)) ? Number(v) : d);
  const label = TOOL_LABELS[name] || name;
  switch (name) {
    case 'vault_search': {
      const q = S(a.query);
      const chunks = await buildChunks(null);
      const hits = scoreChunks(q, chunks);
      return { label, summary: `searched the vault for "${q.slice(0, 60)}" — ${hits.length} hit(s)`, data: hits.slice(0, 6).map(h => h.label + '\n' + h.text).join('\n\n') || 'no hits' };
    }
    case 'list_items': {
      const type = S(a.type) || undefined;
      const items = await listItems(type);
      const lim = Math.min(60, N(a.limit, 30));
      return { label, summary: `listed ${Math.min(items.length, lim)} item(s)${type ? ' of type ' + type : ''}`,
        data: items.slice(0, lim).map(i => `${i.id} · [${i.type}] ${i.title}${i.done ? ' (done)' : ''}${(i.tags || []).length ? ' #' + i.tags.join(' #') : ''}`).join('\n') || '(none)' };
    }
    case 'get_item': {
      const items = await listItems();
      const it = items.find(x => x.id === S(a.id));
      if (!it) return { label, summary: 'item not found: ' + S(a.id) };
      return { label, summary: `read item ${it.title.slice(0, 40)}`, data: `[${it.type}] ${it.title}\n${it.body}\ndata: ${JSON.stringify(it.data || {}).slice(0, 800)}` };
    }
    case 'create_item': {
      const it = await saveItem({
        type: S(a.type, 'note'),
        title: S(a.title),
        body: S(a.body),
        tags: Array.isArray(a.tags) ? (a.tags as unknown[]).map(t => S(t)) : [],
        data: (a.data && typeof a.data === 'object' ? a.data : {}) as Record<string, unknown>,
        pinned: !!a.pinned,
      });
      return { label, summary: `created [${it.type}] "${it.title.slice(0, 40)}" (${it.id})` };
    }
    case 'update_item': {
      const items = await listItems();
      const cur = items.find(x => x.id === S(a.id));
      if (!cur) return { label, summary: 'item not found: ' + S(a.id) };
      const patch: Partial<VaultItem> = { ...cur };
      if (a.title !== undefined) patch.title = S(a.title);
      if (a.body !== undefined) patch.body = S(a.body);
      if (a.tags !== undefined) patch.tags = Array.isArray(a.tags) ? (a.tags as unknown[]).map(t => S(t)) : [];
      if (a.done !== undefined) patch.done = !!a.done;
      if (a.pinned !== undefined) patch.pinned = !!a.pinned;
      if (a.data && typeof a.data === 'object') patch.data = { ...(cur.data || {}), ...(a.data as Record<string, unknown>) };
      const it = await saveItem(patch);
      return { label, summary: `updated [${it.type}] "${it.title.slice(0, 40)}"` };
    }
    case 'delete_item': {
      await deleteItem(S(a.id));
      return { label, summary: `deleted item ${S(a.id)}` };
    }
    case 'vault_stats': {
      const items = await listItems();
      const counts: Record<string, number> = {};
      for (const i of items) counts[i.type] = (counts[i.type] || 0) + 1;
      return { label, summary: `counted ${items.length} items`, data: Object.entries(counts).map(([k, v]) => k + ': ' + v).join(', ') };
    }
    case 'list_posts': {
      const posts = await listPosts({ includeDrafts: true });
      const lim = Math.min(40, N(a.limit, 20));
      return { label, summary: `listed ${Math.min(posts.length, lim)} post(s)`,
        data: posts.slice(0, lim).map(p => `${p.id} · ${p.slug} · "${p.title}" · ${p.date} · ${p.published ? 'LIVE' : 'draft'}${p.pinned ? ' · pinned' : ''}`).join('\n') || '(no posts yet)' };
    }
    case 'get_post': {
      const p = S(a.id) ? (await listPosts({ includeDrafts: true })).find(x => x.id === S(a.id))
        : await getPostBySlug(S(a.slug), { includeDrafts: true });
      if (!p) return { label, summary: 'post not found' };
      return { label, summary: `read post "${p.title.slice(0, 40)}"`, data: `"${p.title}" (${p.slug}, ${p.date}, ${p.published ? 'LIVE' : 'draft'})\n${p.body.slice(0, 3500)}` };
    }
    case 'create_post': {
      const title = S(a.title);
      const posts = await listPosts({ includeDrafts: true });
      let slug = slugify(title);
      while (posts.some(p => p.slug === slug)) slug = slug + '-' + uid().slice(0, 4);
      const post: Post = {
        id: 'p_' + uid(), slug, title,
        date: today(), tags: Array.isArray(a.tags) ? (a.tags as unknown[]).map(t => S(t)) : [],
        cover: '', pinned: !!a.pinned, published: a.published === undefined ? false : !!a.published,
        body: S(a.body), stage: (['seed', 'budding', 'evergreen'].includes(S(a.stage)) ? S(a.stage) : 'seed') as Post['stage'],
        fossil: false,
      };
      await upsertPost(post);
      return { label, summary: `wrote post "${title.slice(0, 40)}" (${post.published ? 'PUBLISHED' : 'draft'}, #${post.stage}) → ${post.id}` };
    }
    case 'update_post': {
      const posts = await listPosts({ includeDrafts: true });
      const cur = posts.find(x => x.id === S(a.id)) || await getPostBySlug(S(a.id), { includeDrafts: true });
      if (!cur) return { label, summary: 'post not found: ' + S(a.id) };
      const patch: Post = { ...cur };
      if (a.title !== undefined) patch.title = S(a.title);
      if (a.body !== undefined) patch.body = S(a.body);
      if (a.tags !== undefined) patch.tags = Array.isArray(a.tags) ? (a.tags as unknown[]).map(t => S(t)) : [];
      if (a.published !== undefined) patch.published = !!a.published;
      if (a.pinned !== undefined) patch.pinned = !!a.pinned;
      if (a.stage !== undefined && ['seed', 'budding', 'evergreen'].includes(S(a.stage))) patch.stage = S(a.stage) as Post['stage'];
      await upsertPost(patch);
      return { label, summary: `edited post "${patch.title.slice(0, 40)}" (${patch.published ? 'LIVE' : 'draft'})` };
    }
    case 'delete_post': {
      await deletePost(S(a.id));
      return { label, summary: `deleted post ${S(a.id)}` };
    }
    case 'get_site': {
      const site = (await getBundle()).site;
      return { label, summary: 'read site settings', data: JSON.stringify({ name: site.name, logo: site.logo, tagline: site.tagline, now: site.now, socials: site.socials, preset: site.preset, accent: site.accent, webring: site.webring, hooks: site.hooks }, null, 1).slice(0, 1200) };
    }
    case 'set_site': {
      const site = (await getBundle()).site;
      const patch: Record<string, string> = {};
      for (const k of ['name', 'logo', 'tagline', 'now', 'colophon'] as const) {
        if (a[k] !== undefined) patch[k] = S(a[k]).slice(0, k === 'now' || k === 'colophon' ? 4000 : 200);
      }
      await upsertSite({ ...site, ...patch });
      return { label, summary: 'updated site settings: ' + Object.keys(patch).join(', ') };
    }
    case 'list_links': {
      const links = await listLinks();
      return { label, summary: `listed ${links.length} short link(s)`,
        data: links.map(l => `${l.id} · /l/${l.slug} → ${l.url} · ${l.clicks} clicks`).join('\n') || '(none)' };
    }
    case 'create_link': {
      const l = await saveLink(S(a.url), S(a.slug) || undefined);
      return { label, summary: `created short link /l/${l.slug} → ${l.url}` };
    }
    case 'delete_link': {
      await deleteLink(S(a.id));
      return { label, summary: `deleted link ${S(a.id)}` };
    }
    case 'list_files': {
      const files = await listFiles();
      const lim = Math.min(50, N(a.limit, 30));
      return { label, summary: `listed ${Math.min(files.length, lim)} file(s)`,
        data: files.slice(0, lim).map(f => `${f.name} (${f.folder || '/'})`).join('\n') || '(drive empty)' };
    }
    case 'list_messages': {
      const msgs = await listMessages({ includePrivate: true });
      const lim = Math.min(50, N(a.limit, 30));
      return { label, summary: `read ${Math.min(msgs.length, lim)} message(s)`,
        data: msgs.slice(0, lim).map(m => `${m.created_at.slice(0, 10)} · ${m.name}${m.public ? ' (public)' : ' (private)'}: ${m.body.slice(0, 140)}`).join('\n') || '(no mail)' };
    }
    default:
      return { label: name, summary: `unknown tool: ${name}` };
  }
}

export async function GET(req: NextRequest) {
  if (!isStudioRequest(req)) return NextResponse.json({ error: 'STUDIO_ONLY' }, { status: 401 });
  const q = new URL(req.url).searchParams.get('q') || '';
  if (!q.trim()) return NextResponse.json({ hits: [], offline: !aiEnv().hasKey });
  const env = aiEnv();
  const queryVec = env.embedModel ? await embed(q) : null;
  const chunks = await buildChunks(queryVec);
  const hits = scoreChunks(q, chunks);
  return NextResponse.json({ hits: hits.slice(0, 12), offline: !env.hasKey });
}

export async function POST(req: NextRequest) {
  if (!isStudioRequest(req)) return NextResponse.json({ error: 'STUDIO_ONLY' }, { status: 401 });
  try {
    const body = await req.json() as { messages?: ChatMsg[]; persona?: string; docId?: string; key?: string };
    const msgs = (body.messages || []).slice(-16);
    const lastUser = [...msgs].reverse().find(m => m.role === 'user')?.content || '';
    const env = aiEnv(body.key);
    const queryVec = env.embedModel && lastUser ? await embed(lastUser, body.key) : null;
    const [chunks, stats] = await Promise.all([buildChunks(queryVec, body.docId), buildStats()]);
    const hits = scoreChunks(lastUser, chunks);
    const context = hits.length
      ? 'CONTEXT — excerpts from the owner\'s vault (most relevant first):\n\n' +
        hits.map(h => h.label + '\n' + h.text).join('\n\n---\n\n')
      : 'CONTEXT — (nothing relevant found in the vault).';

    const personaBlock = body.persona
      ? '\n\nPERSONA OVERRIDE — the owner activated a persona; adopt its style and instructions fully:\n' + body.persona
      : '';

    if (!env.hasKey) {
      // offline brain: honest retrieval-only answer
      const reply = hits.length
        ? '**offline retrieval mode** — no AI key is configured, so i can only show what the vault holds:\n\n' +
          hits.map(h => '- ' + h.label).join('\n') +
          '\n\npaste your key in OS → PLUMBING → AI KEY (openrouter free works, keys start `sk-or-`) or add `OPENROUTER_API_KEY` / `OPENAI_API_KEY` to env and i can actually reason over these.'
        : '**offline retrieval mode** — no AI key configured and nothing in the vault matches "' +
          lastUser.slice(0, 80) + '". add a key (OS → PLUMBING → AI KEY, or env `OPENROUTER_API_KEY`) to bring me online.';
      return NextResponse.json({ ok: true, reply, offline: true, hits });
    }

    const system = BRAIN_SYSTEM + personaBlock + '\n\n' + stats + '\n\n' + context;
    const messages: ChatMsg[] = [
      { role: 'system', content: system },
      ...msgs.map(m => ({ role: m.role, content: String(m.content).slice(0, 6000) })),
    ];
    const out = await brainTurn({
      messages, key: body.key, tools: BRAIN_TOOLS,
      execute: (n, args) => runTool(n, args),
      maxTokens: 1600, temperature: 0.6,
    });
    const toolLog: ToolLog[] = out.tools;
    return NextResponse.json({
      ok: true, reply: out.reply || '(the brain went quiet — try again)',
      tools: toolLog.map(t => ({ name: t.name, label: t.label, summary: t.summary.slice(0, 120) })),
      degraded: out.degraded, hits: hits.slice(0, 6),
      provider: env.provider, model: env.model,
    });
  } catch (e) {
    return NextResponse.json({ error: 'BRAIN_FAIL', message: String(e).slice(0, 300) }, { status: 500 });
  }
}
