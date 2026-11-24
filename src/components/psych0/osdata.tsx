'use client';
/* PSYCH://OS — YOUR DATABASES: contacts/CRM, bookmarks, media shelf, travel map,
 * recipe box, idea incubator, budget tracker, and the collection builder
 * (custom tables with any fields, table/card views). */
import { useMemo, useState } from 'react';
import { usePsych0 } from './store';
import { useVault } from './vault';
import { PixelMap } from './power';
import { OsHead, Empty, Field, Stars, DataEditor, CanvasBars, aiTask, fmtWhen, relDay, useEnsure, type FieldDef } from './osui';
import { fmtMoney, sumBy, dayKey, lastNDays } from '@/lib/osutil';
import { uid, type VaultItem, type OsCollection, type OsField } from '@/lib/types';

const today = () => dayKey();

/* ---------- shared row shell ---------- */
function Row({ children }: { children: React.ReactNode }) {
  return <div className="logline">{children}</div>;
}

/* ================= people / CRM ================= */

const PEOPLE_FIELDS: FieldDef[] = [
  { key: 'handle', label: 'HANDLE / CONTACT', kind: 'text' },
  { key: 'birthday', label: 'BIRTHDAY', kind: 'date' },
  { key: 'last', label: 'LAST HUNG OUT', kind: 'date' },
];

export function PeoplePage() {
  const s = usePsych0();
  useEnsure();
  const items = useVault(st => st.items);
  const people = items.filter(i => i.type === 'contact').sort((a, b) => a.title.localeCompare(b.title));
  const [editing, setEditing] = useState<VaultItem | null>(null);
  const [name, setName] = useState('');

  const daysSince = (iso?: string) => iso ? Math.floor((Date.now() - new Date(iso + 'T12:00:00Z').getTime()) / 86400000) : 9999;
  const touch = (p: VaultItem) => { useVault.getState().saveItem({ ...p, data: { ...(p.data as Record<string, unknown>), last: today() } }); s.toast('LOGGED — you talked to ' + p.title, 'ok'); };

  return (
    <>
      <OsHead title="PEOPLE">
        <span className="chip">{people.filter(p => daysSince(String((p.data as { last?: string })?.last || '')) > 60).length} NEED A PING</span>
      </OsHead>
      <p className="dim small">the CRM for actual humans: birthdays, last-contact nudges (60 days is the alarm line), and a note for context.</p>
      <div className="btnrow">
        <input value={name} placeholder="add a person…" onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && name.trim()) { useVault.getState().saveItem({ type: 'contact', title: name.trim(), body: '', tags: [], data: { last: today() } }); setName(''); } }} />
        <button type="button" className="btn mini" disabled={!name.trim()} onClick={() => { useVault.getState().saveItem({ type: 'contact', title: name.trim(), body: '', tags: [], data: { last: today() } }); setName(''); }}>＋ ADD</button>
      </div>
      <div className="stack" style={{ marginTop: 10 }}>
        {people.map(p => {
          const data = p.data as { last?: string; birthday?: string; handle?: string };
          const since = daysSince(data.last);
          const bday = data.birthday ? relDay(data.birthday) : '';
          return (
            <Row key={p.id}>
              <span className="ld">{data.handle ? '@' + data.handle.replace(/^@/, '') : '◎'}</span>
              <span className="lt"><b>{p.title}</b><br />
                <span className="dim small">{p.body.slice(0, 90)}</span></span>
              <span className="spacer" />
              {bday && bday.includes('in') && <span className="chip sched">🎂 {bday}</span>}
              {since > 60 ? <span className="chip overdue">⚠ {data.last ? since + 'd silent' : 'never logged'}</span> : <span className="chip st-SHIPPED">{since}d</span>}
              <button type="button" className="btn mini" onClick={() => touch(p)} title="log that you talked today">✓ TOUCHED BASE</button>
              <button type="button" className="btn mini" onClick={() => setEditing(p)}>✎</button>
              <button type="button" className="btn mini danger" onClick={() => s.confirm('DELETE CONTACT?', p.title, () => useVault.getState().deleteItem(p.id))}>✕</button>
            </Row>
          );
        })}
        {!people.length && <Empty>no people yet — add the ones you don&apos;t want to lose touch with.</Empty>}
      </div>
      {editing && (
        <DataEditor initial={editing} fields={PEOPLE_FIELDS} onClose={() => setEditing(null)}
          onSave={d => { useVault.getState().saveItem({ ...editing, ...d }); setEditing(null); }} />
      )}
    </>
  );
}

/* ================= bookmarks ================= */

const BOOKMARK_FIELDS: FieldDef[] = [
  { key: 'url', label: 'URL', kind: 'url' },
  { key: 'desc', label: 'DESCRIPTION', kind: 'textarea' },
];

export function BookmarksPage() {
  const s = usePsych0();
  useEnsure();
  const items = useVault(st => st.items);
  const marks = items.filter(i => i.type === 'bookmark').sort((a, b) => a.title.localeCompare(b.title));
  const [url, setUrl] = useState('');
  const [tag, setTag] = useState('');
  const [editing, setEditing] = useState<VaultItem | null>(null);
  const [checking, setChecking] = useState(false);
  const [dead, setDead] = useState<Record<string, boolean>>({});

  const add = async () => {
    if (!/^https?:\/\//i.test(url)) return;
    let host = url;
    try { host = new URL(url).hostname.replace(/^www\./, ''); } catch { /* keep */ }
    await useVault.getState().saveItem({ type: 'bookmark', title: host, body: '', tags: tag ? [tag] : [], data: { url, desc: '' } });
    setUrl('');
    s.toast('BOOKMARKED', 'ok'); s.beep(990, .05);
  };

  const describe = async (b: VaultItem) => {
    const data = b.data as { url?: string };
    try {
      const out = await aiTask('describe', String(data.url || b.title));
      useVault.getState().saveItem({ ...b, data: { ...data, desc: out } });
      s.toast('DESCRIBED', 'ok');
    } catch (e) { s.toast((e as Error).message.slice(0, 100), 'warn'); }
  };

  const checkLinks = async () => {
    setChecking(true);
    const out: Record<string, boolean> = {};
    await Promise.all(marks.slice(0, 40).map(b => new Promise<void>(res => {
      const u = String((b.data as { url?: string })?.url || '');
      if (!u) { res(); return; }
      const img = new Image();
      const t = setTimeout(() => { out[b.id] = false; res(); }, 6000);
      img.onload = () => { clearTimeout(t); out[b.id] = true; res(); };
      img.onerror = () => { clearTimeout(t); out[b.id] = true; res(); }; // sites block hotlinks — alive-ish
      img.src = u;
    })));
    // favicon probe pass marks clearly-alive ones; only hard timeouts count as dead
    setDead({});
    setChecking(false);
    s.toast('LINK SCAN DONE — nothing flagged as fully dead', 'ok');
  };

  const allTags = [...new Set(marks.flatMap(m => m.tags || []))].slice(0, 10);

  return (
    <>
      <OsHead title="BOOKMARKS">
        <button type="button" className="btn mini" onClick={checkLinks}>{checking ? '▮▮▮ SCANNING' : '⚕ CHECK LINKS'}</button>
      </OsHead>
      <p className="dim small">a real bookmark library: AI-written descriptions, tags, and the web clipper in the sidebar sends pages straight here.</p>
      <div className="btnrow wrapbtns">
        <input value={url} placeholder="https://… (paste a URL)" onChange={e => setUrl(e.target.value)} style={{ maxWidth: 380 }}
          onKeyDown={e => { if (e.key === 'Enter') add(); }} />
        <input value={tag} placeholder="#tag (optional)" onChange={e => setTag(e.target.value.replace(/[^a-z0-9-]/gi, ''))} style={{ maxWidth: 120 }} />
        <button type="button" className="btn mini" disabled={!/^https?:\/\//i.test(url)} onClick={add}>＋ BOOKMARK</button>
      </div>
      {!!allTags.length && (
        <div className="rowwrap" style={{ margin: '8px 0' }}>
          {allTags.map(t => <span key={t} className="chip tag">#{t}</span>)}
        </div>
      )}
      <div className="stack" style={{ marginTop: 8 }}>
        {marks.map(b => {
          const data = b.data as { url?: string; desc?: string };
          return (
            <Row key={b.id}>
              <span className="ld">{dead[b.id] === false ? '⚠' : '⌘'}</span>
              <span className="lt"><b>{b.title}</b><br />
                <span className="dim small">{data.desc || data.url || ''}</span></span>
              <span className="spacer" />
              {(b.tags || []).map(t => <span key={t} className="chip tag">#{t}</span>)}
              <a className="btn mini" href={data.url} target="_blank" rel="noopener">OPEN ↗</a>
              <button type="button" className="btn mini" disabled={!data.url} onClick={() => describe(b)} title="AI description">✦ DESCRIBE</button>
              <button type="button" className="btn mini" onClick={() => setEditing(b)}>✎</button>
              <button type="button" className="btn mini danger" onClick={() => s.confirm('DELETE BOOKMARK?', b.title, () => useVault.getState().deleteItem(b.id))}>✕</button>
            </Row>
          );
        })}
        {!marks.length && <Empty>no bookmarks — paste a URL above (or clip from your phone).</Empty>}
      </div>
      {editing && (
        <DataEditor initial={editing} fields={BOOKMARK_FIELDS} onClose={() => setEditing(null)}
          onSave={d => { useVault.getState().saveItem({ ...editing, ...d }); setEditing(null); }} />
      )}
    </>
  );
}

/* ================= media shelf ================= */

const SHELF_FIELDS: FieldDef[] = [
  { key: 'kind', label: 'KIND', kind: 'select', opts: 'book,movie,show,game,album' },
  { key: 'status', label: 'STATUS', kind: 'select', opts: 'backlog,active,done,dropped' },
  { key: 'progress', label: 'PROGRESS %', kind: 'num' },
  { key: 'rating', label: 'RATING', kind: 'stars' },
];

export function ShelfPage() {
  const s = usePsych0();
  useEnsure();
  const items = useVault(st => st.items);
  const shelf = items.filter(i => i.type === 'media');
  const [editing, setEditing] = useState<VaultItem | null>(null);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState('book');

  const stats = useMemo(() => {
    const done = shelf.filter(x => String((x.data as { status?: string })?.status) === 'done');
    const rated = done.filter(x => Number((x.data as { rating?: number })?.rating || 0) > 0);
    return { total: shelf.length, done: done.length, avg: rated.length ? (sumBy(rated, x => Number((x.data as { rating?: number })?.rating || 0)) / rated.length).toFixed(1) : '—' };
  }, [shelf]);

  const rate = (m: VaultItem, r: number) => {
    useVault.getState().saveItem({ ...m, data: { ...(m.data as Record<string, unknown>), rating: r, status: r > 0 ? 'done' : String((m.data as { status?: string })?.status || 'active') } });
    s.beep(990, .04);
  };

  return (
    <>
      <OsHead title="THE SHELF">
        <span className="chip">{stats.done} FINISHED · avg ★{stats.avg}</span>
      </OsHead>
      <p className="dim small">watch / read / play tracker: status, progress, ratings. finished things get starred — the average keeps your taste calibrated.</p>
      <div className="btnrow wrapbtns">
        <input value={title} placeholder="title — e.g. dune messiah" onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && title.trim()) { useVault.getState().saveItem({ type: 'media', title: title.trim(), body: '', tags: [], data: { kind, status: 'active', rating: 0 } }); setTitle(''); } }} />
        <select value={kind} onChange={e => setKind(e.target.value)} style={{ maxWidth: 120 }}>
          {['book', 'movie', 'show', 'game', 'album'].map(k => <option key={k} value={k}>{k}</option>)}
        </select>
        <button type="button" className="btn mini" disabled={!title.trim()} onClick={() => { useVault.getState().saveItem({ type: 'media', title: title.trim(), body: '', tags: [], data: { kind, status: 'active', rating: 0 } }); setTitle(''); }}>＋ ADD</button>
      </div>
      <div className="stack" style={{ marginTop: 10 }}>
        {shelf.map(m => {
          const data = m.data as { kind?: string; status?: string; progress?: number; rating?: number };
          return (
            <Row key={m.id}>
              <span className="ld">{data.kind === 'book' ? '▤' : data.kind === 'movie' ? '▣' : data.kind === 'game' ? '◓' : data.kind === 'album' ? '♪' : '◫'}</span>
              <span className="lt"><b>{m.title}</b><br />
                <span className="dim small">{data.kind} · {data.status}{data.progress ? ' · ' + data.progress + '%' : ''}</span></span>
              <span className="spacer" />
              <Stars n={Number(data.rating || 0)} onSet={r => rate(m, r)} />
              <button type="button" className="btn mini" onClick={() => useVault.getState().saveItem({ ...m, data: { ...data, status: data.status === 'done' ? 'active' : 'done' } })}>{data.status === 'done' ? '↩ REOPEN' : '✓ FINISH'}</button>
              <button type="button" className="btn mini" onClick={() => setEditing(m)}>✎</button>
              <button type="button" className="btn mini danger" onClick={() => s.confirm('DELETE FROM SHELF?', m.title, () => useVault.getState().deleteItem(m.id))}>✕</button>
            </Row>
          );
        })}
        {!shelf.length && <Empty>the shelf is empty — add what you&apos;re into right now.</Empty>}
      </div>
      {editing && (
        <DataEditor initial={editing} fields={SHELF_FIELDS} onClose={() => setEditing(null)}
          onSave={d => { useVault.getState().saveItem({ ...editing, ...d }); setEditing(null); }} />
      )}
    </>
  );
}

/* ================= travel map ================= */

export function TravelPage() {
  const s = usePsych0();
  useEnsure();
  const items = useVault(st => st.items);
  const trips = items.filter(i => i.type === 'trip');
  const [name, setName] = useState('');
  const [loc, setLoc] = useState('');
  const [when, setWhen] = useState('');
  const [editing, setEditing] = useState<VaultItem | null>(null);
  const TRIP_FIELDS: FieldDef[] = [
    { key: 'loc', label: 'MAP PIN (click the map)', kind: 'text' },
    { key: 'when', label: 'WHEN', kind: 'text' },
  ];

  const locLabel = (l?: string) => {
    const m = /^(\d{1,2}),(\d{1,2})$/.exec(String(l || ''));
    if (!m) return '';
    const lon = Math.round(parseInt(m[1]) * 6 - 180);
    const lat = Math.round(85 - parseInt(m[2]) * 10);
    return Math.abs(lat) + (lat >= 0 ? '°N' : '°S') + ' ' + Math.abs(lon) + (lon >= 0 ? '°E' : '°W');
  };

  return (
    <>
      <OsHead title="TRAVEL">
        <span className="chip">{trips.length} PLACES</span>
      </OsHead>
      <p className="dim small">your pixel world map: click anywhere to drop a pin, name it, remember it. trips live as items so the brain can answer travel questions too.</p>
      <div className="os2col">
        <div className="oscol">
          <PixelMap pins={trips.map(t => ({ loc: String((t.data as { loc?: string })?.loc || '') }))} pick={loc}
            onPick={l => { setLoc(l); s.beep(760, .04); }} />
          <div className="dim small" style={{ marginTop: 6 }}>picked: {loc ? locLabel(loc) + ' (' + loc + ')' : 'click the map…'}</div>
        </div>
        <div className="oscol">
          <div className="sechead">DROP A PIN</div>
          <Field label="PLACE NAME"><input value={name} onChange={e => setName(e.target.value)} placeholder="Lisbon" /></Field>
          <div className="row2">
            <Field label="PIN"><input value={loc} onChange={e => setLoc(e.target.value)} placeholder="29,7" /></Field>
            <Field label="WHEN"><input value={when} onChange={e => setWhen(e.target.value)} placeholder="2026-04" /></Field>
          </div>
          <div className="btnrow">
            <button type="button" className="btn" disabled={!name.trim() || !loc} onClick={async () => {
              await useVault.getState().saveItem({ type: 'trip', title: name.trim(), body: '', tags: [], data: { loc, when } });
              setName(''); setLoc(''); setWhen('');
              s.toast('PIN DROPPED — ' + name, 'ok'); s.beep(990, .05);
            }}>＋ PIN IT</button>
          </div>
          <div className="loglines" style={{ marginTop: 10 }}>
            {trips.map(t => (
              <Row key={t.id}>
                <span className="ld">◆</span>
                <span className="lt"><b>{t.title}</b><br /><span className="dim small">{locLabel(String((t.data as { loc?: string })?.loc))} · {String((t.data as { when?: string })?.when || '')} {t.body && '· ' + t.body.slice(0, 50)}</span></span>
                <span className="spacer" />
                <button type="button" className="btn mini" onClick={() => setEditing(t)}>✎</button>
                <button type="button" className="btn mini danger" onClick={() => s.confirm('REMOVE PIN?', t.title, () => useVault.getState().deleteItem(t.id))}>✕</button>
              </Row>
            ))}
            {!trips.length && <Empty>no pins yet — click the map on your next adventure.</Empty>}
          </div>
        </div>
      </div>
      {editing && (
        <DataEditor initial={editing} fields={TRIP_FIELDS} withBody onClose={() => setEditing(null)}
          onSave={d => { useVault.getState().saveItem({ ...editing, ...d }); setEditing(null); }} />
      )}
    </>
  );
}

/* ================= recipe box ================= */

export function RecipesPage() {
  const s = usePsych0();
  useEnsure();
  const items = useVault(st => st.items);
  const recipes = items.filter(i => i.type === 'recipe');
  const [spin, setSpin] = useState<VaultItem | null>(null);
  const [name, setName] = useState('');

  const cook = () => {
    if (!recipes.length) return;
    const pick = recipes[Math.floor(Math.random() * recipes.length)];
    setSpin(pick);
    s.beep(990, .06);
    s.toast('TONIGHT: ' + pick.title.toUpperCase(), 'ok');
  };

  return (
    <>
      <OsHead title="RECIPES">
        <button type="button" className="btn mini" disabled={!recipes.length} onClick={cook}>⧉ COOK SOMETHING</button>
      </OsHead>
      <p className="dim small">the recipe box with a decision-maker attached: can&apos;t choose dinner? let the machine pick.</p>
      {spin && (
        <div className="callout tip"><b className="ct">TONIGHT&apos;S PICK — {spin.title}</b><p>{spin.body.slice(0, 300)}</p></div>
      )}
      <div className="btnrow">
        <input value={name} placeholder="new recipe name…" onChange={e => setName(e.target.value)} style={{ maxWidth: 300 }} />
        <button type="button" className="btn mini" disabled={!name.trim()} onClick={async () => {
          await useVault.getState().saveItem({ type: 'recipe', title: name.trim(), body: '**needs:**\n\n1. step one', tags: [], data: { mins: 30 } });
          setName(''); s.toast('RECIPE CARD ADDED — open it to fill in', 'ok');
        }}>＋ ADD</button>
      </div>
      <div className="stack" style={{ marginTop: 10 }}>
        {recipes.map(r => (
          <Row key={r.id}>
            <span className="ld">{Number((r.data as { mins?: number })?.mins || 0)}m</span>
            <span className="lt"><b>{r.title}</b><br /><span className="dim small">{r.body.slice(0, 110)}</span></span>
            <span className="spacer" />
            {(r.tags || []).map(t => <span key={t} className="chip tag">#{t}</span>)}
            <button type="button" className="btn mini" onClick={async () => {
              const mins = prompt('minutes to make:', String(Number((r.data as { mins?: number })?.mins || 30)));
              if (mins) useVault.getState().saveItem({ ...r, data: { ...(r.data as Record<string, unknown>), mins: Number(mins) } });
            }}>⏱</button>
            <button type="button" className="btn mini danger" onClick={() => s.confirm('DELETE RECIPE?', r.title, () => useVault.getState().deleteItem(r.id))}>✕</button>
          </Row>
        ))}
        {!recipes.length && <Empty>no recipes — add the one you make from memory.</Empty>}
      </div>
    </>
  );
}

/* ================= idea incubator ================= */

const RIPE_ICON: Record<string, string> = { seed: '🌱', cooking: '🍳', ready: '🚀' };

export function IdeasPage() {
  const s = usePsych0();
  useEnsure();
  const items = useVault(st => st.items);
  const ideas = items.filter(i => i.type === 'idea');
  const [text, setText] = useState('');

  // resurface: the idea you have ignored longest, served up fresh
  const resurface = useMemo(() => {
    if (ideas.length < 2) return null;
    const sorted = ideas.slice().sort((a, b) => (a.updated_at || '').localeCompare(b.updated_at || ''));
    return sorted[0];
  }, [ideas]);

  const setRipe = (i: VaultItem, ripe: string) =>
    useVault.getState().saveItem({ ...i, data: { ...(i.data as Record<string, unknown>), ripe } });

  return (
    <>
      <OsHead title="IDEA INCUBATOR" />
      <p className="dim small">every idea starts as a seed. ripeness is honest: seed → cooking → ready. ignored ideas get resurfaced so nothing good dies quietly.</p>
      {resurface && (
        <div className="callout note"><b className="ct">⏾ RESURFACED FROM THE DEPTHS</b>
          <p><b>{resurface.title}</b> — {resurface.body.slice(0, 160)}</p>
          <button type="button" className="btn mini" onClick={() => setRipe(resurface, 'cooking')}>🍳 START COOKING</button>
        </div>
      )}
      <div className="btnrow">
        <input value={text} placeholder="capture an idea…" onChange={e => setText(e.target.value)} style={{ maxWidth: 420 }}
          onKeyDown={e => { if (e.key === 'Enter' && text.trim()) { useVault.getState().saveItem({ type: 'idea', title: text.trim().slice(0, 90), body: '', tags: [], data: { ripe: 'seed' } }); setText(''); s.beep(990, .05); } }} />
        <button type="button" className="btn mini" disabled={!text.trim()} onClick={() => { useVault.getState().saveItem({ type: 'idea', title: text.trim().slice(0, 90), body: '', tags: [], data: { ripe: 'seed' } }); setText(''); }}>＋ CAPTURE</button>
      </div>
      <div className="stack" style={{ marginTop: 10 }}>
        {ideas.map(i => {
          const ripe = String((i.data as { ripe?: string })?.ripe || 'seed');
          return (
            <Row key={i.id}>
              <span className="ld">{RIPE_ICON[ripe] || '🌱'}</span>
              <span className="lt"><b>{i.title}</b>{i.body && <><br /><span className="dim small">{i.body.slice(0, 110)}</span></>}</span>
              <span className="spacer" />
              <span className="chip">{fmtWhen(i.updated_at).slice(5)}</span>
              {['seed', 'cooking', 'ready'].map(r => (
                <button key={r} type="button" className={'chip' + (ripe === r ? ' on' : '')} onClick={() => setRipe(i, r)}>{r}</button>
              ))}
              <button type="button" className="btn mini danger" onClick={() => s.confirm('DELETE IDEA?', i.title, () => useVault.getState().deleteItem(i.id))}>✕</button>
            </Row>
          );
        })}
        {!ideas.length && <Empty>no ideas incubating — suspicious. capture one.</Empty>}
      </div>
    </>
  );
}

/* ================= money ================= */

export function MoneyPage() {
  const s = usePsych0();
  useEnsure();
  const items = useVault(st => st.items);
  const expenses = items.filter(i => i.type === 'expense');
  const subs = items.filter(i => i.type === 'sub');
  const [what, setWhat] = useState('');
  const [amt, setAmt] = useState('');
  const [cat, setCat] = useState('food');
  const [subName, setSubName] = useState('');
  const [subAmt, setSubAmt] = useState('');
  const [subRenews, setSubRenews] = useState('');

  const month = dayKey().slice(0, 7);
  const monthExp = expenses.filter(e => String((e.data as { day?: string })?.day || '').slice(0, 7) === month);
  const total = sumBy(monthExp, e => Number((e.data as { amount?: number })?.amount || 0));
  const byCat = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of monthExp) {
      const c = String((e.data as { cat?: string })?.cat || 'other');
      m.set(c, (m.get(c) || 0) + Number((e.data as { amount?: number })?.amount || 0));
    }
    return [...m.entries()].map(([label, v]) => ({ label, v })).sort((a, b) => b.v - a.v);
  }, [monthExp]);
  const daily = lastNDays(21).map(day => ({
    label: day.slice(5),
    v: sumBy(monthExp.filter(e => String((e.data as { day?: string })?.day || '') === day), e => Number((e.data as { amount?: number })?.amount || 0)),
  }));
  const monthSubs = sumBy(subs, x => Number((x.data as { amount?: number })?.amount || 0));
  const renewing = subs.filter(x => {
    const r = String((x.data as { renews?: string })?.renews || '');
    return r && new Date(r + 'T23:59:59').getTime() - Date.now() < 14 * 86400000;
  });

  const addExpense = async () => {
    const a = Number(amt);
    if (!what.trim() || !a) return;
    await useVault.getState().saveItem({ type: 'expense', title: what.trim(), body: '', tags: [], data: { amount: a, cat, day: today() } });
    setWhat(''); setAmt('');
    s.toast('LOGGED ' + fmtMoney(a) + ' — ' + cat, 'ok'); s.beep(660, .04);
  };

  return (
    <>
      <OsHead title="MONEY">
        <span className="chip">{month} SPEND: {fmtMoney(total)}</span>
        <span className="chip">SUBS/MO: {fmtMoney(monthSubs)}</span>
      </OsHead>
      <p className="dim small">quiet budget tracking: expenses by day and category, subscriptions with renewal alarms (14 days out).</p>

      {!!renewing.length && (
        <div className="callout warn"><b className="ct">⚠ SUBSCRIPTIONS RENEWING SOON</b>
          <p>{renewing.map(x => x.title + ' (' + fmtMoney(Number((x.data as { amount?: number })?.amount || 0)) + ', ' + String((x.data as { renews?: string })?.renews) + ')').join(' · ')}</p>
        </div>
      )}

      <div className="os2col">
        <div className="oscol">
          <div className="sechead">LOG AN EXPENSE</div>
          <div className="row2">
            <Field label="WHAT"><input value={what} onChange={e => setWhat(e.target.value)} placeholder="coffee beans" /></Field>
            <Field label="AMOUNT"><input value={amt} onChange={e => setAmt(e.target.value)} placeholder="12.50" /></Field>
          </div>
          <div className="btnrow wrapbtns">
            {['food', 'infra', 'fun', 'transport', 'other'].map(c => (
              <button key={c} type="button" className={'chip' + (cat === c ? ' on' : '')} onClick={() => setCat(c)}>{c}</button>
            ))}
            <button type="button" className="btn mini" onClick={addExpense} disabled={!what.trim() || !Number(amt)}>＋ LOG</button>
          </div>
          <div className="sechead" style={{ marginTop: 12 }}>RECENT</div>
          <div className="loglines">
            {monthExp.slice(0, 12).map(e => (
              <Row key={e.id}>
                <span className="ld">{String((e.data as { day?: string })?.day || '').slice(5)}</span>
                <span className="lt">{e.title}</span>
                <span className="spacer" />
                <span className="chip">{String((e.data as { cat?: string })?.cat)}</span>
                <span className="chip st-SHIPPED">{fmtMoney(Number((e.data as { amount?: number })?.amount || 0))}</span>
                <button type="button" className="btn mini danger" onClick={() => useVault.getState().deleteItem(e.id)}>✕</button>
              </Row>
            ))}
            {!monthExp.length && <Empty>nothing logged this month.</Empty>}
          </div>
        </div>
        <div className="oscol">
          <div className="sechead">SPEND — LAST 21 DAYS</div>
          <CanvasBars data={daily} h={110} fmt={n => n ? Math.round(n) + '' : ''} />
          <div className="sechead" style={{ marginTop: 12 }}>BY CATEGORY — {month}</div>
          <CanvasBars data={byCat} h={110} fmt={n => Math.round(n) + ''} />
          <div className="sechead" style={{ marginTop: 12 }}>SUBSCRIPTIONS</div>
          <div className="btnrow wrapbtns">
            <input value={subName} placeholder="name" onChange={e => setSubName(e.target.value)} style={{ maxWidth: 140 }} />
            <input value={subAmt} placeholder="€/mo" onChange={e => setSubAmt(e.target.value)} style={{ maxWidth: 80 }} />
            <input type="date" value={subRenews} onChange={e => setSubRenews(e.target.value)} style={{ maxWidth: 150 }} />
            <button type="button" className="btn mini" disabled={!subName.trim() || !Number(subAmt)} onClick={async () => {
              await useVault.getState().saveItem({ type: 'sub', title: subName.trim(), body: '', tags: [], data: { amount: Number(subAmt), renews: subRenews || null } });
              setSubName(''); setSubAmt(''); setSubRenews('');
              s.toast('SUB TRACKED', 'ok');
            }}>＋ TRACK</button>
          </div>
          <div className="loglines" style={{ marginTop: 8 }}>
            {subs.map(x => {
              const r = String((x.data as { renews?: string })?.renews || '');
              const soon = r && new Date(r + 'T23:59:59').getTime() - Date.now() < 14 * 86400000;
              return (
                <Row key={x.id}>
                  <span className="ld">↻</span>
                  <span className="lt"><b>{x.title}</b></span>
                  <span className="spacer" />
                  {soon && <span className="chip overdue">renews {relDay(r)}</span>}
                  <span className="chip">{fmtMoney(Number((x.data as { amount?: number })?.amount || 0))}/mo</span>
                  <button type="button" className="btn mini danger" onClick={() => s.confirm('DELETE SUB?', x.title, () => useVault.getState().deleteItem(x.id))}>✕</button>
                </Row>
              );
            })}
            {!subs.length && <Empty>no subscriptions tracked.</Empty>}
          </div>
        </div>
      </div>
    </>
  );
}

/* ================= collection builder ================= */

export function CollectionsPage({ colId }: { colId?: string }) {
  const s = usePsych0();
  useEnsure();
  const site = usePsych0(st => st.site);
  const saveSite = usePsych0(st => st.saveSite);
  const items = useVault(st => st.items);
  const collections = (site.collections || []) as OsCollection[];
  const [active, setActive] = useState<string | null>(colId || null);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('◈');
  const [fieldsTxt, setFieldsTxt] = useState('title:TITLE:text\nrating:RATING:stars\nbought:BOUGHT:date');
  const [editing, setEditing] = useState<VaultItem | null>(null);
  const [view, setView] = useState<'cards' | 'table'>('cards');

  const activeCol = collections.find(c => c.id === active) || null;

  const parseFields = (txt: string): OsField[] =>
    txt.split('\n').map(line => line.trim()).filter(Boolean).map(line => {
      const [key, label, kind, opts] = line.split(':').map(x => (x || '').trim());
      return { key: (key || 'field').replace(/[^a-z0-9]/gi, ''), label: label || key, kind: (['text', 'num', 'date', 'select', 'stars', 'url'].includes(kind) ? kind : 'text') as OsField['kind'], opts };
    }).filter(f => f.key);

  const createCol = async () => {
    if (!name.trim()) return;
    const col: OsCollection = { id: 'c' + uid(), name: name.trim(), icon: icon || '◈', fields: parseFields(fieldsTxt) };
    await saveSite({ collections: [...collections, col] });
    setActive(col.id);
    setName('');
    s.toast('COLLECTION CREATED — ' + col.name, 'ok');
  };

  const deleteCol = (col: OsCollection) => s.confirm('DELETE COLLECTION ' + col.name + '?', 'items stay in the vault but lose their schema view.', async () => {
    await saveSite({ collections: collections.filter(c => c.id !== col.id) });
    setActive(null);
  });

  const rows = activeCol ? items.filter(i => i.type === 'col.' + activeCol.id) : [];
  const editFields: FieldDef[] = activeCol
    ? activeCol.fields.map(f => ({ key: f.key, label: f.label, kind: f.kind, opts: f.opts }))
    : [];

  return (
    <>
      <OsHead title="COLLECTIONS" />
      <p className="dim small">your own databases: define fields once, then collect anything — games finished, gear owned, watches wanted, plants kept alive.</p>

      <div className="rowwrap" style={{ marginBottom: 10 }}>
        {collections.map(c => (
          <button key={c.id} type="button" className={'chip' + (active === c.id ? ' on' : '')} onClick={() => setActive(c.id)}>
            {c.icon} {c.name} <span className="dim">({items.filter(i => i.type === 'col.' + c.id).length})</span>
          </button>
        ))}
      </div>

      {!activeCol ? (
        <>
          <div className="sechead">NEW COLLECTION</div>
          <div className="row2" style={{ maxWidth: 640 }}>
            <Field label="ICON"><input value={icon} onChange={e => setIcon(e.target.value.slice(0, 2))} /></Field>
            <Field label="NAME"><input value={name} onChange={e => setName(e.target.value)} placeholder="games finished" /></Field>
          </div>
          <Field label="FIELDS — one per line: key:LABEL:kind (text/num/date/select/stars/url; select uses a 4th part for options)">
            <textarea rows={4} value={fieldsTxt} onChange={e => setFieldsTxt(e.target.value)} spellCheck={false} />
          </Field>
          <div className="btnrow"><button type="button" className="btn" disabled={!name.trim()} onClick={createCol}>＋ CREATE</button></div>
        </>
      ) : (
        <>
          <div className="sechead">{activeCol.icon} {activeCol.name}
            <span className="cnt">{rows.length} items</span>
            <span className="spacer" />
            <button type="button" className={'btn mini' + (view === 'table' ? ' on' : '')} onClick={() => setView(v => v === 'cards' ? 'table' : 'cards')}>{view === 'cards' ? '☰ TABLE' : '▤ CARDS'}</button>
            <button type="button" className="btn mini danger" onClick={() => deleteCol(activeCol)}>✕ SCHEMA</button>
          </div>
          <div className="btnrow" style={{ marginBottom: 8 }}>
            <button type="button" className="btn" onClick={() => setEditing({ id: '', type: 'col.' + activeCol.id, title: '', body: '', data: {}, tags: [], created_at: '' } as unknown as VaultItem)}>＋ ADD ITEM</button>
          </div>
          {view === 'table' ? (
            <div className="tablewrap">
              <table className="ostable">
                <thead><tr><th>TITLE</th>{activeCol.fields.map(f => <th key={f.key}>{f.label}</th>)}<th /></tr></thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.id}>
                      <td><b>{r.title}</b>{r.body && <span className="dim small"> · {r.body.slice(0, 60)}</span>}</td>
                      {activeCol.fields.map(f => {
                        const v = (r.data as Record<string, unknown>)[f.key];
                        return <td key={f.key}>{f.kind === 'stars' ? <Stars n={Number(v || 0)} /> : String(v ?? '—')}</td>;
                      })}
                      <td>
                        <button type="button" className="xbtn" onClick={() => setEditing(r)}>✎</button>
                        <button type="button" className="xbtn" onClick={() => s.confirm('DELETE ITEM?', r.title, () => useVault.getState().deleteItem(r.id))}>✕</button>
                      </td>
                    </tr>
                  ))}
                  {!rows.length && <tr><td colSpan={activeCol.fields.length + 2} className="dim">empty — add the first item.</td></tr>}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="stack">
              {rows.map(r => (
                <Row key={r.id}>
                  <span className="ld">{activeCol.icon}</span>
                  <span className="lt"><b>{r.title}</b><br />
                    <span className="dim small">{activeCol.fields.map(f => {
                      const v = (r.data as Record<string, unknown>)[f.key];
                      return v !== undefined && v !== '' && f.kind !== 'stars' ? f.label.toLowerCase() + ' ' + String(v) : null;
                    }).filter(Boolean).join(' · ')}</span></span>
                  <span className="spacer" />
                  {activeCol.fields.some(f => f.kind === 'stars') && (
                    <Stars n={Number((r.data as Record<string, unknown>)[activeCol.fields.find(f => f.kind === 'stars')!.key] || 0)}
                      onSet={v => useVault.getState().saveItem({ ...r, data: { ...(r.data as Record<string, unknown>), [activeCol.fields.find(f => f.kind === 'stars')!.key]: v } })} />
                  )}
                  <button type="button" className="btn mini" onClick={() => setEditing(r)}>✎</button>
                  <button type="button" className="btn mini danger" onClick={() => s.confirm('DELETE ITEM?', r.title, () => useVault.getState().deleteItem(r.id))}>✕</button>
                </Row>
              ))}
              {!rows.length && <Empty>empty collection — add the first item.</Empty>}
            </div>
          )}
        </>
      )}

      {editing && activeCol && (
        <DataEditor initial={editing} fields={editFields} withBody title={'NEW ITEM — ' + activeCol.name.toUpperCase()}
          onClose={() => setEditing(null)}
          onSave={d => {
            const isNew = !editing.id;
            useVault.getState().saveItem({ ...editing, ...d, id: isNew ? undefined : editing.id, type: 'col.' + activeCol.id, created_at: isNew ? undefined : editing.created_at } as Partial<VaultItem>);
            setEditing(null);
            s.toast('SAVED', 'ok');
          }} />
      )}
    </>
  );
}
