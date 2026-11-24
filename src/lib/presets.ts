/* PSYCH0 — theme presets */
export interface Preset { id: string; label: string; accent: string; accent2: string }

export const PRESETS: Preset[] = [
  { id: 'psych0', label: 'PSYCH0', accent: '#ff5c00', accent2: '#00e0c8' },
  { id: 'matrix', label: 'MATRIX', accent: '#00ff41', accent2: '#00b32d' },
  { id: 'amber', label: 'AMBER CRT', accent: '#ffb000', accent2: '#ff7b00' },
  { id: 'ice', label: 'ICE', accent: '#00e0ff', accent2: '#7bffd4' },
  { id: 'blood', label: 'BLOOD', accent: '#ff2244', accent2: '#ff8899' },
  { id: 'paper', label: 'PAPER', accent: '#d8d4c8', accent2: '#a8a498' },
  { id: 'vaporwave', label: 'VAPORWAVE', accent: '#ff71ce', accent2: '#01cdfe' },
  { id: 'c64', label: 'C64', accent: '#786cff', accent2: '#41f244' },
  { id: 'toxic', label: 'TOXIC', accent: '#c8ff00', accent2: '#ff00c8' },
];

export function cyclePreset(cur: { preset: string; accent: string; accent2: string }): Preset {
  const idx = PRESETS.findIndex(p => p.id === cur.preset && p.accent === cur.accent);
  return PRESETS[(idx + 1) % PRESETS.length];
}
