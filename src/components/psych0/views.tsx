'use client';
/* PSYCH0 — public views: home, blog, post, projects, project, lab, about, now, colophon, 404 */
import { useEffect, useState } from 'react';
import { usePsych0, dl } from './store';
import { MD, TitleBar, Btn, Row, Tile, StatusChip, ProjCard, FrameBox, fmtDate, excerpt, useTypewriter, useClock } from './ui';
import { Term404 } from './power';
import { host, mdParse } from '@/lib/markdown';
import { moonPhase } from '@/lib/moon';
import { pageWeightKB, pageCarbonMg } from '@/lib/pageweight';
import { FX_KEYS, STAGE_META, type Post, type Project, type GardenStage } from '@/lib/types';

export function Home() {
  const s = usePsych0();
  const st = s.site;
  const feat = s.projects.find(p => p.featured) || s.projects[0];
  const posts = s.visiblePosts().slice(0, 5);
  const tagline = useTypewriter(st.tagline || '');
  const isStudio = s.viewMode === 'studio';
  const moon = moonPhase();
  const clock = useClock();
  const last = posts[0];

  return (
    <>
      <div className="hero">
        <div className="h-kicker">SIGNAL // {st.name}</div>
        <h1 className="h-title glitch" data-text={st.logo || 'PSYCH0'}>{st.logo || 'PSYCH0'}</h1>
        <div className="h-sub"><span>{tagline}</span><span className="typecur" /></div>
        <div className="statuschips">
          <span className="schip">SESSION <b>#{s.studio ? 'OWNER' : 'GUEST'}</b></span>
          <span className="schip">MODE <b>{isStudio ? 'STUDIO' : 'PUBLIC'}</b></span>
          <span className="schip">BACKEND <b>{s.mode === 'supabase' ? 'SUPABASE' : 'LOCAL'}</b></span>
          <span className="schip">STACK <b>NEXT.JS</b></span>
          <span className="schip">MOON <b>{moon.glyph} {moon.name}</b></span>
          <span className="schip">LOCAL <b>{clock}</b></span>
          {last && <span className="schip">LAST LOG <b>{fmtDate(last.date)}</b></span>}
          {s.tmDate && <span className="schip tm">⏮ VIEWING <b>{s.tmDate}</b></span>}
        </div>
      </div>

      <div className="sechead">NOW<span className="cnt">LIVE FROM THE DEN</span></div>
      <div className="nowbox"><div className="nh">▸ STATUS FEED</div><MD src={st.now} /></div>

      {feat && (
        <div className="sechead">FEATURED PROJECT<span className="cnt">THE CURRENT OBSESSION</span></div>
      )}
      {feat && (
        <div className="grid2">
          <ProjCard pr={feat} featured />
          <div>
            <div className="sechead" style={{ marginTop: 0 }}>LATEST LOG</div>
            <div className="stack">
              {posts.map(p => <Row key={p.id} post={p} />)}
              {!posts.length && <div className="empty">NO ENTRIES YET</div>}
            </div>
            <div style={{ marginTop: 10 }}><Btn href="#/blog">ALL POSTS →</Btn></div>
          </div>
        </div>
      )}

      <div className="sechead">INDEX<span className="cnt">DIRECTORY OF EVERYTHING</span></div>
      <div className="tiles">
        <Tile label="POSTS" count={s.posts.length} href="#/blog" />
        <Tile label="PROJECTS" count={s.projects.length} href="#/projects" />
        <Tile label="LAB" count={s.embeds.length} href="#/lab" />
        <Tile label="ABOUT" count={null} href="#/about" />
        {isStudio && <Tile label="STUDIO" count={null} href="#/studio" />}
        {isStudio && <Tile label="SETTINGS" count={null} href="#/settings" />}
      </div>

      {s.embeds.length > 0 && (
        <>
          <div className="sechead">FROM THE LAB<span className="cnt"><a href="#/lab">OPEN FULL LAB →</a></span></div>
          <div className="grid2">
            {s.embeds.slice(0, 2).map(e => <FrameBox key={e.id} url={e.url} h={e.h} note={e.note} />)}
          </div>
        </>
      )}
    </>
  );
}

export function Blog() {
  const s = usePsych0();
  const tags = Array.from(new Set(s.posts.flatMap(p => p.tags || [])));
  let posts = s.visiblePosts();
  if (s.blogTag) posts = posts.filter(p => (p.tags || []).includes(s.blogTag!));
  if (s.blogQ) posts = posts.filter(p => (p.title + ' ' + p.body + ' ' + (p.tags || []).join(' ')).toLowerCase().includes(s.blogQ.toLowerCase()));
  const isStudio = s.viewMode === 'studio';

  return (
    <>
      <TitleBar title="BLOG_">{isStudio && <Btn href="#/edit/new/post">+ NEW POST</Btn>}</TitleBar>
      <p className="dim small">field notes, manuals and rants. sorted newest first.</p>
      <div className="toolbar" style={{ marginTop: 14 }}>
        <input aria-label="search posts" placeholder="search posts…" value={s.blogQ}
          onChange={e => s.setBlogQ(e.target.value)} />
        <span className="rowwrap">
          <button type="button" className={'chip' + (!s.blogTag ? ' on' : '')} onClick={() => s.setBlogTag(null)}>ALL</button>
          {tags.map(t => (
            <button key={t} type="button" className={'chip' + (s.blogTag === t ? ' on' : '')} onClick={() => s.setBlogTag(t)}>#{t}</button>
          ))}
        </span>
      </div>
      <div className="stack" style={{ marginTop: 14 }}>
        {posts.map(p => <Row key={p.id} post={p} />)}
        {!posts.length && <div className="empty">NO POSTS MATCH</div>}
      </div>
    </>
  );
}

const escHtml = (x: unknown) => String(x ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function PostView({ slug }: { slug: string }) {
  const s = usePsych0();
  const p = s.posts.find(x => x.slug === slug);
  if (!p || (!p.published && s.viewMode !== 'studio')) return <NotFound />;
  const all = s.visiblePosts();
  const idx = all.findIndex(x => x.id === p.id);
  const prev = all[idx - 1], next = all[idx + 1];
  const isStudio = s.viewMode === 'studio';
  // backlinks: posts whose bodies link here via [[slug]]
  const backlinks = s.visiblePosts().filter(x => x.id !== p.id &&
    (x.body || '').toLowerCase().includes('[[' + slug.toLowerCase() + ']]'));
  const scheduled = p.publish_at && p.publish_at > new Date().toISOString();
  const stage = p.stage ? STAGE_META[p.stage as GardenStage] : null;

  /* take-a-copy — everything leaves with the reader */
  const fm = '---\ntitle: ' + p.title + '\ndate: ' + p.date +
    ((p.tags || []).length ? '\ntags: ' + p.tags.join(', ') : '') + '\nslug: ' + p.slug + '\n---\n\n';
  const dlMd = () => { dl(p.slug + '.md', fm + p.body, 'text/markdown'); s.beep(880); };
  const dlTxt = () => {
    const plain = p.body
      .replace(/^@(embed|youtube)\s.*$/gm, '')
      .replace(/^@img\s+\S+\s*\|?\s*/gm, '')
      .replace(/^@gallery.*$/gm, '[ gallery ]')
      .replace(/^@html[\s\S]*?@endhtml$/gm, '[ raw html block ]')
      .replace(/:::\w+\s*.*\n([\s\S]*?)\n:::/g, '$1')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '$1 <$2>')
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '$1 <$2>')
      .replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1')
      .replace(/==([^=]+)==/g, '$1').replace(/~~([^~]+)~~/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[\[([^\]]+)\]\]/g, '$1')
      .replace(/\n{3,}/g, '\n\n').trim();
    dl(p.slug + '.txt', p.title + '\n' + fmtDate(p.date) + '\n\n' + plain + '\n', 'text/plain');
    s.beep(880);
  };
  const printPost = () => {
    const w = window.open('', '_blank');
    if (!w) { s.toast('POPUP BLOCKED — allow popups, then try again', 'warn'); return; }
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>' + escHtml(p.title) + '</title>' +
      '<style>body{font:11.5pt/1.65 Georgia,"Times New Roman",serif;color:#111;max-width:34em;margin:40px auto;padding:0 18px}' +
      'h1,h2,h3{line-height:1.25}h1{font-size:20pt}img{max-width:100%;height:auto}pre{background:#111;color:#eee;padding:12px;overflow-x:auto;font-size:9pt}' +
      'code{font-family:"Courier New",monospace}blockquote{border-left:3px solid #999;margin-left:0;padding-left:14px;color:#444}' +
      'table{border-collapse:collapse;width:100%}td,th{border:1px solid #999;padding:4px 8px;text-align:left}' +
      'small{color:#666}@media print{body{margin:18mm auto}}</style></head><body>' +
      '<small>' + escHtml(s.site.name || 'PSYCH0') + ' · ' + fmtDate(p.date) + '</small><h1>' + escHtml(p.title) + '</h1>' +
      mdParse(p.body) + '<hr><small>printed from ' + escHtml(origin + '/#/blog/' + p.slug) + '</small></body></html>';
    w.document.write(html);
    w.document.close();
    setTimeout(() => { try { w.focus(); w.print(); } catch { /* manual print works too */ } }, 400);
  };
  const copyMd = () => {
    navigator.clipboard?.writeText(fm + p.body)
      .then(() => s.toast('MARKDOWN COPIED', 'ok'))
      .catch(() => s.toast('CLIPBOARD UNAVAILABLE', 'warn'));
  };

  return (
    <>
      <TitleBar title={p.title}>
        <Btn onClick={() => s.speaking ? s.stopSpeaking() : s.speak(p.title + '. ' + p.body)}>
          {s.speaking ? '■ STOP VOICE' : '▶ READ ALOUD'}
        </Btn>
        {isStudio && <Btn href={'#/edit/post/' + p.id}>✎ EDIT</Btn>}
      </TitleBar>
      <div className="pmeta">
        <span className="chip">{fmtDate(p.date)}</span>
        {p.pinned && <span className="chip pin">◆ PINNED</span>}
        {!p.published && <span className="chip draftchip">DRAFT</span>}
        {scheduled && <span className="chip sched">⏱ SCHEDULED</span>}
        {stage && <span className="chip stage">{stage.glyph} {stage.label}</span>}
        {p.fossil && <span className="chip fossilchip">⛏ FOSSIL</span>}
        {(p.tags || []).map(t => <span key={t} className="chip tag">#{t}</span>)}
      </div>
      {p.fossil && (
        <div className="callout fossilb">
          <b className="ct">⛏ FOSSIL — thinking from {p.date.slice(0, 4)}</b>
          <p>kept for the record. present-me does not necessarily endorse past-me, but deleting history is how sites get boring.</p>
        </div>
      )}
      {p.cover && <img className="cover" src={p.cover} alt="" style={{ marginBottom: 8 }} />}
      <MD src={p.body} />
      <div className="btnrow" style={{ marginTop: 16 }}>
        <Btn mini onClick={dlMd}>⤓ .MD</Btn>
        <Btn mini onClick={dlTxt}>⤓ .TXT</Btn>
        <Btn mini onClick={printPost}>⤓ PDF</Btn>
        <Btn mini onClick={copyMd}>⧉ COPY MD</Btn>
        <span className="dim small">take a copy — no lock-in here</span>
      </div>
      {backlinks.length > 0 && (
        <>
          <div className="sechead">MENTIONED IN<span className="cnt">{backlinks.length}</span></div>
          <div className="loglines">
            {backlinks.map(x => (
              <a key={x.id} className="logline" href={'#/blog/' + x.slug}>
                <span className="ld">{fmtDate(x.date)}</span>
                <span className="lt">{x.title}</span>
              </a>
            ))}
          </div>
        </>
      )}
      <div className="pnnav">
        {prev && <Btn href={'#/blog/' + prev.slug}>← {prev.title.slice(0, 28)}</Btn>}
        <span className="spacer" />
        {next && <Btn href={'#/blog/' + next.slug}>{next.title.slice(0, 28)} →</Btn>}
      </div>
    </>
  );
}

export function Projects() {
  const s = usePsych0();
  const isStudio = s.viewMode === 'studio';
  const tmYear = s.tmDate ? s.tmDate.slice(0, 4) : null;
  const list = tmYear ? s.projects.filter(pr => (pr.year || '') <= tmYear) : s.projects;
  return (
    <>
      <TitleBar title="PROJECTS_">{isStudio && <Btn href="#/edit/new/project">+ NEW PROJECT</Btn>}</TitleBar>
      <p className="dim small">things built, broken and shipped. ◆ = featured.</p>
      {tmYear && <div className="callout note" style={{ marginTop: 10 }}><b className="ct">⏮ TIME MACHINE</b><p>showing projects from {tmYear} and earlier — {s.projects.length - list.length} from the future are hidden.</p></div>}
      <div className="pgrid" style={{ marginTop: 14 }}>
        {list.map(pr => <ProjCard key={pr.id} pr={pr} featured={pr.featured} />)}
        {!list.length && <div className="empty">NO PROJECTS YET</div>}
      </div>
    </>
  );
}

export function ProjectView({ slug }: { slug: string }) {
  const s = usePsych0();
  const pr = s.projects.find(x => x.slug === slug);
  if (!pr) return <NotFound />;
  const isStudio = s.viewMode === 'studio';
  const rel = s.visiblePosts().filter(p => p.published && (pr.stack || []).some(t => (p.tags || []).includes(t))).slice(0, 3);

  return (
    <>
      <TitleBar title={pr.title}>
        {isStudio && <Btn href={'#/edit/project/' + pr.id}>✎ EDIT</Btn>}
      </TitleBar>
      <div className="pmeta">
        <StatusChip status={pr.status} /><span className="sep">{'//'}</span>
        <span>{pr.year || '----'}</span>
        {pr.role && <><span className="sep">{'//'}</span><span>{pr.role}</span></>}
        {pr.featured && <><span className="sep">{'//'}</span><span className="acc">◆ FEATURED</span></>}
      </div>
      {!!(pr.stack || []).length && (
        <div className="rowwrap" style={{ marginBottom: 14 }}>
          {pr.stack.map(t => <span key={t} className="chip">{t}</span>)}
        </div>
      )}
      {!!(pr.links || []).length && (
        <div className="rowwrap" style={{ marginBottom: 16 }}>
          {pr.links.map(l => <Btn key={l.url + l.label} href={l.url}>{l.label || 'LINK'} ↗</Btn>)}
        </div>
      )}
      {pr.cover && <img className="cover" src={pr.cover} alt="" style={{ marginBottom: 8 }} />}
      <MD src={pr.body} />
      {!!rel.length && (
        <>
          <div className="sechead">RELATED LOG ENTRIES</div>
          <div className="stack">{rel.map(p => <Row key={p.id} post={p} />)}</div>
        </>
      )}
    </>
  );
}

export function Lab() {
  const s = usePsych0();
  const isStudio = s.viewMode === 'studio';
  return (
    <>
      <TitleBar title="THE LAB_">{isStudio && <Btn href="#/edit/new/embed">+ NEW EMBED</Btn>}</TitleBar>
      <p className="dim small">live windows into other websites. click a frame to load it — nothing runs until you ask. add any URL and it appears here.</p>
      <div className="callout warn" style={{ marginTop: 14 }}>
        <b className="ct">KNOWN LIMIT</b>
        <p>some sites (google, github, x…) send X-Frame-Options and refuse to be framed. every framebox has an OPEN ↗ escape hatch for those. wikis, maps, archives and video players usually frame happily.</p>
      </div>
      <div className="labgrid">
        {s.embeds.map(e => <FrameBox key={e.id} url={e.url} h={e.h} note={e.note} />)}
        {!s.embeds.length && <div className="empty">LAB IS EMPTY — ADD YOUR FIRST EMBED</div>}
      </div>
      <div className="sechead">EMBED ANYWHERE</div>
      <MD src={'in any post or project body, type:\n\n~~~\n@embed https://any-site.example 480\n@youtube dQw4w9WgXcQ\n~~~'} />
    </>
  );
}

export function About() {
  const s = usePsych0();
  const isStudio = s.viewMode === 'studio';
  const ring = s.site.webring || [];
  const [ri, setRi] = useState(0);
  const prev = ring.length ? ring[(ri + ring.length - 1) % ring.length] : null;
  const next = ring.length ? ring[(ri + 1) % ring.length] : null;
  const cur = ring.length ? ring[ri % ring.length] : null;
  const openRing = (x: { label: string; url: string }) => { window.open(x.url, '_blank', 'noopener'); s.beep(990, .04); };

  return (
    <>
      <TitleBar title="ABOUT_">{isStudio && <Btn href="#/edit/about">✎ EDIT</Btn>}</TitleBar>
      <div className="grid2" style={{ marginTop: 14 }}>
        <MD src={s.site.about} />
        <div>
          <div className="sechead" style={{ marginTop: 0 }}>FIND ME</div>
          <div className="socials">
            {!!(s.site.socials || []).length
              ? s.site.socials.map(so => <Btn key={so.label + so.url} href={so.url}>{so.label} ↗</Btn>)
              : <span className="dim small">no links yet — add them in SETTINGS</span>}
          </div>
          {ring.length > 0 && (
            <>
              <div className="sechead">WEBRING<span className="cnt">{ring.length} neighbors</span></div>
              <div className="btnrow">
                <Btn onClick={() => openRing(prev!)}>◀ {prev!.label}</Btn>
                <span className="chip on" style={{ alignSelf: 'center' }}>{cur!.label}</span>
                <Btn onClick={() => openRing(next!)}>{next!.label} ▶</Btn>
              </div>
              <div className="rowwrap" style={{ marginTop: 8 }}>
                {ring.map((x, i) => (
                  <button key={x.label + x.url} type="button" className={'chip' + (i === ri % ring.length ? ' on' : '')}
                    onClick={() => setRi(i)}>{x.label}</button>
                ))}
              </div>
              <div className="dim small" style={{ marginTop: 6 }}>prev/next hop around the ring — the old web, holding hands again.</div>
            </>
          )}
          <div className="sechead">COLOPHON</div>
          <MD src={'- **next.js 16** · react 19 · tailwind 4\n- serverless api routes\n- **supabase** postgres storage\n- hand-made terminal skin: no trackers, one accent color\n- type: `' + (s.site.logo || 'PSYCH0') + '` — press CTRL+K to explore\n- full colophon at `#/colophon` — link in the footer'} />
        </div>
      </div>
    </>
  );
}

/* ================= /now page ================= */

export function NowPage() {
  const s = usePsych0();
  const moon = moonPhase();
  const clock = useClock();
  const posts = s.visiblePosts();
  const last = posts[0];
  return (
    <>
      <TitleBar title="NOW_" />
      <p className="dim small">what holds my attention right now — the <a href="https://nownownow.com" target="_blank" rel="noopener">/now page movement</a>. this page lies less than an about page: it is updated whenever life changes.</p>
      <div className="statuschips" style={{ marginTop: 12 }}>
        <span className="schip">MOON <b>{moon.glyph} {moon.name}</b></span>
        <span className="schip">LOCAL <b>{clock}</b></span>
        <span className="schip">LAST TENDED <b>{last ? fmtDate(last.date) : '—'}</b></span>
        <span className="schip">POSTS <b>{s.posts.length}</b></span>
      </div>
      <div className="nowbox" style={{ marginTop: 14 }}>
        <div className="nh">▸ STATUS FEED</div>
        <MD src={s.site.now || '*nothing right now — the void is loading*'} />
      </div>
      {!!posts.length && (
        <>
          <div className="sechead">FRESH FROM THE LOG<span className="cnt">latest three</span></div>
          <div className="stack">{posts.slice(0, 3).map(p => <Row key={p.id} post={p} />)}</div>
        </>
      )}
    </>
  );
}

/* ================= /colophon page ================= */

export function ColophonPage() {
  const s = usePsych0();
  const [kb, setKb] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setKb(pageWeightKB()), 900); // let resources settle first
    return () => clearTimeout(t);
  }, []);
  const carbon = pageCarbonMg(kb);
  const fxOn = FX_KEYS.filter(k => s.site.fx[k]).length;
  return (
    <>
      <TitleBar title="COLOPHON_" />
      <p className="dim small">how this site was made — the ingredients list every site should ship.</p>
      {s.site.colophon && <MD src={s.site.colophon} />}
      <div className="sechead">STACK</div>
      <MD src={'- **next.js 16** · react 19 · tailwind 4 — the CRT terminal skin\n- serverless API routes + **supabase** postgres (or plain local mode)\n- hand-made theme engine · ' + fxOn + '/7 fx enabled\n- zero trackers · zero cookies · zero analytics'} />
      <div className="sechead">TYPE</div>
      <MD src={'- **silkscreen** — pixel display font (logo, headers)\n- **jetbrains mono** — everything else you are reading'} />
      <div className="sechead">THIS PAGE, MEASURED<span className="cnt">live from your browser</span></div>
      <div className="dashgrid">
        <div className="dashstat"><b>{kb || '…'}</b><span>KB TRANSFERRED</span></div>
        <div className="dashstat"><b>{kb ? carbon.toFixed(1) : '…'}</b><span>mg CO₂e EST.</span></div>
        <div className="dashstat"><b>{s.posts.length}</b><span>POSTS LIVE</span></div>
        <div className="dashstat"><b>{s.embeds.length}</b><span>LAB WINDOWS</span></div>
      </div>
      <div className="helpline">carbon estimate: sustainable web design model (~0.34 mg CO₂e per KB transferred). want it smaller? hit the ⚡ LOW-POWER button in the footer — it strips every effect and animation.</div>
      <div className="sechead">MACHINE ROOM</div>
      <div className="btnrow">
        <Btn href="/feed.xml">RSS ⚡</Btn>
        <Btn href="/sitemap.xml">SITEMAP</Btn>
        <Btn href="/manifest.webmanifest">PWA MANIFEST</Btn>
        <Btn href="/api/health">HEALTH</Btn>
      </div>
    </>
  );
}

export function NotFound() {
  return (
    <>
      <TitleBar title="404 — SIGNAL LOST_" />
      <div className="empty" style={{ marginTop: 14 }}>
        this page does not exist. you fell off the edge of the den — the rescue shell below is your way back.
      </div>
      <div style={{ marginTop: 14 }}>
        <Term404 />
      </div>
      <div className="btnrow" style={{ marginTop: 12 }}>
        <Btn href="#/">← BACK TO INDEX</Btn>
        <Btn href="#/graph">◍ EXPLORE THE GRAPH</Btn>
      </div>
    </>
  );
}
