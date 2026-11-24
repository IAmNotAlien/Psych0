'use client';
/* PSYCH://OS — vault client store (zustand). Dual mode like the main store:
 * SUPABASE → /api/items, /api/files, /api/links · LOCAL → localStorage overlay
 * (with a small demo vault so every OS page works out of the box).
 * Also owns the AES-GCM crypto for the secrets vault. */
import { create } from 'zustand';
import { uid, type VaultItem, type DriveFile, type ShortLink, type OsRule } from '@/lib/types';
import { applyRule, ruleMatches } from '@/lib/osutil';
import { usePsych0 } from './store';

const VAULT_KEY = 'psych0.vault.v1';
const PASS_KEY = 'psych0.vaultpass';

/* ---------- AES-GCM crypto (secrets vault / document vault) ---------- */
const te = new TextEncoder();
const td = new TextDecoder();

const b64 = (buf: ArrayBuffer): string => {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
};
const unb64 = (s: string): ArrayBuffer => {
  const bin = atob(s || '');
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
};

async function deriveKey(pass: string, saltB64: string): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', te.encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: unb64(saltB64), iterations: 120000, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  );
}

export async function encryptSecret(pass: string, plaintext: string): Promise<{ cipher: string; iv: string; salt: string }> {
  const salt = b64(crypto.getRandomValues(new Uint8Array(16)).buffer);
  const iv = b64(crypto.getRandomValues(new Uint8Array(12)).buffer);
  const key = await deriveKey(pass, salt);
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: unb64(iv) }, key, te.encode(plaintext));
  return { cipher: b64(cipher), iv, salt };
}

export async function decryptSecret(pass: string, cipher: string, iv: string, salt: string): Promise<string> {
  const key = await deriveKey(pass, salt);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, key, unb64(cipher));
  return td.decode(plain);
}

/* session-scoped passphrase cache for the secrets vault */
export function cachePass(pass: string) { try { sessionStorage.setItem(PASS_KEY, pass); } catch { /* private mode */ } }
export function cachedPass(): string { try { return sessionStorage.getItem(PASS_KEY) || ''; } catch { return ''; } }
export function clearPass() { try { sessionStorage.removeItem(PASS_KEY); } catch { /* private mode */ } }

/* ---------- demo vault (LOCAL MODE first boot) ---------- */
function seedVault(): { items: VaultItem[]; files: DriveFile[]; links: ShortLink[] } {
  const now = new Date().toISOString();
  const mk = (over: Partial<VaultItem>): VaultItem => ({
    id: 'i_' + uid(), type: 'note', title: '', body: '', data: {}, tags: [], folder: '',
    done: false, pinned: false, secure: false, cipher: '', iv: '', salt: '',
    share: '', burns: 0, reads: 0, share_expires: null, deliver_at: null,
    created_at: now, updated_at: now, ...over,
  });
  const day = (offset: number) => { const d = new Date(); d.setDate(d.getDate() + offset); return d.toISOString().slice(0, 10); };
  const items: VaultItem[] = [
    mk({ type: 'note', title: 'READ ME — THIS IS YOUR SECOND BRAIN', pinned: true, tags: ['meta', 'os'],
      body: 'Everything in PSYCH://OS is an **item** — notes, tasks, habits, bookmarks, expenses, flashcards. One search, one brain, one export.\n\n## what lives where\n\n- **BRAIN** — AI chat over your whole vault (needs `OPENAI_API_KEY`, retrieval works without)\n- **NOTES** — private notes with [[wikilinks]] and backlinks\n- **TASKS** — inbox → today → kanban\n- **DRIVE** — your files, shareable\n- **VAULT** — AES-encrypted secrets\n\nCapture from anywhere: the console (`> cap <text>`), your phone via the share target, a Telegram bot, or email-in.' }),
    mk({ type: 'note', title: 'Zettelkasten playground', tags: ['meta'],
      body: 'Notes can link each other: see [[read-me — this is your second brain]]. Related notes share tags. The CHECKUP button finds orphans and dead links.' }),
    mk({ type: 'task', title: 'wire the telegram bot', tags: ['inbox', 'os'], done: false, data: { priority: 'now', due: day(1) },
      body: 'studio → OS → PLUMBING has the webhook URL + secret.' }),
    mk({ type: 'task', title: 'weekly review sunday 20:00', tags: ['ritual'], done: false, data: { priority: 'soon', due: day(3) }, body: '' }),
    mk({ type: 'task', title: 'delete me — done items go to the archive', tags: [], done: true, data: { priority: 'someday' }, body: '' }),
    mk({ type: 'habit', title: 'deep work 1h', tags: [], data: { icon: '◆', color: 'var(--acc)' }, body: '' }),
    mk({ type: 'habit', title: 'read 20 pages', tags: [], data: { icon: '▤' }, body: '' }),
    mk({ type: 'habit', title: 'move the body', tags: [], data: { icon: '▲' }, body: '' }),
    mk({ type: 'bookmark', title: '100 Rabbits', tags: ['inspiration', 'small-web'], data: { url: 'https://100r.co', desc: 'off-grid studio, the aesthetic ancestors of this whole den.' }, body: '' }),
    mk({ type: 'bookmark', title: 'MDN Web Docs', tags: ['dev'], data: { url: 'https://developer.mozilla.org', desc: 'the web manual.' }, body: '' }),
    mk({ type: 'idea', title: 'a zine made of guestbook messages', tags: [], data: { ripe: 'seed' }, body: 'the mail page already collects them…' }),
    mk({ type: 'idea', title: 'pixel-art weather station', tags: ['hardware'], data: { ripe: 'cooking' }, body: 'e-ink + the worldmap grid.' }),
    mk({ type: 'recipe', title: 'midnight garlic noodles', tags: ['fast'], data: { mins: 15 }, body: '**needs:** noodles, garlic, butter, soy, chili flakes.\n\n1. toast chopped garlic in butter\n2. chili in, noodles in\n3. soy, toss, eat standing up' }),
    mk({ type: 'expense', title: 'groceries', tags: [], data: { amount: 42.5, cat: 'food', day: day(0) }, body: '' }),
    mk({ type: 'expense', title: 'domain renewal', tags: [], data: { amount: 12, cat: 'infra', day: day(-6) }, body: '' }),
    mk({ type: 'sub', title: 'Vercel pro', tags: [], data: { amount: 20, renews: day(18) }, body: '' }),
    mk({ type: 'contact', title: 'example friend', tags: [], data: { handle: '@friend', birthday: day(30), last: day(-100) }, body: 'met at the hackathon. owes me a keyboard switch.' }),
    mk({ type: 'media', title: 'the matrix', tags: [], data: { kind: 'movie', status: 'done', rating: 5 }, body: '' }),
    mk({ type: 'media', title: 'the three-body problem', tags: [], data: { kind: 'book', status: 'active', rating: 0, progress: 40 }, body: '' }),
    mk({ type: 'trip', title: 'Lisbon', tags: [], data: { loc: '29,7', when: '2026-04' }, body: 'pastéis, tiles, hills.' }),
    mk({ type: 'goal', title: 'ship PSYCH://OS', tags: [], data: { target: 100, progress: 65, by: day(45) }, body: '' }),
    mk({ type: 'card', title: 'card', data: { front: 'what does SM-2 stand for?', back: 'SuperMemo-2, the spaced repetition algorithm', due: day(0), ease: 2.5, interval: 0, reps: 0 }, body: '' }),
    mk({ type: 'card', title: 'card', data: { front: 'which env var feeds the brain?', back: 'OPENAI_API_KEY (any OpenAI-compatible base URL)', due: day(0), ease: 2.5, interval: 0, reps: 0 }, body: '' }),
    mk({ type: 'template', title: 'daily plan', tags: ['template'], body: '## top 3\n- \n\n## schedule\n- \n\n## notes\n' }),
    mk({ type: 'template', title: 'meeting notes', tags: ['template'], body: '## who\n\n## decided\n\n## my actions\n- [ ] \n' }),
  ];
  return { items, files: [], links: [] };
}

function readOverlay(): { items: VaultItem[]; files: DriveFile[]; links: ShortLink[] } | null {
  try { return JSON.parse(localStorage.getItem(VAULT_KEY) || 'null'); } catch { return null; }
}
function writeOverlay(v: { items: VaultItem[]; files: DriveFile[]; links: ShortLink[] }) {
  try { localStorage.setItem(VAULT_KEY, JSON.stringify(v)); } catch { /* full */ }
}

async function api(path: string, opts?: RequestInit) {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, json: json as Record<string, unknown> };
}

export const shareToken = () => 'sh_' + uid() + uid();

interface VaultState {
  loaded: boolean;
  items: VaultItem[];
  files: DriveFile[];
  links: ShortLink[];

  ensure(): Promise<void>;
  reload(): Promise<void>;
  saveItem(raw: Partial<VaultItem>): Promise<VaultItem | null>;
  deleteItem(id: string): Promise<void>;
  patch(id: string, patch: Partial<VaultItem>): Promise<void>; // optimistic field update
  uploadFile(file: File, folder: string, text?: string): Promise<DriveFile | null>;
  patchFile(id: string, patch: Partial<DriveFile>): Promise<void>;
  deleteFile(id: string, path?: string): Promise<void>;
  addLink(url: string, slug?: string): Promise<ShortLink | null>;
  delLink(id: string): Promise<void>;

  byType(type: string): VaultItem[];
  capture(text: string, kind?: string): Promise<void>;
  exportVault(): void;
}

export const useVault = create<VaultState>((set, get) => ({
  loaded: false, items: [], files: [], links: [],

  async ensure() {
    if (get().loaded) return;
    const mode = usePsych0.getState().mode;
    if (mode !== 'supabase') {
      const ov = readOverlay();
      const v = ov || seedVault();
      if (!ov) writeOverlay(v);
      set({ items: v.items, files: v.files, links: v.links, loaded: true });
      return;
    }
    await get().reload();
  },

  async reload() {
    const [it, fi, lk] = await Promise.all([
      api('/api/items'), api('/api/files'), api('/api/links'),
    ]);
    set({
      items: (it.json.items as VaultItem[]) || [],
      files: (fi.json.files as DriveFile[]) || [],
      links: (lk.json.links as ShortLink[]) || [],
      loaded: true,
    });
  },

  async saveItem(raw) {
    const mode = usePsych0.getState().mode;
    if (mode === 'local') {
      let item: VaultItem = {
        id: raw.id || 'i_' + uid(), type: raw.type || 'note', title: raw.title || '',
        body: raw.body || '', data: raw.data || {}, tags: raw.tags || [], folder: raw.folder || '',
        done: !!raw.done, pinned: !!raw.pinned, secure: !!raw.secure,
        cipher: raw.cipher || '', iv: raw.iv || '', salt: raw.salt || '',
        share: raw.share || '', burns: raw.burns || 0, reads: raw.reads || 0,
        share_expires: raw.share_expires || null, deliver_at: raw.deliver_at || null,
        created_at: raw.created_at || new Date().toISOString(), updated_at: new Date().toISOString(),
      };
      if (!raw.created_at) {
        const rules = (usePsych0.getState().site.rules || []) as OsRule[];
        for (const r of rules) if (r.on !== false && ruleMatches(r, item)) item = applyRule(item, r);
      }
      const items = [item, ...get().items.filter(x => x.id !== item.id)];
      set({ items });
      writeOverlay({ items, files: get().files, links: get().links });
      return item;
    }
    const r = await api('/api/items', { method: 'POST', body: JSON.stringify(raw) });
    if (!r.ok) { usePsych0.getState().toast(String(r.json.message || 'SAVE FAILED'), 'warn'); return null; }
    const item = r.json.item as VaultItem;
    set(s => ({ items: [item, ...s.items.filter(x => x.id !== item.id)] }));
    return item;
  },

  async deleteItem(id) {
    const mode = usePsych0.getState().mode;
    const items = get().items.filter(x => x.id !== id);
    set({ items });
    if (mode === 'local') { writeOverlay({ items, files: get().files, links: get().links }); return; }
    await api('/api/items?id=' + encodeURIComponent(id), { method: 'DELETE' });
  },

  async patch(id, patch) {
    const cur = get().items.find(x => x.id === id);
    if (cur) await get().saveItem({ ...cur, ...patch });
  },

  async uploadFile(file, folder, text) {
    const mode = usePsych0.getState().mode;
    if (mode === 'local') {
      if (file.size > 400 * 1024) {
        usePsych0.getState().toast('LOCAL MODE: files over 400KB need Supabase storage', 'warn');
        return null;
      }
      const v = readOverlay() || seedVault();
      const used = v.files.reduce((a, f) => a + f.size, 0);
      if (used + file.size > 4 * 1024 * 1024) {
        usePsych0.getState().toast('LOCAL MODE vault full (~4MB) — connect Supabase for the real drive', 'warn');
        return null;
      }
      const rd = new FileReader();
      const url = await new Promise<string>(res => { rd.onload = () => res(String(rd.result)); rd.readAsDataURL(file); });
      const row: DriveFile = {
        id: 'f_' + uid(), name: file.name, folder: folder || '/', mime: file.type || 'application/octet-stream',
        size: file.size, path: '', url, text: text || '', share: '', share_expires: null,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      };
      const files = [row, ...get().files];
      set({ files });
      writeOverlay({ items: get().items, files, links: get().links });
      return row;
    }
    const fd = new FormData();
    fd.append('file', file);
    fd.append('folder', folder || '/');
    if (text) fd.append('text', text);
    const res = await fetch('/api/files', { method: 'POST', body: fd });
    const j = await res.json().catch(() => ({})) as Record<string, unknown>;
    if (!res.ok) { usePsych0.getState().toast(String(j.message || 'UPLOAD FAILED'), 'warn'); return null; }
    const row = j.file as DriveFile;
    set(s => ({ files: [row, ...s.files] }));
    return row;
  },

  async patchFile(id, patch) {
    const cur = get().files.find(f => f.id === id);
    if (!cur) return;
    const mode = usePsych0.getState().mode;
    const next = { ...cur, ...patch, updated_at: new Date().toISOString() };
    const files = get().files.map(f => f.id === id ? next : f);
    set({ files });
    if (mode === 'local') { writeOverlay({ items: get().items, files, links: get().links }); return; }
    await api('/api/files', { method: 'PUT', body: JSON.stringify(next) });
  },

  async deleteFile(id, path) {
    const mode = usePsych0.getState().mode;
    const files = get().files.filter(f => f.id !== id);
    set({ files });
    if (mode === 'local') { writeOverlay({ items: get().items, files, links: get().links }); return; }
    const q = path ? '&path=' + encodeURIComponent(path) : '';
    await api('/api/files?id=' + encodeURIComponent(id) + q, { method: 'DELETE' });
  },

  async addLink(url, slug) {
    const mode = usePsych0.getState().mode;
    if (mode === 'local') {
      const links = get().links;
      if (slug && links.some(l => l.slug === slug)) { usePsych0.getState().toast('SLUG TAKEN', 'warn'); return null; }
      const row: ShortLink = { id: 'l_' + uid(), slug: (slug || uid()).toLowerCase(), url, clicks: 0, created_at: new Date().toISOString() };
      const next = [row, ...links];
      set({ links: next });
      writeOverlay({ items: get().items, files: get().files, links: next });
      usePsych0.getState().toast('LOCAL MODE — /l/ redirects need Supabase', 'warn');
      return row;
    }
    const r = await api('/api/links', { method: 'POST', body: JSON.stringify({ url, slug }) });
    if (!r.ok) { usePsych0.getState().toast(String(r.json.message || 'LINK FAILED'), 'warn'); return null; }
    const row = r.json.link as ShortLink;
    set(s => ({ links: [row, ...s.links] }));
    return row;
  },

  async delLink(id) {
    const links = get().links.filter(l => l.id !== id);
    set({ links });
    if (usePsych0.getState().mode === 'local') { writeOverlay({ items: get().items, files: get().files, links }); return; }
    await api('/api/links?id=' + encodeURIComponent(id), { method: 'DELETE' });
  },

  byType(type) {
    return get().items
      .filter(i => i.type === type)
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || (b.updated_at || '').localeCompare(a.updated_at || ''));
  },

  async capture(text, kind = 'note') {
    const title = text.split('\n')[0].slice(0, 80) || (kind.toUpperCase() + ' CAPTURE');
    await get().saveItem({ type: kind, title, body: text, tags: ['inbox'], data: kind === 'task' ? { priority: 'now' } : {} });
    usePsych0.getState().toast('CAPTURED ▸ ' + kind.toUpperCase() + ' — filed to the inbox', 'ok');
    usePsych0.getState().beep(990, .05);
  },

  exportVault() {
    const { items, files, links } = get();
    const clean = files.map(f => ({ ...f, url: f.url.startsWith('data:') ? '(inline)' : f.url }));
    const blob = new Blob([JSON.stringify({ kind: 'psych0-vault', items, files: clean, links }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'psych0-vault.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 400);
    usePsych0.getState().toast('VAULT EXPORTED', 'ok');
  },
}));

/* re-exports for the OS pages */
export { usePsych0 };
