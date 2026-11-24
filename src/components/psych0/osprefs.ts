'use client';
/* PSYCH://OS — the OS preference engine. Everything here is owner-level
 * customization of the OS SHELL itself (not site content): density, zoom,
 * nav width, glow, corners, motion, wallpapers, card style, scramble, landing.
 * Stored in localStorage, applied as CSS vars + body classes, broadcast on a
 * window event so every open tab re-applies instantly. */
import { useEffect, useState } from 'react';

export interface OsPrefs {
  zoom: number;        // 0.85–1.3 — zoom of the OS content column
  density: 'cozy' | 'compact';
  navWidth: number;    // px — grid column of the nav rail (desktop)
  glow: number;        // 0–100 — accent glow on cards / titles
  radius: number;      // 0–18 px — corner radius of OS cards & inputs
  motion: 'full' | 'reduced' | 'off';
  wallpaper: 'none' | 'grid' | 'dots' | 'scan' | 'aurora' | 'noise';
  wallStrength: number; // 0–100 — wallpaper opacity
  cardStyle: 'flat' | 'outline' | 'glass';
  scramble: boolean;   // the decode-on-mount title animation
  landing: string;     // OS page id suggested as the entry point
}

export const OS_PREFS_KEY = 'psych0.osprefs';

export const OS_LANDING_OPTIONS: { id: string; label: string }[] = [
  { id: '', label: 'OS HOME (all cards)' },
  { id: 'brain', label: 'THE BRAIN' },
  { id: 'inbox', label: 'CAPTURE INBOX' },
  { id: 'notes', label: 'NOTES' },
  { id: 'tasks', label: 'TASKS' },
  { id: 'publish', label: 'PUBLISH (studio)' },
  { id: 'settings', label: 'SETTINGS' },
  { id: 'plumbing', label: 'PLUMBING' },
];

export const DEFAULT_OS_PREFS: OsPrefs = {
  zoom: 1, density: 'cozy', navWidth: 200, glow: 25, radius: 0,
  motion: 'full', wallpaper: 'none', wallStrength: 45, cardStyle: 'flat',
  scramble: true, landing: '',
};

export function loadOsPrefs(): OsPrefs {
  if (typeof window === 'undefined') return DEFAULT_OS_PREFS;
  try {
    const raw = localStorage.getItem(OS_PREFS_KEY);
    if (!raw) return DEFAULT_OS_PREFS;
    return { ...DEFAULT_OS_PREFS, ...(JSON.parse(raw) as Partial<OsPrefs>) };
  } catch { return DEFAULT_OS_PREFS; }
}

export function saveOsPrefs(p: OsPrefs) {
  try { localStorage.setItem(OS_PREFS_KEY, JSON.stringify(p)); } catch { /* private mode */ }
  window.dispatchEvent(new CustomEvent('p0osprefs'));
}

export function resetOsPrefs() {
  try { localStorage.removeItem(OS_PREFS_KEY); } catch { /* private mode */ }
  window.dispatchEvent(new CustomEvent('p0osprefs'));
}

function accentRgb(): string {
  if (typeof window === 'undefined') return '255,92,0';
  const v = getComputedStyle(document.documentElement).getPropertyValue('--acc').trim();
  const m = /^#([0-9a-f]{6})$/i.exec(v);
  if (!m) return '255,92,0';
  const n = parseInt(m[1], 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

/** push prefs into the DOM — CSS vars + classes on <html>/<body> */
export function applyOsPrefs(p: OsPrefs) {
  if (typeof window === 'undefined') return;
  const root = document.documentElement;
  const body = document.body;
  const rgb = accentRgb();

  root.style.setProperty('--osnavw', p.navWidth + 'px');
  root.style.setProperty('--osrad', p.radius + 'px');
  root.style.setProperty('--osz', String(p.zoom));
  root.style.setProperty('--osglow', String(p.glow / 100));
  root.style.setProperty('--osglowc', `rgba(${rgb},0.55)`);
  root.style.setProperty('--oswallo', String(p.wallStrength / 100));
  root.style.setProperty('--oswallc', `rgba(${rgb},0.16)`);
  root.style.setProperty('--oswallcn', 'rgba(214,208,196,0.10)');

  body.classList.toggle('os-compact', p.density === 'compact');
  body.classList.toggle('os-motion-reduced', p.motion === 'reduced');
  body.classList.toggle('os-motion-off', p.motion === 'off');
  for (const w of ['grid', 'dots', 'scan', 'aurora', 'noise'] as const) {
    body.classList.toggle('os-wall-' + w, p.wallpaper === w);
  }
  body.classList.toggle('os-card-outline', p.cardStyle === 'outline');
  body.classList.toggle('os-card-glass', p.cardStyle === 'glass');
  root.classList.toggle('no-scramble', !p.scramble);
}

/** react hook — re-renders on any pref change (this tab or another) */
export function useOsPrefs(): [OsPrefs, (patch: Partial<OsPrefs>) => void, () => void] {
  const [prefs, setPrefs] = useState<OsPrefs>(() => loadOsPrefs());
  useEffect(() => {
    const sync = () => setPrefs(loadOsPrefs());
    window.addEventListener('p0osprefs', sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener('p0osprefs', sync); window.removeEventListener('storage', sync); };
  }, []);
  const patch = (p: Partial<OsPrefs>) => saveOsPrefs({ ...loadOsPrefs(), ...p });
  const reset = () => resetOsPrefs();
  return [prefs, patch, reset];
}
