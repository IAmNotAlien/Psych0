import { NextRequest, NextResponse } from 'next/server';
import { isStudioRequest } from '@/lib/studio';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { saveItem } from '@/lib/osrepo';
import { getRules } from '@/lib/osrepo';
import { uid, slugify, type SiteData, type VaultItem } from '@/lib/types';

export const dynamic = 'force-dynamic';

/* PSYCH://OS — capture from anywhere: the inbox endpoint.
 *
 * POST /api/inbox?secret=<inboxSecret>   — your own bots / shortcuts / email parsers
 *        body: { text, title?, kind?, url?, tags? }   (plain JSON)
 *        ALSO understands Telegram update payloads: { message: { text, chat } }
 *        — set your Telegram bot webhook to this URL + ?secret=… and messages
 *          you DM your bot land in the vault. Reply needs TELEGRAM_BOT_TOKEN.
 *
 * GET  /api/inbox                        — studio-only: show (or mint) the secret
 */

function mintSecret(): string {
  return 'cap_' + uid() + uid() + uid();
}

async function inboxSecret(): Promise<string> {
  const db = supabase();
  if (!db) return '';
  const row = await db.from('site').select('data').eq('id', 1).maybeSingle();
  const data = (row?.data as { data?: SiteData } | null)?.data;
  return data?.inboxSecret || '';
}

export async function GET(req: NextRequest) {
  if (!isStudioRequest(req)) return NextResponse.json({ error: 'STUDIO_ONLY' }, { status: 401 });
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ secret: '', local: true, message: 'Local mode — the inbox needs Supabase so the outside world can reach it.' });
  }
  let secret = await inboxSecret();
  if (!secret) {
    secret = mintSecret();
    const db = supabase()!;
    const row = await db.from('site').select('data').eq('id', 1).maybeSingle();
    const data = (row?.data as { data?: SiteData } | null)?.data || {};
    await db.from('site').upsert({ id: 1, data: { ...data, inboxSecret: secret }, updated_at: new Date().toISOString() });
  }
  return NextResponse.json({ secret });
}

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const provided = url.searchParams.get('secret') || req.headers.get('x-inbox-secret') || '';
  const expected = await inboxSecret().catch(() => '');
  const envSecret = process.env.INBOX_SECRET || '';
  if (!expected && !envSecret) return NextResponse.json({ error: 'NO_INBOX', message: 'Inbox not set up yet. Open the studio → OS → PLUMBING to mint a secret.' }, { status: 503 });
  if (!provided || (provided !== expected && provided !== envSecret)) {
    return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Bad or missing secret.' }, { status: 401 });
  }

  // accept plain JSON AND telegram update envelopes
  let payload: Record<string, unknown> = {};
  try { payload = await req.json() as Record<string, unknown>; } catch { /* empty body */ }
  let text = String(payload.text ?? '').trim();
  let replyTo = '';
  const tg = payload.message as { text?: string; chat?: { id?: number } } | undefined;
  if (!text && tg?.text) {
    text = String(tg.text).trim();
    replyTo = String(tg.chat?.id || '');
  }
  if (!text) return NextResponse.json({ error: 'EMPTY', message: 'text required.' }, { status: 400 });

  const kind = String(payload.kind || 'note');
  const title = String(payload.title || '').slice(0, 200) || (kind === 'task' ? 'TASK FROM THE VOID' : text.split('\n')[0].slice(0, 80));
  const tags = Array.isArray(payload.tags) ? (payload.tags as unknown[]).map(t => String(t).slice(0, 40)) : ['inbox'];
  if (payload.url) text += '\n\n' + String(payload.url);
  const data: Record<string, unknown> = {};
  if (payload.url) data.url = String(payload.url);
  if (payload.due) data.due = String(payload.due);

  const item: Partial<VaultItem> = {
    id: 'i_cap' + uid(), type: kind, title, body: text.slice(0, 40000),
    tags, data, created_at: new Date().toISOString(),
  } as Partial<VaultItem>;
  if (kind === 'task') item.data = { ...data, priority: 'now' };

  const rules = await getRules().catch(() => []);
  const saved = await saveItem(item, { applyRules: rules });

  // telegram echo back (best-effort)
  if (replyTo && process.env.TELEGRAM_BOT_TOKEN) {
    fetch('https://api.telegram.org/bot' + process.env.TELEGRAM_BOT_TOKEN + '/sendMessage', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: replyTo, text: '⬇ filed to ' + slugify(title) + ' [' + saved.type + ']' }),
      signal: AbortSignal.timeout(5000),
    }).catch(() => { /* silent */ });
  }
  return NextResponse.json({ ok: true, id: saved.id, type: saved.type });
}
