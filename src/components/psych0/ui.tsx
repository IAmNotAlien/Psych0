'use client';
/* PSYCH0 — shared UI primitives: MD renderer, hooks, tiny parts */
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { mdParse, excerpt as mdExcerpt } from '@/lib/markdown';
import { usePsych0, REDUCED } from './store';
import { STAGE_META, type GardenStage } from '@/lib/types';

export { mdExcerpt as excerpt };

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '----.--.--'
    : d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getDate()).padStart(2, '0');
}

/* ---------- effects ---------- */

export function useScramble(text: string): string {
  const [out, setOut] = useState(text);
  useEffect(() => {
    if (REDUCED || !text) { setOut(text); return; }
    const chars = '█▓▒░<>/\\|=+*#01';
    let frame = 0;
    const total = Math.min(text.length * 2, 28);
    const t = setInterval(() => {
      frame++;
      const settled = Math.floor((frame / total) * text.length);
      let s = '';
      for (let i = 0; i < text.length; i++) {
        s += i < settled ? text[i] : chars[Math.floor(Math.random() * chars.length)];
      }
      setOut(s);
      if (settled >= text.length) { setOut(text); clearInterval(t); }
    }, 34);
    return () => clearInterval(t);
  }, [text]);
  return out;
}

export function useTypewriter(text: string): string {
  const [out, setOut] = useState('');
  useEffect(() => {
    if (REDUCED) { setOut(text); return; }
    setOut('');
    let i = 0;
    const t = setInterval(() => {
      i++; setOut(text.slice(0, i));
      if (i >= text.length) clearInterval(t);
    }, 24);
    return () => clearInterval(t);
  }, [text]);
  return out;
}

export function useClock(): string {
  const [now, setNow] = useState<string>('--:--:--');
  useEffect(() => {
    const tick = () => setNow(new Date().toLocaleTimeString('en-GB', { hour12: false }));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

/* ---------- MD renderer ---------- */

export function MD({ src, className }: { src: string; className?: string }) {
  const store = usePsych0();
  const html = useMemo(() => mdParse(src), [src]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // click-to-load frames
    const frames = el.querySelectorAll<HTMLDivElement>('.framebox[data-url]');
    const onFrame = (ev: Event) => {
      const box = (ev.target as HTMLElement).closest('.framebox') as HTMLDivElement;
      if (!box) return;
      const url = box.dataset.url || '';
      const iframe = document.createElement('iframe');
      iframe.src = url; iframe.loading = 'lazy';
      iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups');
      iframe.setAttribute('allow', 'fullscreen');
      iframe.title = 'live frame';
      box.classList.add('loaded');
      box.appendChild(iframe);
      store.beep(990, .04);
    };
    frames.forEach(f => f.querySelector('[data-frameload]')?.addEventListener('click', onFrame));
    // lightbox images
    const onImg = (ev: Event) => {
      const img = (ev.target as HTMLElement).closest('img[data-lb]') as HTMLImageElement;
      if (img) store.setLightbox(img.src);
    };
    const imgs = el.querySelectorAll('img[data-lb]');
    imgs.forEach(i => i.addEventListener('click', onImg));
    // wiki-links [[slug]] → real titles
    const wls = el.querySelectorAll<HTMLAnchorElement>('a[data-wl]');
    wls.forEach(a => {
      const p = store.posts.find(x => x.slug === a.dataset.wl);
      if (p) a.textContent = p.title;
    });
    return () => {
      frames.forEach(f => f.querySelector('[data-frameload]')?.removeEventListener('click', onFrame));
      imgs.forEach(i => i.removeEventListener('click', onImg));
    };
  }, [html, store]);

  return <div ref={ref} className={'md ' + (className || '')} dangerouslySetInnerHTML={{ __html: html }} />;
}

/* ---------- small parts ---------- */

export function TitleBar({ title, children }: { title: string; children?: React.ReactNode }) {
  const scrambled = useScramble(title);
  return (
    <div className="titlebar">
      <h1 className="scramble">{scrambled}</h1>
      <span className="spacer" />
      {children}
    </div>
  );
}

export function Btn({ href, onClick, children, mini, danger, className }: {
  href?: string; onClick?: (e: React.MouseEvent) => void; children: React.ReactNode;
  mini?: boolean; danger?: boolean; className?: string;
}) {
  const cls = 'btn' + (mini ? ' mini' : '') + (danger ? ' danger' : '') + (className ? ' ' + className : '');
  if (href) return <a className={cls} href={href}>{children}</a>;
  return <button type="button" className={cls} onClick={onClick}>{children}</button>;
}

export function Row({ post }: { post: PostLike }) {
  const store = usePsych0();
  const isDraft = !post.published;
  const stage = post.stage ? STAGE_META[post.stage as GardenStage] : null;
  return (
    <a className={'logline' + (post.pinned ? ' pinned' : '') + (isDraft ? ' draft' : '') + (post.fossil ? ' fossil' : '')} href={'#/blog/' + post.slug}>
      <span className="ld">{fmtDate(post.date)}</span>
      <span className="lt">{post.title}</span>
      <span className="spacer" />
      {stage && <span className="chip stage" title={'garden state: ' + stage.label}>{stage.glyph}</span>}
      {post.fossil && <span className="chip fossilchip" title="fossil — old thinking, kept for the record">⛏</span>}
      {post.pinned && <span className="chip pin">◆ PINNED</span>}
      {isDraft && <span className="chip draftchip">DRAFT</span>}
      {(post.tags || []).slice(0, 3).map(t => <span key={t} className="chip tag">#{t}</span>)}
    </a>
  );
}
interface PostLike { id: string; slug: string; title: string; date: string; tags?: string[]; pinned?: boolean; published?: boolean; stage?: string | null; fossil?: boolean }

export function Tile({ label, count, href }: { label: string; count: number | null; href: string }) {
  return (
    <a className="tile" href={href}>
      <b>{count !== null ? String(count).padStart(2, '0') : '◈'}</b>
      <span>{label}</span>
    </a>
  );
}

export function StatusChip({ status }: { status: string }) {
  return <span className={'chip st-' + (status || 'IDLE')}>{status || 'IDLE'}</span>;
}

export function ProjCard({ pr, featured }: { pr: ProjectLike; featured?: boolean }) {
  return (
    <a className="card click" href={'#/projects/' + pr.slug}>
      {pr.cover && <img className="cover" src={pr.cover} alt="" loading="lazy" />}
      <h3>{featured && <span className="acc">◆ </span>}{pr.title}</h3>
      <div className="rowwrap">
        <StatusChip status={pr.status || 'IDLE'} />
        <span className="chip">{pr.year}</span>
        {(pr.stack || []).map(s => <span key={s} className="chip">{s}</span>)}
      </div>
      <p className="dim small" style={{ marginTop: 8 }}>{mdExcerpt(pr.body || '', 90)}</p>
    </a>
  );
}
interface ProjectLike { id: string; slug: string; title: string; status?: string; year?: string; stack?: string[]; cover?: string; body?: string }

export function FrameBox({ url, h, note }: { url: string; h: number; note?: string }) {
  const store = usePsych0();
  const [loaded, setLoaded] = useState(false);
  let hostStr = url;
  try { hostStr = new URL(url).hostname.replace(/^www\./, ''); } catch { /* keep */ }
  return (
    <div className={'framebox' + (loaded ? ' loaded' : '')} style={{ minHeight: h || 420 }}>
      <div className="fbbar"><span>{hostStr}</span><a href={url} target="_blank" rel="noopener noreferrer">OPEN ↗</a></div>
      {!loaded && (
        <div className="fboverlay">
          <button type="button" className="btn" onClick={() => { setLoaded(true); store.beep(990, .04); }}>▶ LOAD LIVE FRAME</button>
          <div className="fbnote">{note || hostStr}</div>
        </div>
      )}
      {loaded && (
        <iframe src={url} loading="lazy" title={hostStr}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups" allow="fullscreen" />
      )}
    </div>
  );
}
