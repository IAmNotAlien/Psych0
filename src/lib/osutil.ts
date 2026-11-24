/* PSYCH://OS — pure helpers used on server AND client: spaced repetition,
 * streaks, dates, CSV, rule matching. No DOM, no node APIs. */
import type { OsRule, VaultItem } from './types';

/* ---------- SM-2 spaced repetition (light) ---------- */
export interface CardState { ease: number; interval: number; due: string; reps: number }

export function sm2(state?: Partial<CardState> | null, q: 0 | 1 | 2 | 3 = 2): CardState {
  // q: 0 forgot · 1 hard · 2 good · 3 easy
  const s: CardState = { ease: 2.5, interval: 0, due: '', reps: 0, ...(state || {}) };
  let { ease, interval, reps } = s;
  if (q === 0) { interval = 0; reps = 0; ease = Math.max(1.3, ease - 0.2); }
  else {
    ease = Math.max(1.3, Math.min(3.2, ease + (q === 1 ? -0.15 : q === 3 ? 0.15 : 0)));
    reps += 1;
    if (reps === 1) interval = q === 1 ? 1 : q === 2 ? 1 : 3;
    else if (reps === 2) interval = q === 1 ? 2 : q === 2 ? 3 : 6;
    else interval = Math.round(interval * ease * (q === 1 ? 0.7 : q === 3 ? 1.25 : 1));
    interval = Math.min(interval, 240);
  }
  const due = new Date(Date.now() + interval * 86400000).toISOString().slice(0, 10);
  return { ease, interval, due, reps };
}

/* ---------- streaks + habit grid ---------- */
export function dayKey(d: Date | string = new Date()): string {
  const x = typeof d === 'string' ? new Date(d) : d;
  return x.toISOString().slice(0, 10);
}

export function streakOf(days: Set<string>): number {
  let n = 0;
  const cur = new Date();
  // allow today not checked yet — start from yesterday
  if (!days.has(dayKey(cur))) cur.setDate(cur.getDate() - 1);
  for (;;) {
    if (!days.has(dayKey(cur))) break;
    n++; cur.setDate(cur.getDate() - 1);
  }
  return n;
}

export function lastNDays(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i--) { const x = new Date(d); x.setDate(d.getDate() - i); out.push(dayKey(x)); }
  return out;
}

export function weekScore(days: Set<string>): number {
  const last7 = lastNDays(7);
  return last7.filter(k => days.has(k)).length;
}

/* ---------- tiny canvas chart helpers (data prep) ---------- */
export function sumBy<T>(arr: T[], f: (x: T) => number): number { return arr.reduce((a, x) => a + f(x), 0); }
export function fmtMoney(n: number): string {
  return (n < 0 ? '-' : '') + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ---------- CSV parser (handles quotes + commas) ---------- */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (cell !== '' || row.length) { row.push(cell); rows.push(row); row = []; cell = ''; }
      if (c === '\r' && text[i + 1] === '\n') i++;
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim() !== ''));
}

/* ---------- rules engine (pure matcher — osrepo applies it) ---------- */
export function ruleMatches(rule: OsRule, item: Pick<VaultItem, 'type' | 'title' | 'body' | 'tags'>): boolean {
  const m = rule.match || {};
  if (m.type && item.type !== m.type) return false;
  if (m.tag && !(item.tags || []).includes(m.tag)) return false;
  if (m.contains) {
    const hay = ((item.title || '') + '\n' + (item.body || '')).toLowerCase();
    if (!hay.includes(String(m.contains).toLowerCase())) return false;
  }
  return !!(m.type || m.tag || m.contains);
}

export function applyRule(item: VaultItem, rule: OsRule): VaultItem {
  const act = rule.act || {};
  const next = { ...item, tags: [...(item.tags || [])] };
  if (act.setType) next.type = act.setType;
  if (act.folder) next.folder = act.folder;
  for (const t of act.addTags || []) if (!next.tags.includes(t)) next.tags.push(t);
  return next;
}

/* ---------- keyword relevance score (the offline brain) ---------- */
export function relevance(needle: string, hay: string): number {
  const n = needle.toLowerCase().trim(); const h = hay.toLowerCase();
  if (!n) return 0;
  if (h.includes(n)) return 100 - Math.min(40, h.indexOf(n) / 8);
  // word overlap
  const words = n.split(/\s+/).filter(w => w.length > 2);
  if (!words.length) return -1;
  let hit = 0;
  for (const w of words) if (h.includes(w)) hit++;
  const k = hit / words.length;
  return k > 0.5 ? Math.round(k * 50) : -1;
}

/* ---------- wiki-links ---------- */
export function extractLinks(body: string): string[] {
  const out: string[] = [];
  const re = /\[\[([^\]]+)\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body || ''))) out.push(m[1].trim());
  return [...new Set(out)];
}
