'use client';
/* PSYCH0 — app shell: boot, header/footer, hash router, palette + terminal, modal, lightbox, toasts,
 * full-text search, time machine, reader controls, low-power mode, PWA registration */
import { useEffect, useRef, useState } from 'react';
import { usePsych0, REDUCED } from './store';
import { Home, Blog, PostView, Projects, ProjectView, Lab, About, NowPage, ColophonPage, NotFound } from './views';
import { StudioLogin } from './studio';
import { MailView, GraphView, SearchModal, TimeMachine } from './power';
import { OsRouter, OsHome, OS_PAGES } from './oshub';
import { useVault } from './vault';
import { WebComponents } from './webc';
import { useClock } from './ui';
import { PRESETS } from '@/lib/presets';
import { moonPhase } from '@/lib/moon';
import { pageWeightKB, fmtWeight } from '@/lib/pageweight';
import { FX_KEYS, type PluginCmd } from '@/lib/types';

/* ================= boot screen ================= */
const BOOT_LINES = [
  'PSYCH0 BIOS v2.0 — NEXT.JS EDITION',
  'mounting /den .......... OK',
  'theme engine ........... OK',
  'serverless api ......... OK',
];
/* 1-in-14 boots get a rare line — nobody sees it coming */
const RARE_BOOTS = [
  'wake up. the den is dreaming.',
  'insert coin to continue_',
  '0 days since last existential glitch',
  'hello, world. again.',
  'CTRL+K is a lifestyle.',
  'this boot is one of a kind. probably.',
];
const pickBoot = () => Math.random() < 1 / 14 ? RARE_BOOTS[Math.floor(Math.random() * RARE_BOOTS.length)] : null;

function Boot({ mode }: { mode: string }) {
  const [gone, setGone] = useState(false);
  const rare = useRef(pickBoot());
  useEffect(() => { const t = setTimeout(() => setGone(true), 1500); return () => clearTimeout(t); }, []);
  if (gone) return null;
  return (
    <div id="boot" role="status">
      {BOOT_LINES.map((l, i) => <div key={i} className="bootline" style={{ animationDelay: (i * 0.18) + 's' }}>{l}</div>)}
      <div className="bootline" style={{ animationDelay: '0.72s' }}>{'database ............... ' + (mode === 'supabase' ? 'SUPABASE OK' : 'LOCAL MODE')}</div>
      {rare.current && <div className="bootline bootrare" style={{ animationDelay: '1.05s' }}>{rare.current}</div>}
      <div className="bootline" style={{ animationDelay: '0.9s' }}>hand-made web .......... READY</div>
    </div>
  );
}

/* ================= palette items + terminal (module-level) ================= */

interface Item { label: string; hint: string; fn: () => void }

function fuzzy(needle: string, hay: string): boolean {
  const n = needle.toLowerCase(); const h = hay.toLowerCase(); let i = 0;
  for (const c of n) { i = h.indexOf(c, i); if (i < 0) return false; i++; }
  return true;
}

function buildItems(q: string, s: ReturnType<typeof usePsych0.getState>): Item[] {
  const studio = s.viewMode === 'studio';
  const list: Item[] = [];
  if (q.startsWith('>')) return [{ label: 'TERMINAL ▸ ' + q, hint: 'ENTER RUNS IT', fn: () => {} }];
  const modeLabel = studio ? 'PUBLIC (visitor view)' : s.studio ? 'STUDIO (editing)' : 'STUDIO (needs passcode)';
  list.push({ label: 'MODE ▸ SWITCH TO ' + modeLabel, hint: 'm', fn: () => s.toggleMode() });
  [['INDEX', '#/'], ['BLOG', '#/blog'], ['PROJECTS', '#/projects'], ['THE LAB', '#/lab'],
   ['NOW', '#/now'], ['ABOUT', '#/about'], ['MAIL // GUESTBOOK', '#/mail'],
   ['GRAPH', '#/graph'], ['COLOPHON', '#/colophon']]
    .forEach(([label, href]) => list.push({ label: 'GO ▸ ' + label, hint: href, fn: () => { window.location.hash = href; } }));
  if (s.studio) {
    list.push({ label: 'GO ▸ PSYCH://OS', hint: 'the whole operating system', fn: () => { window.location.hash = '#/os'; } });
    list.push({ label: 'GO ▸ PUBLISH', hint: 'posts · projects · embeds · about', fn: () => { window.location.hash = '#/os/publish'; } });
    list.push({ label: 'GO ▸ SETTINGS', hint: 'os shell + site', fn: () => { window.location.hash = '#/os/settings'; } });
    list.push({ label: 'GO ▸ DASHBOARD', hint: 'stats + history', fn: () => { window.location.hash = '#/os/dash'; } });
    list.push({ label: 'GO ▸ POST DOCTOR', hint: 'lint the blog', fn: () => { window.location.hash = '#/os/doctor'; } });
    list.push({ label: 'GO ▸ READ LATER', hint: 'feeds + clipping', fn: () => { window.location.hash = '#/os/feeds'; } });
    list.push({ label: 'GO ▸ IMPORT ENGINE', hint: 'md / html / wordpress', fn: () => { window.location.hash = '#/os/blogimport'; } });
    list.push({ label: 'GO ▸ ZINE FACTORY', hint: 'print a year', fn: () => { window.location.hash = '#/os/zine'; } });
    OS_PAGES.forEach(p => list.push({ label: 'OS ▸ ' + p.label, hint: p.group.toLowerCase() + ' — ' + p.desc.split(',')[0], fn: () => { window.location.hash = '#/os/' + p.id; } }));
    list.push({ label: 'GO ▸ MEDIA LIBRARY', hint: 'uploads', fn: () => { window.location.hash = '#/os/media'; } });
    list.push({ label: 'NEW ▸ POST', hint: 'n', fn: () => { window.location.hash = '#/os/publish/new/post'; } });
    list.push({ label: 'NEW ▸ PROJECT', hint: 'p', fn: () => { window.location.hash = '#/os/publish/new/project'; } });
    list.push({ label: 'NEW ▸ LAB EMBED', hint: '', fn: () => { window.location.hash = '#/os/publish/new/embed'; } });
    list.push({ label: 'EDIT ▸ ABOUT PAGE', hint: '', fn: () => { window.location.hash = '#/os/publish/about'; } });
    list.push({ label: 'DATA ▸ EXPORT JSON', hint: '', fn: () => s.exportJson() });
  }
  list.push({ label: 'TOOL ▸ FULL-TEXT SEARCH', hint: 's', fn: () => window.dispatchEvent(new CustomEvent('p0search')) });
  list.push({ label: 'TOOL ▸ TIME MACHINE', hint: 'scrub the den back', fn: () => window.dispatchEvent(new CustomEvent('p0tm')) });
  list.push({ label: 'POWER ▸ ' + (s.lowPower ? 'RESTORE FULL POWER' : 'LOW-POWER MODE'), hint: 'strip effects', fn: () => s.toggleLowPower() });
  // owner-defined console plugins (SETTINGS → PLUGINS)
  (s.site.plugins || []).forEach((p: PluginCmd) => {
    if (!p.cmd) return;
    list.push({
      label: 'PLUGIN ▸ ' + (p.label || p.cmd), hint: p.kind,
      fn: () => {
        if (p.kind === 'goto') window.location.hash = p.value.startsWith('#') ? p.value : '#/' + p.value;
        else if (p.kind === 'url') window.open(p.value, '_blank', 'noopener');
        else s.toast(String(p.value).slice(0, 200), 'ok');
      },
    });
  });
  PRESETS.forEach(p => list.push({ label: 'THEME ▸ ' + p.label, hint: p.accent, fn: () => s.setPreset(p.id) }));
  FX_KEYS.forEach(k => list.push({
    label: 'FX ▸ ' + (s.site.fx[k as keyof typeof s.site.fx] ? 'DISABLE ' : 'ENABLE ') + k.toUpperCase(),
    hint: 'toggle', fn: () => s.toggleFx(k),
  }));
  list.push({ label: 'HELP ▸ KEYBOARD SHORTCUTS', hint: '?', fn: () => s.confirm('KEYBOARD SHORTCUTS', 'CTRL+K console · S full-text search · M toggle mode · N new post · P new project · E edit current · ESC close · (N/P/E need studio mode)', () => {}) });

  const needle = q.trim();
  if (needle) {
    s.visiblePosts().filter(p => fuzzy(needle, p.title)).slice(0, 4)
      .forEach(p => list.push({ label: 'POST ▸ ' + p.title, hint: 'open', fn: () => { window.location.hash = '#/blog/' + p.slug; } }));
    s.projects.filter(p => fuzzy(needle, p.title)).slice(0, 4)
      .forEach(p => list.push({ label: 'PROJECT ▸ ' + p.title, hint: 'open', fn: () => { window.location.hash = '#/projects/' + p.slug; } }));
    s.embeds.filter(e => fuzzy(needle, e.title)).slice(0, 3)
      .forEach(e => list.push({ label: 'EMBED ▸ ' + e.title, hint: 'open', fn: () => { window.location.hash = '#/lab'; } }));
    return list.filter(c => fuzzy(needle, c.label));
  }
  return list;
}

function termExec(raw: string, s: ReturnType<typeof usePsych0.getState>) {
  const parts = raw.trim().split(/\s+/);
  const cmd = (parts[0] || '').toLowerCase();
  const arg = parts.slice(1).join(' ');
  const log = (m: string) => s.toast('> ' + m);
  if (!cmd || cmd === 'help') log('commands: goto <page> · theme <preset|#hex> · fx <key> on|off · new post|project|embed · cap <text> · os · brain · notes · journal · tasks · calendar · habits · focus · cards · drive · vault · money · people · shelf · travel · recipes · ideas · collections · links · rules · plumbing · mail · dash · graph · media · doctor · feeds · import · zine · now · colophon · search · tm · lowpower · storm · mode');
  else if (cmd === 'cap') { if (!arg) log('cap what? e.g. cap call the dentist'); else useVault.getState().capture(arg, 'note'); }
  else if (cmd === 'goto') window.location.hash = '#/' + arg;
  else if (cmd === 'search') window.dispatchEvent(new CustomEvent('p0search'));
  else if (cmd === 'tm') window.dispatchEvent(new CustomEvent('p0tm'));
  else if (cmd === 'lowpower') s.toggleLowPower();
  else if (cmd === 'doctor') window.location.hash = s.studio ? '#/os/doctor' : (log('studio only'), '#/');
  else if (cmd === 'feeds') window.location.hash = s.studio ? '#/os/feeds' : (log('studio only'), '#/');
  else if (cmd === 'import') window.location.hash = s.studio ? '#/os/blogimport' : (log('studio only'), '#/');
  else if (cmd === 'zine') window.location.hash = s.studio ? '#/os/zine' : (log('studio only'), '#/');
  else if (cmd === 'now') window.location.hash = '#/now';
  else if (cmd === 'colophon') window.location.hash = '#/colophon';
  else if (cmd === 'theme') {
    const p = PRESETS.find(x => x.id === arg.toLowerCase());
    if (p) s.setPreset(p.id);
    else if (/^#[0-9a-f]{6}$/i.test(arg)) s.setCustomColors(arg, s.site.accent2);
    else log('unknown theme: ' + arg);
  } else if (cmd === 'fx') {
    const key = arg.split(/\s+/)[0];
    if (!FX_KEYS.includes(key as (typeof FX_KEYS)[number])) { log('unknown fx key: ' + key); return; }
    s.toggleFx(key);
  } else if (cmd === 'new') {
    if (arg === 'post') window.location.hash = '#/os/publish/new/post';
    else if (arg === 'project') window.location.hash = '#/os/publish/new/project';
    else if (arg === 'embed') window.location.hash = '#/os/publish/new/embed';
    else log('new what? post | project | embed');
  } else if (cmd === 'mode') s.toggleMode();
  else if (cmd === 'mail') window.location.hash = '#/mail';
  else if (cmd === 'os') window.location.hash = s.studio ? '#/os' : (log('studio only'), '#/');
  else if (['brain', 'notes', 'journal', 'tasks', 'calendar', 'habits', 'focus', 'cards', 'drive', 'vault', 'money', 'people', 'shelf', 'travel', 'recipes', 'ideas', 'collections', 'links', 'rules', 'plumbing', 'inbox', 'bookmarks', 'goals', 'review', 'flashcards'].includes(cmd)) {
    const pageId = cmd === 'cards' ? 'flashcards' : cmd;
    window.location.hash = s.studio ? '#/os/' + pageId : (log('studio only'), '#/');
  }
  else if (cmd === 'dash') window.location.hash = s.studio ? '#/os/dash' : (log('studio only — #/os'), '#/');
  else if (cmd === 'graph') window.location.hash = '#/graph';
  else if (cmd === 'media') window.location.hash = s.studio ? '#/os/media' : (log('studio only'), '#/');
  else if (cmd === 'storm') s.stormOn();
  else if (cmd === 'backup') s.exportJson();
  else {
    // owner-defined plugins: `> <cmd>` matches SETTINGS → PLUGINS
    const plug = (s.site.plugins || []).find(p => p.cmd.toLowerCase() === cmd);
    if (plug) {
      if (plug.kind === 'goto') window.location.hash = plug.value.startsWith('#') ? plug.value : '#/' + plug.value;
      else if (plug.kind === 'url') window.open(plug.value, '_blank', 'noopener');
      else s.toast(String(plug.value).slice(0, 200), 'ok');
      return;
    }
    log('unknown command: ' + cmd + ' — try help');
  }
}

/* ================= palette ================= */

function Palette() {
  const s = usePsych0();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const [openState, setOpenState] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // CTRL+K anywhere toggles the palette (dispatched from the global key handler)
  useEffect(() => {
    const h = () => { setOpenState(v => !v); setQ(''); setSel(0); };
    window.addEventListener('p0palette', h);
    return () => window.removeEventListener('p0palette', h);
  }, []);
  useEffect(() => { if (openState) inputRef.current?.focus(); }, [openState]);

  const items = buildItems(q, s);
  const clamped = Math.min(sel, Math.max(0, items.length - 1));

  const run = (it: Item | undefined) => {
    if (!it) return;
    s.beep(990, .04);
    if (q.startsWith('>')) { termExec(q.slice(1), s); setQ(''); return; }
    setOpenState(false);
    it.fn();
  };

  return (
    <>
      <button type="button" className="hbtn" aria-label="command palette" title="command palette — ctrl+k" onClick={() => setOpenState(true)}>⌘K</button>
      {openState && (
        <div id="palette" role="dialog" aria-label="command palette" onClick={e => { if (e.target === e.currentTarget) setOpenState(false); }}>
          <div className="pbox">
            <div className="phead">PSYCH0://CONSOLE <span>— CTRL+K · ESC CLOSE · TYPE &gt; FOR TERMINAL</span></div>
            <input ref={inputRef} className="pinput" placeholder="type a command, search, or > for terminal…"
              value={q} spellCheck={false} autoComplete="off"
              onChange={e => { setQ(e.target.value); setSel(0); }}
              onKeyDown={e => {
                if (e.key === 'ArrowDown') { e.preventDefault(); setSel(Math.min(items.length - 1, clamped + 1)); }
                else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(Math.max(0, clamped - 1)); }
                else if (e.key === 'Enter') { e.preventDefault(); run(items[clamped]); }
                else if (e.key === 'Escape') setOpenState(false);
              }} />
            <div className="pres">
              {items.slice(0, 12).map((it, i) => (
                <div key={i} className={'pitem' + (i === clamped ? ' sel' : '')} onMouseEnter={() => setSel(i)} onClick={() => run(it)}>
                  <span className="pl">{it.label}</span><span className="hint">{it.hint}</span>
                </div>
              ))}
              {!items.length && <div className="pitem"><span className="pl">NOTHING MATCHES — TRY &gt; FOR TERMINAL</span></div>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ================= reader controls (per-visitor: font size, width, serif) ================= */

function ReaderPanel() {
  const s = usePsych0();
  const [open, setOpen] = useState(false);
  const r = s.reader;
  const btn = (on: boolean, label: string, fn: () => void) => (
    <button type="button" className={'chip' + (on ? ' on' : '')} onClick={fn}>{label}</button>
  );
  return (
    <div className="readerwrap">
      <button type="button" className={'hbtn' + (open ? ' on' : '')} aria-label="reader controls" title="reader controls"
        onClick={() => setOpen(v => !v)}>Aa</button>
      {open && (
        <div className="readerpanel" role="dialog" aria-label="reader controls">
          <div className="rowwrap">
            {btn(r.fs === 0, 'A−', () => s.setReader({ fs: 0 }))}
            {btn(r.fs === 1, 'A', () => s.setReader({ fs: 1 }))}
            {btn(r.fs === 2, 'A+', () => s.setReader({ fs: 2 }))}
          </div>
          <div className="rowwrap">
            {btn(!r.serif, 'MONO', () => s.setReader({ serif: false }))}
            {btn(r.serif, 'SERIF', () => s.setReader({ serif: true }))}
          </div>
          <div className="rowwrap">
            {btn(r.width === 0, 'DEFAULT WIDTH', () => s.setReader({ width: 0 }))}
            {btn(r.width === 1, 'NARROW', () => s.setReader({ width: 1 }))}
            {btn(r.width === 2, 'WIDE', () => s.setReader({ width: 2 }))}
          </div>
          <div className="dim small">saved in this browser — your eyes, your rules.</div>
        </div>
      )}
    </div>
  );
}

/* ================= root app ================= */

export default function Psych0App({ initial, studio, mode, passcodeDefault }: {
  initial: import('@/lib/types').Bundle;
  studio: boolean; mode: 'supabase' | 'local'; passcodeDefault: boolean;
}) {
  const s = usePsych0();
  const inited = useRef(false);
  const clock = useClock();
  const moon = moonPhase();

  // init + hash router
  useEffect(() => {
    if (inited.current) return;
    inited.current = true;
    s.init(initial, studio, mode, passcodeDefault);
    const parse = () => {
      const seg = window.location.hash.replace(/^#/, '').split('/').filter(Boolean).map(x => decodeURIComponent(x));
      s.setSeg(seg);
      window.scrollTo(0, 0);
    };
    parse();
    window.addEventListener('hashchange', parse);
  }, [initial, studio, mode, passcodeDefault, s]);

  // PWA service worker — enables install + share-target on https
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    if (!/^https?:$/.test(window.location.protocol)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => { /* dev servers may lack it */ });
  }, []);

  // theme engine: css vars, fx classes, custom css
  useEffect(() => {
    if (!s.ready) return;
    const root = document.documentElement;
    root.style.setProperty('--acc', s.site.accent);
    root.style.setProperty('--acc2', s.site.accent2);
    const fx = s.site.fx;
    ['fx-grid', 'fx-scan', 'fx-crt', 'fx-cross', 'fx-glitch', 'fx-storm'].forEach(c => document.body.classList.remove(c));
    if (fx.grid) document.body.classList.add('fx-grid');
    if (fx.scan) document.body.classList.add('fx-scan');
    if (fx.crt) document.body.classList.add('fx-crt');
    if (fx.cross) document.body.classList.add('fx-cross');
    if (fx.glitch) document.body.classList.add('fx-glitch');
    if (s.storm) document.body.classList.add('fx-storm');
    let tag = document.getElementById('p0custom') as HTMLStyleElement | null;
    if (!tag) { tag = document.createElement('style'); tag.id = 'p0custom'; document.head.appendChild(tag); }
    tag.textContent = s.site.customCss || '';
  }, [s.ready, s.site.accent, s.site.accent2, s.site.fx, s.site.customCss, s.storm]);

  // keyboard (state read fresh via getState() — no stale closures)
  useEffect(() => {
    // konami: ↑↑↓↓←→←→BA → glitch storm
    const KONAMI = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];
    let kIdx = 0;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); window.dispatchEvent(new CustomEvent('p0palette')); return; }
      if (e.key === 'Escape') { usePsych0.getState().closeModal(); usePsych0.getState().setLightbox(null); return; }
      const k = e.key.toLowerCase();
      kIdx = (k === KONAMI[kIdx]) ? kIdx + 1 : (k === KONAMI[0] ? 1 : 0);
      if (kIdx === KONAMI.length) { kIdx = 0; usePsych0.getState().stormOn(); }
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || (e.target as HTMLElement)?.isContentEditable) return;
      const st = usePsych0.getState();
      if (e.key === 's') { e.preventDefault(); window.dispatchEvent(new CustomEvent('p0search')); return; }
      if (e.key === 'm') st.toggleMode();
      else if (st.viewMode === 'studio' && e.key === 'n') window.location.hash = '#/os/publish/new/post';
      else if (st.viewMode === 'studio' && e.key === 'p') window.location.hash = '#/os/publish/new/project';
      else if (st.viewMode === 'studio' && e.key === 'e') {
        const seg = st.seg;
        if (seg[0] === 'blog' && seg[1]) { const p = st.posts.find(x => x.slug === seg[1]); if (p) window.location.hash = '#/os/publish/post/' + p.id; }
        else if (seg[0] === 'projects' && seg[1]) { const p = st.projects.find(x => x.slug === seg[1]); if (p) window.location.hash = '#/os/publish/project/' + p.id; }
        else if (seg[0] === 'about') window.location.hash = '#/os/publish/about';
        else if (seg.length === 0) window.location.hash = '#/os/publish';
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const seg = s.seg;
  let view: React.ReactNode;
  const isStudio = s.viewMode === 'studio';

  if (seg.length === 0) view = <Home />;
  else if (seg[0] === 'blog' && seg[1]) view = <PostView slug={seg[1]} />;
  else if (seg[0] === 'blog') view = <Blog />;
  else if (seg[0] === 'projects' && seg[1]) view = <ProjectView slug={seg[1]} />;
  else if (seg[0] === 'projects') view = <Projects />;
  else if (seg[0] === 'lab') view = <Lab />;
  else if (seg[0] === 'now') view = <NowPage />;
  else if (seg[0] === 'colophon') view = <ColophonPage />;
  else if (seg[0] === 'about') view = <About />;
  else if (seg[0] === 'mail') view = <MailView />;
  else if (seg[0] === 'graph') view = <GraphView />;
  // the studio lives ONLY inside the OS now — old URLs redirect there
  else if (seg[0] === 'os' && !isStudio) view = <OsGate />;
  else if (seg[0] === 'os' && seg.length === 1) view = <OsHome />;
  else if (seg[0] === 'os') view = <OsRouter page={seg[1] || ''} sub={seg.slice(2).join('/')} />;
  else if (seg[0] === 'studio') view = s.studio ? <OsRedirect to="#/os" /> : <StudioLogin />;
  else if (seg[0] === 'settings') view = <OsRedirect to="#/os/settings" />;
  else if (seg[0] === 'dash') view = <OsRedirect to="#/os/dash" />;
  else if (seg[0] === 'media') view = <OsRedirect to="#/os/media" />;
  else if (seg[0] === 'doctor') view = <OsRedirect to="#/os/doctor" />;
  else if (seg[0] === 'feeds') view = <OsRedirect to="#/os/feeds" />;
  else if (seg[0] === 'import') view = <OsRedirect to="#/os/blogimport" />;
  else if (seg[0] === 'zine') view = <OsRedirect to="#/os/zine" />;
  else if (seg[0] === 'edit' && seg[1] === 'new' && seg[2] === 'post') view = <OsRedirect to="#/os/publish/new/post" />;
  else if (seg[0] === 'edit' && seg[1] === 'new' && seg[2] === 'project') view = <OsRedirect to="#/os/publish/new/project" />;
  else if (seg[0] === 'edit' && seg[1] === 'new' && seg[2] === 'embed') view = <OsRedirect to="#/os/publish/new/embed" />;
  else if (seg[0] === 'edit' && seg[1] === 'post' && seg[2]) view = <OsRedirect to={'#/os/publish/post/' + seg[2]} />;
  else if (seg[0] === 'edit' && seg[1] === 'project' && seg[2]) view = <OsRedirect to={'#/os/publish/project/' + seg[2]} />;
  else if (seg[0] === 'edit' && seg[1] === 'embed' && seg[2]) view = <OsRedirect to={'#/os/publish/embed/' + seg[2]} />;
  else if (seg[0] === 'edit' && seg[1] === 'about') view = <OsRedirect to="#/os/publish/about" />;
  else view = <NotFound />;

  const navKey = ['blog', 'projects', 'lab', 'about', 'now', 'mail', 'graph'].includes(seg[0]) ? seg[0] : '';

  return (
    <div className="p0root">
      <WebComponents />
      <SearchModal />
      <TimeMachine />
      {initial.site.fx.boot && <Boot mode={mode} />}
      <header className="p0head">
        <a className="hlogo" href="#/" id="p0logo">{s.site.logo || 'PSYCH0'}</a>
        <nav id="p0nav" aria-label="main">
          <a href="#/" data-nav="index" className={seg.length === 0 ? 'on' : ''}>INDEX</a>
          <a href="#/blog" data-nav="blog" className={navKey === 'blog' ? 'on' : ''}>BLOG</a>
          <a href="#/projects" data-nav="projects" className={navKey === 'projects' ? 'on' : ''}>PROJECTS</a>
          <a href="#/lab" data-nav="lab" className={navKey === 'lab' ? 'on' : ''}>LAB</a>
          <a href="#/now" data-nav="now" className={navKey === 'now' ? 'on' : ''}>NOW</a>
          <a href="#/about" data-nav="about" className={navKey === 'about' ? 'on' : ''}>ABOUT</a>
          <a href="#/mail" data-nav="mail" className={navKey === 'mail' ? 'on' : ''}>MAIL</a>
          <a href="#/graph" data-nav="graph" className={navKey === 'graph' ? 'on' : ''}>GRAPH</a>
        </nav>
        <div className="hbtns">
          <span className="hclock hmoon" title={'moon: ' + moon.name + ' · ' + moon.illum + '% lit'}>{moon.glyph}</span>
          <span className="hclock" title="local time">{clock}</span>
          <ReaderPanel />
          <button type="button" className={'hbtn hmode' + (isStudio ? ' on' : '')} onClick={() => s.toggleMode()} title="switch studio / public mode (M)">
            {isStudio ? '◐ STUDIO' : '○ PUBLIC'}
          </button>
          <Palette />
          <button type="button" className="hbtn" onClick={() => s.cycleTheme()} title="cycle color theme" aria-label="cycle theme">◍</button>
          <button type="button" className="hbtn burger" aria-label="menu" onClick={() => document.getElementById('p0nav')?.classList.toggle('open')}>☰</button>
        </div>
      </header>

      {s.tmDate && (
        <div className="tmbar">
          <span>⏮ TIME MACHINE — viewing the den as of <b>{s.tmDate}</b></span>
          <button type="button" className="btn mini" onClick={() => s.setTmDate(null)}>⟲ RETURN TO TODAY</button>
        </div>
      )}

      <main className="p0main" id="p0app">{view}</main>

      <footer className="p0foot">
        <span className="fl">{s.site.logo || 'PSYCH0'}</span>
        <span className="fmid">HAND-MADE · NEXT.JS · {s.mode === 'supabase' ? 'SUPABASE' : 'LOCAL MODE'}</span>
        <span className="spacer" />
        {s.lowPower && <LowPowerBadge />}
        <button type="button" className="flink" onClick={() => s.toggleLowPower()} title="strip every effect and animation — permacomputing mode">⚡ LOW-POWER</button>
        <button type="button" className="flink" onClick={() => window.dispatchEvent(new CustomEvent('p0tm'))} title="scrub the whole den back to any date">⏮ TIME MACHINE</button>
        <a href="/feed.xml" target="_blank" rel="noopener" title="RSS feed">RSS ⚡</a>
        <a href="#/colophon" title="how this site is made">COLOPHON</a>
        <a href="#/os">{s.studio ? 'OS' : 'OS ↗'}</a>
        <a href="#top" onClick={e => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>TOP ↑</a>
      </footer>

      {s.modal && (
        <div className="mwrap" role="dialog" onClick={e => { if (e.target === e.currentTarget) s.closeModal(); }}>
          <div className="mbox">
            <div className="mtitle">{s.modal.title}</div>
            <div className="mbody">{s.modal.msg}</div>
            <div className="mbtns">
              <button type="button" className="btn" onClick={() => s.closeModal()}>CANCEL</button>
              <button type="button" className="btn danger" onClick={() => { const yes = s.modal?.onYes; s.closeModal(); yes?.(); }}>CONFIRM</button>
            </div>
          </div>
        </div>
      )}

      {s.lightbox && (
        <div className="lbox" role="dialog" aria-label="image preview" onClick={() => s.setLightbox(null)}>
          <img src={s.lightbox} alt="" />
        </div>
      )}

      <div className="toasts" aria-live="polite">
        {s.toasts.map(t => <div key={t.id} className={'toast ' + t.cls}>{t.msg}</div>)}
      </div>
    </div>
  );
}

/** old studio URLs → their new home inside the OS (one dir has everything) */
function OsRedirect({ to, login }: { to: string; login?: boolean }) {
  useEffect(() => { if (!login) window.location.replace(to); }, [to, login]);
  if (login) return <StudioLogin />;
  return (
    <div className="empty" style={{ marginTop: 40 }}>
      moved into the OS → <a className="btn" href={to} style={{ marginLeft: 10 }}>{to}</a>
    </div>
  );
}

/** the OS front door: passcode gate first, then studio-mode toggle */
function OsGate() {
  const s = usePsych0();
  if (!s.studio) return <StudioLogin />;
  return (
    <>
      <h1 className="scramble" style={{ marginTop: 40 }}>OS LOCKED_</h1>
      <div className="empty" style={{ marginTop: 16 }}>
        you're in public (visitor) view. flip back into studio mode to open the OS.
        <div style={{ marginTop: 14 }}>
          <button type="button" className="btn" onClick={() => s.toggleMode()}>◐ ENTER STUDIO MODE</button>
        </div>
      </div>
    </>
  );
}

/* page weight badge, shown in the footer while low-power mode is on */
function LowPowerBadge() {
  const [kb, setKb] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setKb(pageWeightKB()), 600);
    return () => clearTimeout(t);
  }, []);
  return <span className="weightchip" title="bytes this page actually moved (Performance API) · carbon est. via the sustainable web design model">PAGE ≈ {fmtWeight(kb || 1)}</span>;
}
