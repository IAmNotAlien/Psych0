/* PSYCH0 — moon phase math. No dependencies, no API calls: the moon keeps
 * extremely regular appointments, so a synodic-month counter from a known
 * new moon (2000-01-06 18:14 UTC) is accurate to within a day. */

export interface MoonPhase { t: number; name: string; glyph: string; illum: number }

const SYNODIC = 29.53058867;           // days
const REF_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);

const NAMES = ['NEW MOON', 'WAXING CRESCENT', 'FIRST QUARTER', 'WAXING GIBBOUS',
  'FULL MOON', 'WANING GIBBOUS', 'LAST QUARTER', 'WANING CRESCENT'];
const GLYPHS = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'];

export function moonPhase(d: Date = new Date()): MoonPhase {
  const days = (d.getTime() - REF_NEW_MOON) / 86400000;
  let t = (days % SYNODIC) / SYNODIC;
  if (t < 0) t += 1;
  const illum = Math.round(((1 - Math.cos(2 * Math.PI * t)) / 2) * 100);
  const idx = Math.floor(t * 8 + 0.5) % 8;
  return { t, name: NAMES[idx], glyph: GLYPHS[idx], illum };
}
