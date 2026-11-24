'use client';
/* PSYCH://OS — the hub: page registry, router, and the OS home screen.
 * App.tsx routes #/os and #/os/<page> here; every OS page gets the nav rail. */
import { usePsych0 } from './store';
import { useVault } from './vault';
import { useEnsure } from './osui';
import { BrainPage, InboxPage } from './osbrain';
import { NotesPage, JournalPage } from './osnotes';
import { DrivePage, SecretsPage, LinksPage } from './osfiles';
import { TasksPage, CalendarPage, HabitsPage, FocusPage, GoalsPage, ReviewPage, FlashcardsPage } from './oslife';
import { PeoplePage, BookmarksPage, ShelfPage, TravelPage, RecipesPage, IdeasPage, MoneyPage, CollectionsPage } from './osdata';
import { RulesPage, PlumbingPage, ImportOsPage } from './osplumbing';
import { OsSettingsPage } from './ossettings';
import { loadOsPrefs } from './osprefs';
import { StudioDash, EditPost, EditProject, EditEmbed, EditAbout } from './studio';
import { Dashboard, MediaLib, MailView, GraphView } from './power';
import { DoctorView, FeedsView, ImportView, ZineView } from './studio2';
import { dayKey, weekScore } from '@/lib/osutil';

export interface OsPageDef {
  id: string; label: string; icon: string; group: string; desc: string;
  Comp: (props: { sub?: string }) => React.ReactNode;
}

/* PUBLISH — the studio content manager, living inside the OS.
 * sub-routing: new/post · post/<id> · new/project · project/<id> ·
 *              new/embed · embed/<id> · about */
export function PublishPage({ sub }: { sub?: string }) {
  useEnsure();
  const s = usePsych0();
  if (!s.studio) return (
    <>
      <div className="titlebar"><h1 className="scramble">PUBLISH_</h1></div>
      <div className="empty" style={{ marginTop: 16 }}>locked — open OS access first (the passcode gate at <a href="#/studio" style={{ color: 'var(--acc)' }}>#/studio</a>).</div>
    </>
  );
  const seg = (sub || '').split('/');
  if (seg[0] === 'new' && seg[1] === 'post') return <EditPost os />;
  if (seg[0] === 'new' && seg[1] === 'project') return <EditProject os />;
  if (seg[0] === 'new' && seg[1] === 'embed') return <EditEmbed os />;
  if (seg[0] === 'post' && seg[1]) return <EditPost id={seg[1]} os />;
  if (seg[0] === 'project' && seg[1]) return <EditProject id={seg[1]} os />;
  if (seg[0] === 'embed' && seg[1]) return <EditEmbed id={seg[1]} os />;
  if (seg[0] === 'about') return <EditAbout os />;
  return <StudioDash os />;
}

export const OS_PAGES: OsPageDef[] = [
  { id: 'publish', label: 'PUBLISH', icon: '✒', group: 'DEN', desc: 'the studio in here: posts, projects, lab embeds, about — full editors, autosave', Comp: ({ sub }) => <PublishPage sub={sub} /> },
  { id: 'settings', label: 'SETTINGS', icon: '⚙', group: 'DEN', desc: 'the control room: site identity, theme, css, fx + the OS shell itself, hell customizable', Comp: () => <OsSettingsPage /> },
  { id: 'dash', label: 'DASHBOARD', icon: '◑', group: 'DEN', desc: 'visits, counters, history of the whole den', Comp: () => <Dashboard /> },
  { id: 'media', label: 'MEDIA', icon: '▣', group: 'DEN', desc: 'uploads library — images for posts, covers, drive', Comp: () => <MediaLib /> },
  { id: 'mail', label: 'MAIL', icon: '✉', group: 'DEN', desc: 'guestbook + contact inbox, moderate and reply', Comp: () => <MailView /> },
  { id: 'graph', label: 'GRAPH', icon: '◍', group: 'DEN', desc: 'the link map of everything you wrote', Comp: () => <GraphView /> },
  { id: 'doctor', label: 'POST DOCTOR', icon: '⚕', group: 'DEN', desc: 'lints every post: length, tags, links, garden state', Comp: () => <DoctorView /> },
  { id: 'feeds', label: 'READ LATER', icon: '↗', group: 'DEN', desc: 'rss feeds + the read-later clipper', Comp: () => <FeedsView /> },
  { id: 'blogimport', label: 'IMPORT BLOG', icon: '⇥', group: 'DEN', desc: 'markdown / html / wordpress → posts', Comp: () => <ImportView /> },
  { id: 'zine', label: 'ZINE FACTORY', icon: '📠', group: 'DEN', desc: 'print-ready zine of a year of posts', Comp: () => <ZineView /> },

  { id: 'brain', label: 'THE BRAIN', icon: '✦', group: 'THINK', desc: 'AI chat over your whole vault, daily briefing, semantic search, personas', Comp: ({ sub }) => <BrainPage docId={sub} /> },
  { id: 'inbox', label: 'CAPTURE', icon: '⬒', group: 'THINK', desc: 'the unsorted inbox — console, phone, bot and email land here', Comp: () => <InboxPage /> },
  { id: 'notes', label: 'NOTES', icon: '✎', group: 'THINK', desc: 'private notes, wikilinks, backlinks, templates, versions, share links', Comp: () => <NotesPage /> },
  { id: 'journal', label: 'JOURNAL', icon: '📔', group: 'THINK', desc: 'daily pages + letters to your future self', Comp: () => <JournalPage /> },

  { id: 'drive', label: 'DRIVE', icon: '▤', group: 'KEEP', desc: 'your files: folders, gallery, paste-to-upload, expiring shares, OCR', Comp: () => <DrivePage /> },
  { id: 'vault', label: 'VAULT', icon: '🔒', group: 'KEEP', desc: 'AES-encrypted secrets and documents', Comp: () => <SecretsPage /> },
  { id: 'bookmarks', label: 'BOOKMARKS', icon: '⌘', group: 'KEEP', desc: 'link library with AI descriptions', Comp: () => <BookmarksPage /> },
  { id: 'collections', label: 'COLLECTIONS', icon: '◈', group: 'KEEP', desc: 'build your own databases with any fields', Comp: ({ sub }) => <CollectionsPage colId={sub} /> },

  { id: 'tasks', label: 'TASKS', icon: '▢', group: 'DO', desc: 'GTD inbox → kanban by priority, due dates', Comp: () => <TasksPage /> },
  { id: 'calendar', label: 'CALENDAR', icon: '▦', group: 'DO', desc: 'month grid: tasks, events, countdowns, journal days', Comp: () => <CalendarPage /> },
  { id: 'habits', label: 'HABITS', icon: '◆', group: 'DO', desc: 'streak grids, weekly score, mood + sleep graphs', Comp: () => <HabitsPage /> },
  { id: 'focus', label: 'FOCUS', icon: '⏱', group: 'DO', desc: 'pomodoro with a memory — every session logged', Comp: () => <FocusPage /> },
  { id: 'goals', label: 'GOALS', icon: '◎', group: 'DO', desc: 'rings that fill as you move', Comp: () => <GoalsPage /> },
  { id: 'flashcards', label: 'FLASHCARDS', icon: '☰', group: 'DO', desc: 'SM-2 spaced repetition + generate from notes', Comp: () => <FlashcardsPage /> },
  { id: 'review', label: 'REVIEW', icon: '⟳', group: 'DO', desc: 'the week, assembled from every log', Comp: () => <ReviewPage /> },

  { id: 'money', label: 'MONEY', icon: '€', group: 'DATA', desc: 'expenses, categories, subscription alarms', Comp: () => <MoneyPage /> },
  { id: 'people', label: 'PEOPLE', icon: '☺', group: 'DATA', desc: 'CRM-lite: birthdays + last-contact nudges', Comp: () => <PeoplePage /> },
  { id: 'shelf', label: 'SHELF', icon: '▣', group: 'DATA', desc: 'watch / read / play tracker with ratings', Comp: () => <ShelfPage /> },
  { id: 'travel', label: 'TRAVEL', icon: '✈', group: 'DATA', desc: 'your pixel world map of places', Comp: () => <TravelPage /> },
  { id: 'recipes', label: 'RECIPES', icon: '◬', group: 'DATA', desc: 'recipe box + the dinner decider', Comp: () => <RecipesPage /> },
  { id: 'ideas', label: 'IDEAS', icon: '🌱', group: 'DATA', desc: 'incubator: seed → cooking → ready, with resurfacing', Comp: () => <IdeasPage /> },

  { id: 'links', label: 'SHORT LINKS', icon: '✂', group: 'SYS', desc: 'your own bit.ly on your domain, click counts', Comp: () => <LinksPage /> },
  { id: 'rules', label: 'RULES', icon: '⚙', group: 'SYS', desc: 'if-this-then-that for everything you capture', Comp: () => <RulesPage /> },
  { id: 'import', label: 'IMPORT', icon: '⬆', group: 'SYS', desc: 'CSV → any item type or collection', Comp: () => <ImportOsPage /> },
  { id: 'plumbing', label: 'PLUMBING', icon: '⇄', group: 'SYS', desc: 'capture webhook, telegram bot, email-in, mega backup', Comp: () => <PlumbingPage /> },
];

const GROUPS = ['DEN', 'THINK', 'KEEP', 'DO', 'DATA', 'SYS'];

export function OsNav({ active }: { active: string }) {
  const byGroup = GROUPS.map(g => ({ g, pages: OS_PAGES.filter(p => p.group === g) }));
  return (
    <nav className="osnav" aria-label="psych-os pages">
      {byGroup.map(({ g, pages }) => (
        <div key={g} className="osnavgrp">
          <span className="osnavhead">{g}</span>
          {pages.map(p => (
            <a key={p.id} href={'#/os/' + p.id} className={'osnavlink' + (active === p.id ? ' on' : '')}>
              <span className="osnavicon">{p.icon}</span> {p.label}
            </a>
          ))}
        </div>
      ))}
    </nav>
  );
}

/* ================= OS home ================= */

export function OsHome() {
  const s = usePsych0();
  useEnsure();
  const items = useVault(st => st.items);
  const prefs = loadOsPrefs();
  const today = dayKey();
  const due = items.filter(i => i.type === 'task' && !i.done && String((i.data as { due?: string })?.due || '') <= today).length;
  const logs = new Set(items.filter(i => i.type === 'habitlog' && i.done).map(i => String((i.data as { day?: string }).day)));
  const streak = weekScore(logs);

  return (
    <>
      <div className="titlebar"><h1 className="scramble">PSYCH://OS_</h1>
        <span className="spacer" />
        <span className="chip">{s.mode === 'supabase' ? '◉ VAULT LIVE' : '◍ LOCAL VAULT'}</span>
        <span className="chip">{items.length} ITEMS</span>
      </div>
      <p className="dim small">the den's control room: brain, drive, vault, databases, routines — and the whole studio. {due > 0 ? due + ' task(s) due today · ' : ''}habit check-ins this week: {streak}/7.</p>
      {prefs.landing && OS_PAGES.some(p => p.id === prefs.landing) && (
        <div className="rowwrap" style={{ marginBottom: 10 }}>
          <a className="btn mini" href={'#/os/' + prefs.landing}>⌁ LANDING: {OS_PAGES.find(p => p.id === prefs.landing)?.label} →</a>
          <span className="dim small">set in SETTINGS → OS SHELL</span>
        </div>
      )}
      <div className="osgrid">
        {OS_PAGES.map(p => (
          <a key={p.id} className="oscard" href={'#/os/' + p.id}>
            <span className="osicon">{p.icon}</span>
            <b>{p.label}</b>
            <span className="dim small">{p.desc}</span>
          </a>
        ))}
      </div>
    </>
  );
}

/* ================= router ================= */

export function OsRouter({ page, sub }: { page: string; sub?: string }) {
  const def = OS_PAGES.find(p => p.id === page);
  if (!def) return <OsHome />;
  return (
    <div className="ospage">
      <OsNav active={page} />
      <div className="oscontent">
        {def.Comp({ sub })}
      </div>
    </div>
  );
}

/* used by the studio dashboard tile strip */
export function osTileCounts(items: { type: string; done?: boolean; data?: Record<string, unknown> }[]) {
  const today = dayKey();
  return {
    items: items.length,
    due: items.filter(i => i.type === 'task' && !i.done && String((i.data as { due?: string })?.due || '') <= today).length,
    notes: items.filter(i => i.type === 'note').length,
  };
}
