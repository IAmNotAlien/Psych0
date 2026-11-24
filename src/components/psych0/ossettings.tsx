'use client';
/* PSYCH://OS — SETTINGS, the control room. Two halves:
 * 1. OS SHELL — the OS preference engine (density, zoom, nav, glow, motion,
 *    wallpapers, cards, scramble, landing) — instant-apply, this browser.
 * 2. SITE — the full studio settings component embedded (identity, theme,
 *    custom css, fx, webring, hooks, colophon, tokens, plugins, badge).
 * Everything the studio could do, now lives in the OS. */
import { Settings } from './studio';
import { useOsPrefs, loadOsPrefs, applyOsPrefs, OS_LANDING_OPTIONS, type OsPrefs } from './osprefs';
import { OS_PAGES } from './oshub';

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="osetrow">
      <div className="osetlab">
        <b>{label}</b>
        {hint && <span className="dim small">{hint}</span>}
      </div>
      <div className="osetctl">{children}</div>
    </div>
  );
}

function Seg<T extends string>({ value, options, onChange }: {
  value: T; options: { v: T; label: string }[]; onChange: (v: T) => void;
}) {
  return (
    <div className="rowwrap">
      {options.map(o => (
        <button key={o.v} type="button" className={'chip' + (value === o.v ? ' on' : '')} onClick={() => onChange(o.v)}>{o.label}</button>
      ))}
    </div>
  );
}

function Slide({ value, min, max, step, onChange, fmt }: {
  value: number; min: number; max: number; step: number; onChange: (v: number) => void; fmt: (v: number) => string;
}) {
  return (
    <div className="osetslide">
      <input type="range" min={min} max={max} step={step} value={value} aria-label="slider"
        onChange={e => onChange(Number(e.target.value))} />
      <span className="chip">{fmt(value)}</span>
    </div>
  );
}

/* ================= OS SHELL preferences ================= */

function ShellPrefs() {
  const [p, patch, reset] = useOsPrefs();
  const set = (x: Partial<OsPrefs>) => { patch(x); applyOsPrefs({ ...p, ...x }); };
  return (
    <>
      <div className="titlebar"><h1 className="scramble">OS SHELL_</h1><span className="spacer" />
        <span className="chip">◉ THIS BROWSER · INSTANT APPLY</span></div>
      <p className="dim small">the OS itself, tuned by you. every switch applies live and persists in this browser — the studio settings below change the whole site for everyone.</p>

      <Row label="ZOOM" hint="scale of the OS content column">
        <Slide value={p.zoom} min={0.85} max={1.3} step={0.05} onChange={v => set({ zoom: v })}
          fmt={v => Math.round(v * 100) + '%'} />
      </Row>
      <Row label="DENSITY" hint="padding + gaps of every OS page">
        <Seg value={p.density} options={[{ v: 'cozy', label: 'COZY' }, { v: 'compact', label: 'COMPACT — more data, less air' }]} onChange={v => set({ density: v })} />
      </Row>
      <Row label="NAV RAIL WIDTH" hint="desktop only — the left nav column">
        <Slide value={p.navWidth} min={150} max={340} step={10} onChange={v => set({ navWidth: v })}
          fmt={v => v + 'px'} />
      </Row>
      <Row label="ACCENT GLOW" hint="neon bleed on cards and titles — 0 is crisp, 100 is cyberdeck">
        <Slide value={p.glow} min={0} max={100} step={5} onChange={v => set({ glow: v })}
          fmt={v => v + '%'} />
      </Row>
      <Row label="CORNER RADIUS" hint="0 = terminal-sharp, 18 = soft deck">
        <Slide value={p.radius} min={0} max={18} step={2} onChange={v => set({ radius: v })}
          fmt={v => v + 'px'} />
      </Row>
      <Row label="MOTION" hint="animations across the OS">
        <Seg value={p.motion} options={[{ v: 'full', label: 'FULL' }, { v: 'reduced', label: 'REDUCED' }, { v: 'off', label: 'STILL — zero animation' }]} onChange={v => set({ motion: v })} />
      </Row>
      <Row label="WALLPAPER" hint="a faint layer behind the OS — tinted with your accent">
        <Seg value={p.wallpaper} options={[
          { v: 'none', label: 'NONE' }, { v: 'grid', label: 'GRID' }, { v: 'dots', label: 'DOTS' },
          { v: 'scan', label: 'SCANLINES' }, { v: 'aurora', label: 'AURORA' }, { v: 'noise', label: 'NOISE' },
        ]} onChange={v => set({ wallpaper: v })} />
        <Slide value={p.wallStrength} min={0} max={100} step={5} onChange={v => set({ wallStrength: v })}
          fmt={v => v + '%'} />
      </Row>
      <Row label="CARD STYLE" hint="how the home cards and panels look">
        <Seg value={p.cardStyle} options={[{ v: 'flat', label: 'FLAT' }, { v: 'outline', label: 'OUTLINE' }, { v: 'glass', label: 'GLASS' }]} onChange={v => set({ cardStyle: v })} />
      </Row>
      <Row label="TITLE DECODE" hint="the scramble-in animation on page titles">
        <Seg value={p.scramble ? 'on' : 'off'} options={[{ v: 'on', label: 'ON — decode on mount' }, { v: 'off', label: 'OFF — instant titles' }]} onChange={v => set({ scramble: v === 'on' })} />
      </Row>
      <Row label="LANDING PAGE" hint="the OS points you here first — shown as the ⌁ landing chip on OS home and in the console">
        <select value={p.landing} onChange={e => set({ landing: e.target.value })}>
          {OS_LANDING_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        {p.landing && <a className="btn mini" href={'#/os/' + p.landing} style={{ marginLeft: 8 }}>GO →</a>}
      </Row>

      <div className="rowwrap" style={{ marginTop: 14 }}>
        <button type="button" className="btn" onClick={() => { reset(); setTimeout(() => applyOsPrefs(loadOsPrefs()), 30); }}>⟲ RESET SHELL TO DEFAULTS</button>
      </div>
      <div className="helpline">prefs live in this browser (localStorage) — set them once per device. {OS_PAGES.length} OS pages installed.</div>
    </>
  );
}

/* ================= the page ================= */

export function OsSettingsPage() {
  return (
    <div className="ossettings">
      <ShellPrefs />
      <div className="osettingsplit" aria-hidden="true" />
      {/* the full studio settings — site-wide, saved to the database */}
      <Settings />
    </div>
  );
}
