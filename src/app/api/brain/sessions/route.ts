import { NextRequest, NextResponse } from 'next/server';
import { isStudioRequest } from '@/lib/studio';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/* PSYCH://OS — brain session persistence.
 * GET    /api/brain/sessions        → the 50 most recent chats (id, title, updated_at)
 * POST   /api/brain/sessions        → { id, title } upsert
 * DELETE /api/brain/sessions?id=…   → delete a chat (messages cascade)
 * The client keeps a localStorage mirror too, so chat survives refreshes even
 * before migration 4 runs or without the service key — server sync turns on
 * automatically once writes are possible. */

export async function GET(req: NextRequest) {
  if (!isStudioRequest(req)) return NextResponse.json({ error: 'STUDIO_ONLY' }, { status: 401 });
  const db = supabase();
  if (!db) return NextResponse.json({ sessions: [], persisted: false });
  try {
    const r = await db.from('brain_sessions').select('id,title,created_at,updated_at').order('updated_at', { ascending: false }).limit(50);
    if (r.error) return NextResponse.json({ sessions: [], persisted: false, reason: r.error.message.slice(0, 120) });
    return NextResponse.json({ sessions: r.data || [], persisted: true });
  } catch {
    return NextResponse.json({ sessions: [], persisted: false });
  }
}

export async function POST(req: NextRequest) {
  if (!isStudioRequest(req)) return NextResponse.json({ error: 'STUDIO_ONLY' }, { status: 401 });
  const db = supabase();
  if (!db || !isSupabaseConfigured()) return NextResponse.json({ persisted: false, reason: 'not configured' });
  try {
    const b = await req.json() as { id?: string; title?: string };
    if (!b.id) return NextResponse.json({ persisted: false, reason: 'no id' });
    const r = await db.from('brain_sessions').upsert({
      id: b.id, title: (b.title || 'new chat').slice(0, 120), updated_at: new Date().toISOString(),
    });
    return NextResponse.json({ persisted: !r.error, reason: r.error?.message?.slice(0, 120) });
  } catch {
    return NextResponse.json({ persisted: false });
  }
}

export async function DELETE(req: NextRequest) {
  if (!isStudioRequest(req)) return NextResponse.json({ error: 'STUDIO_ONLY' }, { status: 401 });
  const db = supabase();
  if (!db) return NextResponse.json({ persisted: false });
  const id = new URL(req.url).searchParams.get('id') || '';
  if (!id) return NextResponse.json({ persisted: false, reason: 'no id' });
  try {
    await db.from('brain_sessions').delete().eq('id', id); // messages cascade
    return NextResponse.json({ persisted: true });
  } catch {
    return NextResponse.json({ persisted: false });
  }
}
