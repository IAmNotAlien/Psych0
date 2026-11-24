import { NextRequest, NextResponse } from 'next/server';
import { isStudioRequest } from '@/lib/studio';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/* PSYCH://OS — brain chat messages, per session.
 * GET  /api/brain/messages?session=<id>   → every message of that chat
 * POST /api/brain/messages                → { session, title?, messages: [{role, content, meta?}] }
 *           stores the whole transcript (small chats; simplest correct merge).
 * Requires migration 4 + service key for writes; the client mirrors locally
 * either way so nothing is ever lost on refresh. */

interface StoreMsg { role: 'user' | 'assistant'; content: string; meta?: Record<string, unknown> }

export async function GET(req: NextRequest) {
  if (!isStudioRequest(req)) return NextResponse.json({ error: 'STUDIO_ONLY' }, { status: 401 });
  const sid = new URL(req.url).searchParams.get('session') || '';
  const db = supabase();
  if (!sid || !db) return NextResponse.json({ messages: [], persisted: false });
  try {
    const r = await db.from('brain_messages').select('role,content,meta,created_at')
      .eq('session_id', sid).order('created_at', { ascending: true }).limit(400);
    if (r.error) return NextResponse.json({ messages: [], persisted: false, reason: r.error.message.slice(0, 120) });
    return NextResponse.json({ messages: r.data || [], persisted: true });
  } catch {
    return NextResponse.json({ messages: [], persisted: false });
  }
}

export async function POST(req: NextRequest) {
  if (!isStudioRequest(req)) return NextResponse.json({ error: 'STUDIO_ONLY' }, { status: 401 });
  const db = supabase();
  if (!db || !isSupabaseConfigured()) return NextResponse.json({ persisted: false, reason: 'not configured' });
  try {
    const b = await req.json() as { session?: string; title?: string; messages?: StoreMsg[] };
    const sid = String(b.session || '');
    const msgs = (b.messages || []).filter(m => m.role === 'user' || m.role === 'assistant').slice(-300);
    if (!sid || !msgs.length) return NextResponse.json({ persisted: false, reason: 'empty' });
    // touch the session (creates it on first save)
    await db.from('brain_sessions').upsert({
      id: sid, title: (b.title || 'new chat').slice(0, 120), updated_at: new Date().toISOString(),
    });
    // replace transcript — simplest correct strategy for small chats
    await db.from('brain_messages').delete().eq('session_id', sid);
    const r = await db.from('brain_messages').insert(msgs.map(m => ({
      session_id: sid, role: m.role, content: String(m.content || '').slice(0, 60000),
      meta: (m.meta && typeof m.meta === 'object' ? m.meta : {}) as Record<string, unknown>,
    })));
    return NextResponse.json({ persisted: !r.error, reason: r.error?.message?.slice(0, 120), count: msgs.length });
  } catch {
    return NextResponse.json({ persisted: false });
  }
}
