'use client';
/* PSYCH0 — client state (zustand). Data flows:
 * - SUPABASE mode: everything via /api/* serverless routes (persisted in Postgres)
 * - LOCAL mode (no Supabase keys yet): seed content + localStorage overlay writes */
import { create } from 'zustand';
import { seed, uid, slugify, uniqueSlug, newPost, newProject, newEmbed,
  type Bundle, type SiteData, type Post, type Project, type Embed,
  type Message, type MediaItem, type ApiToken, type Revision } from '@/lib/types';
import { cyclePreset, PRESETS } from '@/lib/presets';

const OVERLAY_KEY = 'psych0.data.v2';
const ACTIVITY_KEY = 'psych0.activity.v1';
const READER_KEY = 'psych0.reader.v1';
const LOWPOWER_KEY = 'psych0.lowpower';
const REDUCED = typeof window !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export type Mode = 'supabase' | 'local';
export type ViewMode = 'studio' | 'public';
export type SaveState = 'idle' | 'saving' | 'saved' | 'error';
export type TokenRow = Omit<ApiToken, 'hash'>;
export interface StatsShape { visits: number; posts: number; projects: number; embeds: number; guestbook: number }

/* reader controls — per-visitor, saved in this browser only.
 * width: 0 = site default, 1 = narrow (64ch), 2 = full wide */
export interface ReaderPrefs { fs: 0 | 1 | 2; width: 0 | 1 | 2; serif: boolean }

/* writing heatmap: day → number of save events */
export function readActivity(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(ACTIVITY_KEY) || '{}') as Record<string, number>; } catch { return {}; }
}
function bumpActivity() {
  try {
    const a = readActivity();
    const t = new Date().toISOString().slice(0, 10);
    a[t] = (a[t] || 0) + 1;
    localStorage.setItem(ACTIVITY_KEY, JSON.stringify(a));
  } catch { /* private mode */ }
}

function readReader(): ReaderPrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(READER_KEY) || '') as Partial<ReaderPrefs>;
    return { fs: (raw.fs ?? 1) as 0 | 1 | 2, width: (raw.width ?? 0) as 0 | 1 | 2, serif: !!raw.serif };
  } catch { return { fs: 1, width: 0, serif: false }; }
}

export function applyReaderClass(r: ReaderPrefs) {
  if (typeof document === 'undefined') return;
  const el = document.documentElement;
  el.classList.remove('r-fs0', 'r-fs1', 'r-fs2', 'r-width0', 'r-width1', 'r-width2', 'r-serif');
  el.classList.add('r-fs' + r.fs, 'r-width' + r.width);
  if (r.serif) el.classList.add('r-serif');
}

interface Toast { id: number; msg: string; cls: string }

interface Psych0State {
  ready: boolean;
  booting: boolean;
  studio: boolean;
  passcodeDefault: boolean;
  mode: Mode;
  viewMode: ViewMode;
  site: SiteData;
  posts: Post[];
  projects: Project[];
  embeds: Embed[];
  seg: string[];
  toasts: Toast[];
  blogQ: string; blogTag: string | null;
  modal: { title: string; msg: string; onYes: () => void } | null;
  lightbox: string | null;
  media: MediaItem[];
  messages: Message[];
  tokens: TokenRow[];
  stats: StatsShape | null;
  paths: Record<string, number>;
  storm: boolean;
  speaking: boolean;
  reader: ReaderPrefs;
  lowPower: boolean;
  tmDate: string | null;

  init(initial: Bundle, studio: boolean, mode: Mode, passcodeDefault: boolean): void;
  setSeg(seg: string[]): void;
  toast(msg: string, cls?: string): void;
  beep(f?: number, d?: number): void;
  confirm(title: string, msg: string, onYes: () => void): void;
  closeModal(): void;
  setLightbox(src: string | null): void;
  setBlogQ(q: string): void; setBlogTag(t: string | null): void;
  setReader(patch: Partial<ReaderPrefs>): void;
  toggleLowPower(): void;
  setTmDate(d: string | null): void;

  visiblePosts(): Post[];
  sortedPosts(): Post[];
  toggleMode(): void;
  refresh(): Promise<void>;

  saveSite(patch: Partial<SiteData>): Promise<void>;
  savePost(p: Post): Promise<void>; deletePost(id: string): Promise<void>;
  saveProject(p: Project): Promise<void>; deleteProject(id: string): Promise<void>;
  saveEmbed(p: Embed): Promise<void>; deleteEmbed(id: string): Promise<void>;
  login(passcode: string): Promise<boolean>;
  logout(): Promise<void>;
  setPreset(id: string): void; cycleTheme(): void;
  setCustomColors(a: string, b: string): void;
  toggleFx(k: string): void;
  exportJson(): void;
  importJson(json: string): Promise<boolean>;

  /* ---------- power features ---------- */
  visit(path: string): void;
  loadExtras(): Promise<void>;
  uploadMedia(file: File): Promise<MediaItem | null>;
  removeMedia(id: string, path?: string): Promise<void>;
  sendMessage(name: string, contact: string, body: string, loc?: string): Promise<boolean>;
  setMsgRead(id: string, read: boolean): Promise<void>;
  setMsgPublic(id: string, isPublic: boolean): Promise<void>;
  removeMessage(id: string): Promise<void>;
  listRevisions(entity: string, id: string): Promise<Revision[]>;
  restoreRevision(rev: number): Promise<boolean>;
  createToken(label: string): Promise<string | null>;
  removeToken(id: string): Promise<void>;
  ai(task: string, text: string): Promise<string>;
  speak(text: string): void;
  stopSpeaking(): void;
  stormOn(): void;
}

function readOverlay(): Partial<Bundle> | null {
  try { return JSON.parse(localStorage.getItem(OVERLAY_KEY) || 'null'); } catch { return null; }
}
function writeOverlay(b: Partial<Bundle>) {
  try { localStorage.setItem(OVERLAY_KEY, JSON.stringify(b)); } catch { /* full */ }
}
function dl(name: string, content: string, type: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 400);
}

async function api(path: string, opts?: RequestInit) {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json: json as Record<string, any> };
}

let toastId = 0;

export const usePsych0 = create<Psych0State>((set, get) => ({
  ready: false, booting: false, studio: false, passcodeDefault: false,
  mode: 'local', viewMode: 'public',
  site: seed().site, posts: [], projects: [], embeds: [],
  seg: [], toasts: [], blogQ: '', blogTag: null, modal: null, lightbox: null,
  media: [], messages: [], tokens: [], stats: null, paths: {}, storm: false, speaking: false,
  reader: { fs: 1, width: 0, serif: false }, lowPower: false, tmDate: null,

  init(initial, studio, mode, passcodeDefault) {
    let bundle = initial;
    if (mode === 'local') {
      const ov = readOverlay();
      if (ov) {
        bundle = {
          site: { ...initial.site, ...(ov.site || {}) },
          posts: ov.posts ?? initial.posts,
          projects: ov.projects ?? initial.projects,
          embeds: ov.embeds ?? initial.embeds,
        };
      }
    }
    const reader = readReader();
    const lowPower = (() => { try { return localStorage.getItem(LOWPOWER_KEY) === '1'; } catch { return false; } })();
    set({ ...bundle, studio, passcodeDefault, mode, viewMode: studio ? 'studio' : 'public', ready: true, reader, lowPower });
    applyReaderClass(reader);
    if (typeof document !== 'undefined') document.body.classList.toggle('p0low', lowPower);
    get().visit('/');
    get().loadExtras();
  },

  setReader(patch) {
    const next = { ...get().reader, ...patch };
    set({ reader: next });
    try { localStorage.setItem(READER_KEY, JSON.stringify(next)); } catch { /* private mode */ }
    applyReaderClass(next);
    get().beep(760, .03);
  },

  toggleLowPower() {
    const on = !get().lowPower;
    set({ lowPower: on });
    try { localStorage.setItem(LOWPOWER_KEY, on ? '1' : '0'); } catch { /* private mode */ }
    if (typeof document !== 'undefined') document.body.classList.toggle('p0low', on);
    get().toast(on ? '⚡ LOW-POWER — effects off, bytes on a diet' : 'FULL POWER RESTORED', 'warn');
    get().beep(on ? 330 : 990, .05);
  },

  setTmDate(d) {
    set({ tmDate: d });
    if (d) get().toast('⏮ TIME MACHINE — the den as of ' + d, 'warn');
  },

  visit(path) {
    if (get().mode !== 'supabase') return;
    try {
      const k = 'psych0.visited.' + path;
      if (sessionStorage.getItem(k)) return;
      sessionStorage.setItem(k, '1');
    } catch { /* private mode */ }
    fetch('/api/visit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path }) }).catch(() => {});
  },

  setSeg(seg) { set({ seg }); },

  toast(msg, cls = '') {
    const id = ++toastId;
    set(s => ({ toasts: [...s.toasts, { id, msg, cls }] }));
    setTimeout(() => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })), 2800);
  },

  beep(f = 880, d = .05) {
    if (!get().site.fx.sound || REDUCED) return;
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC();
      const o = ctx.createOscillator(); const v = ctx.createGain();
      o.type = 'square'; o.frequency.value = f; v.gain.value = .035;
      o.connect(v); v.connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + d);
      v.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + d);
    } catch { /* no audio */ }
  },

  confirm(title, msg, onYes) { set({ modal: { title, msg, onYes } }); },
  closeModal() { set({ modal: null }); },
  setLightbox(src) { set({ lightbox: src }); },
  setBlogQ(q) { set({ blogQ: q }); },
  setBlogTag(t) { set({ blogTag: t }); },

  sortedPosts() {
    return get().posts.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  },
  visiblePosts() {
    const { viewMode, site, tmDate } = get();
    const future = (p: Post) => !!p.publish_at && p.publish_at > new Date().toISOString();
    return get().sortedPosts().filter(p =>
      (!tmDate || (p.date || '') <= tmDate) &&
      ((p.published && !future(p)) || (viewMode === 'studio' && site.showDrafts)));
  },

  toggleMode() {
    const next: ViewMode = get().viewMode === 'studio' ? 'public' : 'studio';
    if (next === 'studio' && !get().studio) { get().toast('STUDIO LOCKED — enter the passcode at #/studio', 'warn'); return; }
    set({ viewMode: next, seg: [] });
    if (typeof window !== 'undefined') window.location.hash = '#/';
    get().toast(next === 'studio' ? 'MODE ▸ STUDIO — editing unlocked' : 'MODE ▸ PUBLIC — this is what visitors see');
    get().beep(next === 'studio' ? 880 : 440, .06);
  },

  async refresh() {
    const { studio, mode } = get();
    if (mode === 'local') {
      // rebuild from seed + overlay (client-side persistence)
      const base = seed();
      const ov = readOverlay();
      set({
        site: { ...base.site, ...(ov?.site || {}) },
        posts: ov?.posts ?? base.posts,
        projects: ov?.projects ?? base.projects,
        embeds: ov?.embeds ?? base.embeds,
      });
      return;
    }
    const draftsQ = studio ? '?drafts=1' : '';
    const [p, pr, em, si] = await Promise.all([
      api('/api/posts' + draftsQ), api('/api/projects'), api('/api/embeds'), api('/api/site'),
    ]);
    set({
      posts: (p.json.posts as Post[]) || [],
      projects: (pr.json.projects as Project[]) || [],
      embeds: (em.json.embeds as Embed[]) || [],
      site: (si.json.site as SiteData) || get().site,
    });
    get().loadExtras();
  },

  async loadExtras() {
    const { mode, studio } = get();
    if (mode !== 'supabase') return;
    fetch('/api/stats')
      .then(r => r.json())
      .then(j => { if (j.stats) set({ stats: j.stats, paths: j.paths || {} }); })
      .catch(() => {});
    fetch('/api/messages').then(r => r.json())
      .then(j => { if (Array.isArray(j.messages)) set({ messages: j.messages as Message[] }); }).catch(() => {});
    if (!studio) return;
    fetch('/api/media').then(r => r.json())
      .then(j => { if (Array.isArray(j.media)) set({ media: j.media as MediaItem[] }); }).catch(() => {});
    fetch('/api/tokens').then(r => r.json())
      .then(j => { if (Array.isArray(j.tokens)) set({ tokens: j.tokens as TokenRow[] }); }).catch(() => {});
  },

  async uploadMedia(file) {
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { get().toast(j.message || 'UPLOAD FAILED', 'warn'); return null; }
      const item = j.item as MediaItem;
      set(s => ({ media: [item, ...s.media] }));
      get().toast('UPLOADED', 'ok'); get().beep(990);
      return item;
    } catch {
      get().toast('UPLOAD FAILED', 'warn'); return null;
    }
  },

  async removeMedia(id, path) {
    const r = await api('/api/media?id=' + encodeURIComponent(id) + (path ? '&path=' + encodeURIComponent(path) : ''), { method: 'DELETE' });
    if (!r.ok) { get().toast(r.json.message || 'DELETE FAILED', 'warn'); return; }
    set(s => ({ media: s.media.filter(m => m.id !== id) }));
    get().toast('DELETED', 'warn');
  },

  async sendMessage(name, contact, body, loc = '') {
    const r = await api('/api/messages', { method: 'POST', body: JSON.stringify({ name, contact, body, website: '', loc }) });
    if (!r.ok) { get().toast(r.json.message || 'SEND FAILED', 'warn'); return false; }
    get().toast('SIGNAL SENT — thank you', 'ok'); get().beep(990);
    get().loadExtras();
    return true;
  },

  async setMsgRead(id, read) {
    await api('/api/messages', { method: 'PUT', body: JSON.stringify({ id, read }) });
    set(s => ({ messages: s.messages.map(m => m.id === id ? { ...m, read } : m) }));
  },

  async setMsgPublic(id, isPublic) {
    await api('/api/messages', { method: 'PUT', body: JSON.stringify({ id, public: isPublic }) });
    set(s => ({ messages: s.messages.map(m => m.id === id ? { ...m, public: isPublic } : m) }));
  },

  async removeMessage(id) {
    const r = await api('/api/messages?id=' + encodeURIComponent(id), { method: 'DELETE' });
    if (!r.ok) { get().toast(r.json.message || 'DELETE FAILED', 'warn'); return; }
    set(s => ({ messages: s.messages.filter(m => m.id !== id) }));
    get().toast('DELETED', 'warn');
  },

  async listRevisions(entity, id) {
    const r = await api('/api/revisions?entity=' + encodeURIComponent(entity) + '&id=' + encodeURIComponent(id));
    if (!r.ok) { get().toast(r.json.message || 'HISTORY UNAVAILABLE', 'warn'); return []; }
    return (r.json.revisions as Revision[]) || [];
  },

  async restoreRevision(rev) {
    const r = await api('/api/revisions', { method: 'POST', body: JSON.stringify({ rev }) });
    if (!r.ok) { get().toast(r.json.message || 'RESTORE FAILED', 'warn'); return false; }
    get().toast('RESTORED — rolled back one version', 'ok'); get().beep(990);
    await get().refresh();
    return true;
  },

  async createToken(label) {
    const r = await api('/api/tokens', { method: 'POST', body: JSON.stringify({ label }) });
    if (!r.ok) { get().toast(r.json.message || 'TOKEN FAILED', 'warn'); return null; }
    await get().loadExtras();
    return (r.json.raw as string) || null;
  },

  async removeToken(id) {
    const r = await api('/api/tokens?id=' + encodeURIComponent(id), { method: 'DELETE' });
    if (!r.ok) { get().toast(r.json.message || 'DELETE FAILED', 'warn'); return; }
    set(s => ({ tokens: s.tokens.filter(t => t.id !== id) }));
  },

  async ai(task, text) {
    const key = (() => { try { return localStorage.getItem('psych0.aikey') || ''; } catch { return ''; } })();
    const r = await api('/api/ai', { method: 'POST', body: JSON.stringify({ task, text, key: key || undefined }) });
    if (!r.ok) throw new Error(String(r.json.message || 'AI unavailable'));
    return String(r.json.text || '');
  },

  speak(text) {
    if (typeof window === 'undefined' || !window.speechSynthesis) { get().toast('NO VOICE ENGINE IN THIS BROWSER', 'warn'); return; }
    get().stopSpeaking();
    const clean = String(text || '')
      .replace(/```[\s\S]*?```/g, ' code block. ')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' image. ')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/[#*_~`>|@]/g, '')
      .replace(/\[\[([^\]]+)\]\]/g, '$1')
      .replace(/\s+/g, ' ').slice(0, 12000);
    const u = new SpeechSynthesisUtterance(clean);
    u.rate = 1; u.pitch = 0.85;
    u.onend = () => set({ speaking: false });
    u.onerror = () => set({ speaking: false });
    set({ speaking: true });
    window.speechSynthesis.speak(u);
    get().toast('VOICE ▸ READING ALOUD', 'ok');
  },

  stopSpeaking() {
    if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
    set({ speaking: false });
  },

  stormOn() {
    if (get().storm) return;
    set({ storm: true });
    get().beep(110, .3); get().beep(880, .1);
    get().toast('⌁ KONAMI ACCEPTED — GLITCH STORM ⌁', 'warn');
    setTimeout(() => set({ storm: false }), 6000);
  },

  async saveSite(patch) {
    const { mode, site } = get();
    const next: SiteData = { ...site, ...patch };
    set({ site: next });
    if (mode === 'local') {
      const ov = readOverlay() || {};
      writeOverlay({ ...ov, site: { ...(ov.site || site), ...patch } });
      get().toast('SAVED — LOCAL MODE (browser only)', 'warn');
      return;
    }
    const r = await api('/api/site', { method: 'PUT', body: JSON.stringify(next) });
    if (!r.ok) get().toast(r.json.message || 'SAVE FAILED', 'warn');
    else get().toast('SAVED', 'ok');
    get().beep(880, .04);
  },

  async savePost(post) {
    bumpActivity();
    const { mode } = get();
    if (mode === 'local') {
      const ov = readOverlay() || {};
      const arr = (ov.posts ?? seed().posts).slice();
      const i = arr.findIndex(x => x.id === post.id);
      if (i >= 0) arr[i] = post; else arr.push(post);
      writeOverlay({ ...ov, posts: arr });
      await get().refresh();
      get().toast('SAVED — LOCAL MODE (browser only)', 'warn');
      return;
    }
    const r = await api('/api/posts', { method: 'POST', body: JSON.stringify(post) });
    if (!r.ok) { get().toast(r.json.message || 'SAVE FAILED', 'warn'); throw new Error(String(r.json.error || 'save failed')); }
    get().toast('SAVED', 'ok'); get().beep(880, .04);
    await get().refresh();
  },

  async deletePost(id) {
    const { mode } = get();
    if (mode === 'local') {
      const ov = readOverlay() || {};
      writeOverlay({ ...ov, posts: (ov.posts ?? seed().posts).filter(x => x.id !== id) });
      await get().refresh(); get().toast('DELETED', 'warn'); return;
    }
    const r = await api('/api/posts/' + id, { method: 'DELETE' });
    if (!r.ok) { get().toast(r.json.message || 'DELETE FAILED', 'warn'); return; }
    get().toast('DELETED', 'warn'); await get().refresh();
  },

  async saveProject(project) {
    bumpActivity();
    const { mode } = get();
    if (mode === 'local') {
      const ov = readOverlay() || {};
      const arr = (ov.projects ?? seed().projects).slice();
      const i = arr.findIndex(x => x.id === project.id);
      if (i >= 0) arr[i] = project; else arr.push(project);
      writeOverlay({ ...ov, projects: arr });
      await get().refresh(); get().toast('SAVED — LOCAL MODE (browser only)', 'warn'); return;
    }
    const r = await api('/api/projects', { method: 'POST', body: JSON.stringify(project) });
    if (!r.ok) { get().toast(r.json.message || 'SAVE FAILED', 'warn'); throw new Error(String(r.json.error || 'save failed')); }
    get().toast('SAVED', 'ok'); get().beep(880, .04); await get().refresh();
  },

  async deleteProject(id) {
    const { mode } = get();
    if (mode === 'local') {
      const ov = readOverlay() || {};
      writeOverlay({ ...ov, projects: (ov.projects ?? seed().projects).filter(x => x.id !== id) });
      await get().refresh(); get().toast('DELETED', 'warn'); return;
    }
    const r = await api('/api/projects/' + id, { method: 'DELETE' });
    if (!r.ok) { get().toast(r.json.message || 'DELETE FAILED', 'warn'); return; }
    get().toast('DELETED', 'warn'); await get().refresh();
  },

  async saveEmbed(embed) {
    bumpActivity();
    const { mode } = get();
    if (mode === 'local') {
      const ov = readOverlay() || {};
      const arr = (ov.embeds ?? seed().embeds).slice();
      const i = arr.findIndex(x => x.id === embed.id);
      if (i >= 0) arr[i] = embed; else arr.push(embed);
      writeOverlay({ ...ov, embeds: arr });
      await get().refresh(); get().toast('SAVED — LOCAL MODE (browser only)', 'warn'); return;
    }
    const r = await api('/api/embeds', { method: 'POST', body: JSON.stringify(embed) });
    if (!r.ok) { get().toast(r.json.message || 'SAVE FAILED', 'warn'); throw new Error(String(r.json.error || 'save failed')); }
    get().toast('SAVED', 'ok'); get().beep(880, .04); await get().refresh();
  },

  async deleteEmbed(id) {
    const { mode } = get();
    if (mode === 'local') {
      const ov = readOverlay() || {};
      writeOverlay({ ...ov, embeds: (ov.embeds ?? seed().embeds).filter(x => x.id !== id) });
      await get().refresh(); get().toast('DELETED', 'warn'); return;
    }
    const r = await api('/api/embeds/' + id, { method: 'DELETE' });
    if (!r.ok) { get().toast(r.json.message || 'DELETE FAILED', 'warn'); return; }
    get().toast('DELETED', 'warn'); await get().refresh();
  },

  async login(passcode) {
    const r = await api('/api/studio/login', { method: 'POST', body: JSON.stringify({ passcode }) });
    if (!r.ok) { get().toast(r.json.message || 'ACCESS DENIED', 'warn'); get().beep(220, .1); return false; }
    set({ studio: true, viewMode: 'studio', passcodeDefault: !!r.json.passcodeIsDefault });
    get().toast('STUDIO UNLOCKED', 'ok'); get().beep(990, .07);
    await get().refresh();
    return true;
  },

  async logout() {
    await api('/api/studio/logout', { method: 'POST' });
    set({ studio: false, viewMode: 'public' });
    get().toast('STUDIO LOCKED — see you', 'warn');
    window.location.hash = '#/';
    await get().refresh();
  },

  setPreset(id) {
    const p = PRESETS.find(x => x.id === id); if (!p) return;
    get().saveSite({ preset: p.id, accent: p.accent, accent2: p.accent2 });
    get().toast('THEME ▸ ' + p.label);
  },
  cycleTheme() {
    const { site } = get();
    const p = cyclePreset(site);
    get().saveSite({ preset: p.id, accent: p.accent, accent2: p.accent2 });
    get().toast('THEME ▸ ' + p.label);
  },
  setCustomColors(a, b) { get().saveSite({ accent: a, accent2: b, preset: 'custom' }); },
  toggleFx(k) {
    const { site } = get();
    get().saveSite({ fx: { ...site.fx, [k]: !site.fx[k as keyof typeof site.fx] } });
  },

  exportJson() {
    const { site, posts, projects, embeds } = get();
    dl('psych0-content.json', JSON.stringify({ site, posts, projects, embeds } as Bundle, null, 2), 'application/json');
    get().toast('CONTENT EXPORTED', 'ok'); get().beep(880);
  },

  async importJson(json) {
    try {
      const b = JSON.parse(json) as Bundle;
      if (!b.site || !Array.isArray(b.posts)) throw new Error('bad shape');
      const { mode } = get();
      if (mode === 'supabase') {
        await Promise.all([
          api('/api/site', { method: 'PUT', body: JSON.stringify(b.site) }),
          ...b.posts.map(p => api('/api/posts', { method: 'POST', body: JSON.stringify(p) })),
          ...(b.projects || []).map(p => api('/api/projects', { method: 'POST', body: JSON.stringify(p) })),
          ...(b.embeds || []).map(e => api('/api/embeds', { method: 'POST', body: JSON.stringify(e) })),
        ]);
      } else {
        writeOverlay({ site: b.site, posts: b.posts, projects: b.projects || [], embeds: b.embeds || [] });
      }
      await get().refresh();
      get().toast('CONTENT IMPORTED', 'ok'); get().beep(990);
      return true;
    } catch (e) {
      get().toast('IMPORT FAILED — ' + (e as Error).message, 'warn');
      return false;
    }
  },
}));

/* re-export helpers used by components */
export { uid, slugify, uniqueSlug, newPost, newProject, newEmbed, dl, OVERLAY_KEY, REDUCED };
export type { Bundle, SiteData, Post, Project, Embed, Message, MediaItem, Revision };
