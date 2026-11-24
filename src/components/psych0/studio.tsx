'use client';
/* PSYCH0 — studio: passcode gate, dashboard, editors (live preview + autosave), settings */
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePsych0, newPost, newProject, newEmbed, slugify, uniqueSlug, OVERLAY_KEY, type SaveState } from './store';
import { MD, TitleBar, Btn, fmtDate } from './ui';
import { AIBar, RevPanel, TokenManager, PluginEditor, BadgeMaker } from './power';
import { PRESETS } from '@/lib/presets';
import { FX_KEYS, suggestStage, STAGE_META, type Post, type Project, type Embed, type SiteData, type GardenStage, type Revision } from '@/lib/types';

/* ================= login ================= */

export function StudioLogin() {
  const s = usePsych0();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <>
      <TitleBar title="OS ACCESS_" />
      <div className="logincard">
        <div className="nh">▸ OWNER GATE</div>
        <p className="dim small">this is the door to PSYCH://OS — publish, settings, mail, the brain, everything. visitors never see this.</p>
        <form onSubmit={async e => { e.preventDefault(); setBusy(true); const ok = await s.login(code); setBusy(false); if (ok) window.location.hash = '#/os'; }}>
          <input type="password" aria-label="studio passcode" placeholder="passcode…" value={code}
            onChange={e => setCode(e.target.value)} autoFocus />
          <button className="btn" type="submit" disabled={busy}>{busy ? 'CHECKING…' : 'ENTER STUDIO →'}</button>
        </form>
        {s.passcodeDefault && <div className="callout note" style={{ marginTop: 12 }}><b className="ct">DEMO PASSCODE</b><p>this deployment uses the default passcode <code>psych0</code>. set <code>STUDIO_PASSCODE</code> in your env to lock it down with your own.</p></div>}
        {s.mode === 'local' && <div className="callout warn" style={{ marginTop: 12 }}><b className="ct">LOCAL MODE</b><p>Supabase is not connected — edits live only in this browser. connect Supabase in SETTINGS → data to persist for everyone.</p></div>}
      </div>
    </>
  );
}

/* ================= dashboard ================= */

function useSaveStatus(): [SaveState, (s: SaveState) => void] {
  return useState<SaveState>('idle');
}

export function StudioDash({ os }: { os?: boolean } = {}) {
  const s = usePsych0();
  const pfx = os ? '#/os/publish' : '#/edit';
  return (
    <>
      <TitleBar title="STUDIO_">
        <Btn onClick={() => s.confirm('LOCK STUDIO?', 'You will need the passcode to edit again.', () => s.logout())}>⏻ LOCK</Btn>
      </TitleBar>

      <div className={'databanner ' + s.mode}>
        <b>{s.mode === 'supabase' ? '● SUPABASE CONNECTED — edits persist for everyone' : '● LOCAL MODE — edits live in this browser only'}</b>
        {s.mode === 'local' && <span> → {os ? 'OS ▸ SETTINGS' : 'SETTINGS → data'} has the 2-minute connection guide.</span>}
        {s.mode === 'supabase' && s.passcodeDefault && <span> → set STUDIO_PASSCODE in env to change the demo passcode.</span>}
      </div>

      <div className="btnrow" style={{ marginBottom: 6 }}>
        <Btn href={os ? '#/os/dash' : '#/dash'}>◈ DASHBOARD{typeof s.stats?.visits === 'number' ? ' · ' + s.stats.visits.toLocaleString() + ' VISITS' : ''}</Btn>
        <Btn href={os ? '#/os/media' : '#/media'}>▤ MEDIA LIBRARY</Btn>
        <Btn href={os ? '#/os/mail' : '#/mail'}>✉ INBOX</Btn>
        <Btn href={os ? '#/os/graph' : '#/graph'}>◍ GRAPH</Btn>
      </div>

      <div className="sechead">LOG ENTRIES<span className="cnt"><a href={pfx + '/new/post'}>+ NEW POST</a></span></div>
      <div className="stack">
        {s.sortedPosts().map(p => (
          <div key={p.id} className="rowline">
            <a className="logline" href={pfx + '/post/' + p.id}>
              <span className="ld">{fmtDate(p.date)}</span>
              <span className="lt">{p.title}</span>
              <span className="spacer" />
              {p.pinned && <span className="chip pin">◆</span>}
              <span className={'chip ' + (p.published ? 'st-SHIPPED' : 'draftchip')}>{p.published ? 'LIVE' : 'DRAFT'}</span>
            </a>
            <button type="button" className="xbtn" aria-label={'delete ' + p.title} onClick={() => s.confirm('DELETE POST?', p.title, () => s.deletePost(p.id).then(() => { if (window.location.hash.startsWith('#/edit') || window.location.hash.startsWith('#/os/publish')) window.location.hash = os ? '#/os/publish' : '#/studio'; }))}>✕</button>
          </div>
        ))}
        {!s.posts.length && <div className="empty">NO POSTS</div>}
      </div>

      <div className="sechead">PROJECTS<span className="cnt"><a href={pfx + '/new/project'}>+ NEW PROJECT</a></span></div>
      <div className="stack">
        {s.projects.map(pr => (
          <div key={pr.id} className="rowline">
            <a className="logline" href={pfx + '/project/' + pr.id}>
              <span className="ld">{pr.year}</span>
              <span className="lt">{pr.title}</span>
              <span className="spacer" />
              <span className={'chip st-' + (pr.status || 'IDLE')}>{pr.status}</span>
              {pr.featured && <span className="chip pin">◆</span>}
            </a>
            <button type="button" className="xbtn" aria-label={'delete ' + pr.title} onClick={() => s.confirm('DELETE PROJECT?', pr.title, () => s.deleteProject(pr.id).then(() => { if (window.location.hash.startsWith('#/edit') || window.location.hash.startsWith('#/os/publish')) window.location.hash = os ? '#/os/publish' : '#/studio'; }))}>✕</button>
          </div>
        ))}
        {!s.projects.length && <div className="empty">NO PROJECTS</div>}
      </div>

      <div className="sechead">LAB EMBEDS<span className="cnt"><a href={pfx + '/new/embed'}>+ NEW EMBED</a></span></div>
      <div className="stack">
        {s.embeds.map(e => (
          <div key={e.id} className="rowline">
            <a className="logline" href={pfx + '/embed/' + e.id}>
              <span className="ld">{e.h}px</span>
              <span className="lt">{e.title}</span>
              <span className="spacer" />
            </a>
            <button type="button" className="xbtn" aria-label={'delete ' + e.title} onClick={() => s.confirm('DELETE EMBED?', e.title, () => s.deleteEmbed(e.id))}>✕</button>
          </div>
        ))}
        {!s.embeds.length && <div className="empty">NO EMBEDS</div>}
      </div>

      <div className="rowwrap" style={{ marginTop: 18 }}>
        <Btn href={os ? '#/os/settings' : '#/settings'}>⚙ SETTINGS</Btn>
        <Btn onClick={() => s.exportJson()}>⬇ EXPORT JSON</Btn>
      </div>
    </>
  );
}

/* ================= editor plumbing ================= */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="fieldwrap"><span className="flabel">{label}</span>{children}</label>;
}
function Check({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return <label className="checkrow"><input type="checkbox" checked={on} onChange={e => onChange(e.target.checked)} /> {label}</label>;
}

function useAutosave<T>(draft: T | null, save: (v: T) => Promise<void>, deps: unknown[] = []) {
  const [status, setStatus] = useSaveStatus();
  const first = useRef(true);
  useEffect(() => {
    if (!draft) return;
    if (first.current) { first.current = false; return; }
    setStatus('saving');
    const t = setTimeout(async () => {
      try { await save(draft); setStatus('saved'); }
      catch { setStatus('error'); }
    }, 650);
    return () => clearTimeout(t);
  }, [draft, ...deps]);
  return status;
}

function SaveDot({ status }: { status: SaveState }) {
  return <span className={'savedot s-' + status}>
    {status === 'saving' ? '● SAVING' : status === 'saved' ? '● SAVED' : status === 'error' ? '● ERROR' : '○ AUTOSAVE ON'}
  </span>;
}

/* ---------- editor plumbing: conflict shield / scroll sync / focus mode ---------- */

export interface ConflictCtl { hit: boolean; markSave(): void; trackDraft(title: string, body: string): void; dismiss(): void; loadTheirs(): void }

/** conflict shield — watches for saves of the same entity made elsewhere
 * (another tab, another device). Our own saves are recognized by content
 * signature + timestamp, so only real external edits raise the flag. */
function useConflict(entity: string, id: string, kind: 'post' | 'project'): ConflictCtl {
  const s = usePsych0();
  const [hit, setHit] = useState(false);
  const started = useRef(Date.now());
  const lastSave = useRef(Date.now());
  const draftRef = useRef<{ title: string; body: string }>({ title: '', body: '' });

  const markSave = () => { lastSave.current = Date.now(); setHit(false); };
  const trackDraft = (title: string, body: string) => { draftRef.current = { title, body }; };

  useEffect(() => {
    if (!id || id.startsWith('untitled')) { /* new drafts can't conflict yet */ }
    const same = (a: { title?: string; body?: string }, b: { title: string; body: string }) =>
      String(a?.title || '') === b.title && String(a?.body || '') === b.body;

    let stop = false;
    const poll = window.setInterval(async () => {
      if (stop || s.mode !== 'supabase') return;
      try {
        const revs = await s.listRevisions(entity, id);
        const bad = revs.some(r =>
          new Date(r.created_at).getTime() > lastSave.current + 1500 &&
          new Date(r.created_at).getTime() > started.current &&
          !same((r.snapshot as { title?: string; body?: string }) || {}, draftRef.current));
        if (bad) setHit(true);
      } catch { /* shield is best-effort */ }
    }, 8000);

    // local mode: another tab writes the localStorage overlay → storage event
    const onStorage = (e: StorageEvent) => {
      if (stop || e.key !== OVERLAY_KEY || !e.newValue || s.mode !== 'local') return;
      try {
        const arr = (JSON.parse(e.newValue) as Record<string, unknown>)[kind === 'post' ? 'posts' : 'projects'] as { id: string; title: string; body: string }[] | undefined;
        const other = (arr || []).find(x => x.id === id);
        if (other && !same(other, draftRef.current)) setHit(true);
      } catch { /* ignore */ }
    };
    window.addEventListener('storage', onStorage);
    return () => { stop = true; window.clearInterval(poll); window.removeEventListener('storage', onStorage); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity, id, s.mode]);

  return {
    hit,
    markSave,
    trackDraft,
    dismiss() { setHit(false); s.toast('KEPT MINE — their version stays in ⏱ HISTORY', 'warn'); },
    async loadTheirs() {
      await s.refresh();
      setHit(false);
      s.toast('LOADED THEIR VERSION', 'ok');
    },
  };
}

/** proportional scroll sync between the markdown source and the live preview */
function useScrollSync() {
  const srcRef = useRef<HTMLTextAreaElement | null>(null);
  const prevRef = useRef<HTMLDivElement | null>(null);
  const lock = useRef(0);
  const sync = (from: 'src' | 'prev') => {
    const a = srcRef.current, b = prevRef.current;
    if (!a || !b || Date.now() < lock.current) return;
    lock.current = Date.now() + 60;
    if (from === 'src') {
      const k = a.scrollHeight > a.clientHeight ? (a.scrollTop / (a.scrollHeight - a.clientHeight)) : 0;
      b.scrollTop = k * Math.max(0, b.scrollHeight - b.clientHeight);
    } else {
      const k = b.scrollHeight > b.clientHeight ? (b.scrollTop / (b.scrollHeight - b.clientHeight)) : 0;
      a.scrollTop = k * Math.max(0, a.scrollHeight - a.clientHeight);
    }
  };
  return { srcRef, prevRef, sync };
}

/** typewriter scroll — keeps the caret floating at ~40% viewport height while typing */
function typewriterScroll(ta: HTMLTextAreaElement | null) {
  if (!ta) return;
  const div = document.createElement('div');
  const cs = getComputedStyle(ta);
  div.style.cssText = 'position:absolute;visibility:hidden;white-space:pre-wrap;word-wrap:break-word;' +
    'width:' + ta.clientWidth + 'px;font:' + cs.font + ';lineHeight:' + cs.lineHeight +
    ';padding:' + cs.padding + ';borderWidth:' + cs.borderWidth + ';boxSizing:' + cs.boxSizing + ';letterSpacing:' + cs.letterSpacing + ';';
  div.textContent = ta.value.slice(0, ta.selectionStart);
  document.body.appendChild(div);
  const caretTop = div.clientHeight;
  div.remove();
  ta.scrollTop = Math.max(0, caretTop - ta.clientHeight * 0.4);
}

function useLayoutPref() {
  const [layout, setLayout] = useState<'split' | 'stack'>(() => {
    if (typeof window === 'undefined') return 'split';
    return (localStorage.getItem('psych0.edlayout') as 'split' | 'stack') || 'split';
  });
  const toggle = () => setLayout(l => {
    const next = l === 'split' ? 'stack' : 'split';
    try { localStorage.setItem('psych0.edlayout', next); } catch { /* private mode */ }
    return next;
  });
  return { layout, toggle };
}

/* ================= post editor ================= */

export function EditPost({ id, os }: { id?: string; os?: boolean } = {}) {
  const s = usePsych0();
  const existing = id ? s.posts.find(x => x.id === id) : undefined;
  const [draft, setDraft] = useState<Post>(() => existing ? { ...existing } : newPost());
  const slugTouched = useRef(!!existing);
  const { srcRef, prevRef, sync } = useScrollSync();
  const { layout, toggle: toggleLayout } = useLayoutPref();
  const [focus, setFocus] = useState(false);
  const conflict = useConflict('post', draft.id, 'post');
  const words = useMemo(() => draft.body.trim() ? draft.body.trim().split(/\s+/).length : 0, [draft.body]);
  const mins = Math.max(1, Math.round(words / 200));
  const isNew = !existing;
  const stage = draft.stage || suggestStage(draft.date);
  const stageMeta = STAGE_META[stage];

  const set = (patch: Partial<Post>) => setDraft(d => {
    const next = { ...d, ...patch };
    if (patch.title !== undefined && !slugTouched.current) next.slug = uniqueSlug(s.posts, slugify(patch.title), d.id);
    return next;
  });

  // conflict shield: always knows the current title+body of THIS editor
  useEffect(() => { conflict.trackDraft(draft.title, draft.body); }, [draft.title, draft.body]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (v: Post) => { conflict.markSave(); await s.savePost(v); };
  const status = useAutosave(draft, save);

  const commit = async (redirect: boolean) => {
    try {
      await save({ ...draft, slug: uniqueSlug(s.posts, draft.slug, draft.id) });
      if (redirect) {
        if (os && isNew) window.location.hash = '#/os/publish';
        else window.location.hash = isNew ? '#/studio' : '#/blog/' + draft.slug;
      }
    } catch { /* toast already shown */ }
  };

  const applyAI = (out: string) => {
    if (out.startsWith('__TAGS__')) {
      try { set({ tags: JSON.parse(out.slice(8)) as string[] }); } catch { /* ignore */ }
      return;
    }
    set({ body: out });
  };
  const prependAI = (block: string) => set({ body: block + draft.body });

  // conflict shield → "load theirs" wires the fresh server copy into this editor
  const [theirVer, setTheirVer] = useState<Post | null>(null);
  useEffect(() => {
    if (!conflict.hit) return;
    const fresh = s.posts.find(x => x.id === draft.id);
    if (fresh && fresh.body !== draft.body) setTheirVer(fresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conflict.hit]);

  return (
    <>
      <div className={'edgrid edpost' + (layout === 'stack' ? ' stack' : '') + (focus ? ' focusmode' : '')}>
        <div className="edform">
          <div className="titlebar"><h1 className="scramble">{isNew ? 'NEW POST_' : 'EDIT POST_'}</h1>
            <span className="spacer" />
            <button type="button" className={'btn mini' + (focus ? ' on' : '')} onClick={() => setFocus(f => !f)}
              title="focus mode — dims everything that isn't this editor, typewriter-scrolls the caret">◌ FOCUS</button>
            <button type="button" className="btn mini" onClick={toggleLayout} title="split or stacked layout">{layout === 'split' ? '◫ SPLIT' : '⇕ STACK'}</button>
            <SaveDot status={status} />
          </div>

          {conflict.hit && (
            <div className="conflictb">
              <b className="ct">⚠ CONFLICT SHIELD</b>
              <p>this post was just saved from somewhere else (another tab or device). if you save now, you overwrite it — its current version is already kept in ⏱ HISTORY.</p>
              <div className="btnrow">
                <button type="button" className="btn mini" onClick={conflict.dismiss}>✎ KEEP MINE</button>
                <button type="button" className="btn mini" onClick={async () => { if (theirVer) { setDraft({ ...theirVer }); conflict.dismiss(); } else conflict.loadTheirs(); }}>⟲ LOAD THEIRS</button>
              </div>
            </div>
          )}

          <Field label="TITLE"><input value={draft.title} onChange={e => set({ title: e.target.value })} /></Field>
          <div className="row2">
            <Field label="SLUG"><input value={draft.slug} onChange={e => { slugTouched.current = true; set({ slug: slugify(e.target.value) }); }} /></Field>
            <Field label="DATE"><input type="date" value={draft.date} onChange={e => set({ date: e.target.value })} /></Field>
          </div>
          <div className="row2">
            <Field label="TAGS (comma)"><input value={(draft.tags || []).join(', ')} onChange={e => set({ tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })} /></Field>
            <Field label="PUBLISH AT (schedule / time capsule — optional)">
              <input type="datetime-local" value={draft.publish_at ? draft.publish_at.slice(0, 16) : ''}
                onChange={e => set({ publish_at: e.target.value ? new Date(e.target.value).toISOString() : null })} />
            </Field>
          </div>
          <div className="row2">
            <Field label="GARDEN STATE — how alive is this?">
              <select value={draft.stage || ''} onChange={e => set({ stage: (e.target.value || null) as GardenStage | null })}>
                <option value="">AUTO ({stageMeta.glyph} {stageMeta.label})</option>
                <option value="seed">🌱 SEED — just planted</option>
                <option value="budding">🌿 BUDDING — still growing</option>
                <option value="evergreen">🌲 EVERGREEN — tended and true</option>
              </select>
            </Field>
            <Field label="COVER URL"><input value={draft.cover} onChange={e => set({ cover: e.target.value })} placeholder="https://… or #/media to upload" /></Field>
          </div>
          <div className="rowwrap">
            <Check label="◆ pinned" on={!!draft.pinned} onChange={v => set({ pinned: v })} />
            <Check label="● published" on={!!draft.published} onChange={v => set({ published: v })} />
            <Check label="⛏ fossil — old thinking, kept for the record" on={!!draft.fossil} onChange={v => set({ fossil: v })} />
            {draft.publish_at && <span className="chip sched">⏱ GOES LIVE {draft.publish_at.slice(0, 16).replace('T', ' ')}</span>}
          </div>
          <div className="aibar-row">
            <AIBar text={draft.body} apply={applyAI} prepend={prependAI} />
            {!isNew && <RevPanel entity="post" id={draft.id} />}
          </div>
          <Field label={'BODY — MARKDOWN + DIRECTIVES (' + words + ' words · ' + mins + ' min)'}>
            <textarea ref={srcRef} className="mdsrc" rows={14} value={draft.body} spellCheck={false}
              onScroll={() => sync('src')}
              onKeyUp={e => { if (focus) typewriterScroll(e.currentTarget); }}
              onClick={e => { if (focus) typewriterScroll(e.currentTarget); }}
              onChange={e => set({ body: e.target.value })} />
          </Field>
          <div className="rowwrap">
            <Btn onClick={() => commit(false)}>💾 SAVE</Btn>
            <Btn onClick={() => commit(true)}>SAVE + {(draft.published ? 'VIEW' : 'BACK')} →</Btn>
            {!isNew && <Btn danger onClick={() => s.confirm('DELETE POST?', draft.title, () => s.deletePost(draft.id).then(() => { window.location.hash = os ? '#/os/publish' : '#/studio'; }))}>✕ DELETE</Btn>}
          </div>
          <div className="helpline">spells on their own line: @embed URL 480 · @youtube ID · @img URL | caption · @gallery u1 | u2 · :::tip TITLE … :::</div>
        </div>
        <div className="edprev" ref={prevRef} onScroll={() => sync('prev')}>
          <div className="nh">▸ LIVE PREVIEW</div>
          {draft.cover && <img className="cover" src={draft.cover} alt="" style={{ marginBottom: 8 }} />}
          <MD src={draft.body || '*nothing to preview yet*'} />
        </div>
      </div>
    </>
  );
}

/* ================= project editor ================= */

export function EditProject({ id, os }: { id?: string; os?: boolean } = {}) {
  const s = usePsych0();
  const existing = id ? s.projects.find(x => x.id === id) : undefined;
  const [draft, setDraft] = useState<Project>(() => existing ? { ...existing } : newProject());
  const slugTouched = useRef(!!existing);
  const { srcRef, prevRef, sync } = useScrollSync();
  const { layout, toggle: toggleLayout } = useLayoutPref();
  const status = useAutosave(draft, v => s.saveProject(v));
  const isNew = !existing;

  const set = (patch: Partial<Project>) => setDraft(d => {
    const next = { ...d, ...patch };
    if (patch.title !== undefined && !slugTouched.current) next.slug = uniqueSlug(s.projects, slugify(patch.title), d.id);
    return next;
  });

  const commit = async (redirect: boolean) => {
    try {
      await s.saveProject({ ...draft, slug: uniqueSlug(s.projects, draft.slug, draft.id) });
      if (redirect) {
        if (os && isNew) window.location.hash = '#/os/publish';
        else window.location.hash = isNew ? '#/studio' : '#/projects/' + draft.slug;
      }
    } catch { /* toast already shown */ }
  };

  return (
    <>
      <div className={'edgrid' + (layout === 'stack' ? ' stack' : '')}>
        <div className="edform">
          <div className="titlebar"><h1 className="scramble">{isNew ? 'NEW PROJECT_' : 'EDIT PROJECT_'}</h1>
            <span className="spacer" />
            <button type="button" className="btn mini" onClick={toggleLayout}>{layout === 'split' ? '◫ SPLIT' : '⇕ STACK'}</button>
            <SaveDot status={status} />
          </div>
          <Field label="TITLE"><input value={draft.title} onChange={e => set({ title: e.target.value })} /></Field>
          <div className="row2">
            <Field label="SLUG"><input value={draft.slug} onChange={e => { slugTouched.current = true; set({ slug: slugify(e.target.value) }); }} /></Field>
            <Field label="YEAR"><input value={draft.year} onChange={e => set({ year: e.target.value })} /></Field>
          </div>
          <div className="row2">
            <Field label="STATUS">
              <select value={draft.status} onChange={e => set({ status: e.target.value })}>
                {['WIP', 'ACTIVE', 'SHIPPED', 'IDLE', 'DEAD'].map(x => <option key={x} value={x}>{x}</option>)}
              </select>
            </Field>
            <Field label="ROLE"><input value={draft.role} onChange={e => set({ role: e.target.value })} /></Field>
          </div>
          <Field label="STACK (comma)"><input value={(draft.stack || []).join(', ')} onChange={e => set({ stack: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })} /></Field>
          <Field label="COVER URL"><input value={draft.cover} onChange={e => set({ cover: e.target.value })} /></Field>
          <Field label="LINKS — one per line: LABEL :: URL">
            <textarea rows={3} value={(draft.links || []).map(l => l.label + ' :: ' + l.url).join('\n')}
              onChange={e => set({ links: e.target.value.split('\n').filter(Boolean).map(line => { const [a, b] = line.split('::'); return { label: (a || 'LINK').trim(), url: (b || a || '').trim() }; }) })} />
          </Field>
          <div className="rowwrap"><Check label="◆ featured project" on={!!draft.featured} onChange={v => set({ featured: v })} /></div>
          <Field label="BODY — MARKDOWN"><textarea ref={srcRef} className="mdsrc" rows={12} value={draft.body}
            onScroll={() => sync('src')} onChange={e => set({ body: e.target.value })} spellCheck={false} /></Field>
          {!isNew && <div className="aibar-row"><RevPanel entity="project" id={draft.id} /></div>}
          <div className="rowwrap">
            <Btn onClick={() => commit(false)}>💾 SAVE</Btn>
            <Btn onClick={() => commit(true)}>SAVE + {(isNew ? 'BACK' : 'VIEW')} →</Btn>
            {!isNew && <Btn danger onClick={() => s.confirm('DELETE PROJECT?', draft.title, () => s.deleteProject(draft.id).then(() => { window.location.hash = os ? '#/os/publish' : '#/studio'; }))}>✕ DELETE</Btn>}
          </div>
        </div>
        <div className="edprev" ref={prevRef} onScroll={() => sync('prev')}>
          <div className="nh">▸ LIVE PREVIEW</div>
          {draft.cover && <img className="cover" src={draft.cover} alt="" style={{ marginBottom: 8 }} />}
          <MD src={draft.body || '*nothing to preview yet*'} />
        </div>
      </div>
    </>
  );
}

/* ================= embed editor ================= */

export function EditEmbed({ id, os }: { id?: string; os?: boolean } = {}) {
  const s = usePsych0();
  const existing = id ? s.embeds.find(x => x.id === id) : undefined;
  const [draft, setDraft] = useState<Embed>(() => existing ? { ...existing } : newEmbed());
  const status = useAutosave(draft, v => s.saveEmbed(v));
  const isNew = !existing;

  const commit = async (redirect: boolean) => {
    await s.saveEmbed(draft);
    if (redirect) window.location.hash = '#/lab';
  };

  return (
    <>
      <div className="titlebar"><h1 className="scramble">{isNew ? 'NEW EMBED_' : 'EDIT EMBED_'}</h1><span className="spacer" /><SaveDot status={status} /></div>
      <div className="edgrid">
        <div className="edform">
          <Field label="TITLE"><input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} /></Field>
          <Field label="URL"><input value={draft.url} onChange={e => setDraft({ ...draft, url: e.target.value })} placeholder="https://…" /></Field>
          <div className="row2">
            <Field label="NOTE"><input value={draft.note} onChange={e => setDraft({ ...draft, note: e.target.value })} /></Field>
            <Field label="HEIGHT (px)"><input type="number" value={draft.h} onChange={e => setDraft({ ...draft, h: parseInt(e.target.value || '420', 10) })} /></Field>
          </div>
          <div className="rowwrap">
            <Btn onClick={() => commit(false)}>💾 SAVE</Btn>
            <Btn onClick={() => commit(true)}>SAVE + VIEW LAB →</Btn>
            {!isNew && <Btn danger onClick={() => s.confirm('DELETE EMBED?', draft.title, () => s.deleteEmbed(draft.id).then(() => { window.location.hash = os ? '#/os/publish' : '#/studio'; }))}>✕ DELETE</Btn>}
          </div>
        </div>
        <div className="edprev">
          <div className="nh">▸ PREVIEW (click LOAD to run)</div>
          <iframe title="embed preview" src={draft.url} loading="lazy" style={{ width: '100%', height: draft.h || 420, border: '1px solid var(--acc)' }}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups" />
        </div>
      </div>
    </>
  );
}

/* ================= about editor ================= */

export function EditAbout({ os }: { os?: boolean } = {}) {
  const s = usePsych0();
  const [draft, setDraft] = useState(s.site.about);
  const status = useAutosave(draft, v => s.saveSite({ about: v }));
  const { srcRef, prevRef, sync } = useScrollSync();
  return (
    <>
      <div className="titlebar"><h1 className="scramble">EDIT ABOUT_</h1><span className="spacer" /><SaveDot status={status} /></div>
      <div className="edgrid">
        <div className="edform">
          <Field label="ABOUT — MARKDOWN"><textarea ref={srcRef} className="mdsrc" rows={16} value={draft}
            onScroll={() => sync('src')} onChange={e => setDraft(e.target.value)} spellCheck={false} /></Field>
          <div className="rowwrap"><Btn onClick={() => { window.location.hash = os ? '#/os/publish' : '#/about'; }}>DONE →</Btn></div>
        </div>
        <div className="edprev" ref={prevRef} onScroll={() => sync('prev')}><div className="nh">▸ LIVE PREVIEW</div><MD src={draft} /></div>
      </div>
    </>
  );
}

/* ================= settings ================= */

export function Settings() {
  const s = usePsych0();
  const site = s.site;
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<SiteData>) => setDraftLocal(patch);
  const [local, setLocal] = useState<Partial<SiteData>>({});
  const setDraftLocal = (patch: Partial<SiteData>) => setLocal(v => ({ ...v, ...patch }));
  const merged: SiteData = { ...site, ...local, fx: { ...site.fx, ...(local.fx || {}) } };

  return (
    <>
      <TitleBar title="SETTINGS_" />
      <div className="edgrid edgrid1">
        <div className="edform">
          <div className="sechead" style={{ marginTop: 0 }}>IDENTITY</div>
          <div className="row2">
            <Field label="SITE NAME"><input value={merged.name} onChange={e => set({ name: e.target.value })} /></Field>
            <Field label="LOGO TEXT"><input value={merged.logo} onChange={e => set({ logo: e.target.value })} /></Field>
          </div>
          <Field label="TAGLINE"><input value={merged.tagline} onChange={e => set({ tagline: e.target.value })} /></Field>
          <Field label="NOW FEED — MARKDOWN"><textarea rows={4} value={merged.now} onChange={e => set({ now: e.target.value })} spellCheck={false} /></Field>
          <Field label="SOCIAL LINKS — one per line: LABEL :: URL">
            <textarea rows={3} value={(merged.socials || []).map(x => x.label + ' :: ' + x.url).join('\n')}
              onChange={e => set({ socials: e.target.value.split('\n').filter(Boolean).map(line => { const [a, b] = line.split('::'); return { label: (a || 'LINK').trim(), url: (b || a || '').trim() }; }) })} />
          </Field>

          <div className="sechead">THEME</div>
          <div className="rowwrap">
            {PRESETS.map(p => (
              <button key={p.id} type="button" className={'chip' + (merged.preset === p.id ? ' on' : '')} onClick={() => s.setPreset(p.id)}>
                <span className="swatch" style={{ background: p.accent }} /> {p.label}
              </button>
            ))}
          </div>
          <div className="row2">
            <Field label="ACCENT"><input type="color" value={merged.accent} onChange={e => s.setCustomColors(e.target.value, merged.accent2)} /></Field>
            <Field label="ACCENT 2"><input type="color" value={merged.accent2} onChange={e => s.setCustomColors(merged.accent, e.target.value)} /></Field>
          </div>
          <Field label="CUSTOM CSS — injected live, the canvas is yours">
            <textarea rows={5} className="mono" value={merged.customCss} onChange={e => set({ customCss: e.target.value })} spellCheck={false} />
          </Field>

          <div className="sechead">EFFECTS</div>
          <div className="rowwrap">
            {FX_KEYS.map(k => (
              <Check key={k} label={k} on={!!merged.fx[k as keyof typeof merged.fx]} onChange={() => s.toggleFx(k)} />
            ))}
          </div>
          <div className="rowwrap"><Check label="show drafts in the blog (studio mode only)" on={!!merged.showDrafts} onChange={v => set({ showDrafts: v })} /></div>
          <div className="rowwrap"><Check label="public guestbook on the MAIL page" on={merged.showGuestbook !== false} onChange={v => set({ showGuestbook: v })} /></div>

          <div className="sechead">DATA</div>
          <div className={'databanner ' + s.mode}>
            <b>{s.mode === 'supabase' ? '● SUPABASE CONNECTED' : '● LOCAL MODE'}</b>
          </div>
          {s.mode === 'local' && (
            <div className="callout tip">
              <b className="ct">CONNECT SUPABASE — 2 MINUTES</b>
              <p>1. create a free project at <b>supabase.com</b> → 2. SQL editor → paste <code>supabase/schema.sql</code> from this repo → run → 3. project settings → API → copy the URL + <code>service_role</code> key → 4. add <code>SUPABASE_URL</code> + <code>SUPABASE_SERVICE_ROLE_KEY</code> to env (local <code>.env.local</code> or Vercel) → 5. restart. every edit now lives in your own Postgres.</p>
            </div>
          )}
          <div className="rowwrap">
            <Btn onClick={() => s.exportJson()}>⬇ EXPORT JSON</Btn>
            <Btn onClick={() => fileRef.current?.click()}>⬆ IMPORT JSON</Btn>
            {s.mode === 'local' && <Btn danger onClick={() => s.confirm('WIPE LOCAL EDITS?', 'Restores the demo content in this browser.', () => { localStorage.removeItem('psych0.data.v2'); s.refresh(); s.toast('LOCAL EDITS WIPED', 'warn'); })}>⟲ RESET DEMO</Btn>}
            <input ref={fileRef} type="file" accept="application/json" style={{ display: 'none' }} aria-label="import json"
              onChange={e => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = () => s.importJson(String(r.result)); r.readAsText(f); }} />
          </div>

          <div className="sechead">WEBRING — FRIEND SITES</div>
          <Field label="one per line: LABEL :: URL — prev/next ring lives on the ABOUT page">
            <textarea rows={3} value={(merged.webring || []).map(x => x.label + ' :: ' + x.url).join('\n')}
              onChange={e => set({ webring: e.target.value.split('\n').filter(Boolean).map(line => { const [a, b] = line.split('::'); return { label: (a || 'SITE').trim(), url: (b || a || '').trim() }; }) })} />
          </Field>

          <div className="sechead">PUBLISH WEBHOOKS — TALK TO THE OUTSIDE</div>
          <div className="dim small" style={{ marginBottom: 6 }}>
            when a post goes live (draft → published), every URL here gets
            <code> POST {'{'}event:&apos;post.published&apos;, slug, title, url{'}'}</code> JSON — Discord pings, Zapier, automation, whatever.
          </div>
          <Field label="one per line: LABEL :: URL">
            <textarea rows={3} value={(merged.hooks || []).map(x => x.label + ' :: ' + x.url).join('\n')}
              onChange={e => set({ hooks: e.target.value.split('\n').filter(Boolean).map(line => { const [a, b] = line.split('::'); return { label: (a || 'HOOK').trim(), url: (b || a || '').trim() }; }) })} />
          </Field>

          <div className="sechead">COLOPHON NOTES — HOW THE DEN IS MADE</div>
          <Field label="markdown — shown on #/colophon above the auto-generated stack report">
            <textarea rows={4} value={merged.colophon || ''} onChange={e => set({ colophon: e.target.value })} spellCheck={false} />
          </Field>

          <div className="rowwrap" style={{ marginTop: 16 }}>
            <Btn className="savebtn" onClick={() => s.saveSite(local).then(() => setLocal({}))}>💾 SAVE SETTINGS</Btn>
          </div>
          <div className="helpline">identity, theme, css and effects autosave when you hit SAVE SETTINGS; fx toggles + presets apply instantly.</div>

          <TokenManager />
          <PluginEditor />
          <BadgeMaker />
        </div>
      </div>
    </>
  );
}
