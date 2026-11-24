'use client';
/* PSYCH://OS — SUPPLY LINES: rules engine, capture-from-anywhere (webhook /
 * telegram / email-in / phone share target), CSV importers, mega backup export. */
import { useEffect, useState } from 'react';
import { usePsych0, dl } from './store';
import { useVault } from './vault';
import { OsHead, Empty, Field, useEnsure, getAiKey, setAiKey as saveAiKey } from './osui';
import { parseCSV } from '@/lib/osutil';
import { uid, type OsRule, type OsCollection, type VaultItem } from '@/lib/types';

/* ================= rules engine ================= */

export function RulesPage() {
  const s = usePsych0();
  useEnsure();
  const site = usePsych0(st => st.site);
  const saveSite = usePsych0(st => st.saveSite);
  const rules = (site.rules || []) as OsRule[];
  const [label, setLabel] = useState('');
  const [mType, setMType] = useState('');
  const [contains, setContains] = useState('');
  const [mTag, setMTag] = useState('');
  const [aTags, setATags] = useState('');
  const [aType, setAType] = useState('');
  const [aFolder, setAFolder] = useState('');

  const add = async () => {
    if (!label.trim()) return;
    const rule: OsRule = {
      id: 'r' + uid(), label: label.trim(), on: true,
      match: { type: mType || undefined, contains: contains || undefined, tag: mTag || undefined },
      act: {
        addTags: aTags ? aTags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
        setType: aType || undefined,
        folder: aFolder || undefined,
      },
    };
    await saveSite({ rules: [...rules, rule] });
    setLabel(''); setContains(''); setATags(''); setAType(''); setAFolder(''); setMTag(''); setMType('');
    s.toast('RULE INSTALLED — fires on every new capture', 'ok');
  };

  return (
    <>
      <OsHead title="RULES ENGINE" />
      <p className="dim small">IF-THIS-THEN-THAT for your vault: every NEW item gets matched against these rules (server-side, before it saves). &ldquo;anything containing &lsquo;invoice&rsquo; → tag #money&rdquo;. old items are untouched.</p>

      <div className="stack">
        {rules.map(r => (
          <div key={r.id} className="logline">
            <span className="ld">{r.on ? '◉' : '○'}</span>
            <span className="lt"><b>{r.label}</b><br />
              <span className="dim small">
                IF {r.match.type ? 'type=' + r.match.type + ' ' : ''}
                {r.match.contains ? 'contains "' + r.match.contains + '" ' : ''}
                {r.match.tag ? 'tagged #' + r.match.tag : ''}
                {' '}THEN {r.act.addTags?.length ? '+' + r.act.addTags.map(t => '#' + t).join(' +') + ' ' : ''}
                {r.act.setType ? 'type→' + r.act.setType + ' ' : ''}
                {r.act.folder ? 'folder=' + r.act.folder : ''}
              </span></span>
            <span className="spacer" />
            <button type="button" className="btn mini" onClick={() => saveSite({ rules: rules.map(x => x.id === r.id ? { ...x, on: !x.on } : x) })}>{r.on ? 'DISABLE' : 'ENABLE'}</button>
            <button type="button" className="btn mini danger" onClick={() => s.confirm('DELETE RULE?', r.label, () => saveSite({ rules: rules.filter(x => x.id !== r.id) }))}>✕</button>
          </div>
        ))}
        {!rules.length && <Empty>no rules — the vault files things as-is.</Empty>}
      </div>

      <div className="sechead" style={{ marginTop: 14 }}>NEW RULE</div>
      <Field label="LABEL"><input value={label} onChange={e => setLabel(e.target.value)} placeholder="invoices → money" /></Field>
      <div className="row2" style={{ maxWidth: 640 }}>
        <Field label="IF TYPE (optional)">
          <select value={mType} onChange={e => setMType(e.target.value)}>
            <option value="">any type</option>
            {['note', 'task', 'bookmark', 'journal', 'expense', 'idea', 'recipe', 'contact', 'media', 'trip', 'goal', 'card', 'capsule'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="IF CONTAINS (optional)"><input value={contains} onChange={e => setContains(e.target.value)} placeholder="invoice" /></Field>
      </div>
      <div className="row2" style={{ maxWidth: 640 }}>
        <Field label="IF TAGGED (optional)"><input value={mTag} onChange={e => setMTag(e.target.value.replace(/[^a-z0-9-]/gi, ''))} placeholder="inbox" /></Field>
        <Field label="THEN ADD TAGS (comma)"><input value={aTags} onChange={e => setATags(e.target.value)} placeholder="money, admin" /></Field>
      </div>
      <div className="row2" style={{ maxWidth: 640 }}>
        <Field label="THEN CHANGE TYPE (optional)">
          <select value={aType} onChange={e => setAType(e.target.value)}>
            <option value="">keep type</option>
            {['note', 'task', 'bookmark', 'idea', 'expense'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="THEN MOVE TO FOLDER (optional)"><input value={aFolder} onChange={e => setAFolder(e.target.value)} placeholder="receipts" /></Field>
      </div>
      <div className="btnrow"><button type="button" className="btn" disabled={!label.trim()} onClick={add}>＋ INSTALL RULE</button></div>
    </>
  );
}

/* ================= plumbing: capture from anywhere ================= */

export function PlumbingPage() {
  const s = usePsych0();
  useEnsure();
  const [secret, setSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiKey, setAiKey] = useState('');
  const [aiKeyStored, setAiKeyStored] = useState(false);
  useEffect(() => { setAiKey(''); setAiKeyStored(!!getAiKey()); }, []);
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://yourden.dev';

  const mint = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/inbox');
      const j = await r.json() as { secret?: string; local?: boolean; message?: string };
      if (j.local) s.toast(j.message || 'needs Supabase', 'warn');
      setSecret(j.secret || '');
    } catch { s.toast('FAILED — is Supabase connected?', 'warn'); }
    setLoading(false);
  };

  const curlExample = 'curl -X POST "' + origin + '/api/inbox?secret=' + (secret || 'SECRET') + '" \\\n  -H "Content-Type: application/json" \\\n  -d \'{"text":"milk, eggs, revenge","kind":"task"}\'';
  const telegramNote = 'BotFather → /newbot → copy the token → env TELEGRAM_BOT_TOKEN → set webhook: https://api.telegram.org/bot<TOKEN>/setWebhook?url=' + origin + '/api/inbox%3Fsecret%3D' + (secret || 'SECRET');

  return (
    <>
      <OsHead title="PLUMBING">
        <button type="button" className="btn mini" disabled={loading} onClick={mint}>{loading ? '▮▮▮' : secret ? '⟳ SHOW SECRET' : '⚡ MINT CAPTURE SECRET'}</button>
      </OsHead>
      <p className="dim small">capture from anywhere: a plain webhook, your Telegram bot, an email parser, the phone share target — everything lands in the vault (tagged #inbox) and your rules file it.</p>

      <div className="os2col">
        <div className="oscol">
          <div className="sechead">⬒ CAPTURE WEBHOOK</div>
          {secret ? (
            <>
              <div className="callout tip"><b className="ct">SECRET (keep it private)</b><p><code>{secret}</code></p></div>
              <Field label="ENDPOINT"><input readOnly value={'POST ' + origin + '/api/inbox?secret=' + secret} onFocus={e => e.currentTarget.select()} /></Field>
              <Field label="TRY IT"><textarea rows={4} readOnly value={curlExample} onFocus={e => e.currentTarget.select()} /></Field>
              <div className="helpline">body: {'{ text, kind?: note|task|bookmark, title?, url?, tags?, due? }'} — also accepts raw Telegram update payloads.</div>
            </>
          ) : (
            <Empty>mint a secret first — it locks your capture endpoint to you.</Empty>
          )}

          <div className="sechead" style={{ marginTop: 14 }}>✈ TELEGRAM BOT</div>
          <p className="dim small">DM your bot; every message becomes a capture. it even replies &ldquo;filed ✓&rdquo;.</p>
          <Field label="SETUP (copy each step)"><textarea rows={3} readOnly value={telegramNote} onFocus={e => e.currentTarget.select()} /></Field>
        </div>

        <div className="oscol">
          <div className="sechead">✉ EMAIL-IN</div>
          <p className="dim small">point any email-parser automation (Zapier &ldquo;Email Parser&rdquo;, Make, a tiny IMAP script) at the capture webhook: subject → <code>title</code>, body → <code>text</code>. forwarding a newsletter = it&apos;s in the vault.</p>

          <div className="sechead" style={{ marginTop: 14 }}>📱 PHONE CAPTURE</div>
          <p className="dim small">install the den as an app (browser menu → Install), then use your OS &ldquo;share&rdquo; menu on any page, photo or text → PSYCH0 → it&apos;s captured. iOS Shortcuts work too: a shortcut that POSTs to the webhook gives you Siri capture.</p>

          <div className="sechead" style={{ marginTop: 14 }}>✦ AI KEY — THIS BROWSER ONLY</div>
          <p className="dim small">paste an OpenRouter key (starts <code>sk-or-</code>, free models — the OS defaults to <code>openrouter/free</code>) or any OpenAI-compatible key. it is stored in this browser&apos;s localStorage, sent with each AI request, and never written to the database. for a site-wide key use env: <code>OPENROUTER_API_KEY</code> or <code>OPENAI_API_KEY</code>.</p>
          <div className="btnrow wrapbtns">
            <input value={aiKey} placeholder="sk-or-…" onChange={e => setAiKey(e.target.value)} style={{ maxWidth: 320 }} type="password" />
            <button type="button" className="btn mini" disabled={!aiKey.trim()} onClick={() => { saveAiKey(aiKey); setAiKeyStored(true); s.toast(aiKey.trim().startsWith('sk-or-') ? 'OPENROUTER KEY SAVED — free tier active in this browser' : 'KEY SAVED — this browser only', 'ok'); }}>💾 SAVE KEY</button>
            <button type="button" className="btn mini" onClick={() => { saveAiKey(''); setAiKeyStored(false); setAiKey(''); s.toast('KEY CLEARED', 'warn'); }}>⟲ CLEAR</button>
            <span className="chip">{aiKey.trim().startsWith('sk-or-') ? 'OPENROUTER · ' + (usePsych0.getState().mode === 'supabase' ? 'live' : 'local') : aiKeyStored ? 'KEY SET' : 'NO LOCAL KEY'}</span>
          </div>

          <div className="sechead" style={{ marginTop: 14 }}>⤓ MEGA BACKUP</div>
          <p className="dim small">everything out, anytime, zero lock-in: site + posts + vault items + drive metadata + short links as one JSON.</p>
          <div className="btnrow wrapbtns">
            <button type="button" className="btn" onClick={() => useVault.getState().exportVault()}>⬇ VAULT JSON</button>
            <button type="button" className="btn" onClick={async () => {
              try {
                const r = await fetch('/api/backup');
                const j = await r.json() as Record<string, unknown>;
                if (j.error) { s.toast(String(j.message || 'backup needs Supabase'), 'warn'); return; }
                dl('psych0-os-backup.json', JSON.stringify(j, null, 2), 'application/json');
                s.toast('FULL BACKUP DOWNLOADED', 'ok');
              } catch { s.toast('BACKUP FAILED', 'warn'); }
            }}>⬇ EVERYTHING (site + vault)</button>
            <button type="button" className="btn" onClick={() => s.exportJson()}>⬇ BLOG CONTENT</button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ================= importers (CSV → anything) ================= */

const COLS: Record<string, string> = {
  title: 'title', name: 'title', task: 'title',
  body: 'body', note: 'body', notes: 'body', description: 'body', desc: 'body', text: 'body',
  tags: 'tags', tag: 'tags',
  url: 'url', link: 'url', href: 'url',
  amount: 'amount', price: 'amount', cost: 'amount',
  date: 'day', day: 'day', when: 'day',
  category: 'cat', cat: 'cat',
  due: 'due',
  front: 'front', question: 'front', back: 'back', answer: 'back',
  handle: 'handle', birthday: 'birthday', last: 'last',
  kind: 'kind', status: 'status', rating: 'rating', progress: 'progress',
  ripe: 'ripe', loc: 'loc', mins: 'mins', priority: 'priority',
};

export function ImportOsPage() {
  const s = usePsych0();
  useEnsure();
  const site = usePsych0(st => st.site);
  const collections = (site.collections || []) as OsCollection[];
  const [rows, setRows] = useState<string[][]>([]);
  const [target, setTarget] = useState('note');
  const [done_, setDone] = useState(0);
  const [busy, setBusy] = useState(false);

  const load = (files: FileList | null) => {
    if (!files?.length) return;
    const r = new FileReader();
    r.onload = () => {
      const parsed = parseCSV(String(r.result || ''));
      setRows(parsed);
      setDone(0);
      s.toast(parsed.length ? parsed.length - 1 + ' DATA ROWS FOUND' : 'EMPTY CSV?', parsed.length ? 'ok' : 'warn');
    };
    r.readAsText(files[0]);
  };

  const headerMap = (header: string[]): Record<number, string> => {
    const map: Record<number, string> = {};
    header.forEach((h, i) => { const k = COLS[h.trim().toLowerCase()]; if (k) map[i] = k; });
    return map;
  };

  const doImport = async () => {
    if (rows.length < 2) return;
    setBusy(true);
    const map = headerMap(rows[0]);
    let n = 0;
    for (const row of rows.slice(1)) {
      const rec: Record<string, string> = {};
      for (const [i, key] of Object.entries(map)) rec[key] = (row[Number(i)] || '').trim();
      if (!rec.title && !rec.body && !rec.url) continue;
      const data: Record<string, unknown> = {};
      if (rec.url) data.url = rec.url;
      if (rec.amount) data.amount = Number(rec.amount) || 0;
      if (rec.day) data.day = rec.day;
      if (rec.cat) data.cat = rec.cat;
      if (rec.due) data.due = rec.due;
      if (rec.front) data.front = rec.front;
      if (rec.back) data.back = rec.back;
      if (rec.handle) data.handle = rec.handle;
      if (rec.birthday) data.birthday = rec.birthday;
      if (rec.last) data.last = rec.last;
      if (rec.kind) data.kind = rec.kind;
      if (rec.status) data.status = rec.status;
      if (rec.rating) data.rating = Number(rec.rating) || 0;
      if (rec.ripe) data.ripe = rec.ripe;
      if (rec.loc) data.loc = rec.loc;
      if (rec.mins) data.mins = Number(rec.mins) || 0;
      if (rec.priority) data.priority = rec.priority;
      else if (target === 'task') data.priority = 'now';
      const item: Partial<VaultItem> = {
        type: target,
        title: (rec.title || rec.front || rec.url || 'imported').slice(0, 200),
        body: rec.body || rec.back || '',
        tags: rec.tags ? rec.tags.split(/[;|]/).map(t => t.trim().toLowerCase()).filter(Boolean) : ['imported'],
        data,
      };
      try { await useVault.getState().saveItem(item); n++; } catch { /* keep going */ }
    }
    setBusy(false);
    setDone(n);
    s.toast('IMPORTED ' + n + ' ITEMS → ' + target.toUpperCase(), 'ok');
    setRows([]);
  };

  const targetIsCard = target === 'card';

  return (
    <>
      <OsHead title="IMPORT ENGINE // OS" />
      <p className="dim small">CSV → anything: contacts from Google, expenses from your bank, flashcards from Anki exports (front,back), bookmarks from pinboard… headers are auto-mapped. blog posts (.md/.html/WordPress) live in STUDIO → IMPORT.</p>

      <div className="btnrow wrapbtns">
        <label className="btn mini" style={{ cursor: 'pointer' }}>
          ⤒ CSV FILE<input type="file" hidden accept=".csv,.txt" onChange={e => { load(e.target.files); e.currentTarget.value = ''; }} />
        </label>
        <Field label="TARGET">
          <select value={target} onChange={e => setTarget(e.target.value)}>
            <optgroup label="core types">
              {['note', 'task', 'bookmark', 'contact', 'expense', 'idea', 'recipe', 'card', 'trip', 'media'].map(t => <option key={t} value={t}>{t}</option>)}
            </optgroup>
            {!!collections.length && (
              <optgroup label="your collections">
                {collections.map(c => <option key={c.id} value={'col.' + c.id}>{c.icon} {c.name}</option>)}
              </optgroup>
            )}
          </select>
        </Field>
        <button type="button" className="btn" disabled={rows.length < 2 || busy} onClick={doImport}>{busy ? '▮▮▮ IMPORTING' : '⬆ IMPORT ' + Math.max(0, rows.length - 1) + ' ROWS'}</button>
        {done_ > 0 && <span className="chip st-SHIPPED">{done_} IMPORTED ✓</span>}
      </div>

      {rows.length > 1 && (
        <>
          <div className="sechead" style={{ marginTop: 10 }}>PREVIEW<span className="cnt">{rows.length - 1} rows · mapped: {Object.values(headerMap(rows[0])).join(', ') || 'NO KNOWN HEADERS'}</span></div>
          <div className="tablewrap">
            <table className="ostable">
              <thead><tr>{rows[0].map((h, i) => <th key={i}>{String(h).slice(0, 16)}</th>)}</tr></thead>
              <tbody>
                {rows.slice(1, 6).map((r, ri) => <tr key={ri}>{r.map((c, ci) => <td key={ci}>{String(c).slice(0, 40)}</td>)}</tr>)}
              </tbody>
            </table>
          </div>
          {targetIsCard && <div className="helpline">card imports map front/back/question/answer columns.</div>}
        </>
      )}
    </>
  );
}
