'use client';
/* PSYCH0 — power features: dashboard, media library, mail/guestbook, graph,
 * revision history, AI bar, tokens, plugins, badge maker, 404 terminal,
 * writing heatmap, on-this-day, full-text search, time machine, pixel map.
 * Wired to the store; every server touch goes through /api/*. */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { usePsych0, dl, readActivity } from './store';
import { useVault } from './vault';
import { fmtDate, Btn, TitleBar, MD } from './ui';
import { uid, slugify, type PluginCmd, type Post, type Revision, type MediaItem, type Message } from '@/lib/types';
import { mapRows, MAP_W, MAP_H, parseLoc, locLabel } from '@/lib/worldmap';
import type { FeedItem } from '@/lib/feeds';

/* ================= dashboard ================= */

export function Dashboard() {
  const s = usePsych0();
  const st = s.stats;
  const scheduled = s.posts.filter(p => p.publish_at && p.publish_at > new Date().toISOString())
    .sort((a, b) => (a.publish_at || '').localeCompare(b.publish_at || ''));
  const unread = s.messages.filter(m => !m.read).length;
  const topPaths = Object.entries(s.paths).sort((a, b) => b[1] - a[1]).slice(0, 6);

  return (
    <>
      <TitleBar title="DASHBOARD_">
        <Btn onClick={() => s.loadExtras()} mini>⟳ REFRESH</Btn>
      </TitleBar>

      <div className="dashgrid">
        <div className="dashstat"><b>{st ? st.visits.toLocaleString() : '—'}</b><span>VISITS</span></div>
        <div className="dashstat"><b>{st ? String(st.posts).padStart(2, '0') : '—'}</b><span>POSTS</span></div>
        <div className="dashstat"><b>{st ? String(st.projects).padStart(2, '0') : '—'}</b><span>PROJECTS</span></div>
        <div className="dashstat"><b>{st ? String(st.embeds).padStart(2, '0') : '—'}</b><span>EMBEDS</span></div>
        <div className="dashstat"><b>{st ? String(st.guestbook).padStart(2, '0') : '—'}</b><span>MAILS</span></div>
        <div className="dashstat warn"><b>{String(unread).padStart(2, '0')}</b><span>UNREAD</span></div>
      </div>

      <div className="btnrow">
        <Btn href="#/edit/new/post">✎ NEW POST</Btn>
        <Btn href="#/edit/new/project">✎ NEW PROJECT</Btn>
        <Btn onClick={() => s.exportJson()}>⤓ BACKUP JSON</Btn>
        <Btn href="#/doctor">✚ DOCTOR</Btn>
        <Btn href="#/feeds">⌁ FEEDS</Btn>
        <Btn href="#/import">⤒ IMPORT</Btn>
        <Btn href="#/zine">⧉ ZINE</Btn>
        <Btn href="#/media">▤ MEDIA</Btn>
        <Btn href="#/mail">✉ INBOX{unread ? ` (${unread})` : ''}</Btn>
        <Btn href="#/graph">◍ GRAPH</Btn>
        <Btn href="#/settings">⚙ SETTINGS</Btn>
      </div>

      {scheduled.length > 0 && (
        <>
          <div className="sechead">SCHEDULED / TIME CAPSULES<span className="cnt">{scheduled.length} waiting</span></div>
          <div className="loglines">
            {scheduled.map(p => (
              <div key={p.id} className="logline">
                <span className="ld">{p.publish_at!.replace('T', ' ').slice(0, 16)}</span>
                <span className="lt">{p.title}</span>
                <span className="spacer" />
                <span className="chip sched">⏱ SCHEDULED</span>
                <a className="btn mini" href={'#/edit/post/' + p.id}>EDIT</a>
              </div>
            ))}
          </div>
        </>
      )}

      {topPaths.length > 0 && (
        <>
          <div className="sechead">MOST VISITED<span className="cnt">this deployment</span></div>
          <div className="loglines">
            {topPaths.map(([path, n]) => (
              <div key={path} className="logline">
                <span className="ld">{String(n).padStart(4, ' ')}×</span>
                <span className="lt">{path}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <Heatmap />
      <OnThisDay />

      <div className="sechead">QUICK LINKS</div>
      <div className="tiles">
        <a className="tile" href="/feed.xml" target="_blank" rel="noopener"><b>⚡</b><span>RSS FEED</span></a>
        <a className="tile" href="/sitemap.xml" target="_blank" rel="noopener"><b>☰</b><span>SITEMAP</span></a>
        <a className="tile" href={'/api/og?title=' + encodeURIComponent(s.site.logo || 'PSYCH0')} target="_blank" rel="noopener"><b>◈</b><span>OG CARD</span></a>
        <a className="tile" href="/api/badge?text=PSYCH0" target="_blank" rel="noopener"><b>▤</b><span>BADGE</span></a>
        <a className="tile" href="/manifest.webmanifest" target="_blank" rel="noopener"><b>▣</b><span>PWA APP</span></a>
        <a className="tile" href="#/colophon"><b>✎</b><span>COLOPHON</span></a>
      </div>
    </>
  );
}

/* ================= writing heatmap ================= */

function Heatmap() {
  const s = usePsych0();
  const counts = useMemo(() => {
    const c: Record<string, number> = { ...readActivity() };
    for (const p of s.posts) c[p.date] = (c[p.date] || 0) + 1;
    return c;
  }, [s.posts, s.stats]);

  const days: { d: string; n: number }[] = [];
  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - 182);
  while (start.getDay() !== 0) start.setDate(start.getDate() - 1); // align weeks on Sunday
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const iso = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    days.push({ d: iso, n: counts[iso] || 0 });
  }
  const level = (n: number) => n === 0 ? 0 : n < 2 ? 1 : n < 4 ? 2 : n < 7 ? 3 : 4;

  // streaks over all active days
  const active = Object.keys(counts).filter(k => counts[k] > 0).sort();
  const dayMs = 86400000;
  const toN = (d: string) => Math.floor(new Date(d + 'T12:00:00Z').getTime() / dayMs);
  let longest = 0, run = 0;
  for (let i = 0; i < active.length; i++) {
    run = (i > 0 && toN(active[i]) === toN(active[i - 1]) + 1) ? run + 1 : 1;
    longest = Math.max(longest, run);
  }
  let cur = 0;
  const todayISO = end.getFullYear() + '-' + String(end.getMonth() + 1).padStart(2, '0') + '-' + String(end.getDate()).padStart(2, '0');
  const todayN = toN(todayISO);
  for (let n = todayN; n > todayN - 366; n--) {
    const iso = new Date(n * dayMs).toISOString().slice(0, 10);
    if ((counts[iso] || 0) > 0) { cur++; continue; }
    if (n === todayN) continue; // today may simply not be written yet — grace day
    break;
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <>
      <div className="sechead">WRITING HEATMAP<span className="cnt">{total} save events</span></div>
      <div className="hmwrap">
        <div className="hmgrid" role="img" aria-label="writing heatmap, last 26 weeks">
          {days.map(d => (
            <div key={d.d} className={'hmcell hm' + level(d.n)} title={d.d + ' — ' + d.n + ' events'} />
          ))}
        </div>
        <div className="hmlegend dim small">
          <span>CURRENT STREAK <b className="acc">{cur}d</b></span>
          <span>LONGEST <b className="acc">{longest}d</b></span>
          <span>LESS <i className="hmcell hm0" /><i className="hmcell hm1" /><i className="hmcell hm2" /><i className="hmcell hm3" /><i className="hmcell hm4" /> MORE</span>
        </div>
      </div>
    </>
  );
}

/* ================= on this day ================= */

function OnThisDay() {
  const s = usePsych0();
  const today = new Date();
  const md = String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
  const hits = s.posts
    .filter(p => (p.date || '').slice(5) === md && p.date.slice(0, 4) !== String(today.getFullYear()))
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  if (!hits.length) return null;
  return (
    <>
      <div className="sechead">ON THIS DAY<span className="cnt">{md}</span></div>
      <div className="loglines">
        {hits.map(p => {
          const ago = today.getFullYear() - parseInt(p.date.slice(0, 4), 10);
          return (
            <a key={p.id} className="logline" href={'#/blog/' + p.slug}>
              <span className="ld">{ago}y ago</span>
              <span className="lt">{p.title}</span>
              <span className="spacer" />
              <span className="dim small">{p.date}</span>
            </a>
          );
        })}
      </div>
    </>
  );
}

/* ================= media library ================= */

export function MediaLib() {
  const s = usePsych0();
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const doUpload = async (files: FileList | File[]) => {
    const imgs = Array.from(files).filter(f => /^image\//.test(f.type));
    if (!imgs.length) { s.toast('IMAGES ONLY', 'warn'); return; }
    setBusy(true);
    for (const f of imgs.slice(0, 8)) await s.uploadMedia(f);
    setBusy(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDrag(false);
    if (e.dataTransfer?.files?.length) doUpload(e.dataTransfer.files);
  };

  // paste an image from the clipboard anywhere in this view
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (const it of items) if (it.kind === 'file' && /^image\//.test(it.type)) { const f = it.getAsFile(); if (f) files.push(f); }
      if (files.length) doUpload(files);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copy = (text: string, what: string) => {
    navigator.clipboard?.writeText(text).then(() => s.toast('COPIED ' + what, 'ok')).catch(() => s.toast(text.slice(0, 120)));
  };

  return (
    <>
      <TitleBar title="MEDIA LIBRARY_">
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={e => e.target.files && doUpload(e.target.files)} />
        <Btn onClick={() => fileRef.current?.click()} mini>＋ UPLOAD</Btn>
      </TitleBar>

      <div
        className={'dropzone' + (drag ? ' over' : '') + (busy ? ' busy' : '')}
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
      >
        {busy ? 'UPLOADING ▮▮▮…' : '⇩ DRAG · DROP · PASTE IMAGES HERE (click to browse) — stored in Supabase Storage'}
      </div>

      {!s.media.length && <div className="empty">no uploads yet. drag the first one in — it lands in your database + storage bucket, with a permanent URL.</div>}

      <div className="mediagrid">
        {s.media.map((m: MediaItem) => (
          <div key={m.id} className="mediacard">
            <img src={m.url} alt={m.path} loading="lazy" onClick={() => s.setLightbox(m.url)} />
            <div className="mediameta">
              <span className="small dim">{(m.size / 1024).toFixed(0)} KB</span>
              <span className="spacer" />
              <button type="button" className="btn mini" title="copy url" onClick={() => copy(m.url, 'URL')}>URL</button>
              <button type="button" className="btn mini" title="copy as markdown image" onClick={() => copy('@img ' + m.url, 'MARKDOWN')}>@IMG</button>
              <button type="button" className="btn mini" title="copy as cover-ready url" onClick={() => copy(m.url + ' | ' + m.path, 'URL+NOTE')}>＋|</button>
              <button type="button" className="btn mini danger" onClick={() => s.confirm('DELETE MEDIA', 'Remove ' + m.path + ' permanently?', () => s.removeMedia(m.id, m.path))}>✕</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ================= mail / guestbook ================= */

export function MailView() {
  const s = usePsych0();
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [body, setBody] = useState('');
  const [loc, setLoc] = useState('');
  const [busy, setBusy] = useState(false);
  const msgs = s.messages;
  const guestbook = msgs.filter(m => m.public);
  const inbox = msgs;
  const pins = guestbook.filter(m => m.loc);

  const send = async () => {
    if (!body.trim()) { s.toast('SAY SOMETHING FIRST', 'warn'); return; }
    setBusy(true);
    const ok = await s.sendMessage(name, contact, body, loc);
    setBusy(false);
    if (ok) { setBody(''); setContact(''); }
  };

  return (
    <>
      <TitleBar title="SIGNAL MAIL_">
        <span className="dim small">{s.mode === 'supabase' ? 'DATABASE-BACKED' : 'LOCAL MODE — needs Supabase'}</span>
      </TitleBar>

      {s.studio && s.mode === 'supabase' && (
        <>
          <div className="sechead">OWNER INBOX<span className="cnt">{inbox.filter(m => !m.read).length} unread</span></div>
          <div className="loglines">
            {inbox.map((m: Message) => (
              <div key={m.id} className={'logline' + (m.read ? '' : ' unread')}>
                <span className="ld">{fmtDate(m.created_at)}</span>
                <span className="lt">{m.name}{m.contact ? ' · ' + m.contact : ''}</span>
                <span className="spacer" />
                {!m.public && <span className="chip">PRIVATE</span>}
                <button type="button" className="btn mini" onClick={() => s.setMsgRead(m.id, !m.read)}>{m.read ? 'UNREAD' : 'READ'}</button>
                <button type="button" className="btn mini" onClick={() => s.setMsgPublic(m.id, !m.public)}>{m.public ? 'HIDE' : 'SHOW'}</button>
                <button type="button" className="btn mini danger" onClick={() => s.confirm('DELETE MAIL', 'Delete this message forever?', () => s.removeMessage(m.id))}>✕</button>
              </div>
            ))}
            {!inbox.length && <div className="empty">inbox empty — share the guestbook link and wait for signals.</div>}
          </div>
        </>
      )}

      <div className="sechead">LEAVE A SIGNAL<span className="cnt">public guestbook</span></div>
      <div className="mailform">
        <div className="pixelwrap">
          <div className="nh">▸ DROP A PIN (optional) {loc && <button type="button" className="btn mini" onClick={() => setLoc('')}>× CLEAR ({locLabel(loc)})</button>}</div>
          <PixelMap pins={loc ? [...pins, { loc }] : pins} pick={loc} onPick={setLoc} compact />
        </div>
        <div className="edgrid2">
          <label className="fieldwrap">NAME
            <input value={name} maxLength={60} placeholder="anon" onChange={e => setName(e.target.value)} />
          </label>
          <label className="fieldwrap">CONTACT (optional — email, @handle…)
            <input value={contact} maxLength={120} placeholder="how do i reach you back?" onChange={e => setContact(e.target.value)} />
          </label>
        </div>
        <label className="fieldwrap">SIGNAL
          <textarea value={body} maxLength={2000} rows={4} placeholder="transmission text… markdown works" onChange={e => setBody(e.target.value)} />
        </label>
        {/* honeypot — bots fill it, humans never see it */}
        <input tabIndex={-1} autoComplete="off" value="" onChange={() => {}} style={{ position: 'absolute', left: -9999 }} aria-hidden="true" name="website" />
        <div className="btnrow">
          <button type="button" className="btn" disabled={busy} onClick={send}>{busy ? 'TRANSMITTING ▮▮▮' : '⌁ TRANSMIT'}</button>
        </div>
      </div>

      {s.site.showGuestbook !== false && s.mode === 'supabase' && (
        <div className="loglines" style={{ marginTop: 18 }}>
          {guestbook.map((m: Message) => (
            <div key={m.id} className={'logline gbline' + (m.read ? '' : ' unread')}>
              <span className="ld">{fmtDate(m.created_at)}</span>
              <span className="lt"><b className="acc">{m.name}</b> — {m.body.slice(0, 140)}</span>
              <span className="spacer" />
              {m.loc && <span className="chip mapchip" title={locLabel(m.loc)}>📍</span>}
            </div>
          ))}
          {!guestbook.length && <div className="empty">the airwaves are quiet. be the first signal.</div>}
        </div>
      )}
      {s.mode !== 'supabase' && <div className="empty">guestbook is database-backed — connect Supabase (SETTINGS → DATA) to go live.</div>}
    </>
  );
}

/* ================= graph view ================= */

export function GraphView() {
  const s = usePsych0();
  const posts = s.visiblePosts();

  const edges: [string, string][] = [];
  const outCount: Record<string, number> = {};
  const inCount: Record<string, number> = {};
  posts.forEach(p => {
    const targets = [...new Set((p.body.match(/\[\[([a-z0-9\u00c0-\u024f-]+)\]\]/gi) || [])
      .map(w => w.slice(2, -2).toLowerCase()))];
    targets.forEach(tSlug => {
      const target = posts.find(x => x.slug === tSlug);
      if (target && target.id !== p.id) {
        edges.push([p.id, target.id]);
        outCount[p.id] = (outCount[p.id] || 0) + 1;
        inCount[target.id] = (inCount[target.id] || 0) + 1;
      }
    });
  });

  const W = 760, H = 420, R = Math.min(W, H) / 2 - 70;
  const pos: Record<string, { x: number; y: number }> = {};
  posts.forEach((p, i) => {
    const a = (i / Math.max(1, posts.length)) * Math.PI * 2 - Math.PI / 2;
    pos[p.id] = { x: W / 2 + R * Math.cos(a), y: H / 2 + R * Math.sin(a) };
  });

  const orphans = posts.filter(p => !outCount[p.id] && !inCount[p.id]);
  const linked = posts.length - orphans.length;

  return (
    <>
      <TitleBar title="DEN GRAPH_">
        <span className="dim small">{posts.length} posts · {edges.length} links · write <code>[[slug]]</code> in any post to connect</span>
      </TitleBar>

      {linked > 0 ? (
        <div className="graphwrap">
          <svg viewBox={`0 0 ${W} ${H}`} className="graph" role="img" aria-label="post link graph">
            {edges.map(([a, b], i) => (
              <line key={i} x1={pos[a]?.x} y1={pos[a]?.y} x2={pos[b]?.x} y2={pos[b]?.y}
                className="gedge" stroke="var(--acc2)" strokeOpacity="0.4" />
            ))}
            {posts.map(p => (
              <g key={p.id} className={'gnode' + (inCount[p.id] ? ' hub' : '')}
                onClick={() => { window.location.hash = '#/blog/' + p.slug; }}>
                <circle cx={pos[p.id]?.x} cy={pos[p.id]?.y} r={7 + Math.min(8, (inCount[p.id] || 0) * 2.5)}
                  fill={p.pinned ? 'var(--acc)' : 'var(--p0fg)'} />
                <text x={pos[p.id]?.x} y={(pos[p.id]?.y || 0) - 14} textAnchor="middle">{p.title.slice(0, 22)}</text>
              </g>
            ))}
          </svg>
        </div>
      ) : (
        <div className="empty">no links yet. open any post and write <code>[[another-post-slug]]</code> — wiki-links connect the den automatically.</div>
      )}

      {orphans.length > 0 && (
        <>
          <div className="sechead">ORPHANS<span className="cnt">not linked from anywhere</span></div>
          <div className="loglines">
            {orphans.map(p => (
              <a key={p.id} className="logline" href={'#/blog/' + p.slug}>
                <span className="ld">{fmtDate(p.date)}</span>
                <span className="lt">{p.title}</span>
              </a>
            ))}
          </div>
        </>
      )}
    </>
  );
}

/* ================= revision history (editors) ================= */

export function RevPanel({ entity, id }: { entity: string; id: string }) {
  const s = usePsych0();
  const [revs, setRevs] = useState<Revision[] | null>(null);
  const [open, setOpen] = useState(false);

  const load = async () => {
    const list = await s.listRevisions(entity, id);
    setRevs(list);
    setOpen(true);
  };

  if (!open) return <Btn mini onClick={() => (revs ? setOpen(true) : load())}>⏱ HISTORY{revs?.length ? ` (${revs.length})` : ''}</Btn>;

  const snapTitle = (r: Revision) => {
    const snap = r.snapshot as { title?: string; name?: string } | null;
    return String(snap?.title || snap?.name || 'version');
  };

  return (
    <div className="revpanel">
      <div className="btnrow">
        <Btn mini onClick={() => setOpen(false)}>▲ CLOSE HISTORY</Btn>
        <span className="dim small">last {revs?.length || 0} snapshots — every save takes one automatically</span>
      </div>
      {(revs || []).map(r => (
        <div key={r.id} className="logline">
          <span className="ld">{r.created_at.replace('T', ' ').slice(0, 16)}</span>
          <span className="lt">{snapTitle(r)}</span>
          <span className="spacer" />
          <button type="button" className="btn mini"
            onClick={() => s.confirm('RESTORE VERSION', 'Roll back to: ' + snapTitle(r) + '?', async () => { if (await s.restoreRevision(r.id)) { setOpen(false); window.location.hash = '#/studio'; } })}>
            ⟲ RESTORE
          </button>
        </div>
      ))}
      {!revs?.length && <div className="empty">no history yet — save once and a snapshot appears here.</div>}
    </div>
  );
}

/* ================= AI bar (editors) ================= */

export function AIBar({ text, apply, prepend }: { text: string; apply: (v: string) => void; prepend?: (v: string) => void }) {
  const s = usePsych0();
  const [busy, setBusy] = useState('');

  const run = async (task: string, label: string) => {
    setBusy(task);
    try {
      const out = await s.ai(task, text);
      if (!out) { s.toast('AI RETURNED NOTHING', 'warn'); return; }
      if (task === 'polish') apply(out);
      else if (task === 'tags') {
        const tags = out.split(/[,\n]/).map(t => t.trim().toLowerCase().replace(/[^a-z0-9-]/g, '')).filter(Boolean).slice(0, 6);
        apply('__TAGS__' + JSON.stringify(tags));
      } else if (task === 'summary' && prepend) prepend('> TL;DR — ' + out + '\n\n');
      else s.confirm('AI ' + label.toUpperCase(), out.slice(0, 900), () => {});
      s.toast('AI ▸ ' + label.toUpperCase() + ' DONE', 'ok');
    } catch (e) {
      s.toast((e as Error).message, 'warn');
    }
    setBusy('');
  };

  return (
    <div className="aibar">
      <span className="dim small">AI ▸</span>
      <button type="button" className="btn mini" disabled={!!busy} onClick={() => run('polish', 'polish')}>{busy === 'polish' ? '▮▮▮' : '✦ POLISH'}</button>
      <button type="button" className="btn mini" disabled={!!busy} onClick={() => run('tags', 'tags')}>{busy === 'tags' ? '▮▮▮' : '# TAGS'}</button>
      <button type="button" className="btn mini" disabled={!!busy} onClick={() => run('summary', 'summary')}>{busy === 'summary' ? '▮▮▮' : '≡ TL;DR'}</button>
      <button type="button" className="btn mini" disabled={!!busy} onClick={() => run('ideas', 'ideas')}>{busy === 'ideas' ? '▮▮▮' : '✧ IDEAS'}</button>
    </div>
  );
}

/* ================= settings sections ================= */

export function TokenManager() {
  const s = usePsych0();
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    const raw = await s.createToken(label || 'my token');
    setBusy(false);
    setLabel('');
    if (raw) {
      s.confirm('API TOKEN CREATED — COPY IT NOW', 'Raw token (shown ONCE, stored hashed):\n\n' + raw +
        '\n\nUse it:\n> curl -X POST ' + (typeof window !== 'undefined' ? window.location.origin : '') + '/api/hook -H "Authorization: Bearer ' + raw + '" -H "Content-Type: application/json" -d \'{"title":"FROM MY PHONE","body":"hello"}\'', () => {});
    }
  };

  return (
    <div className="setsec">
      <div className="seth">API TOKENS — POST FROM ANYTHING</div>
      <div className="dim small" style={{ marginBottom: 10 }}>
        personal tokens let scripts, iOS Shortcuts or any HTTP client create posts (drafts by default).
        endpoint: <code>POST /api/hook</code> with header <code>Authorization: Bearer &lt;token&gt;</code>.
      </div>
      <div className="btnrow">
        <input value={label} placeholder="token label — e.g. iphone shortcut" maxLength={60}
          onChange={e => setLabel(e.target.value)} style={{ maxWidth: 320 }} />
        <button type="button" className="btn" disabled={busy} onClick={create}>{busy ? '▮▮▮' : '＋ CREATE TOKEN'}</button>
      </div>
      <div className="loglines" style={{ marginTop: 10 }}>
        {s.tokens.map(t => (
          <div key={t.id} className="logline">
            <span className="ld">{fmtDate(t.created_at)}</span>
            <span className="lt">{t.label}</span>
            <span className="spacer" />
            <span className="chip">{t.last_used ? 'used ' + fmtDate(t.last_used) : 'never used'}</span>
            <button type="button" className="btn mini danger" onClick={() => s.confirm('REVOKE TOKEN', 'Revoke "' + t.label + '"? Clients using it stop working.', () => s.removeToken(t.id))}>REVOKE</button>
          </div>
        ))}
        {!s.tokens.length && <div className="empty">no tokens yet — create one and post to your den from anywhere.</div>}
      </div>
    </div>
  );
}

export function PluginEditor() {
  const s = usePsych0();
  const [txt, setTxt] = useState(() => JSON.stringify(s.site.plugins || [], null, 2));
  const [err, setErr] = useState('');

  const save = async () => {
    try {
      const plugins = JSON.parse(txt) as PluginCmd[];
      if (!Array.isArray(plugins)) throw new Error('must be an array');
      for (const p of plugins) {
        if (!p.cmd || !['goto', 'url', 'text'].includes(p.kind)) throw new Error('each plugin needs cmd + kind (goto|url|text) + value');
        p.cmd = slugify(p.cmd).toUpperCase().replace(/-/g, '');
        p.label = p.label || p.cmd;
      }
      await s.saveSite({ plugins });
      setErr('');
      setTxt(JSON.stringify(plugins, null, 2));
      s.toast('PLUGINS SAVED — available in CTRL+K', 'ok');
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <div className="setsec">
      <div className="seth">CONSOLE PLUGINS — YOUR OWN COMMANDS</div>
      <div className="dim small" style={{ marginBottom: 10 }}>
        JSON array. kind <code>goto</code> navigates, <code>url</code> opens a tab, <code>text</code> shows a note.
        they appear in CTRL+K as PLUGIN ▸ … and run as terminal commands too (<code>&gt; mycmd</code>).
      </div>
      <textarea className="csstxt" rows={6} spellCheck={false} value={txt} onChange={e => setTxt(e.target.value)} />
      {err && <div className="callout warn"><span className="ct">JSON ERROR</span>{err}</div>}
      <div className="btnrow"><button type="button" className="btn" onClick={save}>SAVE PLUGINS</button></div>
    </div>
  );
}

export function BadgeMaker() {
  const s = usePsych0();
  const [text, setText] = useState((s.site.logo || 'PSYCH0').slice(0, 12));
  const [fg, setFg] = useState(s.site.accent);
  const [bg, setBg] = useState('#0a0a0c');
  const src = '/api/badge?text=' + encodeURIComponent(text) + '&fg=' + encodeURIComponent(fg) + '&bg=' + encodeURIComponent(bg);
  const html = `<a href="${typeof window !== 'undefined' ? window.location.origin : ''}"><img src="${(typeof window !== 'undefined' ? window.location.origin : '') + src}" width="88" height="31" alt="${text}"></a>`;
  return (
    <div className="setsec">
      <div className="seth">88×31 BADGE MAKER — Y2K WEB RINGS</div>
      <div className="btnrow" style={{ alignItems: 'center' }}>
        <img src={src} alt="badge preview" width={88} height={31} style={{ imageRendering: 'pixelated' }} />
        <input value={text} maxLength={12} onChange={e => setText(e.target.value.toUpperCase())} style={{ maxWidth: 140 }} />
        <label className="small dim">FG <input type="color" value={fg} onChange={e => setFg(e.target.value)} /></label>
        <label className="small dim">BG <input type="color" value={bg} onChange={e => setBg(e.target.value)} /></label>
        <button type="button" className="btn mini" onClick={() => { navigator.clipboard?.writeText(html); s.toast('EMBED CODE COPIED', 'ok'); }}>COPY EMBED</button>
      </div>
      <div className="dim small"><code>{html.slice(0, 120)}…</code></div>
    </div>
  );
}

/* ================= 404 terminal ================= */

export function Term404() {
  const s = usePsych0();
  const [lines, setLines] = useState<string[]>([
    'PSYCH0 RESCUE SHELL v0.9',
    'route not found. you fell off the edge of the den.',
    'type "help" — or "open" to crawl back home.',
  ]);
  const [q, setQ] = useState('');
  const [target] = useState(() => 1 + Math.floor(Math.random() * 100));
  const [guesses, setGuesses] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => { boxRef.current?.scrollTo(0, boxRef.current.scrollHeight); }, [lines]);

  const run = () => {
    const cmd = q.trim().toLowerCase();
    if (!cmd) return;
    const push = (...ls: string[]) => setLines(ls2 => [...ls2, ...ls]);
    push('> ' + cmd);
    if (cmd === 'help') {
      push('help · open · whoami · ls · cat den.txt · guess <n> · storm · clear');
    } else if (cmd === 'open' || cmd === 'home') {
      window.location.hash = '#/';
    } else if (cmd === 'whoami') {
      push('a visitor, somewhere in the noise. session #' + Math.floor(Math.random() * 9000 + 1000) + '.');
    } else if (cmd === 'ls') {
      push('den.txt   posts/   projects/   lab/   exit.exe');
    } else if (cmd === 'cat den.txt' || cmd === 'cat den') {
      push('the den is hand-made. the den is a canvas, not a cage.', 'the missing page was never here anyway.');
    } else if (cmd.startsWith('guess')) {
      const n = parseInt(cmd.split(/\s+/)[1] || '', 10);
      if (isNaN(n)) push('guess what? a number 1-100: "guess 42"');
      else {
        const g = guesses + 1; setGuesses(g);
        if (n === target) push('★ ' + n + ' — CORRECT, in ' + g + ' tries. secret unlocked: try ↑↑↓↓←→←→BA anywhere on this site.');
        else push(n < target ? n + ' — too low.' : n + ' — too high.', '(try ' + g + ')');
      }
    } else if (cmd === 'storm') {
      s.stormOn(); push('storm summoned. hold onto your scanlines.');
    } else if (cmd === 'clear') {
      setLines([]);
      return;
    } else if (cmd === 'exit' || cmd === 'quit') {
      push('there is no exit. only INDEX.');
    } else {
      push('unknown: ' + cmd + ' — try help');
    }
    setQ('');
  };

  return (
    <div className="term404" ref={boxRef}>
      {lines.map((l, i) => <div key={i} className="t4line">{l}</div>)}
      <div className="t4input">
        <span className="acc">$&gt;</span>
        <input value={q} autoFocus spellCheck={false} placeholder="type help…"
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') run(); }} />
      </div>
    </div>
  );
}

/* ================= full-text search (press S anywhere) ================= */

interface Hit { kind: 'post' | 'project' | 'os'; slug: string; title: string; snippet: string; score: number; osPage?: string }

/* vault item → OS page for the search jump */
const OS_TARGET: Record<string, string> = {
  note: 'notes', journal: 'journal', task: 'tasks', event: 'calendar', bookmark: 'bookmarks',
  contact: 'people', expense: 'money', sub: 'money', recipe: 'recipes', idea: 'ideas',
  media: 'shelf', trip: 'travel', goal: 'goals', card: 'flashcards', secret: 'vault',
  capsule: 'journal', session: 'focus', habit: 'habits', persona: 'brain', template: 'notes',
};

export function SearchModal() {
  const s = usePsych0();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const items = useVault(st => st.items);

  useEffect(() => {
    const h = () => { setOpen(v => !v); setQ(''); setSel(0); useVault.getState().ensure().catch(() => {}); };
    window.addEventListener('p0search', h);
    return () => window.removeEventListener('p0search', h);
  }, []);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 0); }, [open]);

  if (!open) {
    return <button type="button" className="hbtn" aria-label="full-text search" title="full-text search — press S"
      onClick={() => { setOpen(true); setQ(''); setSel(0); }}>⌕</button>;
  }

  const needle = q.trim().toLowerCase();
  const hits: Hit[] = (() => {
    if (needle.length < 2) return [];
    const score = (hay: string): number => {
      const idx = hay.indexOf(needle);
      if (idx >= 0) return 100 - Math.min(30, idx);
      let j = 0;
      for (const c of needle) { const f = hay.indexOf(c, j); if (f < 0) return -1; j = f + 1; }
      return 40 - Math.min(20, j - needle.length);
    };
    const out: Hit[] = [];
    for (const p of s.visiblePosts()) {
      const hay = (p.title + '\n' + (p.tags || []).join(' ') + '\n' + p.body).toLowerCase();
      const sc = score(hay);
      if (sc < 0) continue;
      const where = hay.indexOf(needle);
      const start = Math.max(0, (where >= 0 ? where : hay.indexOf(needle[0])) - 40);
      out.push({ kind: 'post', slug: p.slug, title: p.title,
        snippet: (start > 0 ? '…' : '') + hay.slice(start, start + 140).replace(/\s+/g, ' ').trim() + '…', score: sc });
    }
    for (const pr of s.projects) {
      const hay = (pr.title + '\n' + (pr.stack || []).join(' ') + '\n' + pr.body).toLowerCase();
      const sc = score(hay) - 10; // posts outrank projects
      if (sc < 0) continue;
      const where = hay.indexOf(needle);
      const start = Math.max(0, (where >= 0 ? where : hay.indexOf(needle[0])) - 40);
      out.push({ kind: 'project', slug: pr.slug, title: pr.title,
        snippet: (start > 0 ? '…' : '') + hay.slice(start, start + 140).replace(/\s+/g, ' ').trim() + '…', score: sc });
    }
    // PSYCH://OS vault — private items, studio-ish contexts only
    if (s.studio) {
      for (const it of items) {
        if ((it.secure && it.cipher) || it.type === 'secret') continue; // encrypted never leaks into search snippets
        const hay = (it.title + '\n' + (it.tags || []).join(' ') + '\n' + it.body + '\n' + JSON.stringify(it.data || {})).toLowerCase();
        const sc = score(hay) - 4;
        if (sc < 0) continue;
        const where = hay.indexOf(needle);
        const start = Math.max(0, (where >= 0 ? where : hay.indexOf(needle[0])) - 40);
        out.push({ kind: 'os', slug: it.id, title: it.title || '(untitled ' + it.type + ')',
          snippet: (start > 0 ? '…' : '') + hay.slice(start, start + 120).replace(/\s+/g, ' ').trim() + '…', score: sc,
          osPage: OS_TARGET[it.type] || 'notes' });
      }
    }
    return out.sort((a, b) => b.score - a.score).slice(0, 14);
  })();
  const clamped = Math.min(sel, Math.max(0, hits.length - 1));

  const go = (h: Hit) => {
    setOpen(false);
    s.beep(990, .04);
    if (h.kind === 'post') window.location.hash = '#/blog/' + h.slug;
    else if (h.kind === 'project') window.location.hash = '#/projects/' + h.slug;
    else window.location.hash = '#/os/' + (h.osPage || 'notes');
  };

  return (
    <div id="palette" role="dialog" aria-label="full-text search" onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div className="pbox searchbox">
        <div className="phead">PSYCH0://SEARCH <span>— FULL TEXT · ESC CLOSE · ↑↓ PICK · ENTER OPEN</span></div>
        <input ref={inputRef} className="pinput" placeholder={'search the whole den for "' + needle + '"…'}
          value={q} spellCheck={false} autoComplete="off"
          onChange={e => { setQ(e.target.value); setSel(0); }}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setSel(Math.min(hits.length - 1, clamped + 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(Math.max(0, clamped - 1)); }
            else if (e.key === 'Enter') { e.preventDefault(); if (hits[clamped]) go(hits[clamped]); }
            else if (e.key === 'Escape') setOpen(false);
          }} />
        <div className="pres">
          {hits.map((h, i) => (
            <div key={h.kind + h.slug} className={'pitem' + (i === clamped ? ' sel' : '')} onMouseEnter={() => setSel(i)} onClick={() => go(h)}>
              <span className="pl">{h.kind === 'post' ? 'POST' : h.kind === 'project' ? 'PROJ' : 'OS'} ▸ {h.title}</span>
              <span className="hint">{h.snippet.slice(0, 60)}</span>
            </div>
          ))}
          {needle.length >= 2 && !hits.length && <div className="pitem"><span className="pl">NOTHING FOUND — THE DEN IS QUIET ON THAT</span></div>}
          {needle.length < 2 && <div className="pitem"><span className="pl">TYPE 2+ CHARACTERS — SEARCHES TITLES, TAGS, FULL BODIES</span></div>}
        </div>
      </div>
    </div>
  );
}

/* ================= time machine ================= */

export function TimeMachine() {
  const s = usePsych0();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const h = () => setOpen(v => !v);
    window.addEventListener('p0tm', h);
    return () => window.removeEventListener('p0tm', h);
  }, []);
  if (!open) return null;

  const dates = s.posts.map(p => p.date || '').filter(Boolean).sort();
  const today = new Date().toISOString().slice(0, 10);
  const min = dates[0] || '2020-01-01';
  const dayMs = 86400000;
  const toN = (d: string) => Math.floor(new Date(d + 'T12:00:00Z').getTime() / dayMs);
  const fromN = (n: number) => new Date(n * dayMs).toISOString().slice(0, 10);
  const val = s.tmDate ? toN(s.tmDate) : toN(today);
  const shown = s.visiblePosts().length;

  return (
    <div id="palette" role="dialog" aria-label="time machine" onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div className="pbox tmbox">
        <div className="phead">PSYCH0://TIME MACHINE <span>— SCRUB THE DEN BACK IN TIME</span></div>
        <div className="tmreadout">{s.tmDate ? 'VIEWING AS OF ' + s.tmDate : 'VIEWING TODAY — ' + today}</div>
        <input type="range" className="tmslider" min={toN(min)} max={toN(today)} value={val} step={1}
          aria-label="time machine date"
          onChange={e => s.setTmDate(fromN(parseInt(e.target.value, 10)))} />
        <div className="tmends dim small"><span>{min}</span><span>{today}</span></div>
        <div className="dim small">{shown} post{shown === 1 ? '' : 's'} existed by this date · projects and the graph obey too.</div>
        <div className="btnrow">
          <button type="button" className="btn mini" onClick={() => { s.setTmDate(null); setOpen(false); }}>⟲ EXIT TIME MACHINE</button>
          <button type="button" className="btn mini" onClick={() => setOpen(false)}>CLOSE</button>
        </div>
      </div>
    </div>
  );
}

/* ================= guestbook pixel map ================= */

export function PixelMap({ pins, pick, onPick, compact }: {
  pins: { loc?: string }[]; pick?: string; onPick?: (loc: string) => void; compact?: boolean;
}) {
  const cvRef = useRef<HTMLCanvasElement>(null);
  const rows = useMemo(() => mapRows(), []);

  useEffect(() => {
    const cv = cvRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const CELL = 9;
    const dpr = window.devicePixelRatio || 1;
    cv.width = MAP_W * CELL * dpr;
    cv.height = MAP_H * CELL * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, MAP_W * CELL, MAP_H * CELL);
    ctx.font = '9px monospace';
    ctx.textBaseline = 'top';
    const acc = (getComputedStyle(document.documentElement).getPropertyValue('--acc') || '#ff5c00').trim();
    const acc2 = (getComputedStyle(document.documentElement).getPropertyValue('--acc2') || '#00e0c8').trim();
    rows.forEach((line, r) => {
      for (let c = 0; c < MAP_W; c++) {
        const ch = line[c];
        ctx.fillStyle = ch === '#' ? 'rgba(128,128,128,0.55)' : 'rgba(255,255,255,0.05)';
        ctx.fillText(ch, c * CELL, r * CELL);
      }
    });
    ctx.fillStyle = acc;
    for (const p of pins) {
      const xy = parseLoc(p.loc || '');
      if (xy) ctx.fillText('◆', xy.c * CELL, xy.r * CELL);
    }
    if (pick) {
      const xy = parseLoc(pick);
      if (xy) { ctx.fillStyle = acc2; ctx.fillText('✦', xy.c * CELL, xy.r * CELL); }
    }
  }, [rows, pins, pick]);

  const click = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onPick) return;
    const cv = cvRef.current;
    if (!cv) return;
    const rect = cv.getBoundingClientRect();
    const c = Math.min(MAP_W - 1, Math.max(0, Math.floor((e.clientX - rect.left) / (rect.width / MAP_W))));
    const r = Math.min(MAP_H - 1, Math.max(0, Math.floor((e.clientY - rect.top) / (rect.height / MAP_H))));
    s_beep();
    onPick(c + ',' + r);
  };
  const s_beep = () => { try { usePsych0.getState().beep(760, .03); } catch { /* audio off */ } };

  return (
    <canvas ref={cvRef} onClick={click}
      className={'pixelmap' + (onPick ? ' pickable' : '') + (compact ? ' compact' : '')}
      aria-label="pixel world map of guestbook pins"
      title={onPick ? 'click anywhere to drop your pin' : 'guestbook pins'} />
  );
}
