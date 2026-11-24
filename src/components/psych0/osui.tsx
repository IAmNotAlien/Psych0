'use client';
/* PSYCH://OS — shared UI machinery: shell + nav placeholder, generic item
 * editor, calendar grid, canvas charts, mic dictation, stars, chips.
 * The nav registry itself lives in oshub.tsx (pages here stay registry-free). */
import { useEffect, useRef, useState } from 'react';
import { usePsych0 } from './store';
import { useVault } from './vault';
import { encryptSecret, decryptSecret } from './vault';
import { uid, type VaultItem } from '@/lib/types';

export function fmtWhen(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso).slice(0, 10);
  return d.toISOString().slice(0, 10);
}

export function relDay(iso?: string | null): string {
  if (!iso) return '';
  const day = (x: Date) => Math.floor(x.getTime() / 86400000);
  const target = day(new Date(iso.slice(0, 10) + 'T12:00:00Z'));
  const today = day(new Date());
  const diff = target - today;
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff === -1) return 'yesterday';
  if (diff < 0) return (-diff) + 'd ago';
  return 'in ' + diff + 'd';
}

/* ---------- shell ---------- */

export function useEnsure() {
  const loaded = useVault(s => s.loaded);
  useEffect(() => { useVault.getState().ensure().catch(() => {}); }, [loaded]);
  return loaded;
}

export function OsHead({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="titlebar">
      <h1 className="scramble">{'PSYCH://OS — ' + title}</h1>
      <span className="spacer" />
      {children}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="empty">{children}</div>;
}

/* ---------- small form parts ---------- */

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="fieldwrap"><span className="flabel">{label}</span>{children}</label>;
}
export function Check({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return <label className="checkrow"><input type="checkbox" checked={on} onChange={e => onChange(e.target.checked)} /> {label}</label>;
}
export function SaveDot({ status }: { status: string }) {
  return <span className={'savedot s-' + status}>
    {status === 'saving' ? '● SAVING' : status === 'saved' ? '● SAVED' : status === 'error' ? '● ERROR' : '○ AUTOSAVE ON'}
  </span>;
}

export function Stars({ n, onSet }: { n: number; onSet?: (v: number) => void }) {
  return (
    <span className="stars" title={n ? n + '/5' : 'not rated'}>
      {[1, 2, 3, 4, 5].map(i => (
        <button key={i} type="button" className={'star' + (i <= n ? ' on' : '')}
          onClick={onSet ? () => onSet(i === n ? 0 : i) : undefined}>{i <= n ? '★' : '☆'}</button>
      ))}
    </span>
  );
}

export function DueChip({ due, done }: { due?: string | null; done?: boolean }) {
  if (!due) return null;
  const rel = relDay(due);
  const late = !done && (new Date(due + 'T23:59:59').getTime() < Date.now());
  return <span className={'chip' + (late ? ' overdue' : ' sched')}>{late ? '⚠ ' : '⏱ '}{due} · {rel}</span>;
}

/* ---------- generic item editor (drives every collection) ---------- */

export interface FieldDef { key: string; label: string; kind: 'text' | 'num' | 'date' | 'select' | 'stars' | 'url' | 'textarea' | 'check'; opts?: string }

export function DataEditor({ initial, fields, withBody, onClose, onSave, title }: {
  initial: Partial<VaultItem>; fields: FieldDef[]; withBody?: boolean;
  onClose: () => void; onSave: (item: Partial<VaultItem>) => void; title?: string;
}) {
  const [d, setD] = useState<Partial<VaultItem>>(() => ({ ...initial }));
  const set = (patch: Partial<VaultItem>) => setD(prev => ({ ...prev, ...patch }));
  const setData = (key: string, v: unknown) => setD(prev => ({ ...prev, data: { ...(prev.data || {}), [key]: v } }));

  return (
    <div className="mwrap" role="dialog" aria-label="item editor" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="mbox edbox">
        <div className="mtitle">{title || 'EDIT ITEM'}</div>
        <Field label="TITLE"><input value={d.title || ''} onChange={e => set({ title: e.target.value })} autoFocus /></Field>
        <div className="row2">
          <Field label="TAGS (comma)"><input value={(d.tags || []).join(', ')} onChange={e => set({ tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })} /></Field>
          <Field label="PINNED"><Check label="◆ pin to top" on={!!d.pinned} onChange={v => set({ pinned: v })} /></Field>
        </div>
        <div className="row2">
          {fields.map(f => (
            <Field key={f.key} label={f.label}>{fieldInput(f, d, setData, set)}</Field>
          ))}
        </div>
        {(withBody || d.body) && (
          <Field label="BODY — MARKDOWN">
            <textarea rows={withBody ? 8 : 3} value={d.body || ''} spellCheck={false} onChange={e => set({ body: e.target.value })} />
          </Field>
        )}
        <div className="mbtns">
          <button type="button" className="btn" onClick={onClose}>CANCEL</button>
          <button type="button" className="btn danger" onClick={() => onSave(d)}>💾 SAVE</button>
        </div>
      </div>
    </div>
  );
}

function fieldInput(f: FieldDef, d: Partial<VaultItem>,
  setData: (k: string, v: unknown) => void, set: (p: Partial<VaultItem>) => void) {
  const v = (d.data || {})[f.key];
  if (f.kind === 'select') {
    const opts = (f.opts || '').split(',').map(x => x.trim()).filter(Boolean);
    return <select value={String(v ?? opts[0] ?? '')} onChange={e => setData(f.key, e.target.value)}>
      {opts.map(o => <option key={o} value={o}>{o}</option>)}
    </select>;
  }
  if (f.kind === 'stars') return <Stars n={Number(v || 0)} onSet={x => setData(f.key, x)} />;
  if (f.kind === 'check') return <Check label={f.label.toLowerCase()} on={!!v} onChange={x => setData(f.key, x)} />;
  if (f.kind === 'num') return <input type="number" step="any" value={v === undefined || v === null ? '' : String(v)} onChange={e => setData(f.key, e.target.value === '' ? undefined : Number(e.target.value))} />;
  if (f.kind === 'date') return <input type="date" value={String(v ?? '')} onChange={e => setData(f.key, e.target.value)} />;
  if (f.kind === 'textarea') return <textarea rows={3} value={String(v ?? '')} spellCheck={false} onChange={e => setData(f.key, e.target.value)} />;
  return <input value={String(v ?? '')} onChange={e => setData(f.key, e.target.value)} placeholder={f.kind === 'url' ? 'https://…' : ''} />;
}

/* ---------- calendar month grid ---------- */

export function MonthGrid({ cursor, onMove, renderDay }: {
  cursor: { y: number; m: number }; onMove: (c: { y: number; m: number }) => void;
  renderDay: (key: string) => React.ReactNode;
}) {
  const months = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
  const first = new Date(cursor.y, cursor.m, 1);
  const startPad = (first.getDay() + 6) % 7; // monday-first
  const daysIn = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysIn; d++) cells.push(cursor.y + '-' + String(cursor.m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0'));
  const todayKey = new Date().toISOString().slice(0, 10);
  return (
    <div className="monthgrid-wrap">
      <div className="monthnav">
        <button type="button" className="btn mini" onClick={() => onMove(cursor.m === 0 ? { y: cursor.y - 1, m: 11 } : { y: cursor.y, m: cursor.m - 1 })}>← PREV</button>
        <b>{months[cursor.m]} {cursor.y}</b>
        <button type="button" className="btn mini" onClick={() => onMove(cursor.m === 11 ? { y: cursor.y + 1, m: 0 } : { y: cursor.y, m: cursor.m + 1 })}>NEXT →</button>
        <button type="button" className="btn mini" onClick={() => onMove({ y: new Date().getFullYear(), m: new Date().getMonth() })}>TODAY</button>
      </div>
      <div className="monthgrid">
        {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(d => <div key={d} className="mh">{d}</div>)}
        {cells.map((key, i) => (
          <div key={i} className={'mcell' + (!key ? ' off' : '') + (key === todayKey ? ' today' : '')}>
            {key && <>{<span className="mnum">{Number(key.slice(8))}</span>}{renderDay(key)}</>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- canvas charts (pixel aesthetic) ---------- */

export function CanvasBars({ data, h = 120, fmt }: { data: { label: string; v: number }[]; h?: number; fmt?: (n: number) => string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const max = Math.max(1, ...data.map(d => d.v));
    const w = cv.width = cv.clientWidth * 2; const hh = cv.height = h * 2;
    const g = cv.getContext('2d'); if (!g) return;
    g.scale(1, 1);
    const acc = getComputedStyle(document.documentElement).getPropertyValue('--acc').trim() || '#ff5c00';
    const dim = 'rgba(214,208,196,0.25)';
    g.clearRect(0, 0, w, hh);
    const bw = w / Math.max(1, data.length);
    data.forEach((d, i) => {
      const bh = Math.max(2, (d.v / max) * (hh - 44));
      g.fillStyle = d.v > 0 ? acc : dim;
      g.fillRect(i * bw + bw * 0.18, hh - 30 - bh, bw * 0.64, bh);
      g.fillStyle = 'rgba(214,208,196,0.75)';
      g.font = '18px monospace';
      const label = fmt ? fmt(d.v) : String(d.v);
      if (label && label.length <= 6) g.fillText(label, i * bw + bw * 0.18, hh - 34 - bh);
      g.fillStyle = 'rgba(214,208,196,0.5)';
      g.font = '15px monospace';
      const l = d.label.slice(0, 7);
      g.fillText(l, i * bw + bw * 0.18 + (bw * 0.64 - g.measureText(l).width) / 2, hh - 8);
    });
  }, [data, h, fmt]);
  return <canvas ref={ref} className="oschart" style={{ height: h }} aria-hidden="true" />;
}

export function CanvasLine({ points, h = 120, max = 5 }: { points: { label: string; v: number }[]; h?: number; max?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const w = cv.width = cv.clientWidth * 2; const hh = cv.height = h * 2;
    const g = cv.getContext('2d'); if (!g) return;
    const acc2 = getComputedStyle(document.documentElement).getPropertyValue('--acc2').trim() || '#00e0c8';
    g.clearRect(0, 0, w, hh);
    if (points.length < 1) return;
    const step = w / Math.max(1, points.length - 1);
    g.strokeStyle = acc2; g.lineWidth = 3;
    g.beginPath();
    points.forEach((p, i) => {
      const x = i * step; const y = hh - 26 - (p.v / max) * (hh - 50);
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    });
    g.stroke();
    g.fillStyle = acc2;
    points.forEach((p, i) => {
      const x = i * step; const y = hh - 26 - (p.v / max) * (hh - 50);
      if (p.v > 0) g.fillRect(x - 4, y - 4, 8, 8);
    });
    g.fillStyle = 'rgba(214,208,196,0.5)'; g.font = '15px monospace';
    points.forEach((p, i) => {
      if (i % Math.ceil(points.length / 7) === 0) g.fillText(p.label.slice(5), i * step - 16, hh - 6);
    });
  }, [points, h, max]);
  return <canvas ref={ref} className="oschart" style={{ height: h }} aria-hidden="true" />;
}

export function Ring({ pct, label }: { pct: number; label: string }) {
  const r = 52, c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <svg className="osring" viewBox="0 0 130 130" role="img" aria-label={label}>
      <circle cx="65" cy="65" r={r} fill="none" stroke="rgba(214,208,196,0.15)" strokeWidth="9" />
      <circle cx="65" cy="65" r={r} fill="none" stroke="var(--acc)" strokeWidth="9"
        strokeDasharray={c} strokeDashoffset={c * (1 - clamped / 100)} transform="rotate(-90 65 65)" />
      <text x="65" y="62" textAnchor="middle" className="osring-num">{Math.round(clamped)}%</text>
      <text x="65" y="84" textAnchor="middle" className="osring-lbl">{label}</text>
    </svg>
  );
}

/* ---------- mic dictation (voice notes) ---------- */

type SR = { start(): void; stop(): void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; continuous: boolean; interimResults: boolean; lang: string };

export function MicButton({ onText }: { onText: (t: string) => void }) {
  const [on, setOn] = useState(false);
  const recRef = useRef<SR | null>(null);
  const store = usePsych0();

  const toggle = () => {
    if (on) { recRef.current?.stop(); return; }
    const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) { store.toast('NO SPEECH ENGINE IN THIS BROWSER — try Chrome', 'warn'); return; }
    const rec = new Ctor();
    rec.continuous = true; rec.interimResults = false; rec.lang = navigator.language || 'en';
    rec.onresult = e => {
      let chunk = '';
      for (let i = 0; i < e.results.length; i++) chunk += e.results[i][0].transcript;
      onText(chunk);
    };
    rec.onend = () => { setOn(false); recRef.current = null; };
    recRef.current = rec;
    try { rec.start(); setOn(true); store.toast('🎙 LISTENING — speak your note', 'ok'); }
    catch { store.toast('MIC BLOCKED — allow microphone access', 'warn'); }
  };
  return (
    <button type="button" className={'btn mini' + (on ? ' on' : '')} onClick={toggle} title="voice dictation">
      {on ? '⏹ STOP MIC' : '🎙 DICTATE'}
    </button>
  );
}

/* ---------- AI helper (task runner with graceful offline) ---------- */

/* per-request AI key — lives ONLY in this browser's localStorage; the server
 * uses it for the request and stores nothing. lets you run on OpenRouter
 * free without touching Vercel env vars. */
export function getAiKey(): string {
  try { return localStorage.getItem('psych0.aikey') || ''; } catch { return ''; }
}
export function setAiKey(key: string) {
  try {
    if (key.trim()) localStorage.setItem('psych0.aikey', key.trim());
    else localStorage.removeItem('psych0.aikey');
  } catch { /* private mode */ }
}

export async function aiTask(task: string, text: string): Promise<string> {
  const r = await fetch('/api/ai', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task, text, key: getAiKey() || undefined }),
  });
  const j = await r.json().catch(() => ({})) as Record<string, unknown>;
  if (!r.ok) throw new Error(String(j.message || j.error || 'AI unavailable'));
  return String(j.text || '');
}

/* ---------- secret lock (AES-GCM unlock widget) ---------- */

export function useVaultPass() {
  const [pass, setPass] = useState('');
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try { const p = sessionStorage.getItem('psych0.vaultpass'); if (p) { setPass(p); setOpen(true); } } catch { /* private mode */ }
  }, []);
  const unlock = async (p: string, test: { cipher: string; iv: string; salt: string } | null) => {
    if (test && test.cipher) {
      try { await decryptSecret(p, test.cipher, test.iv, test.salt); }
      catch { return false; }
    }
    setPass(p);
    setOpen(true);
    try { sessionStorage.setItem('psych0.vaultpass', p); } catch { /* private mode */ }
    return true;
  };
  const lock = () => { setPass(''); setOpen(false); try { sessionStorage.removeItem('psych0.vaultpass'); } catch { /* private mode */ } };
  return { pass, open, unlock, lock };
}

export async function sealBody(pass: string, body: string) {
  return encryptSecret(pass, body);
}

/** decrypt an item body for display — wrong pass or locked → empty */
export async function openBody(pass: string, item: VaultItem): Promise<string> {
  if (!item.secure || !item.cipher) return item.body;
  if (!pass) return '';
  try { return await decryptSecret(pass, item.cipher, item.iv, item.salt); }
  catch { return ''; }
}

export const newItemId = () => 'i_' + uid();
