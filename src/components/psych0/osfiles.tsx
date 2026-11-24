'use client';
/* PSYCH://OS — DRIVE (folders, drag-drop, paste-to-upload, gallery, shares,
 * OCR, chat-with-doc), the encrypted SECRETS VAULT, and your own /l SHORT LINKS. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePsych0 } from './store';
import { useVault, shareToken, cachePass, cachedPass, encryptSecret, decryptSecret } from './vault';
import { OsHead, Empty, Field, aiTask, fmtWhen } from './osui';
import type { DriveFile } from '@/lib/types';

const HUMAN = (n: number) => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : n > 1024 ? (n / 1024).toFixed(0) + ' KB' : n + ' B';
const isImg = (f: DriveFile) => /^image\//.test(f.mime);
const isAud = (f: DriveFile) => /^audio\//.test(f.mime);
const isVid = (f: DriveFile) => /^video\//.test(f.mime);
const isPdf = (f: DriveFile) => f.mime === 'application/pdf';

/* ================= drive ================= */

export function DrivePage() {
  const s = usePsych0();
  const files = useVault(st => st.files);
  const [folder, setFolder] = useState('/');
  const [view, setView] = useState<'list' | 'gallery'>('list');
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState('');
  const [newFolder, setNewFolder] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const folders = useMemo(() => {
    const set = new Set<string>(['/']);
    for (const f of files) set.add(f.folder || '/');
    return [...set].sort();
  }, [files]);
  const here = files.filter(f => (f.folder || '/') === folder);
  const totalSize = files.reduce((a, f) => a + (f.size || 0), 0);

  const upload = async (list: FileList | null) => {
    if (!list) return;
    for (const f of Array.from(list).slice(0, 10)) {
      setBusy(f.name);
      await useVault.getState().uploadFile(f, folder);
    }
    setBusy('');
    s.beep(990, .05);
  };

  // paste-to-upload: screenshots land straight in the drive
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const it of Array.from(items)) {
        if (it.kind === 'file') {
          const f = it.getAsFile();
          if (f) { e.preventDefault(); useVault.getState().uploadFile(f, folder).then(() => s.toast('PASTED INTO DRIVE — ' + f.name, 'ok')); return; }
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [folder, s]);

  const share = async (f: DriveFile, days: number) => {
    const token = shareToken();
    await useVault.getState().patchFile(f.id, {
      share: token,
      share_expires: days > 0 ? new Date(Date.now() + days * 86400000).toISOString() : null,
    });
    const link = f.url && !f.url.startsWith('data:') ? f.url : window.location.origin + '/api/files/share?token=' + token;
    try { await navigator.clipboard.writeText(link); s.toast('SHARE LINK COPIED' + (days ? ' · dies in ' + days + 'd' : ''), 'ok'); }
    catch { s.toast('LINK: ' + link.slice(0, 90), 'ok'); }
  };

  const ocr = async (f: DriveFile) => {
    setBusy('ocr-' + f.id);
    try {
      const text = await aiTask('ocr', f.url);
      await useVault.getState().patchFile(f.id, { text: text.slice(0, 50000) });
      await useVault.getState().saveItem({ type: 'note', title: 'OCR — ' + f.name, body: text, tags: ['ocr'], data: { fileId: f.id } });
      s.toast('OCR DONE — text saved to file + note', 'ok');
    } catch (e) { s.toast((e as Error).message.slice(0, 140), 'warn'); }
    setBusy('');
  };

  const crumbs = folder === '/' ? [] : folder.replace(/^\//, '').split('/');

  return (
    <>
      <OsHead title="DRIVE">
        <span className="chip">{files.length} files · {HUMAN(totalSize)}</span>
        <button type="button" className={'btn mini' + (view === 'gallery' ? ' on' : '')} onClick={() => setView(v => v === 'list' ? 'gallery' : 'list')}>{view === 'list' ? '▤ GALLERY' : '☰ LIST'}</button>
        <button type="button" className="btn mini" onClick={() => fileRef.current?.click()}>⤒ UPLOAD</button>
      </OsHead>
      <p className="dim small">drop files, paste screenshots (CTRL+V), or upload. share anything with a link that can self-expire. {s.mode === 'local' && 'LOCAL MODE: small files live in this browser only (~4MB cap).'}</p>

      <input ref={fileRef} type="file" hidden multiple onChange={e => { upload(e.target.files); e.currentTarget.value = ''; }} />

      <div className="btnrow wrapbtns">
        <button type="button" className={'chip' + (folder === '/' ? ' on' : '')} onClick={() => setFolder('/')}>⌂ ROOT</button>
        {crumbs.map((c, i) => (
          <button key={i} type="button" className="chip on" onClick={() => setFolder('/' + crumbs.slice(0, i + 1).join('/'))}>{c}</button>
        ))}
        <select value="" onChange={e => { if (e.target.value) setFolder(e.target.value); }} aria-label="jump to folder">
          <option value="">⤓ folder…</option>
          {folders.filter(f => f !== folder).map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <span className="spacer" />
        <input value={newFolder} placeholder="new folder name…" onChange={e => setNewFolder(e.target.value)} style={{ maxWidth: 200 }} />
        <button type="button" className="btn mini" disabled={!newFolder.trim()} onClick={() => { setFolder((folder === '/' ? '' : folder) + '/' + newFolder.trim().replace(/[^\w-]/g, '-')); setNewFolder(''); }}>＋ MKDIR</button>
      </div>

      <div
        className={'dropzone' + (dragging ? ' drag' : '')}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); upload(e.dataTransfer?.files || null); }}
        onClick={() => fileRef.current?.click()}
      >
        {busy && busy !== '' && !busy.startsWith('ocr') ? '⤒ uploading ' + busy + '…' : '⇩ DROP FILES ANYWHERE ON THIS PANEL — or click to browse (paste works too)'}
      </div>

      {view === 'gallery' ? (
        <div className="drivegrid">
          {here.map(f => (
            <div key={f.id} className="drivecell">
              {isImg(f) ? <img src={f.url} alt={f.name} loading="lazy" onClick={() => s.setLightbox(f.url)} />
                : isVid(f) ? <video src={f.url} controls preload="metadata" />
                : isAud(f) ? <audio src={f.url} controls preload="none" />
                : <div className="driveext">{(f.name.split('.').pop() || '?').toUpperCase()}</div>}
              <div className="drivecap"><b>{f.name}</b><span className="dim small">{HUMAN(f.size)}{f.share ? ' · ⇗ shared' : ''}</span></div>
            </div>
          ))}
          {!here.length && <Empty>this folder is empty.</Empty>}
        </div>
      ) : (
        <div className="loglines" style={{ marginTop: 10 }}>
          {here.map(f => (
            <div key={f.id} className="logline">
              <span className="ld">{isImg(f) ? <img src={f.url} alt="" loading="lazy" className="drivethumb" onClick={() => s.setLightbox(f.url)} /> : '▤'}</span>
              <span className="lt"><b>{f.name}</b><br /><span className="dim small">{HUMAN(f.size)} · {fmtWhen(f.created_at)}{f.text ? ' · ⌇ indexable text' : ''}{f.share ? ' · ⇗ shared' : ''}</span></span>
              <span className="spacer" />
              <a className="btn mini" href={f.url} target="_blank" rel="noopener">OPEN ↗</a>
              <a className="btn mini" href={'#/os/brain/' + f.id} title="chat about this document with the brain">✦ CHAT</a>
              <button type="button" className="btn mini" onClick={() => { const n = prompt('rename:', f.name); if (n) useVault.getState().patchFile(f.id, { name: n }); }}>✎</button>
              <button type="button" className="btn mini" onClick={() => { const n = prompt('move to folder:', f.folder); if (n !== null) useVault.getState().patchFile(f.id, { folder: n || '/' }); }}>⇢</button>
              <button type="button" className="btn mini" onClick={() => share(f, 0)}>⇗ 7d+</button>
              <button type="button" className="btn mini" onClick={() => share(f, 7)}>⇗ 7d</button>
              {isImg(f) && <button type="button" className="btn mini" disabled={busy === 'ocr-' + f.id} onClick={() => ocr(f)} title="AI vision OCR → searchable note">{busy === 'ocr-' + f.id ? '▮▮▮' : '⌘ OCR'}</button>}
              <button type="button" className="btn mini danger" onClick={() => s.confirm('DELETE FILE?', f.name, () => useVault.getState().deleteFile(f.id, f.path))}>✕</button>
            </div>
          ))}
          {!here.length && <Empty>nothing here yet — drop a file above.</Empty>}
        </div>
      )}
    </>
  );
}

/* ================= secrets vault ================= */

export function SecretsPage() {
  const s = usePsych0();
  const items = useVault(st => st.items);
  const [pass, setPass] = useState('');
  const [open, setOpen] = useState(() => !!cachedPass());
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState('');
  const [title, setTitle] = useState('');
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);

  const secrets = items.filter(i => i.type === 'secret').sort((a, b) => a.title.localeCompare(b.title));
  const docs = items.filter(i => i.type === 'note' && i.secure);

  const unlock = async () => {
    const probe = secrets[0] || docs[0];
    if (probe && probe.cipher) {
      try { await decryptSecret(pass, probe.cipher, probe.iv, probe.salt); }
      catch { s.toast('WRONG PASSPHRASE', 'warn'); return; }
    }
    cachePass(pass);
    setOpen(true);
    s.toast('VAULT OPEN — key stays in this tab session', 'ok');
    s.beep(990, .06);
  };

  const reveal = async (it: typeof secrets[number]) => {
    const p = cachedPass();
    if (!p) return;
    try {
      const text = await decryptSecret(p, it.cipher, it.iv, it.salt);
      setRevealed(r => ({ ...r, [it.id]: text }));
    } catch { s.toast('DECRYPT FAILED — wrong key?', 'warn'); }
  };

  const copy = async (it: typeof secrets[number]) => {
    const p = cachedPass();
    if (!p) return;
    try {
      const text = await decryptSecret(p, it.cipher, it.iv, it.salt);
      await navigator.clipboard.writeText(text);
      s.toast('COPIED — clipboard only, nowhere else', 'ok');
    } catch { s.toast('DECRYPT FAILED', 'warn'); }
  };

  const addSecret = async () => {
    const p = cachedPass();
    if (!p || !title.trim() || !draft.trim()) return;
    const enc = await encryptSecret(p, draft);
    await useVault.getState().saveItem({ type: 'secret', title: title.trim(), body: '', tags: [], ...enc, secure: true });
    setTitle(''); setDraft('');
    s.toast('SEALED 🔒', 'ok');
  };

  const reSeal = async (id: string, text: string) => {
    const it = items.find(i => i.id === id);
    const p = cachedPass();
    if (!it || !p) return;
    const enc = await encryptSecret(p, text);
    await useVault.getState().saveItem({ ...it, ...enc, body: '', secure: true });
    setEditing(null);
    s.toast('RE-SEALED 🔒', 'ok');
  };

  if (!open) {
    return (
      <>
        <OsHead title="THE VAULT" />
        <div className="logincard">
          <div className="nh">▸ AES-256-GCM GATE</div>
          <p className="dim small">secrets are encrypted in your browser with a passphrase-derived key. the server only ever stores ciphertext. the key lives in this tab&apos;s session only.</p>
          <form onSubmit={e => { e.preventDefault(); unlock(); }}>
            <input type="password" placeholder="vault passphrase…" value={pass} onChange={e => setPass(e.target.value)} autoFocus />
            <button className="btn" type="submit">UNLOCK →</button>
          </form>
          {!(secrets.length + docs.length) && <div className="callout tip" style={{ marginTop: 12 }}><b className="ct">FIRST TIME</b><p>no secrets yet — any passphrase becomes your key on the first seal. don&apos;t lose it: without it the data is unrecoverable by design.</p></div>}
        </div>
      </>
    );
  }

  return (
    <>
      <OsHead title="THE VAULT">
        <button type="button" className="btn mini" onClick={() => { cachePass(''); setOpen(false); s.toast('VAULT LOCKED 🔒', 'warn'); }}>🔒 LOCK</button>
      </OsHead>
      <p className="dim small">encrypted at rest (AES-256-GCM, PBKDF2 120k). reveal or copy on demand — nothing is ever rendered until you ask.</p>

      <div className="os2col">
        <div className="oscol">
          <div className="sechead">SECRETS<span className="cnt">{secrets.length}</span></div>
          <div className="btnrow"><input value={title} placeholder="label — e.g. github recovery codes" onChange={e => setTitle(e.target.value)} /></div>
          <Field label="SECRET TEXT"><textarea rows={4} value={draft} onChange={e => setDraft(e.target.value)} /></Field>
          <div className="btnrow"><button type="button" className="btn" onClick={addSecret} disabled={!title.trim() || !draft.trim()}>🔒 SEAL IT</button></div>
          <div className="loglines" style={{ marginTop: 10 }}>
            {secrets.map(it => (
              <div key={it.id} className="logline">
                <span className="ld">🔒</span>
                <span className="lt"><b>{it.title}</b>{revealed[it.id] && <><br /><code className="small">{revealed[it.id].slice(0, 180)}</code></>}</span>
                <span className="spacer" />
                {revealed[it.id]
                  ? <button type="button" className="btn mini" onClick={() => setRevealed(r => { const c = { ...r }; delete c[it.id]; return c; })}>HIDE</button>
                  : <button type="button" className="btn mini" onClick={() => reveal(it)}>👁 REVEAL</button>}
                <button type="button" className="btn mini" onClick={() => copy(it)}>⧉ COPY</button>
                <button type="button" className="btn mini" onClick={async () => { const p = cachedPass(); if (!p) return; try { setEditing({ id: it.id, text: await decryptSecret(p, it.cipher, it.iv, it.salt) }); } catch { s.toast('DECRYPT FAILED', 'warn'); } }}>✎</button>
                <button type="button" className="btn mini danger" onClick={() => s.confirm('DESTROY SECRET?', it.title, () => useVault.getState().deleteItem(it.id))}>✕</button>
              </div>
            ))}
            {!secrets.length && <Empty>no secrets sealed yet.</Empty>}
          </div>
        </div>

        <div className="oscol">
          <div className="sechead">DOCUMENT VAULT<span className="cnt">{docs.length} sealed notes</span></div>
          <div className="dim small" style={{ marginBottom: 8 }}>any note with 🔒 lives here — write it in NOTES (flip the secure flag by sealing) or seal a new one from a secret above.</div>
          <div className="loglines">
            {docs.map(d => (
              <div key={d.id} className="logline">
                <span className="ld">🔒</span>
                <span className="lt"><b>{d.title}</b><br /><span className="dim small">{fmtWhen(d.updated_at)}</span></span>
                <span className="spacer" />
                <a className="btn mini" href="#/os/notes">OPEN IN NOTES →</a>
                <button type="button" className="btn mini danger" onClick={() => s.confirm('DELETE SEALED NOTE?', d.title, () => useVault.getState().deleteItem(d.id))}>✕</button>
              </div>
            ))}
            {!docs.length && <Empty>no sealed documents — ID scans, contracts and certificates belong here.</Empty>}
          </div>
        </div>
      </div>

      {editing && (
        <div className="mwrap" onClick={e => { if (e.target === e.currentTarget) setEditing(null); }}>
          <div className="mbox">
            <div className="mtitle">EDIT SEALED ITEM</div>
            <textarea rows={8} value={editing.text} onChange={e => setEditing(v => v ? { ...v, text: e.target.value } : v)} spellCheck={false} style={{ width: '100%' }} />
            <div className="mbtns">
              <button type="button" className="btn" onClick={() => setEditing(null)}>CANCEL</button>
              <button type="button" className="btn danger" onClick={() => reSeal(editing.id, editing.text)}>🔒 RE-SEAL</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ================= short links ================= */

export function LinksPage() {
  const s = usePsych0();
  const links = useVault(st => st.links);
  const [url, setUrl] = useState('');
  const [slug, setSlug] = useState('');

  return (
    <>
      <OsHead title="SHORT LINKS" />
      <p className="dim small">your own bit.ly, on your own domain: <code>yourden.dev/l/<b>slug</b></code> → anywhere. clicks counted. {s.mode === 'local' && 'LOCAL MODE: the /l/ redirect needs Supabase — links still save locally.'}</p>
      <div className="btnrow wrapbtns">
        <input value={url} placeholder="https://destination…  (required)" onChange={e => setUrl(e.target.value)} style={{ maxWidth: 380 }} />
        <input value={slug} placeholder="custom slug (optional)" onChange={e => setSlug(e.target.value.replace(/[^a-z0-9-]/gi, '').toLowerCase())} style={{ maxWidth: 180 }} />
        <button type="button" className="btn" disabled={!/^https?:\/\//i.test(url)} onClick={async () => {
          const l = await useVault.getState().addLink(url, slug);
          if (l) { setUrl(''); setSlug(''); s.toast('/l/' + l.slug + ' LIVE', 'ok'); s.beep(990, .05); }
        }}>✂ SHORTEN</button>
      </div>
      <div className="loglines" style={{ marginTop: 10 }}>
        {links.map(l => (
          <div key={l.id} className="logline">
            <span className="ld">{l.clicks}×</span>
            <span className="lt"><b>/l/{l.slug}</b><br /><span className="dim small">{l.url}</span></span>
            <span className="spacer" />
            <button type="button" className="btn mini" onClick={async () => {
              try { await navigator.clipboard.writeText(window.location.origin + '/l/' + l.slug); s.toast('COPIED', 'ok'); } catch { /* clipboard blocked */ }
            }}>⧉ COPY</button>
            <button type="button" className="btn mini danger" onClick={() => s.confirm('DELETE LINK?', '/l/' + l.slug, () => useVault.getState().delLink(l.id))}>✕</button>
          </div>
        ))}
        {!links.length && <Empty>no short links yet — shorten something above.</Empty>}
      </div>
    </>
  );
}
