'use client';
/* PSYCH://OS — private NOTES universe (wikilinks, backlinks, templates,
 * version history, share/burn, AI bar, voice dictation, checkup doctor)
 * and the daily JOURNAL with letters to your future self (capsules). */
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePsych0, dl } from './store';
import { useVault, shareToken } from './vault';
import { OsHead, Empty, Field, Check, MicButton, aiTask, fmtWhen, relDay, useEnsure, openBody } from './osui';
import { extractLinks, streakOf } from '@/lib/osutil';
import { MD } from './ui';
import type { VaultItem } from '@/lib/types';

/* ---------- autosave helper ---------- */
function useDebouncedSave(item: VaultItem | null, save: (i: VaultItem) => void, ms = 900) {
  const [status, setStatus] = useState('idle');
  const first = useRef(true);
  useEffect(() => {
    if (!item) return;
    if (first.current) { first.current = false; return; }
    setStatus('saving');
    const t = setTimeout(() => { try { save(item); setStatus('saved'); } catch { setStatus('error'); } }, ms);
    return () => clearTimeout(t);
  }, [item, save, ms]);
  return status;
}

/* ================= notes page ================= */

export function NotesPage() {
  const s = usePsych0();
  useEnsure();
  const items = useVault(st => st.items);
  const notes = useMemo(() => items.filter(i => i.type === 'note').sort((a, b) => Number(b.pinned) - Number(a.pinned) || (b.updated_at || '').localeCompare(a.updated_at || '')), [items]);
  const templates = useMemo(() => items.filter(i => i.type === 'template'), [items]);
  const [selId, setSelId] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [outline, setOutline] = useState(false);
  const [showRevs, setShowRevs] = useState(false);
  const [revs, setRevs] = useState<{ id: number; created_at: string }[]>([]);
  const [plain, setPlain] = useState<string>('');
  const [busyAI, setBusyAI] = useState('');
  const [checkup, setCheckup] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const sel = notes.find(n => n.id === selId) || null;
  const status = useDebouncedSave(sel, i => useVault.getState().saveItem(i));

  // encrypted note → keep the plaintext working copy in local state
  useEffect(() => {
    let dead = false;
    setPlain('');
    if (sel) openBody(sessionStorage.getItem('psych0.vaultpass') || '', sel)
      .then(t => { if (!dead) setPlain(t); })
      .catch(() => {});
    return () => { dead = true; };
  }, [sel?.id, sel?.cipher]); // eslint-disable-line react-hooks/exhaustive-deps

  const body = sel ? (sel.secure ? plain : sel.body) : '';
  const setBody = (v: string) => {
    if (!sel) return;
    if (sel.secure) setPlain(v);
    else useVault.getState().saveItem({ ...sel, body: v });
  };
  const commitPlain = () => {
    // encrypted notes save on demand (encryption is not free)
    if (sel && sel.secure && plain !== sel.body) {
      import('./vault').then(async ({ encryptSecret }) => {
        const pass = sessionStorage.getItem('psych0.vaultpass') || '';
        if (!pass) { s.toast('VAULT LOCKED — unlock in OS → VAULT first', 'warn'); return; }
        const enc = await encryptSecret(pass, plain);
        await useVault.getState().saveItem({ ...sel, body: '', ...enc, secure: true });
        s.toast('RE-SEALED 🔒', 'ok');
      });
    }
  };

  const filtered = notes.filter(n =>
    (!tag || (n.tags || []).includes(tag)) &&
    (!q.trim() || ((n.title + ' ' + n.body + ' ' + (n.tags || []).join(' ')).toLowerCase().includes(q.toLowerCase()))));

  const allTags = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of notes) for (const t of n.tags || []) m.set(t, (m.get(t) || 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [notes]);

  /* zettelkasten machinery */
  const linkTargets = useMemo(() => extractLinks(body).map(t => t.toLowerCase()), [body]);
  const backlinks = useMemo(() =>
    sel ? notes.filter(n => n.id !== sel.id && extractLinks(n.body).some(t => t.toLowerCase() === (sel.title || '').toLowerCase())) : [],
    [notes, sel]);
  const deadLinks = useMemo(() =>
    linkTargets.filter(t => !notes.some(n => (n.title || '').toLowerCase() === t)), [linkTargets, notes]);
  const related = useMemo(() => {
    if (!sel) return [];
    const tags = new Set(sel.tags || []);
    return notes.filter(n => n.id !== sel.id && (n.tags || []).some(t => tags.has(t))).slice(0, 6);
  }, [notes, sel]);

  /* checkup */
  const orphans = notes.filter(n => !(n.tags || []).length && !extractLinks(n.body).length &&
    !notes.some(x => x.id !== n.id && extractLinks(x.body).some(t => t.toLowerCase() === (n.title || '').toLowerCase())));

  const insert = (text: string) => {
    const ta = taRef.current;
    if (!ta || !sel) return;
    const pos = ta.selectionStart || body.length;
    const next = body.slice(0, pos) + text + body.slice(pos);
    setBody(next);
    setTimeout(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = pos + text.length; }, 30);
  };

  const newNote = async (tpl?: VaultItem) => {
    const n = await useVault.getState().saveItem({
      type: 'note', title: tpl ? tpl.title.toUpperCase() : 'NEW NOTE',
      body: tpl ? tpl.body : '', tags: tpl ? (tpl.tags || []).filter(t => t !== 'template') : [],
    });
    if (n) { setSelId(n.id); s.toast('NOTE CREATED', 'ok'); }
  };

  const runAI = async (task: string, apply: (out: string) => void, label: string) => {
    if (!sel) return;
    setBusyAI(label);
    try {
      let src = body;
      if (task === 'voice') src = body;
      const out = await aiTask(task, src);
      if (task === 'tags') {
        const tags = out.split(',').map(t => t.trim().toLowerCase().replace(/^#/, '')).filter(Boolean).slice(0, 6);
        if (sel) useVault.getState().saveItem({ ...sel, tags: [...new Set([...(sel.tags || []), ...tags])] });
        s.toast('TAGGED: ' + tags.join(' '), 'ok');
      } else apply(out);
    } catch (e) { s.toast((e as Error).message.slice(0, 120), 'warn'); }
    setBusyAI('');
  };

  const loadRevs = async () => {
    if (!sel) return;
    setShowRevs(true);
    if (s.mode !== 'supabase') { setRevs([]); return; }
    try {
      const r = await fetch('/api/items?revs=' + encodeURIComponent(sel.id));
      const j = await r.json() as { revisions?: { id: number; created_at: string }[] };
      setRevs(j.revisions || []);
    } catch { setRevs([]); }
  };

  const makeShare = async (burns: number, days: number) => {
    if (!sel) return;
    const token = shareToken();
    const exp = days > 0 ? new Date(Date.now() + days * 86400000).toISOString() : null;
    await useVault.getState().saveItem({ ...sel, share: token, burns, share_expires: exp });
    const url = window.location.origin + (burns > 0 ? '/burn/' : '/p/') + token;
    try { await navigator.clipboard.writeText(url); s.toast('SHARE LINK COPIED — ' + (burns > 0 ? burns + '-read burn link' : 'read-only'), 'ok'); }
    catch { s.toast('LINK: ' + url, 'ok'); }
  };

  return (
    <>
      <OsHead title="NOTES">
        <button type="button" className={'btn mini' + (checkup ? ' on' : '')} onClick={() => setCheckup(v => !v)}>⚕ CHECKUP{orphans.length + deadLinks.length ? ' (' + (orphans.length) + ')' : ''}</button>
        <button type="button" className="btn mini" onClick={() => newNote()}>＋ NOTE</button>
        {!!templates.length && (
          <select value="" onChange={e => { const t = templates.find(x => x.id === e.target.value); if (t) newNote(t); }} aria-label="new from template">
            <option value="">＋ FROM TEMPLATE…</option>
            {templates.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
        )}
      </OsHead>
      <p className="dim small">private notes with [[wikilinks]], backlinks, templates, versions and a doctor. nothing here is public unless you hand out a link.</p>

      <div className="os2col">
        <div className="oscol">
          <div className="btnrow"><input value={q} placeholder="filter notes…" onChange={e => setQ(e.target.value)} /></div>
          {!!allTags.length && (
            <div className="rowwrap" style={{ marginBottom: 8 }}>
              <button type="button" className={'chip' + (!tag ? ' on' : '')} onClick={() => setTag(null)}>ALL</button>
              {allTags.slice(0, 10).map(([t, n]) => (
                <button key={t} type="button" className={'chip' + (tag === t ? ' on' : '')} onClick={() => setTag(t === tag ? null : t)}>#{t} {n}</button>
              ))}
            </div>
          )}
          <div className="loglines">
            {filtered.map(n => (
              <button type="button" key={n.id} className={'logline' + (selId === n.id ? ' sel' : '')} onClick={() => setSelId(n.id)}
                style={{ textAlign: 'left', background: 'none', border: 'none', color: 'inherit', width: '100%' }}>
                <span className="ld">{fmtWhen(n.updated_at).slice(5)}</span>
                <span className="lt">{n.pinned ? '◆ ' : ''}{n.title || '(untitled)'}{n.secure ? ' 🔒' : ''}<br />
                  <span className="dim small">{(n.tags || []).map(t => '#' + t).join(' ')}</span></span>
                <span className="spacer" />
                {extractLinks(n.body).length > 0 && <span className="chip" title="wikilinks">⛓ {extractLinks(n.body).length}</span>}
              </button>
            ))}
            {!filtered.length && <Empty>no notes match. plant one.</Empty>}
          </div>
          {checkup && (
            <div className="callout warn" style={{ marginTop: 10 }}>
              <b className="ct">NOTE DOCTOR</b>
              <p>{orphans.length} orphan(s) with no tags, links or backlinks; {deadLinks.length} dead [[link(s)]] from the open note.</p>
              {!!orphans.length && <p className="small">orphans: {orphans.slice(0, 6).map(o => o.title || '(untitled)').join(' · ')}</p>}
              {!!deadLinks.length && <p className="small">dead links: {deadLinks.map(d => '[[…' + d + ']]').join(' ')}</p>}
            </div>
          )}
        </div>

        <div className="oscol">
          {!sel ? (
            <Empty>pick a note on the left — or create one. wikilinks look like [[note title]].</Empty>
          ) : (
            <>
              <div className="btnrow">
                <input value={sel.title} onChange={e => useVault.getState().saveItem({ ...sel, title: e.target.value })} placeholder="note title…" style={{ fontWeight: 700 }} />
                <SaveDotInline status={status} />
              </div>
              <div className="btnrow">
                <input value={(sel.tags || []).join(', ')} placeholder="tags…"
                  onChange={e => useVault.getState().saveItem({ ...sel, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })} />
                <Check label="◆" on={!!sel.pinned} onChange={v => useVault.getState().saveItem({ ...sel, pinned: v })} />
              </div>
              <div className="btnrow wrapbtns">
                <button type="button" className={'btn mini' + (preview ? ' on' : '')} onClick={() => { setPreview(p => !p); commitPlain(); }}>{preview ? '✎ EDIT' : '👁 PREVIEW'}</button>
                <button type="button" className={'btn mini' + (outline ? ' on' : '')} onClick={() => setOutline(o => !o)} title="collapsible outline view">≡ OUTLINE</button>
                <button type="button" className="btn mini" onClick={() => insert('[[' + (sel.title || 'link target') + ']]')} title="insert wikilink to this note">⛓ SELF-LINK</button>
                <button type="button" className="btn mini" disabled={busyAI !== ''} onClick={() => runAI('tags', () => {}, 'tagging')}>{busyAI === 'tagging' ? '▮▮▮' : '⚡ AI TAG'}</button>
                <button type="button" className="btn mini" disabled={busyAI !== ''} onClick={() => runAI('summary', out => { setBody('## TL;DR\n\n' + out + '\n\n' + body); commitPlain(); }, 'summarizing')}>{busyAI === 'summarizing' ? '▮▮▮' : '⚡ SUMMARIZE'}</button>
                <button type="button" className="btn mini" disabled={busyAI !== ''} onClick={() => runAI('polish', out => { setBody(out); }, 'polishing')}>{busyAI === 'polishing' ? '▮▮▮' : '⚡ POLISH'}</button>
                <button type="button" className="btn mini" disabled={busyAI !== ''} onClick={() => runAI('voice', out => { setBody(out); }, 'cleaning')}>{busyAI === 'cleaning' ? '▮▮▮' : '⚡ CLEAN VOICE'}</button>
                <MicButton onText={t => setBody((body ? body + '\n\n' : '') + t)} />
                <button type="button" className="btn mini" onClick={loadRevs}>⏱ HISTORY</button>
                <button type="button" className="btn mini" onClick={() => makeShare(0, 0)}>⇗ SHARE</button>
                <button type="button" className="btn mini danger" onClick={() => makeShare(1, 0)} title="self-destructing link — burns after one read">🔥 BURN LINK</button>
                <button type="button" className="btn mini danger" onClick={() => s.confirm('DELETE NOTE?', sel.title, () => { useVault.getState().deleteItem(sel.id); setSelId(null); })}>✕</button>
              </div>
              <div className="helpline">
                ⤓ <button type="button" className="flink" onClick={() => dl((sel.title || 'note') + '.md', '# ' + sel.title + '\n\n' + body, 'text/markdown')}>export .md</button>
                {sel.share && <> · shared: <code>{sel.share.slice(0, 12)}…</code> <button type="button" className="flink" onClick={() => useVault.getState().saveItem({ ...sel, share: '', burns: 0, share_expires: null })}>revoke</button></>}
              </div>

              {showRevs && (
                <div className="callout note">
                  <b className="ct">⏱ VERSION HISTORY {s.mode !== 'supabase' ? '(needs Supabase)' : ''}</b>
                  <div className="loglines">
                    {revs.map(r => (
                      <div key={r.id} className="logline">
                        <span className="ld">{fmtWhen(r.created_at).slice(5, 16)}</span>
                        <span className="lt">snapshot</span>
                        <span className="spacer" />
                        <button type="button" className="btn mini" onClick={async () => {
                          try {
                            const rr = await fetch('/api/items?revs=' + sel.id);
                            const jj = await rr.json() as { revisions?: { id: number; snapshot?: { body?: string; title?: string } }[] };
                            const snap = jj.revisions?.find(x => x.id === r.id)?.snapshot;
                            if (snap) { setBody(String(snap.body || '')); s.toast('SNAPSHOT LOADED INTO EDITOR — save to keep', 'ok'); }
                          } catch { s.toast('RESTORE FAILED', 'warn'); }
                        }}>⟲ LOAD</button>
                      </div>
                    ))}
                    {!revs.length && <div className="dim small">no snapshots yet — every save keeps up to 20.</div>}
                  </div>
                  <button type="button" className="btn mini" onClick={() => setShowRevs(false)}>CLOSE</button>
                </div>
              )}

              {preview ? (
                <div className="edprev" style={{ minHeight: 240 }}><MD src={body || '*nothing yet*'} /></div>
              ) : outline ? (
                <div className="outlineview">
                  {body.split('\n').map((line, i) => {
                    const h = /^(#+)\s/.exec(line);
                    const li = /^\s*([-*+]|\d+\.)\s/.exec(line);
                    const depth = h ? h[1].length : li ? Math.floor((line.match(/^\s*/)?.[0].length || 0) / 2) + 2 : 0;
                    const text = line.replace(/^(#+\s|\s*([-*+]|\d+\.)\s)/, '') || line;
                    return (
                      <details key={i} open={depth <= 2} style={{ marginLeft: depth * 14 }}>
                        <summary className="dim small">{text.slice(0, 120) || '·'}</summary>
                      </details>
                    );
                  })}
                </div>
              ) : (
                <textarea ref={taRef} className="mdsrc" rows={16} value={body} spellCheck={false}
                  onChange={e => setBody(e.target.value)} onBlur={commitPlain}
                  placeholder={'write here… [[wikilinks]] and markdown work.'} />
              )}

              <div className="os2col" style={{ marginTop: 10 }}>
                <div>
                  <div className="sechead">⛓ LINKS OUT</div>
                  <div className="rowwrap">
                    {linkTargets.map(t => {
                      const dead = deadLinks.includes(t);
                      return <button key={t} type="button" className={'chip' + (dead ? ' warnchip' : '')}
                        onClick={() => { const target = notes.find(n => (n.title || '').toLowerCase() === t); if (target) setSelId(target.id); else s.toast('DEAD LINK — no note titled "' + t + '"', 'warn'); }}>
                        {dead ? '✗ ' : '→ '}{t}</button>;
                    })}
                    {!linkTargets.length && <span className="dim small">none — link with [[title]]</span>}
                  </div>
                </div>
                <div>
                  <div className="sechead">↩ BACKLINKS{related.length ? <span className="cnt">+ {related.length} related</span> : null}</div>
                  <div className="rowwrap">
                    {backlinks.map(b => <button key={b.id} type="button" className="chip" onClick={() => setSelId(b.id)}>← {b.title}</button>)}
                    {related.slice(0, 5).map(r => <button key={r.id} type="button" className="chip dim" onClick={() => setSelId(r.id)}>~ {r.title}</button>)}
                    {!backlinks.length && !related.length && <span className="dim small">nothing points here yet</span>}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function SaveDotInline({ status }: { status: string }) {
  return <span className={'savedot s-' + status}>{status === 'saving' ? '●' : status === 'saved' ? '✓' : '○'}</span>;
}

/* ================= journal page ================= */

export function JournalPage() {
  const s = usePsych0();
  useEnsure();
  const items = useVault(st => st.items);
  const today = new Date().toISOString().slice(0, 10);
  const entries = useMemo(() =>
    items.filter(i => i.type === 'journal').sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || '')), [items]);
  const todayEntry = entries.find(e => String((e.data as { day?: string })?.day || '') === today);
  const [draft, setDraft] = useState('');
  const [capText, setCapText] = useState('');
  const [capDate, setCapDate] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 365); return d.toISOString().slice(0, 10); });
  const loadedOnce = useRef(false);

  useEffect(() => {
    if (!loadedOnce.current && todayEntry !== undefined) { setDraft(todayEntry.body); loadedOnce.current = true; }
  }, [todayEntry]);

  const saveToday = () => {
    if (!draft.trim()) return;
    if (todayEntry) useVault.getState().saveItem({ ...todayEntry, body: draft });
    else useVault.getState().saveItem({ type: 'journal', title: 'JOURNAL — ' + today, body: draft, tags: [], data: { day: today } });
    s.toast('DAY LOGGED — ' + today, 'ok'); s.beep(880, .05);
  };

  const capsules = items.filter(i => i.type === 'capsule');
  const delivered = capsules.filter(c => c.deliver_at && c.deliver_at.slice(0, 10) <= today);
  const sealed = capsules.filter(c => !c.deliver_at || c.deliver_at.slice(0, 10) > today);
  const habitDays = new Set(items.filter(i => i.type === 'habitlog' && i.done).map(i => String((i.data as { day?: string })?.day || '')));
  const writeStreak = useMemo(() => {
    let n = 0; const d = new Date();
    for (;;) {
      const k = d.toISOString().slice(0, 10);
      if (!entries.some(e => String((e.data as { day?: string })?.day || '') === k)) break;
      n++; d.setDate(d.getDate() - 1);
    }
    return n;
  }, [entries]);

  return (
    <>
      <OsHead title="JOURNAL" />
      <p className="dim small">one page per day, plus letters that travel through time. today is entry #{entries.length + 1} · writing streak {writeStreak}d · habit streak {streakOf(habitDays)}d</p>

      <div className="os2col">
        <div className="oscol">
          <div className="sechead">TODAY — {today}</div>
          <div className="btnrow wrapbtns"><MicButton onText={t => setDraft(v => (v ? v + '\n\n' : '') + t)} />
            <button type="button" className="btn mini" onClick={saveToday} disabled={!draft.trim()}>💾 LOG THE DAY</button>
            <button type="button" className="btn mini" onClick={async () => {
              try { const out = await aiTask('summary', draft); setDraft(v => '> TL;DR: ' + out + '\n\n' + v); } catch (e) { s.toast((e as Error).message.slice(0, 100), 'warn'); }
            }}>⚡ TL;DR</button>
          </div>
          <textarea className="mdsrc" rows={12} value={draft} spellCheck={false}
            onChange={e => setDraft(e.target.value)}
            placeholder={'what happened today?\n\n- the thing that went well\n- the thing that didn\'t\n- one line for future you'} />
          <div className="sechead" style={{ marginTop: 12 }}>PAST ENTRIES<span className="cnt">{entries.length}</span></div>
          <div className="loglines">
            {entries.slice(0, 30).map(e => (
              <button type="button" key={e.id} className="logline" style={{ textAlign: 'left', background: 'none', border: 'none', color: 'inherit', width: '100%' }}
                onClick={() => { setDraft(e.body); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                <span className="ld">{String((e.data as { day?: string })?.day || fmtWhen(e.created_at)).slice(5)}</span>
                <span className="lt dim small">{(e.body || '').slice(0, 90)}</span>
              </button>
            ))}
            {!entries.length && <Empty>the first entry is the hardest. write one line.</Empty>}
          </div>
        </div>

        <div className="oscol">
          <div className="sechead">✉ LETTERS TO FUTURE SELF</div>
          <Field label="LETTER"><textarea rows={4} value={capText} onChange={e => setCapText(e.target.value)} placeholder="dear future me…" /></Field>
          <Field label="DELIVER ON"><input type="date" value={capDate} onChange={e => setCapDate(e.target.value)} /></Field>
          <div className="btnrow">
            <button type="button" className="btn" disabled={!capText.trim()} onClick={async () => {
              await useVault.getState().saveItem({ type: 'capsule', title: 'LETTER — ' + capDate, body: capText, deliver_at: new Date(capDate + 'T09:00:00Z').toISOString() });
              setCapText(''); s.toast('CAPSULE SEALED — arrives ' + relDay(capDate), 'ok'); s.beep(990, .06);
            }}>✉ SEAL CAPSULE</button>
          </div>

          <div className="sechead" style={{ marginTop: 12 }}>IN FLIGHT<span className="cnt">{sealed.length}</span></div>
          <div className="loglines">
            {sealed.map(c => (
              <div key={c.id} className="logline capsule locked">
                <span className="ld">{fmtWhen(c.deliver_at)}</span>
                <span className="lt blurtxt">{c.body.slice(0, 60)}</span>
                <span className="spacer" />
                <span className="chip sched">sealed · {relDay(c.deliver_at)}</span>
                <button type="button" className="btn mini danger" onClick={() => s.confirm('BURN THE LETTER?', 'It will never be delivered.', () => useVault.getState().deleteItem(c.id))}>✕</button>
              </div>
            ))}
            {!sealed.length && <Empty>no letters in flight — seal one above.</Empty>}
          </div>

          <div className="sechead" style={{ marginTop: 12 }}>DELIVERED<span className="cnt">{delivered.length}</span></div>
          <div className="loglines">
            {delivered.map(c => (
              <div key={c.id} className="logline capsule">
                <span className="ld">{fmtWhen(c.deliver_at)}</span>
                <span className="lt"><b>{c.title}</b><br /><span className="small">{c.body.slice(0, 140)}</span></span>
                <span className="spacer" />
                <span className="chip st-SHIPPED">ARRIVED</span>
                <button type="button" className="btn mini danger" onClick={() => useVault.getState().deleteItem(c.id)}>✕</button>
              </div>
            ))}
            {!delivered.length && <Empty>nothing delivered yet. the future is patient.</Empty>}
          </div>
        </div>
      </div>
    </>
  );
}
