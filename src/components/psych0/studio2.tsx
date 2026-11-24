'use client';
/* PSYCH0 — studio annex pages: post doctor, read-later clipper, import engine,
 * zine compiler. All studio-only (routed from App with the gate check). */
import { useEffect, useMemo, useState } from 'react';
import { usePsych0, newPost, slugify, uid, dl } from './store';
import { TitleBar, Btn, fmtDate } from './ui';
import { lintAll, healthScore, collectImageUrls, type LintIssue } from '@/lib/lint';
import { autoImport, type ImportedDraft } from '@/lib/importer';
import { parseFeed, type FeedItem } from '@/lib/feeds';
import { buildZineHtml } from '@/lib/zine';
import { uniqueSlug, type Post, type FeedSrc } from '@/lib/types';

const READ_KEY = 'psych0.feeds.read';
const readSet = (): Set<string> => { try { return new Set(JSON.parse(localStorage.getItem(READ_KEY) || '[]')); } catch { return new Set(); } };

/* ================= post doctor ================= */

const LEVEL_ICON: Record<string, string> = { err: '⛔', warn: '⚠', info: 'ℹ' };

export function DoctorView() {
  const s = usePsych0();
  const reports = useMemo(() => lintAll(s.posts), [s.posts]);
  const overall = healthScore(reports);
  const [imgScan, setImgScan] = useState<Record<string, boolean>>({});
  const [scanning, setScanning] = useState(false);
  const [cols, setCols] = useState<{ stage: boolean; loc: boolean } | null>(null);

  useEffect(() => {
    fetch('/api/health').then(r => r.json()).then(j => setCols(j.columns || null)).catch(() => {});
  }, []);

  const scanImages = async () => {
    setScanning(true);
    const urls = [...new Set(s.posts.flatMap(p => collectImageUrls(p)))].slice(0, 60);
    const out: Record<string, boolean> = {};
    await Promise.all(urls.map(u => new Promise<void>(res => {
      const img = new Image();
      const t = setTimeout(() => { out[u] = img.complete && img.naturalWidth > 0; res(); }, 6000);
      img.onload = () => { clearTimeout(t); out[u] = true; res(); };
      img.onerror = () => { clearTimeout(t); out[u] = false; res(); };
      img.src = u;
    })));
    setImgScan(out);
    setScanning(false);
    const dead = urls.filter(u => out[u] === false).length;
    s.toast('IMAGE SCAN DONE — ' + (dead ? dead + ' dead' : 'all alive'), dead ? 'warn' : 'ok');
  };

  const deadFor = (p: Post) => collectImageUrls(p).filter(u => imgScan[u] === false);
  const grade = overall >= 90 ? 'A' : overall >= 75 ? 'B' : overall >= 60 ? 'C' : 'D';

  return (
    <>
      <TitleBar title="POST DOCTOR_">
        <Btn mini onClick={scanImages}>{scanning ? '▮▮▮ SCANNING' : '⧗ RUN IMAGE SCAN'}</Btn>
      </TitleBar>

      <div className={'databanner ' + (overall >= 75 ? 'supabase' : 'local')}>
        <b>BLOG HEALTH {grade} · {overall}/100</b>
        <span> → {reports.filter(r => r.issues.some(i => i.level === 'err')).length} posts with hard errors, {reports.filter(r => r.issues.length).length} with notes.</span>
      </div>

      {cols && !cols.stage && (
        <div className="callout warn"><b className="ct">MIGRATION 2 MISSING</b>
          <p>the database lacks the <code>stage</code>/<code>fossil</code>/<code>loc</code> columns — garden states, fossils and pixel-map pins will not persist. paste <code>supabase/migrate-2.sql</code> into the Supabase SQL editor and run it (idempotent, takes 5 seconds).</p>
        </div>
      )}

      <div className="stack">
        {reports.map(r => {
          const dead = deadFor(r.post);
          const cls = r.score >= 90 ? 'st-SHIPPED' : r.score >= 70 ? 'sched' : 'draftchip';
          return (
            <div key={r.post.id} className="doctorcard">
              <a className="doctorhead" href={'#/edit/post/' + r.post.id}>
                <span className="lt">{r.post.title}</span>
                <span className="spacer" />
                {!r.post.published && <span className="chip draftchip">DRAFT</span>}
                <span className={'chip ' + cls}>{r.score}/100</span>
              </a>
              {!!r.issues.length || !!dead.length ? (
                <ul className="doctorissues">
                  {r.issues.map((i: LintIssue, k) => (
                    <li key={k} className={'li-' + i.level}>{LEVEL_ICON[i.level]} {i.msg}</li>
                  ))}
                  {dead.map(u => <li key={u} className="li-err">⛔ dead image: {u.slice(0, 70)}</li>)}
                </ul>
              ) : <div className="dim small" style={{ padding: '6px 12px' }}>clean bill of health ✓</div>}
            </div>
          );
        })}
        {!reports.length && <div className="empty">NO POSTS TO EXAMINE</div>}
      </div>
      <div className="helpline">checks: broken [[wikilinks]] · duplicate slugs · stuck schedules · ghost drafts · missing tags/covers/alt text · dead image URLs (via the scan) · too-short posts.</div>
    </>
  );
}

/* ================= read-later clipper ================= */

export function FeedsView() {
  const s = usePsych0();
  const feeds = s.site.feeds || [];
  const [items, setItems] = useState<FeedItem[]>([]);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [nu, setNu] = useState('');
  const [nl, setNl] = useState('');
  const [read, setRead] = useState<Set<string>>(() => readSet());
  const [clipped, setClipped] = useState<Set<string>>(() => new Set());

  const pull = async (f: FeedSrc): Promise<FeedItem[]> => {
    try {
      const r = await fetch('/api/fetch?url=' + encodeURIComponent(f.url));
      const j = await r.json() as { text?: string; message?: string };
      if (!r.ok) { setErr(f.label + ': ' + (j.message || 'fetch failed')); return []; }
      return parseFeed(j.text || '', f.label);
    } catch { setErr(f.label + ': fetch failed'); return []; }
  };

  const refreshAll = async () => {
    if (!feeds.length) { setErr('no subscriptions yet — add one below'); return; }
    setErr('');
    const out: FeedItem[] = [];
    for (const f of feeds) { setBusy(f.id); out.push(...await pull(f)); }
    setBusy('');
    out.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    setItems(out);
    s.toast('PULLED ' + out.length + ' ITEMS FROM ' + feeds.length + ' FEEDS', 'ok');
  };

  const addFeed = async () => {
    const url = nu.trim();
    if (!/^https?:\/\//i.test(url)) { s.toast('NEED A FEED URL (https://…)', 'warn'); return; }
    const label = (nl.trim() || (() => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return 'FEED'; } })()).toUpperCase();
    const f: FeedSrc = { id: 'f_' + uid(), url, label };
    await s.saveSite({ feeds: [...feeds, f] });
    setNu(''); setNl('');
    s.toast('SUBSCRIBED — pulling first batch…', 'ok');
    setBusy(f.id);
    const first = await pull(f);
    setBusy('');
    setItems(prev => [...first, ...prev].sort((a, b) => (b.date || '').localeCompare(a.date || '')));
  };

  const removeFeed = (f: FeedSrc) => s.confirm('UNSUBSCRIBE', 'Remove "' + f.label + '"? (clipped drafts stay)', async () => {
    await s.saveSite({ feeds: feeds.filter(x => x.id !== f.id) });
    setItems(prev => prev.filter(i => i.source !== f.label));
  });

  const clip = async (it: FeedItem) => {
    const base: Post = newPost();
    const p: Post = {
      ...base,
      id: 'p_cl' + uid(),
      title: it.title.slice(0, 120),
      slug: uniqueSlug(s.posts, slugify(it.title), 'p_cl' + uid()),
      tags: ['clip', slugify(it.source)].filter(Boolean),
      published: false,
      body: '[' + it.title + '](' + it.link + ')\n\n> ' + (it.summary || '(no summary — open the source)') +
        '\n\n*clipped from ' + it.source + (it.date ? ' · ' + it.date.slice(0, 10) : '') + '*\n',
    };
    await s.savePost(p);
    setClipped(prev => new Set(prev).add(it.id));
    s.toast('CLIPPED TO DRAFTS — find it in the studio', 'ok');
  };

  const markRead = (id: string) => {
    const next = new Set(read); next.add(id);
    setRead(next);
    try { localStorage.setItem(READ_KEY, JSON.stringify([...next])); } catch { /* private mode */ }
  };

  return (
    <>
      <TitleBar title="READ LATER_">
        <Btn mini onClick={refreshAll}>{busy ? '▮▮▮ PULLING' : '⟳ REFRESH ALL'}</Btn>
      </TitleBar>
      <p className="dim small">your subscriptions, pulled through the server (no CORS pain). clip anything straight into the drafts.</p>

      <div className="btnrow" style={{ marginTop: 10 }}>
        <input value={nu} placeholder="feed url — https://site.example/rss.xml" onChange={e => setNu(e.target.value)} style={{ maxWidth: 380 }} />
        <input value={nl} placeholder="label (optional)" maxLength={24} onChange={e => setNl(e.target.value)} style={{ maxWidth: 160 }} />
        <button type="button" className="btn" onClick={addFeed}>＋ SUBSCRIBE</button>
      </div>
      {!!feeds.length && (
        <div className="loglines" style={{ marginTop: 8 }}>
          {feeds.map(f => (
            <div key={f.id} className="logline">
              <span className="ld">RSS</span>
              <span className="lt">{f.label} — <span className="dim">{f.url}</span></span>
              <span className="spacer" />
              <button type="button" className="btn mini" disabled={busy === f.id} onClick={async () => { setBusy(f.id); const first = await pull(f); setBusy(''); setItems(prev => [...first, ...prev].sort((a, b) => (b.date || '').localeCompare(a.date || ''))); }}>{busy === f.id ? '▮▮▮' : '⟳ PULL'}</button>
              <button type="button" className="btn mini danger" onClick={() => removeFeed(f)}>✕</button>
            </div>
          ))}
        </div>
      )}
      {err && <div className="callout warn"><span className="ct">FEED</span>{err}</div>}

      <div className="sechead">INBOX<span className="cnt">{items.length} items · {items.filter(i => !read.has(i.id)).length} unread</span></div>
      <div className="loglines">
        {items.map(it => (
          <div key={it.id} className={'logline feedline' + (read.has(it.id) ? ' read' : '')}>
            <span className="ld">{it.date ? it.date.slice(5, 10) : '· ·'}</span>
            <span className="lt"><b>{it.title}</b><br /><span className="dim small">{it.source} — {it.summary.slice(0, 110)}</span></span>
            <span className="spacer" />
            {clipped.has(it.id) && <span className="chip st-SHIPPED">CLIPPED</span>}
            <button type="button" className="btn mini" onClick={() => clip(it)}>✎ CLIP</button>
            <a className="btn mini" href={it.link} target="_blank" rel="noopener noreferrer" onClick={() => markRead(it.id)}>OPEN ↗</a>
            <button type="button" className="btn mini" onClick={() => markRead(it.id)}>{read.has(it.id) ? 'READ' : 'MARK'}</button>
          </div>
        ))}
        {!items.length && <div className="empty">nothing pulled yet — subscribe to a feed and hit REFRESH ALL.</div>}
      </div>
    </>
  );
}

/* ================= import engine ================= */

export function ImportView() {
  const s = usePsych0();
  const [queue, setQueue] = useState<ImportedDraft[]>([]);
  const [paste, setPaste] = useState('');
  const [busy, setBusy] = useState(false);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).slice(0, 20).forEach(f => {
      const r = new FileReader();
      r.onload = () => {
        const drafts = autoImport(String(r.result || ''), f.name);
        setQueue(q => [...q, ...drafts]);
        s.toast(f.name + ' → ' + drafts.length + ' post(s)', 'ok');
      };
      r.readAsText(f);
    });
  };

  const parsePaste = () => {
    const drafts = autoImport(paste, 'pasted text');
    if (!drafts.length) { s.toast('NOTHING I CAN PARSE — is it markdown, html or a WP export?', 'warn'); return; }
    setQueue(q => [...q, ...drafts]);
    setPaste('');
    s.toast('PARSED ' + drafts.length + ' POST(S)', 'ok');
  };

  const doImport = async () => {
    setBusy(true);
    const used = new Set(s.posts.map(p => p.slug));
    let n = 0;
    for (const d of queue) {
      let slug = slugify(d.title), k = 2;
      while (used.has(slug)) { slug = slugify(d.title) + '-' + k; k++; }
      used.add(slug);
      const p: Post = {
        id: d.id, slug, title: d.title, date: d.date, tags: d.tags, cover: d.cover,
        pinned: false, published: d.published, body: d.body, publish_at: null, stage: 'seed',
      };
      try { await s.savePost(p); n++; } catch { /* keep going */ }
    }
    setBusy(false);
    setQueue([]);
    s.toast('IMPORTED ' + n + ' POST(S) — review them in the studio', 'ok');
    window.location.hash = '#/studio';
  };

  return (
    <>
      <TitleBar title="IMPORT ENGINE_">
        <label className="btn mini" style={{ cursor: 'pointer' }}>
          ⤒ FILES<input type="file" hidden multiple accept=".md,.markdown,.txt,.html,.htm,.xml"
            onChange={e => { addFiles(e.target.files); e.currentTarget.value = ''; }} />
        </label>
      </TitleBar>
      <p className="dim small">bring your old blog home. understood: markdown files (with optional <code>---</code> front-matter), pasted or saved HTML pages, and WordPress WXR exports (.xml). everything lands as reviewable drafts.</p>

      <Field label="PASTE MARKDOWN / HTML / WXR XML">
        <textarea rows={6} value={paste} onChange={e => setPaste(e.target.value)} spellCheck={false}
          placeholder={'---\ntitle: my old post\ndate: 2024-03-01\ntags: notes, web\n---\n\nbody text here…'} />
      </Field>
      <div className="btnrow"><button type="button" className="btn" onClick={parsePaste}>⌁ PARSE TEXT</button></div>

      <div
        className="dropzone"
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); addFiles(e.dataTransfer?.files || null); }}
        onClick={() => document.getElementById('impfile')?.click()}
      >
        ⇩ DROP .MD / .HTML / .XML FILES HERE (click to browse)
      </div>
      <input id="impfile" type="file" hidden multiple accept=".md,.markdown,.txt,.html,.htm,.xml"
        onChange={e => { addFiles(e.target.files); e.currentTarget.value = ''; }} />

      <div className="sechead">REVIEW QUEUE<span className="cnt">{queue.length} waiting</span></div>
      <div className="loglines">
        {queue.map(d => (
          <div key={d.id} className="logline">
            <span className="ld">{d.date}</span>
            <span className="lt">{d.title}<br /><span className="dim small">{d.source} · {d.words} words · {d.tags.map(t => '#' + t).join(' ')}</span></span>
            <span className="spacer" />
            <button type="button" className="btn mini" onClick={() => setQueue(q => q.map(x => x.id === d.id ? { ...x, published: !x.published } : x))}>{d.published ? '● LIVE' : 'DRAFT'}</button>
            <button type="button" className="btn mini danger" onClick={() => setQueue(q => q.filter(x => x.id !== d.id))}>✕</button>
          </div>
        ))}
        {!queue.length && <div className="empty">queue empty — drop files or paste text above.</div>}
      </div>
      {!!queue.length && (
        <div className="btnrow" style={{ marginTop: 10 }}>
          <button type="button" className="btn" disabled={busy} onClick={doImport}>{busy ? '▮▮▮ IMPORTING' : '⬆ IMPORT ' + queue.length + ' POST(S)'}</button>
        </div>
      )}
    </>
  );
}

/* field helper duplicated from studio.tsx (same shape) */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="fieldwrap"><span className="flabel">{label}</span>{children}</label>;
}

/* ================= zine compiler ================= */

export function ZineView() {
  const s = usePsych0();
  const years = useMemo(() =>
    [...new Set(s.posts.map(p => (p.date || '').slice(0, 4)).filter(Boolean))].sort().reverse(), [s.posts]);
  const [year, setYear] = useState(years[0] || String(new Date().getFullYear()));
  const [inclDrafts, setInclDrafts] = useState(false);
  const now = new Date().toISOString();

  const posts = s.posts.filter(p =>
    (p.date || '').startsWith(year) &&
    (inclDrafts || (p.published && !(p.publish_at && p.publish_at > now))));

  const compile = () => {
    if (!posts.length) { s.toast('NO POSTS IN ' + year + ' FOR THIS SELECTION', 'warn'); return; }
    const html = buildZineHtml({
      siteName: s.site.name || 'PSYCH0', year, vol: '1',
      posts: posts.map(p => ({ title: p.title, date: p.date, tags: p.tags || [], body: p.body })),
    });
    const w = window.open('', '_blank');
    if (!w) { s.toast('POPUP BLOCKED — allow popups, then compile again', 'warn'); return; }
    w.document.write(html);
    w.document.close();
    s.toast('ZINE COMPILED — PRINT → SAVE AS PDF and you are a publisher', 'ok');
  };

  const dlMd = () => {
    const md = '# ' + (s.site.name || 'PSYCH0') + ' ZINE — ' + year + '\n\n' +
      posts.map(p => '# ' + p.title + '\n\n*' + p.date + '*\n\n' + p.body + '\n\n---\n\n').join('');
    dl((s.site.name || 'psych0') + '-zine-' + year + '.md', md, 'text/markdown');
  };

  return (
    <>
      <TitleBar title="ZINE FACTORY_">
        <Btn mini onClick={compile}>⧉ COMPILE + PRINT</Btn>
        <Btn mini onClick={dlMd}>⤓ .MD</Btn>
      </TitleBar>
      <p className="dim small">one year of posts → one printable zine: cover, table of contents, every entry on its own page. hit COMPILE, print to PDF, staple if you feel ambitious.</p>
      <div className="btnrow">
        <label className="fieldwrap"><span className="flabel">YEAR</span>
          <select value={year} onChange={e => setYear(e.target.value)}>
            {(years.length ? years : [year]).map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
        <label className="checkrow" style={{ marginTop: 18 }}>
          <input type="checkbox" checked={inclDrafts} onChange={e => setInclDrafts(e.target.checked)} /> include drafts
        </label>
        <span className="chip">{posts.length} entries</span>
      </div>
      <div className="loglines" style={{ marginTop: 10 }}>
        {posts.map(p => (
          <div key={p.id} className="logline">
            <span className="ld">{fmtDate(p.date)}</span>
            <span className="lt">{p.title}</span>
            <span className="spacer" />
            {!p.published && <span className="chip draftchip">DRAFT</span>}
          </div>
        ))}
        {!posts.length && <div className="empty">nothing here for {year}{inclDrafts ? '' : ' (published only)'}.</div>}
      </div>
    </>
  );
}
