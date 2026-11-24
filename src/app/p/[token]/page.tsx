'use client';
/* PSYCH://OS — public reader for a shared private note (/p/<token>).
 * Rendered outside the main app shell — deliberately minimal: the note,
 * the owner logo, nothing else. */
import { use, useEffect, useState } from 'react';
import { mdParse } from '@/lib/markdown';

interface Shared { title: string; body: string; burned?: boolean }

export default function SharedNote({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [state, setState] = useState<'loading' | 'ok' | 'gone'>('loading');
  const [note, setNote] = useState<Shared | null>(null);

  useEffect(() => {
    fetch('/api/share/' + encodeURIComponent(token))
      .then(r => r.json())
      .then(j => {
        if (j.title !== undefined) { setNote(j as Shared); setState('ok'); }
        else setState('gone');
      })
      .catch(() => setState('gone'));
  }, [token]);

  return (
    <div style={{ maxWidth: 680, margin: '10vh auto', padding: '0 18px', fontFamily: 'var(--p0mono)', color: 'var(--p0fg)' }}>
      <a href="/" style={{ color: 'var(--acc)', textDecoration: 'none', letterSpacing: 3, fontFamily: 'var(--p0disp)' }}>PSYCH0 ↖</a>
      {state === 'loading' && <p className="dim">decrypting the envelope…</p>}
      {state === 'gone' && (
        <div className="logincard" style={{ marginTop: 18 }}>
          <div className="nh">▸ NOTHING HERE</div>
          <p className="dim">this link is invalid, expired, or the note has burned after reading.</p>
        </div>
      )}
      {state === 'ok' && note && (
        <div className="logincard" style={{ marginTop: 18 }}>
          <div className="nh">▸ SHARED NOTE</div>
          <h1 style={{ color: 'var(--acc)', fontSize: 20, letterSpacing: 2 }}>{note.title || 'UNTITLED'}</h1>
          <div className="md" dangerouslySetInnerHTML={{ __html: mdParse(note.body || '') }} />
        </div>
      )}
    </div>
  );
}
