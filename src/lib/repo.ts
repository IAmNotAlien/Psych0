/* PSYCH0 — repository layer.
 * Server-side only. Every read/write goes to Supabase when configured,
 * otherwise falls back to seed content (LOCAL MODE) — writes throw. */
import { createHash } from 'crypto';
import { supabase, isSupabaseConfigured, canWriteSupabase } from '@/lib/supabase';
import { seed, newMessage, uid, type SiteData, type Post, type Project, type Embed,
  type Bundle, type Message, type MediaItem, type ApiToken, type Revision } from '@/lib/types';

export class RepoError extends Error {
  code: string;
  constructor(code: string, msg: string) { super(msg); this.code = code; }
}

export function requireSupabase() {
  const db = supabase();
  if (!db) throw new RepoError('SUPABASE_NOT_CONNECTED', 'Database not connected. Add SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY to env, then run supabase/schema.sql in the Supabase SQL editor.');
  if (!canWriteSupabase()) {
    // publishable/anon key only — RLS blocks every write with a cryptic
    // permission error, so fail early with the actual fix instead
    throw new RepoError('READ_ONLY', 'Supabase is connected in READ-ONLY mode (publishable key). Add SUPABASE_SERVICE_ROLE_KEY (the sb_secret_… key from Supabase → Settings → API) to env, then redeploy — writes will work instantly.');
  }
  return db;
}

/* ---------- reads ---------- */

/** a fresh Supabase project has no tables yet — errors like "Could not find
 * the table" / "relation does not exist" mean the schema isn't applied yet;
 * fall back to seed content instead of 500ing the whole site */
function isSchemaMissing(e: unknown): boolean {
  const m = String((e as Error)?.message || e || '');
  return /could not find the table|schema cache|relation .* does not exist/i.test(m);
}

export async function getBundle(): Promise<Bundle> {
  if (!isSupabaseConfigured()) return seed();
  try {
    const db = supabase()!;
    const [siteRow, posts, projects, embeds] = await Promise.all([
      db.from('site').select('data').eq('id', 1).maybeSingle(),
      db.from('posts').select('*').order('date', { ascending: false }),
      db.from('projects').select('*').order('created_at', { ascending: true }),
      db.from('embeds').select('*').order('created_at', { ascending: true }),
    ]);
    return {
      // siteRow = supabase result {data: row}; row = {data: SiteData} (jsonb col named "data")
      site: ((siteRow?.data as { data?: SiteData } | null)?.data) || seed().site,
      posts: (posts.data as unknown as Post[]) || [],
      projects: (projects.data as unknown as Project[]) || [],
      embeds: (embeds.data as unknown as Embed[]) || [],
    };
  } catch (e) {
    if (isSchemaMissing(e)) return seed();
    throw e;
  }
}

const nowISO = () => new Date().toISOString();
const notYet = (p: Post) => !!p.publish_at && p.publish_at > nowISO();

export async function listPosts(opts?: { includeDrafts?: boolean }): Promise<Post[]> {
  if (!isSupabaseConfigured()) {
    const s = seed().posts.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    if (opts?.includeDrafts) return s;
    return s.filter(p => p.published && !notYet(p));
  }
  const db = supabase()!;
  let q = db.from('posts').select('*').order('date', { ascending: false });
  if (!opts?.includeDrafts) {
    q = q.eq('published', true).or(`publish_at.is.null,publish_at.lte.${nowISO()}`) as typeof q;
  }
  const { data, error } = await q;
  if (error) {
    if (isSchemaMissing(error)) return seed().posts.filter(p => opts?.includeDrafts || (p.published && !notYet(p)));
    throw new RepoError('DB_READ', error.message);
  }
  return (data as unknown as Post[]) || [];
}

export async function getPostBySlug(slug: string, opts?: { includeDrafts?: boolean }): Promise<Post | null> {
  if (!isSupabaseConfigured()) {
    const p = seed().posts.find(x => x.slug === slug) || null;
    if (p && !opts?.includeDrafts && (!p.published || notYet(p))) return null;
    return p;
  }
  const db = supabase()!;
  let q = db.from('posts').select('*').eq('slug', slug);
  if (!opts?.includeDrafts) {
    q = q.eq('published', true).or(`publish_at.is.null,publish_at.lte.${nowISO()}`) as typeof q;
  }
  const { data, error } = await q.maybeSingle();
  if (error) {
    if (isSchemaMissing(error)) return seed().posts.find(x => x.slug === slug) || null;
    throw new RepoError('DB_READ', error.message);
  }
  return (data as unknown as Post) || null;
}

export async function listProjects(): Promise<Project[]> {
  if (!isSupabaseConfigured()) return seed().projects;
  const db = supabase()!;
  const { data, error } = await db.from('projects').select('*').order('created_at', { ascending: true });
  if (error) {
    if (isSchemaMissing(error)) return seed().projects;
    throw new RepoError('DB_READ', error.message);
  }
  return (data as unknown as Project[]) || [];
}

export async function getProjectBySlug(slug: string): Promise<Project | null> {
  if (!isSupabaseConfigured()) return seed().projects.find(x => x.slug === slug) || null;
  const db = supabase()!;
  const { data, error } = await db.from('projects').select('*').eq('slug', slug).maybeSingle();
  if (error) {
    if (isSchemaMissing(error)) return seed().projects.find(x => x.slug === slug) || null;
    throw new RepoError('DB_READ', error.message);
  }
  return (data as unknown as Project) || null;
}

export async function listEmbeds(): Promise<Embed[]> {
  if (!isSupabaseConfigured()) return seed().embeds;
  const db = supabase()!;
  const { data, error } = await db.from('embeds').select('*').order('created_at', { ascending: true });
  if (error) {
    if (isSchemaMissing(error)) return seed().embeds;
    throw new RepoError('DB_READ', error.message);
  }
  return (data as unknown as Embed[]) || [];
}

/* ---------- writes (always require Supabase; snapshot a revision first) ---------- */

async function snapshot(entity: string, entityId: string, rows: 'posts' | 'projects' | 'embeds') {
  try {
    const db = requireSupabase();
    const { data } = await db.from(rows).select('*').eq('id', entityId).maybeSingle();
    if (data) await db.from('revisions').insert({ entity, entity_id: entityId, snapshot: data });
    // prune: keep the 20 newest snapshots per entity+id
    const keep = await db.from('revisions').select('id')
      .eq('entity', entity).eq('entity_id', entityId)
      .order('created_at', { ascending: false }).limit(20);
    const ids = ((keep?.data as { id: number }[]) || []).map(r => r.id);
    if (ids.length === 20) {
      await db.from('revisions').delete()
        .eq('entity', entity).eq('entity_id', entityId)
        .not('id', 'in', `(${ids.join(',')})`);
    }
  } catch { /* snapshots are best-effort; never block a save */ }
}

export async function upsertSite(site: SiteData): Promise<SiteData> {
  const db = requireSupabase();
  try {
    const cur = await db.from('site').select('data').eq('id', 1).maybeSingle();
    const prev = (cur?.data as { data?: SiteData } | null)?.data;
    if (prev) await db.from('revisions').insert({ entity: 'site', entity_id: 'site', snapshot: prev });
  } catch { /* best-effort */ }
  const { error } = await db.from('site').upsert({ id: 1, data: site, updated_at: nowISO() });
  if (error) throw new RepoError('DB_WRITE', error.message);
  return site;
}

export async function upsertPost(post: Post): Promise<Post> {
  const db = requireSupabase();
  await snapshot('post', post.id, 'posts');
  // was it live before this save? (drives publish webhooks)
  const prev = await db.from('posts').select('published').eq('id', post.id).maybeSingle();
  const wasPublished = !!(prev?.data as { published?: boolean } | null)?.published;
  const full = { ...post, updated_at: nowISO() };
  let error = (await db.from('posts').upsert(full)).error;
  if (error && /column/i.test(error.message || '')) {
    // migrate-2 not applied yet — save without the garden/fossil columns
    const { stage: _s, fossil: _f, ...rest } = full;
    error = (await db.from('posts').upsert(rest)).error;
  }
  if (error) throw new RepoError('DB_WRITE', error.message);
  if (!wasPublished && post.published) firePublishHooks(post); // best-effort, non-blocking errors
  return post;
}

async function getSiteData(): Promise<SiteData | null> {
  try {
    const db = requireSupabase();
    const row = await db.from('site').select('data').eq('id', 1).maybeSingle();
    return ((row?.data as { data?: SiteData } | null)?.data) || null;
  } catch { return null; }
}

/** publish webhooks — POST {event:'post.published', …} to every URL in SETTINGS → WEBHOOKS */
async function firePublishHooks(post: Post) {
  try {
    const site = await getSiteData();
    for (const h of site?.hooks || []) {
      if (!h.url || !/^https?:\/\//i.test(h.url)) continue;
      await fetch(h.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'post.published', slug: post.slug, title: post.title,
          date: post.date, url: '/#/blog/' + post.slug, at: nowISO(),
        }),
        signal: AbortSignal.timeout(5000),
      }).catch(() => { /* a dead hook never blocks a publish */ });
    }
  } catch { /* best-effort */ }
}

export async function deletePost(id: string): Promise<void> {
  const db = requireSupabase();
  const { error } = await db.from('posts').delete().eq('id', id);
  if (error) throw new RepoError('DB_WRITE', error.message);
}

export async function upsertProject(project: Project): Promise<Project> {
  const db = requireSupabase();
  await snapshot('project', project.id, 'projects');
  const { error } = await db.from('projects').upsert({ ...project, updated_at: nowISO() });
  if (error) throw new RepoError('DB_WRITE', error.message);
  return project;
}

export async function deleteProject(id: string): Promise<void> {
  const db = requireSupabase();
  const { error } = await db.from('projects').delete().eq('id', id);
  if (error) throw new RepoError('DB_WRITE', error.message);
}

export async function upsertEmbed(embed: Embed): Promise<Embed> {
  const db = requireSupabase();
  await snapshot('embed', embed.id, 'embeds');
  const { error } = await db.from('embeds').upsert({ ...embed, updated_at: nowISO() });
  if (error) throw new RepoError('DB_WRITE', error.message);
  return embed;
}

export async function deleteEmbed(id: string): Promise<void> {
  const db = requireSupabase();
  const { error } = await db.from('embeds').delete().eq('id', id);
  if (error) throw new RepoError('DB_WRITE', error.message);
}

/* ================= power features ================= */

/* ---------- revisions ---------- */
export async function listRevisions(entity: string, entityId: string): Promise<Revision[]> {
  const db = requireSupabase();
  const { data, error } = await db.from('revisions')
    .select('*').eq('entity', entity).eq('entity_id', entityId)
    .order('created_at', { ascending: false }).limit(20);
  if (error) throw new RepoError('DB_READ', error.message);
  return (data as unknown as Revision[]) || [];
}

export async function restoreRevision(revId: number): Promise<{ entity: string; data: Record<string, unknown> }> {
  const db = requireSupabase();
  const { data, error } = await db.from('revisions').select('*').eq('id', revId).maybeSingle();
  if (error || !data) throw new RepoError('DB_READ', error?.message || 'revision not found');
  const rev = data as Revision;
  const snap = rev.snapshot as Record<string, unknown>;
  const map: Record<string, 'posts' | 'projects' | 'embeds'> = { post: 'posts', project: 'projects', embed: 'embeds' };
  if (rev.entity === 'site') {
    await upsertSite(snap as unknown as SiteData);
  } else if (map[rev.entity]) {
    const { error: werr } = await db.from(map[rev.entity]).upsert({ ...snap, updated_at: nowISO() });
    if (werr) throw new RepoError('DB_WRITE', werr.message);
  } else {
    throw new RepoError('BAD_ENTITY', 'unknown revision entity');
  }
  return { entity: rev.entity, data: snap };
}

/* ---------- messages (inbox + guestbook) ---------- */
export async function listMessages(opts?: { includePrivate?: boolean }): Promise<Message[]> {
  const db = requireSupabase();
  let q = db.from('messages').select('*').order('created_at', { ascending: false }).limit(200);
  if (!opts?.includePrivate) q = q.eq('public', true);
  const { data, error } = await q;
  if (error) throw new RepoError('DB_READ', error.message);
  return (data as unknown as Message[]) || [];
}

export async function createMessage(name: string, contact: string, body: string, loc = ''): Promise<Message> {
  const db = requireSupabase();
  const m = newMessage(name, contact, body, loc);
  let error = (await db.from('messages').insert(m)).error;
  if (error && /column/i.test(error.message || '')) {
    // migrate-2 not applied yet — save without the pixel-map pin
    const { loc: _l, ...rest } = m;
    error = (await db.from('messages').insert(rest)).error;
  }
  if (error) throw new RepoError('DB_WRITE', error.message);
  return m;
}

export async function setMessageRead(id: string, read: boolean): Promise<void> {
  const db = requireSupabase();
  const { error } = await db.from('messages').update({ read }).eq('id', id);
  if (error) throw new RepoError('DB_WRITE', error.message);
}

export async function setMessagePublic(id: string, isPublic: boolean): Promise<void> {
  const db = requireSupabase();
  const { error } = await db.from('messages').update({ public: isPublic }).eq('id', id);
  if (error) throw new RepoError('DB_WRITE', error.message);
}

export async function deleteMessage(id: string): Promise<void> {
  const db = requireSupabase();
  const { error } = await db.from('messages').delete().eq('id', id);
  if (error) throw new RepoError('DB_WRITE', error.message);
}

/* ---------- media library ---------- */
export async function listMedia(): Promise<MediaItem[]> {
  const db = requireSupabase();
  const { data, error } = await db.from('media').select('*').order('created_at', { ascending: false }).limit(500);
  if (error) throw new RepoError('DB_READ', error.message);
  return (data as unknown as MediaItem[]) || [];
}

export async function addMedia(m: MediaItem): Promise<MediaItem> {
  const db = requireSupabase();
  const { error } = await db.from('media').insert(m);
  if (error) throw new RepoError('DB_WRITE', error.message);
  return m;
}

export async function deleteMedia(id: string, path?: string): Promise<void> {
  const db = requireSupabase();
  if (path) { try { await db.storage.from('media').remove([path]); } catch { /* best-effort */ } }
  const { error } = await db.from('media').delete().eq('id', id);
  if (error) throw new RepoError('DB_WRITE', error.message);
}

/* ---------- api tokens (sha256 hashed, raw shown once) ---------- */
export function hashToken(raw: string): string {
  return createHash('sha256').update('p0k:' + raw).digest('hex');
}

export async function createToken(label: string): Promise<{ row: ApiToken; raw: string }> {
  const db = requireSupabase();
  const raw = 'p0k_' + uid() + uid() + uid() + uid();
  const row: ApiToken = {
    id: 't_' + uid(), hash: hashToken(raw), label: (label || 'token').slice(0, 60),
    created_at: nowISO(), last_used: null,
  };
  const { error } = await db.from('tokens').insert(row);
  if (error) throw new RepoError('DB_WRITE', error.message);
  return { row, raw };
}

export async function listTokens(): Promise<ApiToken[]> {
  const db = requireSupabase();
  const { data, error } = await db.from('tokens').select('*').order('created_at', { ascending: false });
  if (error) throw new RepoError('DB_READ', error.message);
  return (data as unknown as ApiToken[]) || [];
}

export async function deleteToken(id: string): Promise<void> {
  const db = requireSupabase();
  const { error } = await db.from('tokens').delete().eq('id', id);
  if (error) throw new RepoError('DB_WRITE', error.message);
}

/** true if the request carries a valid Bearer token; also touches last_used */
export async function verifyApiToken(req: Request): Promise<boolean> {
  const auth = req.headers.get('authorization') || '';
  const raw = auth.replace(/^Bearer\s+/i, '').trim();
  if (!raw) return false;
  const db = requireSupabase();
  const hash = hashToken(raw);
  const { data } = await db.from('tokens').select('id').eq('hash', hash).maybeSingle();
  if (!data) return false;
  await db.from('tokens').update({ last_used: nowISO() }).eq('id', (data as { id: string }).id);
  return true;
}

/** studio cookie OR valid api token — used by write endpoints */
export async function isWriter(req: Request, cookieStudio: boolean): Promise<boolean> {
  return cookieStudio || verifyApiToken(req);
}

/* ---------- counters (visits / votes) ---------- */
export async function bumpCounter(key: string, by = 1): Promise<number> {
  const db = requireSupabase();
  const { data, error } = await db.rpc('bump_counter', { k: key, by });
  if (!error && typeof data === 'number') return data;
  // fallback if the rpc is missing: read-modify-write
  const cur = await db.from('counters').select('n').eq('key', key).maybeSingle();
  const n = ((cur?.data as { n?: number } | null)?.n || 0) + by;
  await db.from('counters').upsert({ key, n });
  return n;
}

export async function getCounter(key: string): Promise<number> {
  const db = requireSupabase();
  const { data } = await db.from('counters').select('n').eq('key', key).maybeSingle();
  return (data as { n?: number } | null)?.n || 0;
}

export async function getCounters(prefix: string): Promise<Record<string, number>> {
  const db = requireSupabase();
  const { data, error } = await db.from('counters').select('*').like('key', prefix + '%');
  if (error) throw new RepoError('DB_READ', error.message);
  const out: Record<string, number> = {};
  for (const r of (data as { key: string; n: number }[]) || []) out[r.key] = r.n;
  return out;
}

export async function getStats(): Promise<{ visits: number; posts: number; projects: number; embeds: number; guestbook: number }> {
  const db = requireSupabase();
  const [visits, posts, projects, embeds, guest] = await Promise.all([
    getCounter('visit:total'),
    db.from('posts').select('id', { count: 'exact', head: true }),
    db.from('projects').select('id', { count: 'exact', head: true }),
    db.from('embeds').select('id', { count: 'exact', head: true }),
    db.from('messages').select('id', { count: 'exact', head: true }),
  ]);
  return {
    visits, posts: posts.count || 0, projects: projects.count || 0,
    embeds: embeds.count || 0, guestbook: guest.count || 0,
  };
}
