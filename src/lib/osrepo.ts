/* PSYCH://OS — server repository for the private vault layer.
 * items + files + links, the rules engine, share/burn resolution and the
 * mega backup. Supabase only — the vault needs real persistence; the client
 * store keeps a LOCAL MODE overlay so the OS still works without a database. */
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { requireSupabase, RepoError } from '@/lib/repo';
import { applyRule, ruleMatches } from '@/lib/osutil';
import { uid, type VaultItem, type DriveFile, type ShortLink, type SiteData, type OsRule } from '@/lib/types';

export { requireSupabase, RepoError };

const nowISO = () => new Date().toISOString();

function cleanItem(raw: Partial<VaultItem>): VaultItem {
  return {
    id: raw.id || 'i_' + uid(),
    type: String(raw.type || 'note').slice(0, 40),
    title: String(raw.title || '').slice(0, 300),
    body: String(raw.body ?? '').slice(0, 200000),
    data: (raw.data && typeof raw.data === 'object' ? raw.data : {}) as Record<string, unknown>,
    tags: Array.isArray(raw.tags) ? raw.tags.slice(0, 24).map(t => String(t).slice(0, 40)) : [],
    folder: String(raw.folder || '').slice(0, 200),
    done: !!raw.done,
    pinned: !!raw.pinned,
    secure: !!raw.secure,
    cipher: String(raw.cipher || ''),
    iv: String(raw.iv || ''),
    salt: String(raw.salt || ''),
    share: String(raw.share || ''),
    burns: Math.max(0, Math.min(99, Number(raw.burns || 0))),
    reads: Math.max(0, Math.min(9999, Number(raw.reads || 0))),
    share_expires: raw.share_expires || null,
    deliver_at: raw.deliver_at || null,
    created_at: raw.created_at || nowISO(),
    updated_at: nowISO(),
  };
}

/* ---------- items ---------- */
export async function listItems(type?: string): Promise<VaultItem[]> {
  if (!isSupabaseConfigured()) return [];
  const db = supabase()!;
  let q = db.from('items').select('*').order('updated_at', { ascending: false }).limit(2000);
  if (type) q = q.eq('type', type);
  const { data, error } = await q;
  if (error) throw new RepoError('DB_READ', error.message);
  return ((data as unknown as VaultItem[]) || []).map(i => cleanItem(i));
}

export async function saveItem(raw: Partial<VaultItem>, opts?: { applyRules?: OsRule[] }): Promise<VaultItem> {
  const db = requireSupabase();
  let item = cleanItem(raw);
  if (!raw.created_at) {
    // brand new → snapshot-free insert, run the rules engine
    for (const r of opts?.applyRules || []) {
      if (r.on !== false && ruleMatches(r, item)) item = applyRule(item, r);
    }
  }
  await snapshot('item', item.id, db.from('items'));
  const { error } = await db.from('items').upsert(item);
  if (error) throw new RepoError('DB_WRITE', error.message);
  return item;
}

export async function deleteItem(id: string): Promise<void> {
  const db = requireSupabase();
  const { error } = await db.from('items').delete().eq('id', id);
  if (error) throw new RepoError('DB_WRITE', error.message);
}

/* ---------- share / burn resolution (public, token-based) ---------- */
export async function findSharedItem(token: string): Promise<VaultItem | null> {
  if (!isSupabaseConfigured() || !token) return null;
  const db = supabase()!;
  const { data } = await db.from('items').select('*').eq('share', token).maybeSingle();
  if (!data) return null;
  const it = cleanItem(data as Partial<VaultItem>);
  if (it.share_expires && it.share_expires < nowISO()) return null;
  return it;
}

/** count a read; burn after N. returns the item or null when consumed */
export async function readSharedItem(token: string): Promise<{ item: VaultItem | null; burned: boolean }> {
  const it = await findSharedItem(token);
  if (!it) return { item: null, burned: false };
  if (it.burns > 0) {
    const reads = it.reads + 1;
    const db = requireSupabase();
    if (reads >= it.burns) {
      await db.from('items').delete().eq('id', it.id);
      return { item: it, burned: true };
    }
    await db.from('items').update({ reads }).eq('id', it.id);
  }
  return { item: it, burned: false };
}

/* ---------- files (drive) ---------- */
export async function listFiles(): Promise<DriveFile[]> {
  if (!isSupabaseConfigured()) return [];
  const db = supabase()!;
  const { data, error } = await db.from('files').select('*').order('created_at', { ascending: false }).limit(2000);
  if (error) throw new RepoError('DB_READ', error.message);
  return (data as unknown as DriveFile[]) || [];
}

export async function saveFile(f: Partial<DriveFile>): Promise<DriveFile> {
  const db = requireSupabase();
  const row: DriveFile = {
    id: f.id || 'f_' + uid(),
    name: String(f.name || 'file').slice(0, 200),
    folder: String(f.folder || '/').slice(0, 200),
    mime: String(f.mime || 'application/octet-stream').slice(0, 100),
    size: Math.max(0, Number(f.size || 0)),
    path: String(f.path || ''),
    url: String(f.url || ''),
    text: String(f.text || '').slice(0, 100000),
    share: String(f.share || ''),
    share_expires: f.share_expires || null,
    created_at: f.created_at || nowISO(),
    updated_at: nowISO(),
  };
  const { error } = await db.from('files').upsert(row);
  if (error) throw new RepoError('DB_WRITE', error.message);
  return row;
}

export async function deleteFile(id: string, path?: string): Promise<void> {
  const db = requireSupabase();
  if (path) { try { await db.storage.from('drive').remove([path]); } catch { /* best-effort */ } }
  const { error } = await db.from('files').delete().eq('id', id);
  if (error) throw new RepoError('DB_WRITE', error.message);
}

export async function findSharedFile(token: string): Promise<DriveFile | null> {
  if (!isSupabaseConfigured() || !token) return null;
  const db = supabase()!;
  const { data } = await db.from('files').select('*').eq('share', token).maybeSingle();
  if (!data) return null;
  const f = data as DriveFile;
  if (f.share_expires && f.share_expires < nowISO()) return null;
  return f;
}

/* ---------- links (shortener) ---------- */
export async function listLinks(): Promise<ShortLink[]> {
  if (!isSupabaseConfigured()) return [];
  const db = supabase()!;
  const { data, error } = await db.from('links').select('*').order('created_at', { ascending: false }).limit(500);
  if (error) throw new RepoError('DB_READ', error.message);
  return (data as unknown as ShortLink[]) || [];
}

export async function saveLink(url: string, slug?: string): Promise<ShortLink> {
  const db = requireSupabase();
  const cleanSlug = (slug || uid()).toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40) || uid();
  const row: ShortLink = { id: 'l_' + uid(), slug: cleanSlug, url, clicks: 0, created_at: nowISO() };
  const { error } = await db.from('links').upsert(row);
  if (error) throw new RepoError('DB_WRITE', error.message.includes('duplicate') ? 'SLUG_TAKEN' : error.message);
  return row;
}

export async function resolveLink(slug: string): Promise<ShortLink | null> {
  if (!isSupabaseConfigured()) return null;
  const db = supabase()!;
  const { data } = await db.from('links').select('*').eq('slug', slug).maybeSingle();
  return (data as ShortLink) || null;
}

export async function bumpLink(slug: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    const db = supabase()!;
    const cur = await db.from('links').select('clicks').eq('slug', slug).maybeSingle();
    const n = ((cur?.data as { clicks?: number } | null)?.clicks || 0) + 1;
    await db.from('links').update({ clicks: n }).eq('slug', slug);
  } catch { /* best-effort */ }
}

export async function deleteLink(id: string): Promise<void> {
  const db = requireSupabase();
  const { error } = await db.from('links').delete().eq('id', id);
  if (error) throw new RepoError('DB_WRITE', error.message);
}

/* ---------- rules helper ---------- */
export async function getRules(site?: SiteData | null): Promise<OsRule[]> {
  if (site) return site.rules || [];
  try {
    const db = requireSupabase();
    const row = await db.from('site').select('data').eq('id', 1).maybeSingle();
    const data = (row?.data as { data?: SiteData } | null)?.data;
    return data?.rules || [];
  } catch { return []; }
}

/* ---------- revisions (same table as posts) ---------- */
async function snapshot(entity: string, entityId: string, table: ReturnType<ReturnType<typeof requireSupabase>['from']>) {
  try {
    const db = requireSupabase();
    const { data } = await table.select('*').eq('id', entityId).maybeSingle();
    if (data) await db.from('revisions').insert({ entity, entity_id: entityId, snapshot: data });
    const keep = await db.from('revisions').select('id')
      .eq('entity', entity).eq('entity_id', entityId)
      .order('created_at', { ascending: false }).limit(20);
    const ids = ((keep?.data as { id: number }[]) || []).map(r => r.id);
    if (ids.length === 20) {
      await db.from('revisions').delete()
        .eq('entity', entity).eq('entity_id', entityId)
        .not('id', 'in', `(${ids.join(',')})`);
    }
  } catch { /* best-effort */ }
}

export async function listItemRevisions(itemId: string) {
  const db = requireSupabase();
  const { data, error } = await db.from('revisions')
    .select('*').eq('entity', 'item').eq('entity_id', itemId)
    .order('created_at', { ascending: false }).limit(20);
  if (error) throw new RepoError('DB_READ', error.message);
  return data || [];
}

/* ---------- mega backup ---------- */
export async function fullBackup(): Promise<Record<string, unknown>> {
  const db = requireSupabase();
  const [site, posts, projects, embeds, items, files, links] = await Promise.all([
    db.from('site').select('data').eq('id', 1).maybeSingle(),
    db.from('posts').select('*'),
    db.from('projects').select('*'),
    db.from('embeds').select('*'),
    db.from('items').select('*'),
    db.from('files').select('*'),
    db.from('links').select('*'),
  ]);
  return {
    kind: 'psych0-os-backup', version: 3, at: nowISO(),
    site: ((site?.data as { data?: SiteData } | null)?.data) || null,
    posts: posts.data || [], projects: projects.data || [], embeds: embeds.data || [],
    items: items.data || [], files: (files.data || []).map((f: DriveFile) => ({ ...f })), links: links.data || [],
  };
}
