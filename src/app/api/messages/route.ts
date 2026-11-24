import { NextRequest, NextResponse } from 'next/server';
import { isStudioRequest } from '@/lib/studio';
import { listMessages, createMessage, setMessageRead, setMessagePublic, deleteMessage, RepoError } from '@/lib/repo';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const studio = isStudioRequest(req);
  try {
    const messages = await listMessages({ includePrivate: studio });
    return NextResponse.json({ messages, inbox: studio });
  } catch (e) {
    const err = e as RepoError;
    return NextResponse.json({ error: err.code || 'MSG_READ', message: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { name?: string; contact?: string; body?: string; website?: string; loc?: string };
    // honeypot: real visitors never fill the invisible "website" field
    if (body.website) return NextResponse.json({ ok: true });
    if (!body.body || !body.body.trim()) return NextResponse.json({ error: 'EMPTY', message: 'Say something first.' }, { status: 400 });
    const m = await createMessage(body.name || 'ANON', body.contact || '', body.body, body.loc || '');
    return NextResponse.json({ ok: true, message: { id: m.id, created_at: m.created_at } });
  } catch (e) {
    const err = e as RepoError;
    const status = err.code === 'SUPABASE_NOT_CONNECTED' ? 503 : 500;
    return NextResponse.json({ error: err.code || 'MSG_WRITE', message: err.message || 'Guestbook is database-backed — connect Supabase first.' }, { status });
  }
}

export async function PUT(req: NextRequest) {
  if (!isStudioRequest(req)) return NextResponse.json({ error: 'STUDIO_ONLY' }, { status: 401 });
  try {
    const body = await req.json() as { id?: string; read?: boolean; public?: boolean };
    if (!body.id) return NextResponse.json({ error: 'NO_ID' }, { status: 400 });
    if (typeof body.read === 'boolean') await setMessageRead(body.id, body.read);
    if (typeof body.public === 'boolean') await setMessagePublic(body.id, body.public);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const err = e as RepoError;
    return NextResponse.json({ error: err.code || 'MSG_UPDATE', message: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!isStudioRequest(req)) return NextResponse.json({ error: 'STUDIO_ONLY' }, { status: 401 });
  const id = req.nextUrl.searchParams.get('id') || '';
  if (!id) return NextResponse.json({ error: 'NO_ID' }, { status: 400 });
  try {
    await deleteMessage(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const err = e as RepoError;
    return NextResponse.json({ error: err.code || 'MSG_DELETE', message: err.message }, { status: 500 });
  }
}
