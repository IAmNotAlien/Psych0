'use client';
/* PSYCH://OS — self-destructing note (/burn/<token>).
 * The reader must press BURN READ first: fetching consumes one read, and when
 * the burn limit is hit the server deletes the note mid-flight. One entry,
 * zero remains. */
import { use, useEffect, useState } from 'react';
import { mdParse } from '@/lib/markdown';

interface Shared { title: string; body: string; burned?: boolean }

export default function BurnNote({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [state, setState] = useState<'armed' | 'loading' | 'ok' | 'burned' | 'gone'>('armed');
  const [note, setNote] = useState<Shared | null>(null);

  const read = () => {
    setState('loading');
    fetch('/api/share/' + encodeURIComponent(token))
      .then(r => r.json())
      .then(j => {
        if (j.title === undefined) { setState('gone'); return; }
        setNote(j as Shared);
        setState(j.burned ? 'burned' : 'ok');
      })
      .catch(() => setState('gone'));
  };

  useEffect(() => { document.title = '⚠ BURN AFTER READING — PSYCH0'; }, []);

  return (
    <div style={{ maxWidth: 680, margin: '10vh auto', padding: '0 18px', fontFamily: 'var(--p0mono)', color: 'var(--p0fg)' }}>
      <a href="/" style={{ color: 'var(--acc)', textDecoration: 'none', letterSpacing: 3, fontFamily: 'var(--p0disp)' }}>PSYCH0 ↖</a>
      {state === 'armed' && (
        <div className="logincard" style={{ marginTop: 18, borderColor: 'var(--p0red)' }}>
          <div className="nh" style={{ color: 'var(--p0red)' }}>▸ ⚠ BURN AFTER READING</div>
          <p className="dim">this message destroys itself the moment (or moments) it is read. no backup, no undo.</p>
          <button className="btn danger" onClick={read}>🔥 BURN READ — SHOW ME</button>
        </div>
      )}
      {state === 'loading' && <p className="dim" style={{ marginTop: 18 }}>opening the envelope…</p>}
      {(state === 'ok' || state === 'burned') && note && (
        <div className="logincard" style={{ marginTop: 18, borderColor: state === 'burned' ? 'var(--p0red)' : undefined }}>
          {state === 'burned' && <div className="callout warn"><b className="ct">🔥 CONSUMED</b><p>this was the final read — the note is now ash on the server.</p></div>}
          <div className="nh">▸ {state === 'burned' ? 'LAST COPY' : 'SECRET NOTE'}</div>
          <h1 style={{ color: 'var(--acc)', fontSize: 20, letterSpacing: 2 }}>{note.title || 'UNTITLED'}</h1>
          <div className="md" dangerouslySetInnerHTML={{ __html: mdParse(note.body || '') }} />
          {state === 'ok' && <p className="dim small">read it now — it may not survive another open.</p>}
        </div>
      )}
      {state === 'gone' && (
        <div className="logincard" style={{ marginTop: 18 }}>
          <div className="nh">▸ ASHES</div>
          <p className="dim">nothing here — the note is gone for good.</p>
        </div>
      )}
    </div>
  );
}
