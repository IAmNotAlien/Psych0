'use client';
/* PSYCH://OS — THE BRAIN: AI chat over your whole vault (RAG + TOOLS — it can
 * read and write items, posts, settings, links, mail), daily briefing, capture
 * inbox, semantic search, AI personas, and PERSISTENT SESSIONS: chats survive
 * refreshes (localStorage mirror + Supabase sync when migration 4 is live).
 * Works without an AI key in honest retrieval-only mode. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePsych0 } from './store';
import { useVault } from './vault';
import { OsHead, Empty, Field, MicButton, fmtWhen, relDay, useEnsure, getAiKey } from './osui';
import { MD } from './ui';
import { dayKey, streakOf } from '@/lib/osutil';
import type { VaultItem } from '@/lib/types';

interface ToolChip { name: string; label: string; summary: string }
interface Msg { role: 'user' | 'assistant'; content: string; hits?: { label: string }[]; tools?: ToolChip[]; offline?: boolean; t?: string }
interface SessionMeta { id: string; title: string; updated_at: string; localOnly?: boolean }

/* ---------- the local mirror — chat survives refreshes, always ---------- */

const MIRROR_KEY = 'psych0.brain.mirror.v1';
interface Mirror { sessions: SessionMeta[]; msgs: Record<string, Msg[]> }

function loadMirror(): Mirror {
  try {
    const raw = localStorage.getItem(MIRROR_KEY);
    if (!raw) return { sessions: [], msgs: {} };
    const m = JSON.parse(raw) as Mirror;
    return { sessions: m.sessions || [], msgs: m.msgs || {} };
  } catch { return { sessions: [], msgs: {} }; }
}
function saveMirror(m: Mirror) {
  try {
    // keep the mirror sane: 60 sessions, 200 msgs each
    m.sessions = m.sessions.slice(0, 60);
    for (const k of Object.keys(m.msgs)) m.msgs[k] = m.msgs[k].slice(-200);
    localStorage.setItem(MIRROR_KEY, JSON.stringify(m));
  } catch { /* private mode */ }
}
const newSessionId = () => 'c_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/* ================= daily briefing ================= */

function Briefing() {
  const s = usePsych0();
  const items = useVault(st => st.items);
  const today = dayKey();
  const due = items.filter(i => i.type === 'task' && !i.done && String((i.data as { due?: string })?.due || '') <= today);
  const caps = items.filter(i => i.type === 'capsule' && i.deliver_at && i.deliver_at.slice(0, 10) <= today);
  const journalToday = items.find(i => i.type === 'journal' && String((i.data as { day?: string })?.day || '') === today);
  const habitDays = new Set(items.filter(i => i.type === 'habitlog' && i.done).map(i => String((i.data as { day?: string }).day || '')));
  const streak = streakOf(habitDays);
  const noteCount = items.filter(i => i.type === 'note').length;
  const onThisDay = s.posts.filter(p => {
    if (!p.date) return false;
    const pd = p.date.slice(5), td = today.slice(5);
    return pd === td && p.date.slice(0, 4) !== today.slice(0, 4);
  });

  return (
    <div className="briefcard">
      <div className="nh">▸ DAILY BRIEFING — {today}</div>
      <div className="briefgrid">
        <div className="briefcell"><b>{due.length}</b><span>tasks due{due.length ? ' — go get them' : ' · clear sky'}</span></div>
        <div className="briefcell"><b>{streak}</b><span>day habit streak</span></div>
        <div className="briefcell"><b>{noteCount}</b><span>notes in the vault</span></div>
        <div className="briefcell"><b>{journalToday ? '✓' : '○'}</b><span>journal {journalToday ? 'written today' : 'not yet today'}</span></div>
      </div>
      {!!caps.length && <div className="callout tip"><b className="ct">📬 CAPSULES DELIVERED</b><p>{caps.length} letter(s) from your past self arrived — read them in the JOURNAL page.</p></div>}
      {!!onThisDay.length && <div className="dim small">⏾ on this day: {onThisDay.slice(0, 2).map(p => p.title).join(' · ')}</div>}
    </div>
  );
}

/* ================= typing indicator ================= */

const THINKING = ['scanning the vault…', 'connecting synapses…', 'reading the context…', 'thinking in lowercase…', 'consulting the stacks…', 'wiring the answer…'];

function Typing() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setI(v => (v + 1) % THINKING.length), 1900);
    return () => window.clearInterval(t);
  }, []);
  return (
    <div className="chatmsg ai brainline">
      <div className="bav">✦</div>
      <div className="bbody">
        <div className="mtitle2">BRAIN <span className="dim small">{THINKING[i]}</span></div>
        <div className="typingdots"><span /><span /><span /></div>
      </div>
    </div>
  );
}

/* ================= one chat message ================= */

function ChatMsgView({ m, onCopy }: { m: Msg; onCopy: (t: string) => void }) {
  const me = m.role === 'user';
  return (
    <div className={'chatmsg brainline ' + (me ? 'me' : 'ai')}>
      <div className={'bav' + (me ? ' me' : '')}>{me ? '▶' : '✦'}</div>
      <div className="bbody">
        <div className="mtitle2">{me ? 'YOU' : 'BRAIN'} {m.t && <span className="dim small">{m.t}</span>}</div>
        {me ? <div className="chatbody">{m.content}</div> : <div className="chatbody md"><MD src={m.content} /></div>}
        {!!m.tools?.length && (
          <div className="chatools">
            {m.tools.map((t, i) => (
              <span key={i} className="chip tool" title={t.summary}>✧ {t.label}</span>
            ))}
          </div>
        )}
        {!!m.hits?.length && (
          <div className="chatsrc">sources: {m.hits.slice(0, 4).map(h => h.label).join(' · ')}</div>
        )}
        {!me && m.content && (
          <button type="button" className="flink small copybtn" onClick={() => onCopy(m.content)}>⧉ copy</button>
        )}
      </div>
    </div>
  );
}

/* ================= the brain page ================= */

export function BrainPage({ docId }: { docId?: string }) {
  const s = usePsych0();
  useEnsure();
  const loaded = useVault(st => st.loaded);
  const items = useVault(st => st.items);
  const personas = useMemo(() => items.filter(i => i.type === 'persona'), [items]);
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [activeId, setActiveId] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [synced, setSynced] = useState<boolean | null>(null); // null = checking
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [persona, setPersona] = useState('');
  const [searchQ, setSearchQ] = useState('');
  const [hits, setHits] = useState<{ label: string }[] | null>(null);
  const [capture, setCapture] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const mirrorDirty = useRef(0);
  const docName = docId ? items.find(i => i.id === docId)?.title || '' : '';

  /* ---- persistence core: mirror first, server when it answers ---- */

  const persistTurn = useCallback((sid: string, all: Msg[]) => {
    const m = loadMirror();
    const title = all.find(x => x.role === 'user')?.content.slice(0, 60) || 'new chat';
    m.msgs[sid] = all;
    const now = new Date().toISOString();
    const meta = { id: sid, title, updated_at: now };
    const rest = m.sessions.filter(x => x.id !== sid);
    m.sessions = [meta, ...rest];
    saveMirror(m);
    setSessions(m.sessions);
    // debounced server sync — silent best-effort
    window.clearTimeout(mirrorDirty.current);
    mirrorDirty.current = window.setTimeout(async () => {
      try {
        const r = await fetch('/api/brain/messages', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session: sid, title, messages: all.map(x => ({ role: x.role, content: x.content, meta: { tools: x.tools || [], hits: (x.hits || []).map(h => h.label), offline: x.offline || false } })) }),
        });
        const j = await r.json() as { persisted?: boolean };
        if (typeof j.persisted === 'boolean' && j.persisted) setSynced(true);
        void fetch('/api/brain/sessions', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: sid, title }),
        });
      } catch { /* local mirror already has it */ }
    }, 700);
  }, []);

  /* ---- boot: load mirror, then merge server sessions ---- */
  useEffect(() => {
    const m = loadMirror();
    setSessions(m.sessions);
    void (async () => {
      try {
        const r = await fetch('/api/brain/sessions');
        const j = await r.json() as { sessions?: SessionMeta[]; persisted?: boolean };
        const server = (j.sessions || []).map(x => ({ id: x.id, title: x.title, updated_at: x.updated_at }));
        setSynced(!!j.persisted);
        if (!server.length) return;
        // merge: server rows win over mirror rows with the same id
        const map = new Map<string, SessionMeta>();
        for (const sess of m.sessions) map.set(sess.id, sess);
        for (const sess of server) map.set(sess.id, { ...map.get(sess.id), ...sess } as SessionMeta);
        const merged = [...map.values()].sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));
        setSessions(merged);
        const keep = loadMirror();
        keep.sessions = merged;
        saveMirror(keep);
      } catch { setSynced(false); }
    })();
  }, []);

  /* ---- autoscroll ---- */
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, busy]);

  const openSession = useCallback((id: string) => {
    const m = loadMirror();
    const local = m.msgs[id] || [];
    setActiveId(id);
    setMsgs(local);
    // server refresh in the background (a newer device may have more)
    void (async () => {
      try {
        const r = await fetch('/api/brain/messages?session=' + encodeURIComponent(id));
        const j = await r.json() as { messages?: { role: string; content: string; meta?: { tools?: ToolChip[]; hits?: string[]; offline?: boolean } }[]; persisted?: boolean };
        if (!j.persisted || !j.messages?.length) return;
        const serverMsgs: Msg[] = j.messages.map(x => ({
          role: x.role === 'user' ? 'user' : 'assistant',
          content: x.content,
          tools: x.meta?.tools || [],
          hits: (x.meta?.hits || []).map(label => ({ label })),
          offline: x.meta?.offline,
        }));
        if (serverMsgs.length >= local.length) {
          setMsgs(serverMsgs);
          const keep = loadMirror();
          keep.msgs[id] = serverMsgs;
          saveMirror(keep);
        }
      } catch { /* mirror version stands */ }
    })();
  }, []);

  const startNew = useCallback(() => {
    setActiveId(newSessionId());
    setMsgs([]);
  }, []);

  const deleteSession = useCallback((id: string) => {
    s.confirm('DELETE CHAT?', 'the whole conversation — local copy and server copy.', async () => {
      const m = loadMirror();
      delete m.msgs[id];
      m.sessions = m.sessions.filter(x => x.id !== id);
      saveMirror(m);
      setSessions(m.sessions);
      if (activeId === id) startNew();
      try { await fetch('/api/brain/sessions?id=' + encodeURIComponent(id), { method: 'DELETE' }); } catch { /* local already gone */ }
    });
  }, [activeId, s, startNew]);

  /* ---- send (the brain turn) ---- */
  const send = async () => {
    const text = q.trim();
    if (!text || busy) return;
    setQ('');
    const sid = activeId || newSessionId();
    if (!activeId) setActiveId(sid);
    const next: Msg[] = [...msgs, { role: 'user', content: text, t: fmtWhen(new Date().toISOString()) }];
    setMsgs(next);
    setBusy(true);
    persistTurn(sid, next);
    try {
      const r = await fetch('/api/brain', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next.map(m => ({ role: m.role, content: m.content })),
          persona: persona ? String((personas.find(p => p.id === persona)?.data as { system?: string })?.system || '') : undefined,
          docId: docId || undefined,
          key: getAiKey() || undefined,
        }),
      });
      const j = await r.json() as { reply?: string; hits?: { label: string }[]; tools?: ToolChip[]; offline?: boolean; message?: string };
      const done: Msg[] = [...next, {
        role: 'assistant',
        content: j.reply || j.message || '(silence)',
        hits: j.hits, tools: j.tools, offline: j.offline,
        t: fmtWhen(new Date().toISOString()),
      }];
      setMsgs(done);
      persistTurn(sid, done);
    } catch (e) {
      const done: Msg[] = [...next, { role: 'assistant', content: '⚠ brain unreachable: ' + (e as Error).message }];
      setMsgs(done);
      persistTurn(sid, done);
    }
    setBusy(false);
  };

  const doSearch = async () => {
    const needle = searchQ.trim();
    if (needle.length < 2) return;
    setHits(null);
    try {
      const r = await fetch('/api/brain?q=' + encodeURIComponent(needle));
      const j = await r.json() as { hits?: { label: string }[] };
      setHits(j.hits || []);
      s.beep(880, .04);
    } catch { s.toast('SEARCH FAILED', 'warn'); }
  };

  const quick = (t: string) => { setQ(t); };
  const copy = (t: string) => {
    try { navigator.clipboard.writeText(t); s.toast('COPIED', 'ok'); } catch { s.toast('COPY BLOCKED', 'warn'); }
  };

  return (
    <>
      <OsHead title="THE BRAIN">
        <span className="chip">{s.mode === 'supabase' ? '◉ VAULT LIVE' : '◍ LOCAL VAULT'}</span>
        <span className="chip" title={synced ? 'chats sync through Supabase (migration 4)' : 'chats persist in this browser — run migration 4 to sync across devices'}>
          {synced ? '⌁ CHATS SYNCED' : '⌁ CHATS: THIS BROWSER'}
        </span>
      </OsHead>
      <p className="dim small">one brain over everything: notes, tasks, journals, files, posts — and it can WRITE too (items, posts, settings, links). chats persist; it quotes its sources.</p>

      <Briefing />

      <div className="os2col">
        <div className="oscol">
          <div className="sechead">CHAT{docName ? <span className="cnt">doc: {docName.slice(0, 30)}</span> : null}<span className="cnt">{activeId ? (sessions.find(x => x.id === activeId)?.title || 'chat') : 'new chat'}</span></div>
          <div className="chatbox brainbox">
            {!msgs.length && (
              <div className="chatempty">
                <div className="bav big">✦</div>
                <p>brain online. i know every room of this OS — and i have hands: ask me to <b>find</b>, <b>remember</b>, <b>write</b>, <b>organize</b> or <b>publish</b>.</p>
                <div className="rowwrap center">
                  {[['summarize what i captured this week', 'summarize this week'],
                    ['what tasks are overdue?', 'overdue tasks'],
                    ['remember that my hosting expires in december', 'remember something'],
                    ['write a short blog post about this OS', 'write a post'],
                    ['how many notes do i have?', 'count the vault']].map(([ask, label]) => (
                      <button key={label} type="button" className="chip" onClick={() => quick(ask)}>{label}</button>
                  ))}
                </div>
                {docName && <p className="dim small">asking about the pinned doc <b>{docName}</b>.</p>}
              </div>
            )}
            {msgs.map((m, i) => <ChatMsgView key={i} m={m} onCopy={copy} />)}
            {busy && <Typing />}
            <div ref={endRef} />
          </div>
          <div className="btnrow">
            <select value={persona} onChange={e => setPersona(e.target.value)} aria-label="persona">
              <option value="">bare brain</option>
              {personas.map(p => <option key={p.id} value={p.id}>{(p.data as { icon?: string })?.icon || '◇'} {p.title}</option>)}
            </select>
            <MicButton onText={t => setQ(t)} />
            <button type="button" className="btn mini" onClick={startNew} title="start a fresh chat (old ones stay in the rail)">✳ NEW CHAT</button>
          </div>
          <div className="btnrow">
            <input value={q} placeholder={docName ? 'ask about ' + docName.slice(0, 24) + '…' : 'ask your brain — or tell it to DO something…'}
              onChange={e => setQ(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
            <button type="button" className="btn" disabled={busy || !q.trim()} onClick={send}>SEND ⏎</button>
          </div>
          <div className="helpline">it has tools: <button type="button" className="flink" onClick={() => quick('create a task: water the plants tomorrow')}>create a task</button> · <button type="button" className="flink" onClick={() => quick('draft a blog post titled "hello brain" and save it as a draft')}>draft a post</button> · <button type="button" className="flink" onClick={() => quick('what did i note about hosting?')}>find notes</button> · <button type="button" className="flink" onClick={() => quick('update the site tagline to: a den wired into one brain')}>edit the site</button></div>
        </div>

        <div className="oscol">
          <div className="sechead">CHATS<span className="cnt">{sessions.length} saved · never forgotten</span></div>
          <div className="loglines sessrail">
            {sessions.map(sess => (
              <div key={sess.id} className={'logline sessrow' + (sess.id === activeId ? ' sel' : '')}>
                <button type="button" className="lt" onClick={() => openSession(sess.id)} title={sess.title}>
                  <b>{(sess.title || 'chat').slice(0, 44)}</b><br />
                  <span className="dim small">{relDay(sess.updated_at)}{sess.localOnly ? ' · local' : ''}</span>
                </button>
                <span className="spacer" />
                <button type="button" className="xbtn" aria-label={'delete chat ' + sess.title} onClick={() => deleteSession(sess.id)}>✕</button>
              </div>
            ))}
            {!sessions.length && <Empty>no chats yet — the first one starts your history.</Empty>}
          </div>

          <div className="sechead">CAPTURE INBOX<span className="cnt">dump now, organize never (the AI files it)</span></div>
          <Field label="raw thought → vault (tagged #inbox)">
            <textarea rows={3} value={capture} onChange={e => setCapture(e.target.value)} placeholder='e.g. "call the dentist tuesday" or "idea: pixel rss reader"' />
          </Field>
          <div className="btnrow">
            <button type="button" className="btn" disabled={!capture.trim()} onClick={async () => { await useVault.getState().capture(capture, 'note'); setCapture(''); }}>⬒ FILE AS NOTE</button>
            <button type="button" className="btn" disabled={!capture.trim()} onClick={async () => { await useVault.getState().capture(capture, 'task'); setCapture(''); }}>⬒ FILE AS TASK</button>
          </div>

          <div className="sechead">SEMANTIC SEARCH<span className="cnt">meaning, not just keywords</span></div>
          <div className="btnrow">
            <input value={searchQ} placeholder="that thing about hosting…" onChange={e => setSearchQ(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') doSearch(); }} />
            <button type="button" className="btn mini" onClick={doSearch}>⌕ FIND</button>
          </div>
          {hits && (
            <div className="loglines" style={{ marginTop: 8 }}>
              {hits.map((h, i) => <div key={i} className="logline"><span className="lt">{h.label}</span></div>)}
              {!hits.length && <Empty>nothing in the vault resonates with that.</Empty>}
            </div>
          )}

          {!!personas.length && (
            <>
              <div className="sechead">AI PERSONAS<span className="cnt">{personas.length} installed</span></div>
              <div className="loglines">
                {personas.map(p => (
                  <div key={p.id} className="logline">
                    <span className="ld">{String((p.data as { icon?: string })?.icon || '◇')}</span>
                    <span className="lt">{p.title}<br /><span className="dim small">{String((p.data as { system?: string })?.system || '').slice(0, 90)}…</span></span>
                    <span className="spacer" />
                    <button type="button" className="btn mini" onClick={() => { setPersona(p.id); s.toast('PERSONA LOADED — ' + p.title, 'ok'); }}>LOAD</button>
                  </div>
                ))}
              </div>
            </>
          )}
          {!loaded && <Empty>booting the vault…</Empty>}
        </div>
      </div>
    </>
  );
}

/* ================= capture inbox standalone ================= */

export function InboxPage() {
  useEnsure();
  const items = useVault(st => st.items);
  const inbox = items.filter(i => (i.tags || []).includes('inbox') && !i.done).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  const [q, setQ] = useState('');
  const s = usePsych0();

  const fileInto = async (i: VaultItem, type: string) => {
    await useVault.getState().patch(i.id, { type, tags: (i.tags || []).filter(t => t !== 'inbox') });
    s.toast('FILED AS ' + type.toUpperCase(), 'ok');
  };

  return (
    <>
      <OsHead title="CAPTURE INBOX" />
      <p className="dim small">everything captured from the console, your phone, the bot or email lands here unsorted. file it or let a rule do it (OS → RULES).</p>
      <div className="loglines">
        {inbox.map(i => (
          <div key={i.id} className="logline">
            <span className="ld">{fmtWhen(i.created_at).slice(5)}</span>
            <span className="lt"><b>{i.title}</b>{i.body && i.body !== i.title ? <><br /><span className="dim small">{i.body.slice(0, 110)}</span></> : null}</span>
            <span className="spacer" />
            <span className="chip">{i.type}</span>
            <button type="button" className="btn mini" onClick={() => fileInto(i, 'note')}>→ NOTE</button>
            <button type="button" className="btn mini" onClick={() => fileInto(i, 'task')}>→ TASK</button>
            <button type="button" className="btn mini danger" onClick={() => useVault.getState().deleteItem(i.id)}>✕</button>
          </div>
        ))}
        {!inbox.length && <Empty>inbox zero. the stream is clear.</Empty>}
      </div>
      <div className="btnrow" style={{ marginTop: 12 }}>
        <input value={q} placeholder="quick capture…" onChange={e => setQ(e.target.value)}
          onKeyDown={async e => { if (e.key === 'Enter' && q.trim()) { await useVault.getState().capture(q, 'note'); setQ(''); } }} />
        <span className="dim small">⏎ captures as a note · relative: {inbox.length ? 'oldest ' + relDay(inbox[inbox.length - 1]?.created_at) : ''}</span>
      </div>
    </>
  );
}
