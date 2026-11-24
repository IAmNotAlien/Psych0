'use client';
/* PSYCH://OS — LIFE OPS: tasks + GTD kanban, calendar, habits + mood log,
 * pomodoro focus timer, goals, weekly review generator, SM-2 flashcards. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePsych0 } from './store';
import { useVault } from './vault';
import { OsHead, Empty, Field, Stars, DueChip, CanvasBars, CanvasLine, Ring, MonthGrid, DataEditor, aiTask, fmtWhen, relDay, useEnsure, getAiKey, type FieldDef } from './osui';
import { sm2, dayKey, lastNDays, streakOf, weekScore } from '@/lib/osutil';
import type { VaultItem } from '@/lib/types';

const TASK_FIELDS: FieldDef[] = [
  { key: 'priority', label: 'PRIORITY', kind: 'select', opts: 'now,soon,later,someday' },
  { key: 'due', label: 'DUE', kind: 'date' },
];

const PRIORITY: Record<string, string> = { now: 'NOW', soon: 'SOON', later: 'LATER', someday: 'SOMEDAY' };

/* ================= tasks + GTD ================= */

export function TasksPage() {
  const s = usePsych0();
  useEnsure();
  const items = useVault(st => st.items);
  const tasks = useMemo(() => items.filter(i => i.type === 'task'), [items]);
  const inboxNotes = useMemo(() => items.filter(i => i.type === 'note' && (i.tags || []).includes('inbox')), [items]);
  const [q, setQ] = useState('');
  const [quick, setQuick] = useState('');
  const [editing, setEditing] = useState<VaultItem | null>(null);
  const today = dayKey();

  const add = async () => {
    if (!quick.trim()) return;
    await useVault.getState().saveItem({ type: 'task', title: quick.trim(), body: '', tags: ['inbox'], data: { priority: 'now' } });
    setQuick('');
    s.beep(990, .05);
  };
  const done = (t: VaultItem) => {
    useVault.getState().saveItem({ ...t, done: !t.done });
    s.beep(t.done ? 440 : 990, .05);
    if (!t.done) s.toast('TASK CRUSHED ✓', 'ok');
  };

  const overdue = tasks.filter(t => !t.done && String((t.data as { due?: string })?.due || '') < today);
  const dueToday = tasks.filter(t => !t.done && String((t.data as { due?: string })?.due || '') === today);
  const filtered = (arr: VaultItem[]) => arr.filter(t => !q.trim() || (t.title + t.body).toLowerCase().includes(q.toLowerCase()));
  const byPri = (p: string) => filtered(tasks.filter(t => !t.done && String((t.data as { priority?: string })?.priority || 'now') === p));
  const doneTasks = filtered(tasks.filter(t => t.done)).slice(0, 12);

  const card = (t: VaultItem) => (
    <div key={t.id} className="taskcard">
      <button type="button" className={'check' + (t.done ? ' on' : '')} onClick={() => done(t)} aria-label="toggle done">{t.done ? '✓' : ''}</button>
      <div className="taskbody">
        <b>{t.title}</b>
        <div className="rowwrap">
          <span className={'chip pri-' + String((t.data as { priority?: string })?.priority || 'now')}>{PRIORITY[String((t.data as { priority?: string })?.priority || 'now')]}</span>
          <DueChip due={String((t.data as { due?: string })?.due || '') || null} done={t.done} />
          {(t.tags || []).map(tag => <span key={tag} className="chip tag">#{tag}</span>)}
        </div>
      </div>
      <span className="spacer" />
      <button type="button" className="xbtn" onClick={() => setEditing(t)}>✎</button>
      <button type="button" className="xbtn" onClick={() => s.confirm('DELETE TASK?', t.title, () => useVault.getState().deleteItem(t.id))}>✕</button>
    </div>
  );

  return (
    <>
      <OsHead title="TASKS">
        <span className="chip">{overdue.length} OVERDUE</span>
        <span className="chip">{dueToday.length} TODAY</span>
      </OsHead>
      <p className="dim small">capture into the inbox, work the kanban by priority, everything with a due date shows up on the calendar and the daily briefing.</p>

      <div className="btnrow">
        <input value={quick} placeholder="add a task and hit ⏎…"
          onChange={e => setQuick(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') add(); }} />
        <button type="button" className="btn" onClick={add}>＋ ADD</button>
        <input value={q} placeholder="filter…" onChange={e => setQ(e.target.value)} style={{ maxWidth: 200 }} />
      </div>

      {!!inboxNotes.length && (
        <div className="callout tip"><b className="ct">INBOX — {inboxNotes.length} unfiled</b>
          {inboxNotes.slice(0, 4).map(n => (
            <div key={n.id} className="logline">
              <span className="lt">{n.title}</span>
              <span className="spacer" />
              <button type="button" className="btn mini" onClick={() => useVault.getState().patch(n.id, { type: 'task', data: { priority: 'now' }, tags: (n.tags || []).filter(t => t !== 'inbox') })}>→ TASK</button>
              <button type="button" className="btn mini" onClick={() => useVault.getState().patch(n.id, { tags: (n.tags || []).filter(t => t !== 'inbox') })}>→ KEEP AS NOTE</button>
            </div>
          ))}
        </div>
      )}

      {(!!overdue.length || !!dueToday.length) && (
        <>
          <div className="sechead">TODAY<span className="cnt">{overdue.length} overdue · {dueToday.length} due</span></div>
          <div className="stack">
            {overdue.map(card)}
            {dueToday.map(card)}
          </div>
        </>
      )}

      <div className="sechead" style={{ marginTop: 14 }}>KANBAN — BY PRIORITY</div>
      <div className="kanban">
        {['now', 'soon', 'later'].map(p => (
          <div key={p} className="kcol">
            <div className="khead">{PRIORITY[p]}<span className="cnt">{byPri(p).length}</span></div>
            <div className="kstack">{byPri(p).map(card)}{!byPri(p).length && <Empty>clear</Empty>}</div>
          </div>
        ))}
      </div>

      <div className="sechead" style={{ marginTop: 14 }}>SOMEDAY<span className="cnt">{byPri('someday').length}</span></div>
      <div className="stack">{byPri('someday').map(card)}{!byPri('someday').length && <Empty>nothing parked — either do it, defer it or delete it.</Empty>}</div>

      <div className="sechead" style={{ marginTop: 14 }}>DONE (RECENT)</div>
      <div className="stack">{doneTasks.map(card)}{!doneTasks.length && <Empty>nothing finished yet today. go get one.</Empty>}</div>

      {editing && (
        <DataEditor initial={editing} fields={TASK_FIELDS} onClose={() => setEditing(null)}
          onSave={d => { useVault.getState().saveItem({ ...editing, ...d }); setEditing(null); }} />
      )}
    </>
  );
}

/* ================= calendar ================= */

export function CalendarPage() {
  const s = usePsych0();
  useEnsure();
  const items = useVault(st => st.items);
  const [cursor, setCursor] = useState(() => ({ y: new Date().getFullYear(), m: new Date().getMonth() }));
  const [title, setTitle] = useState('');
  const [day, setDay] = useState(dayKey());
  const [kind, setKind] = useState<'event' | 'task'>('event');

  const events = items.filter(i => i.type === 'event');
  const byDay = (key: string) => ({
    events: events.filter(e => String((e.data as { day?: string })?.day || '') === key),
    tasks: items.filter(i => i.type === 'task' && !i.done && String((i.data as { due?: string })?.due || '') === key),
    journal: items.some(i => i.type === 'journal' && String((i.data as { day?: string })?.day || '') === key),
  });

  const upcoming = events
    .filter(e => String((e.data as { day?: string })?.day || '') >= dayKey())
    .sort((a, b) => String((a.data as { day?: string }).day).localeCompare(String((b.data as { day?: string }).day)))
    .slice(0, 6);

  return (
    <>
      <OsHead title="CALENDAR" />
      <p className="dim small">tasks by due date, events, exam countdowns, journal days. everything meets here.</p>

      <div className="os2col">
        <div className="oscol">
          <MonthGrid cursor={cursor} onMove={setCursor} renderDay={key => {
            const d = byDay(key);
            if (!d.events.length && !d.tasks.length && !d.journal) return null;
            return (
              <div className="mchips">
                {d.journal && <span className="chip mini" title="journal written">✎</span>}
                {d.events.slice(0, 2).map(e => <span key={e.id} className="chip mini acc2" title={e.title}>{e.title.slice(0, 12)}</span>)}
                {d.tasks.slice(0, 3).map(t => <span key={t.id} className="chip mini" title={t.title}>▢ {t.title.slice(0, 10)}</span>)}
                {d.tasks.length > 3 && <span className="chip mini">+{d.tasks.length - 3}</span>}
              </div>
            );
          }} />
        </div>
        <div className="oscol">
          <div className="sechead">ADD TO A DAY</div>
          <div className="row2">
            <Field label="TITLE"><input value={title} onChange={e => setTitle(e.target.value)} /></Field>
            <Field label="DATE"><input type="date" value={day} onChange={e => setDay(e.target.value)} /></Field>
          </div>
          <div className="btnrow">
            <button type="button" className="btn" disabled={!title.trim()} onClick={async () => {
              await useVault.getState().saveItem({ type: kind, title: title.trim(), body: '', tags: [], data: kind === 'event' ? { day } : { due: day, priority: 'now' } });
              setTitle(''); s.toast(kind.toUpperCase() + ' ON ' + day, 'ok'); s.beep(880, .05);
            }}>＋ AS {kind.toUpperCase()}</button>
            <button type="button" className={'btn mini' + (kind === 'event' ? ' on' : '')} onClick={() => setKind('event')}>EVENT</button>
            <button type="button" className={'btn mini' + (kind === 'task' ? ' on' : '')} onClick={() => setKind('task')}>TASK</button>
          </div>

          <div className="sechead" style={{ marginTop: 14 }}>COUNTDOWNS</div>
          <div className="loglines">
            {upcoming.map(e => (
              <div key={e.id} className="logline">
                <span className="ld">{String((e.data as { day?: string }).day).slice(5)}</span>
                <span className="lt"><b>{e.title}</b></span>
                <span className="spacer" />
                <span className="chip st-SHIPPED">{relDay(String((e.data as { day?: string }).day)).toUpperCase()}</span>
                <button type="button" className="btn mini danger" onClick={() => s.confirm('DELETE EVENT?', e.title, () => useVault.getState().deleteItem(e.id))}>✕</button>
              </div>
            ))}
            {!upcoming.length && <Empty>nothing ahead on the runway.</Empty>}
          </div>
        </div>
      </div>
    </>
  );
}

/* ================= habits + mood ================= */

export function HabitsPage() {
  const s = usePsych0();
  useEnsure();
  const items = useVault(st => st.items);
  const habits = items.filter(i => i.type === 'habit').sort((a, b) => a.title.localeCompare(b.title));
  const logs = items.filter(i => i.type === 'habitlog');
  const moods = items.filter(i => i.type === 'mood');
  const [hTitle, setHTitle] = useState('');
  const [hIcon, setHIcon] = useState('◆');
  const [sleep, setSleep] = useState('');
  const [workout, setWorkout] = useState('');
  const today = dayKey();
  const days56 = lastNDays(56);

  const logSet = (habitId: string) => new Set(logs.filter(l => String((l.data as { habit?: string })?.habit || '') === habitId && l.done).map(l => String((l.data as { day?: string }).day)));

  const toggleLog = async (habitId: string, day: string) => {
    const cur = logs.find(l => String((l.data as { habit?: string })?.habit || '') === habitId && String((l.data as { day?: string }).day) === day);
    if (cur) await useVault.getState().deleteItem(cur.id);
    else await useVault.getState().saveItem({ type: 'habitlog', title: 'log ' + day, body: '', tags: [], done: true, data: { habit: habitId, day } });
    s.beep(990, .04);
  };

  const todayMood = moods.find(m => String((m.data as { day?: string })?.day || '') === today);
  const moodPoints = lastNDays(14).map(day => ({
    label: day.slice(5),
    v: Number((moods.find(m => String((m.data as { day?: string })?.day || '') === day) as { data?: { mood?: number } } | undefined)?.data?.mood || 0),
  }));
  const sleepPoints = lastNDays(14).map(day => ({
    label: day.slice(5),
    v: Number((moods.find(m => String((m.data as { day?: string })?.day || '') === day) as { data?: { sleep?: number } } | undefined)?.data?.sleep || 0),
  }));
  const weekTotal = weekScore(new Set(logs.filter(l => l.done).map(l => String((l.data as { day?: string }).day))));
  const weekBars = lastNDays(14).map(day => ({ label: day.slice(5), v: logs.filter(l => l.done && String((l.data as { day?: string }).day) === day).length }));

  const saveMood = (mood: number) => {
    const data = { day: today, mood, sleep: Number(sleep || (todayMood?.data as { sleep?: number })?.sleep || 0), workout: Number(workout || (todayMood?.data as { workout?: number })?.workout || 0) };
    if (todayMood) useVault.getState().saveItem({ ...todayMood, data });
    else useVault.getState().saveItem({ type: 'mood', title: 'mood ' + today, body: '', tags: [], data });
    s.beep(mood >= 4 ? 990 : 660, .05);
  };
  const patchMood = (key: 'sleep' | 'workout', v: string) => {
    if (key === 'sleep') setSleep(v);
    else setWorkout(v);
    if (!todayMood) return;
    const cur = todayMood.data as { mood?: number; sleep?: number; workout?: number };
    const data = { ...cur, day: today, [key]: Number(v || 0) };
    useVault.getState().saveItem({ ...todayMood, data });
  };

  return (
    <>
      <OsHead title="HABITS + MOOD">
        <span className="chip">{weekTotal}/7 THIS WEEK</span>
      </OsHead>
      <p className="dim small">tap a square to check a habit. streaks, a weekly score and the mood/sleep graphs keep you honest — gently.</p>

      <div className="btnrow wrapbtns">
        <input value={hIcon} onChange={e => setHIcon(e.target.value.slice(0, 2))} style={{ maxWidth: 56 }} title="icon glyph" />
        <input value={hTitle} placeholder="new habit — e.g. stretch 10min" onChange={e => setHTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && hTitle.trim()) { useVault.getState().saveItem({ type: 'habit', title: hTitle.trim(), body: '', tags: [], data: { icon: hIcon || '◆' } }); setHTitle(''); s.toast('HABIT PLANTED', 'ok'); } }} />
        <button type="button" className="btn mini" disabled={!hTitle.trim()} onClick={() => { useVault.getState().saveItem({ type: 'habit', title: hTitle.trim(), body: '', tags: [], data: { icon: hIcon || '◆' } }); setHTitle(''); }}>＋ PLANT</button>
      </div>

      <div className="stack" style={{ marginTop: 10 }}>
        {habits.map(h => {
          const days = logSet(h.id);
          const streak = streakOf(days);
          return (
            <div key={h.id} className="habitrow">
              <div className="habithead">
                <b>{String((h.data as { icon?: string })?.icon || '◆')} {h.title}</b>
                <span className="spacer" />
                <span className="chip st-SHIPPED">🔥 {streak}d streak</span>
                <span className="chip">{days.size} total</span>
                <button type="button" className="xbtn" onClick={() => s.confirm('DELETE HABIT?', h.title, () => useVault.getState().deleteItem(h.id))}>✕</button>
              </div>
              <div className="habitgrid">
                {days56.map(day => (
                  <button key={day} type="button" title={day}
                    className={'hcell' + (days.has(day) ? ' on' : '') + (day === today ? ' today' : '')}
                    onClick={() => toggleLog(h.id, day)}>{''}</button>
                ))}
              </div>
            </div>
          );
        })}
        {!habits.length && <Empty>no habits yet — plant one above. start with one. seriously.</Empty>}
      </div>

      <div className="sechead" style={{ marginTop: 16 }}>TODAY&apos;S CHECK-IN — {today}</div>
      <div className="btnrow wrapbtns">
        <span className="dim small">mood:</span>
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} type="button" className={'chip' + (Number((todayMood?.data as { mood?: number })?.mood) === n ? ' on' : '')} onClick={() => saveMood(n)}>{['☹', '😕', '😐', '🙂', '😄'][n - 1]}</button>
        ))}
        <span className="dim small">sleep h:</span>
        <input value={sleep} placeholder={(todayMood?.data as { sleep?: number })?.sleep ? String((todayMood?.data as { sleep?: number }).sleep) : '7.5'} onChange={e => patchMood('sleep', e.target.value)} style={{ maxWidth: 70 }} />
        <span className="dim small">workout min:</span>
        <input value={workout} placeholder={(todayMood?.data as { workout?: number })?.workout ? String((todayMood?.data as { workout?: number }).workout) : '0'} onChange={e => patchMood('workout', e.target.value)} style={{ maxWidth: 70 }} />
      </div>

      <div className="os2col" style={{ marginTop: 12 }}>
        <div>
          <div className="sechead">MOOD — 14 DAYS</div>
          <CanvasLine points={moodPoints} h={110} max={5} />
        </div>
        <div>
          <div className="sechead">SLEEP — 14 DAYS</div>
          <CanvasBars data={sleepPoints} h={110} fmt={n => n ? String(n) : ''} />
        </div>
      </div>
      <div className="sechead" style={{ marginTop: 12 }}>CHECK-INS PER DAY — 14 DAYS</div>
      <CanvasBars data={weekBars} h={90} fmt={n => n ? String(n) : ''} />
    </>
  );
}

/* ================= focus (pomodoro + time log) ================= */

const PRESETS: { label: string; mins: number }[] = [
  { label: 'POMODORO 25', mins: 25 }, { label: 'SHORT 5', mins: 5 }, { label: 'LONG 15', mins: 15 }, { label: 'DEEP 50', mins: 50 },
];

export function FocusPage() {
  const s = usePsych0();
  useEnsure();
  const items = useVault(st => st.items);
  const [mins, setMins] = useState(25);
  const [left, setLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [label, setLabel] = useState('');
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  const today = dayKey();
  const sessions = items.filter(i => i.type === 'session');
  const todaySessions = sessions.filter(x => String((x.data as { day?: string })?.day || '') === today);
  const todayMins = todaySessions.reduce((a, x) => a + Number((x.data as { mins?: number })?.mins || 0), 0);
  const bars = lastNDays(14).map(day => ({
    label: day.slice(5),
    v: sessions.filter(x => String((x.data as { day?: string })?.day || '') === day).reduce((a, x) => a + Number((x.data as { mins?: number })?.mins || 0), 0),
  }));

  const complete = async () => {
    setRunning(false);
    await useVault.getState().saveItem({ type: 'session', title: label || 'focus session', body: '', tags: [], done: true, data: { day: today, mins } });
    s.beep(880, .2); setTimeout(() => s.beep(660, .2), 250);
    s.toast('⏱ SESSION LOGGED — ' + mins + ' MIN', 'ok');
    setLeft(mins * 60);
  };

  useEffect(() => {
    if (running) {
      tick.current = setInterval(() => {
        setLeft(l => {
          if (l <= 1) { complete(); return 0; }
          if (l % 60 === 0 && l > 0) s.beep(660, .03);
          return l - 1;
        });
      }, 1000);
    }
    return () => { if (tick.current) clearInterval(tick.current); };
  }, [running]); // eslint-disable-line react-hooks/exhaustive-deps

  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');

  return (
    <>
      <OsHead title="FOCUS">
        <span className="chip">{todayMins} MIN TODAY</span>
      </OsHead>
      <p className="dim small">pomodoro timer with a memory: every finished session is logged, charted and fed into the weekly review.</p>

      <div className="focuswrap">
        <Ring pct={100 - (left / (mins * 60)) * 100} label={running ? 'RUNNING' : 'READY'} />
        <div className="focusface">
          <div className="focustime">{mm}:{ss}</div>
          <div className="btnrow wrapbtns">
            {PRESETS.map(p => (
              <button key={p.label} type="button" className={'chip' + (mins === p.mins ? ' on' : '')}
                onClick={() => { setMins(p.mins); setLeft(p.mins * 60); setRunning(false); }}>{p.label}</button>
            ))}
          </div>
          <div className="btnrow">
            <input value={label} placeholder="what are you focusing on? (optional)" onChange={e => setLabel(e.target.value)} />
          </div>
          <div className="btnrow">
            <button type="button" className={'btn' + (running ? ' danger' : '')} onClick={() => { setRunning(r => !r); s.beep(running ? 440 : 990, .06); }}>
              {running ? '⏸ PAUSE' : left === mins * 60 ? '▶ START' : '▶ RESUME'}
            </button>
            <button type="button" className="btn" onClick={() => { setRunning(false); setLeft(mins * 60); }}>⟲ RESET</button>
            <button type="button" className="btn" onClick={complete}>✔ LOG EARLY</button>
          </div>
          <div className="dim small">sessions today: {todaySessions.length} · total {todayMins} min</div>
        </div>
      </div>

      <div className="sechead" style={{ marginTop: 14 }}>MINUTES FOCUSED — 14 DAYS</div>
      <CanvasBars data={bars} h={120} fmt={n => n ? String(n) + 'm' : ''} />

      <div className="sechead" style={{ marginTop: 12 }}>SESSION LOG</div>
      <div className="loglines">
        {sessions.slice(0, 12).map(x => (
          <div key={x.id} className="logline">
            <span className="ld">{fmtWhen(x.created_at).slice(5)}</span>
            <span className="lt">{x.title}</span>
            <span className="spacer" />
            <span className="chip">{Number((x.data as { mins?: number })?.mins || 0)} min</span>
            <button type="button" className="btn mini danger" onClick={() => useVault.getState().deleteItem(x.id)}>✕</button>
          </div>
        ))}
        {!sessions.length && <Empty>no sessions yet — press START.</Empty>}
      </div>
    </>
  );
}

/* ================= goals ================= */

export function GoalsPage() {
  const s = usePsych0();
  useEnsure();
  const items = useVault(st => st.items);
  const goals = items.filter(i => i.type === 'goal');
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState('100');
  const [editing, setEditing] = useState<VaultItem | null>(null);
  const GOAL_FIELDS: FieldDef[] = [
    { key: 'target', label: 'TARGET (number)', kind: 'num' },
    { key: 'by', label: 'DEADLINE', kind: 'date' },
  ];

  const pctOf = (g: VaultItem) => {
    const t = Number((g.data as { target?: number })?.target || 100);
    const p = Number((g.data as { progress?: number })?.progress || 0);
    return Math.max(0, Math.min(100, (p / Math.max(1, t)) * 100));
  };

  return (
    <>
      <OsHead title="GOALS" />
      <p className="dim small">a number, a deadline, a ring that fills up. progress by hand or link it to a habit streak — visible momentum is the point.</p>

      <div className="btnrow wrapbtns">
        <input value={title} placeholder="new goal — e.g. run 100km" onChange={e => setTitle(e.target.value)} />
        <input value={target} onChange={e => setTarget(e.target.value)} style={{ maxWidth: 90 }} title="target number" />
        <button type="button" className="btn mini" disabled={!title.trim()} onClick={async () => {
          await useVault.getState().saveItem({ type: 'goal', title: title.trim(), body: '', tags: [], data: { target: Number(target || 100), progress: 0 } });
          setTitle(''); s.toast('GOAL SET', 'ok');
        }}>＋ SET GOAL</button>
      </div>

      <div className="goalgrid">
        {goals.map(g => {
          const data = g.data as { progress?: number; target?: number; by?: string };
          const pct = pctOf(g);
          return (
            <div key={g.id} className="goalcard">
              <Ring pct={pct} label={String(data.progress || 0) + '/' + String(data.target || '?')} />
              <b className="goaltitle">{g.title}</b>
              {data.by && <div className="dim small">by {data.by} · {relDay(data.by)}</div>}
              <div className="btnrow wrapbtns">
                <button type="button" className="btn mini" onClick={() => useVault.getState().saveItem({ ...g, data: { ...data, progress: Math.max(0, Number(data.progress || 0) - 1) } })}>−1</button>
                <button type="button" className="btn mini" onClick={() => useVault.getState().saveItem({ ...g, data: { ...data, progress: Number(data.progress || 0) + 1 } })}>+1</button>
                <button type="button" className="btn mini" onClick={() => useVault.getState().saveItem({ ...g, data: { ...data, progress: Number(data.progress || 0) + 5 } })}>+5</button>
                <button type="button" className="btn mini" onClick={() => setEditing(g)}>✎</button>
                <button type="button" className="btn mini danger" onClick={() => s.confirm('DELETE GOAL?', g.title, () => useVault.getState().deleteItem(g.id))}>✕</button>
              </div>
            </div>
          );
        })}
        {!goals.length && <Empty>no goals yet. pick one thing that would make this month count.</Empty>}
      </div>

      {editing && (
        <DataEditor initial={editing} fields={GOAL_FIELDS} onClose={() => setEditing(null)}
          onSave={d => { useVault.getState().saveItem({ ...editing, ...d }); setEditing(null); }} />
      )}
    </>
  );
}

/* ================= weekly review ================= */

export function ReviewPage() {
  const s = usePsych0();
  useEnsure();
  const items = useVault(st => st.items);
  const [out, setOut] = useState('');
  const [busy, setBusy] = useState(false);
  const weekAgo = dayKey(new Date(Date.now() - 7 * 86400000));
  const today = dayKey();

  const digest = useMemo(() => {
    const inWeek = items.filter(i => (i.created_at || '').slice(0, 10) >= weekAgo);
    const done = items.filter(i => i.type === 'task' && i.done && (i.updated_at || '').slice(0, 10) >= weekAgo);
    const mins = items.filter(i => i.type === 'session' && String((i.data as { day?: string })?.day || '') >= weekAgo)
      .reduce((a, x) => a + Number((x.data as { mins?: number })?.mins || 0), 0);
    const logs = new Set(items.filter(i => i.type === 'habitlog' && i.done && String((i.data as { day?: string }).day) >= weekAgo).map(i => String((i.data as { day?: string }).day)));
    const moods = items.filter(i => i.type === 'mood' && String((i.data as { day?: string })?.day || '') >= weekAgo);
    const avgMood = moods.length ? (moods.reduce((a, x) => a + Number((x.data as { mood?: number })?.mood || 0), 0) / moods.length).toFixed(1) : '—';
    return { inWeek, done, mins, habits: weekScore(logs), avgMood };
  }, [items, weekAgo]);

  const digestText =
    `# WEEK IN REVIEW — ${weekAgo} → ${today}\n\n` +
    `## numbers\n- captured ${digest.inWeek.length} items\n- finished ${digest.done.length} tasks\n- focused ${digest.mins} minutes\n- habit check-ins on ${digest.habits}/7 days\n- average mood ${digest.avgMood}/5\n\n` +
    `## tasks crushed\n${digest.done.map(t => '- ' + t.title).join('\n') || '- (none logged)'}\n\n` +
    `## everything captured\n${digest.inWeek.slice(0, 30).map(i => '- [' + i.type + '] ' + (i.title || i.body.slice(0, 60))).join('\n') || '- (nothing captured)'}\n`;

  const runAI = async () => {
    setBusy(true);
    try {
      const r = await fetch('/api/brain', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: getAiKey() || undefined, messages: [{ role: 'user', content: 'Here is my raw weekly log. Write a tight weekly review: wins, patterns, one honest observation, and 3 focuses for next week. Markdown.\n\n' + digestText.slice(0, 6000) }] }),
      });
      const j = await r.json() as { reply?: string; message?: string };
      setOut(j.reply || j.message || '');
      s.toast('REVIEW DRAFTED', 'ok');
    } catch (e) { s.toast((e as Error).message.slice(0, 120), 'warn'); }
    setBusy(false);
  };

  const dlMd = () => {
    const blob = new Blob([(out || digestText)], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'week-review-' + today + '.md';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 400);
  };

  return (
    <>
      <OsHead title="WEEKLY REVIEW">
        <button type="button" className="btn mini" onClick={dlMd}>⤓ .MD</button>
        <button type="button" className="btn mini" disabled={busy} onClick={runAI}>{busy ? '▮▮▮ WRITING' : '⚡ AI REVIEW'}</button>
      </OsHead>
      <p className="dim small">the OS assembles your week from every log — tasks, sessions, habits, moods, captures. the AI turns it into an honest review; without a key you still get the raw digest.</p>

      <div className="briefgrid" style={{ margin: '10px 0' }}>
        <div className="briefcell"><b>{digest.inWeek.length}</b><span>items captured</span></div>
        <div className="briefcell"><b>{digest.done.length}</b><span>tasks finished</span></div>
        <div className="briefcell"><b>{digest.mins}m</b><span>focus time</span></div>
        <div className="briefcell"><b>{digest.habits}/7</b><span>habit days</span></div>
        <div className="briefcell"><b>{digest.avgMood}</b><span>avg mood /5</span></div>
      </div>

      <div className="btnrow"><button type="button" className={'btn mini' + (out ? ' on' : '')} onClick={() => setOut('')}>{out ? 'SHOW RAW DIGEST' : out === '' && !digestText ? '' : 'SHOW AI DRAFT'}</button></div>
      <textarea className="mdsrc" rows={18} value={out || digestText} readOnly spellCheck={false} />
    </>
  );
}

/* ================= flashcards (SM-2) ================= */

export function FlashcardsPage() {
  const s = usePsych0();
  useEnsure();
  const items = useVault(st => st.items);
  const cards = items.filter(i => i.type === 'card');
  const notes = items.filter(i => i.type === 'note');
  const today = dayKey();
  const due = cards.filter(c => String((c.data as { due?: string })?.due || '1970-01-01') <= today);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [fFront, setFFront] = useState('');
  const [fBack, setFBack] = useState('');
  const [busy, setBusy] = useState(false);
  const [srcNote, setSrcNote] = useState('');

  const card = due[idx];

  const grade = async (q: 0 | 1 | 2 | 3) => {
    if (!card) return;
    const next = sm2(card.data as { ease?: number; interval?: number; due?: string; reps?: number }, q);
    await useVault.getState().saveItem({ ...card, data: { ...(card.data as Record<string, unknown>), ...next } });
    setFlipped(false);
    setIdx(i => i + 1);
    s.beep(q === 0 ? 330 : 990, .05);
  };

  const genFromNote = async () => {
    const note = notes.find(n => String(n.id) === srcNote);
    if (!note) { s.toast('PICK A NOTE FIRST', 'warn'); return; }
    setBusy(true);
    try {
      const out = await aiTask('flash', (note.title + '\n\n' + note.body).slice(0, 6000));
      const lines = out.split('\n').map(l => l.trim()).filter(l => l.includes('::'));
      let made = 0;
      for (const line of lines) {
        const [front, back] = line.split('::').map(x => x.trim());
        if (!front || !back) continue;
        await useVault.getState().saveItem({ type: 'card', title: 'card', body: '', tags: [slugifyTag(note.title)], data: { front, back, due: today, ease: 2.5, interval: 0, reps: 0 } });
        made++;
      }
      s.toast(made + ' CARDS GENERATED', 'ok');
    } catch (e) { s.toast((e as Error).message.slice(0, 120), 'warn'); }
    setBusy(false);
  };

  const addCard = async () => {
    if (!fFront.trim() || !fBack.trim()) return;
    await useVault.getState().saveItem({ type: 'card', title: 'card', body: '', tags: [], data: { front: fFront.trim(), back: fBack.trim(), due: today, ease: 2.5, interval: 0, reps: 0 } });
    setFFront(''); setFBack('');
    s.toast('CARD ADDED', 'ok');
  };

  return (
    <>
      <OsHead title="FLASHCARDS">
        <span className="chip">{due.length} DUE</span>
        <span className="chip">{cards.length} TOTAL</span>
      </OsHead>
      <p className="dim small">spaced repetition (SM-2): cards come back right before you would forget them. grade honestly — the algorithm only works if you don&apos;t cheat yourself.</p>

      <div className="studybox">
        {!card ? (
          <Empty>{cards.length ? 'queue clear — come back tomorrow.' : 'no cards yet — make one below or generate from a note.'}</Empty>
        ) : flipped ? (
          <>
            <div className="cardq">{String((card.data as { front?: string })?.front || '')}</div>
            <div className="carda">{String((card.data as { back?: string })?.back || '')}</div>
            <div className="btnrow wrapbtns">
              <button type="button" className="btn danger" onClick={() => grade(0)}>FORGOT</button>
              <button type="button" className="btn" onClick={() => grade(1)}>HARD</button>
              <button type="button" className="btn" onClick={() => grade(2)}>GOOD</button>
              <button type="button" className="btn" onClick={() => grade(3)}>EASY</button>
            </div>
            <div className="dim small">next interval: HARD ~{sm2(card.data as { ease: number; interval: number; due: string; reps: number }, 1).interval}d · GOOD ~{sm2(card.data as { ease: number; interval: number; due: string; reps: number }, 2).interval}d · EASY ~{sm2(card.data as { ease: number; interval: number; due: string; reps: number }, 3).interval}d</div>
          </>
        ) : (
          <>
            <div className="cardq">{String((card.data as { front?: string })?.front || '')}</div>
            <button type="button" className="btn" onClick={() => { setFlipped(true); s.beep(660, .04); }}>⟲ REVEAL</button>
          </>
        )}
      </div>

      <div className="os2col" style={{ marginTop: 14 }}>
        <div>
          <div className="sechead">NEW CARD</div>
          <Field label="FRONT (question)"><input value={fFront} onChange={e => setFFront(e.target.value)} /></Field>
          <Field label="BACK (answer)"><input value={fBack} onChange={e => setFBack(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addCard(); }} /></Field>
          <div className="btnrow"><button type="button" className="btn" onClick={addCard} disabled={!fFront.trim() || !fBack.trim()}>＋ ADD CARD</button></div>
        </div>
        <div>
          <div className="sechead">GENERATOR<span className="cnt">note → cards</span></div>
          <Field label="SOURCE NOTE">
            <select value={srcNote} onChange={e => setSrcNote(e.target.value)}>
              <option value="">pick a note…</option>
              {notes.map(n => <option key={n.id} value={n.id}>{n.title}</option>)}
            </select>
          </Field>
          <div className="btnrow"><button type="button" className="btn" disabled={!srcNote || busy} onClick={genFromNote}>{busy ? '▮▮▮ GENERATING' : '⚡ GENERATE CARDS'}</button></div>
          <div className="helpline">makes 3-6 &ldquo;QUESTION :: ANSWER&rdquo; cards from any note&apos;s content.</div>
        </div>
      </div>
    </>
  );
}

function slugifyTag(t: string): string {
  return t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'study';
}
