'use client';
/* PSYCH0 — PWA share target. The OS sends shared links/text/images here
 * (GET /share?title=&text=&url=&kind=). kind=note|task|bookmark files a vault
 * item; no kind = the classic blog draft clip. Studio session required —
 * visitors get a preview + a nudge to sign in. */
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { newPost, slugify, uid } from '@/lib/types';

function ShareInner() {
  const sp = useSearchParams();
  const title = sp.get('title') || '';
  const text = sp.get('text') || '';
  const url = sp.get('url') || '';
  const kind = sp.get('kind') || '';
  const isItem = ['note', 'task', 'bookmark'].includes(kind);
  const [state, setState] = useState<'checking' | 'saving' | 'saved' | 'guest' | 'error'>('checking');
  const [preview] = useState(() => {
    const p = newPost();
    p.title = (title || (url ? 'SHARED LINK' : 'SHARED CLIP')).slice(0, 120);
    p.body = [title && !text.startsWith(title) ? title : '', text, url].filter(Boolean).join('\n\n') || '(empty share)';
    p.slug = slugify(p.title);
    return p;
  });

  useEffect(() => {
    let dead = false;
    fetch('/api/studio/session').then(r => r.json()).then(async j => {
      if (dead) return;
      if (!j.studio) { setState('guest'); return; }
      setState('saving');
      try {
        let res: Response;
        if (isItem) {
          const data: Record<string, unknown> = { type: kind, title: preview.title, body: preview.body, tags: ['inbox'], data: {} };
          if (kind === 'bookmark' && url) data.data = { url };
          if (kind === 'task') data.data = { priority: 'now' };
          res = await fetch('/api/items', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: 'i_sh' + uid(), ...data }),
          });
        } else {
          res = await fetch('/api/posts', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...preview, published: false }),
          });
        }
        setState(res.ok ? 'saved' : 'error');
      } catch { if (!dead) setState('error'); }
    }).catch(() => { if (!dead) setState('guest'); });
    return () => { dead = true; };
  }, [preview, isItem, kind]);

  return (
    <div style={{ maxWidth: 560, margin: '8vh auto', padding: '0 18px' }}>
      <div className="logincard" style={{ marginTop: 0 }}>
        <div className="nh">▸ PSYCH0 SHARE TARGET{isItem ? ' → ' + kind.toUpperCase() : ''}</div>
        <h1 style={{ fontSize: 22, letterSpacing: 2, color: 'var(--acc)' }}>SHARED INTO THE DEN_</h1>
        {state === 'checking' && <p className="dim">checking the studio session…</p>}
        {state === 'saving' && <p className="dim">clipping ▮▮▮…</p>}
        {state === 'saved' && (
          <div className="callout tip"><b className="ct">CAPTURED ✓</b>
            <p>{isItem ? 'filed to the vault' + (kind === 'task' ? ' as a task' : ' (tagged #inbox)') : 'saved as a draft'} — open the studio to see it.</p>
          </div>
        )}
        {state === 'guest' && (
          <div className="callout warn"><b className="ct">ALMOST</b>
            <p>this clip is previewed below but nothing is stored yet — the den only takes captures from the owner. unlock the studio to keep it.</p>
          </div>
        )}
        {state === 'error' && (
          <div className="callout warn"><b className="ct">SAVE FAILED</b><p>the database said no. try again from the studio.</p></div>
        )}
        <div className="sechead" style={{ marginTop: 16 }}>PREVIEW</div>
        <div className="logline" style={{ display: 'block', padding: '10px 0' }}>
          <b style={{ color: 'var(--acc)' }}>{preview.title}</b>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, color: 'var(--p0dim)', marginTop: 8 }}>{preview.body}</pre>
        </div>
        <div className="btnrow" style={{ marginTop: 16 }}>
          <a className="btn" href="/#/studio">STUDIO →</a>
          {isItem && <a className="btn" href={'/#/os/inbox'}>INBOX →</a>}
          <a className="btn" href="/">DEN HOME →</a>
        </div>
      </div>
    </div>
  );
}

export default function SharePage() {
  return (
    <Suspense fallback={<div style={{ maxWidth: 560, margin: '8vh auto', padding: '0 18px' }} className="dim">loading…</div>}>
      <ShareInner />
    </Suspense>
  );
}
