import { NextRequest, NextResponse } from 'next/server';
import { isStudioRequest } from '@/lib/studio';
import { listTokens, createToken, deleteToken, RepoError } from '@/lib/repo';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!isStudioRequest(req)) return NextResponse.json({ error: 'STUDIO_ONLY' }, { status: 401 });
  try {
    const tokens = (await listTokens()).map(t => ({ id: t.id, label: t.label, created_at: t.created_at, last_used: t.last_used }));
    return NextResponse.json({ tokens });
  } catch (e) {
    const err = e as RepoError;
    return NextResponse.json({ error: err.code || 'TOKEN_READ', message: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isStudioRequest(req)) return NextResponse.json({ error: 'STUDIO_ONLY' }, { status: 401 });
  try {
    const body = await req.json() as { label?: string };
    const { row, raw } = await createToken(body.label || 'token');
    // the raw token is returned exactly once — only its sha256 hash is stored
    return NextResponse.json({ token: { id: row.id, label: row.label, created_at: row.created_at }, raw });
  } catch (e) {
    const err = e as RepoError;
    return NextResponse.json({ error: err.code || 'TOKEN_WRITE', message: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!isStudioRequest(req)) return NextResponse.json({ error: 'STUDIO_ONLY' }, { status: 401 });
  const id = req.nextUrl.searchParams.get('id') || '';
  if (!id) return NextResponse.json({ error: 'NO_ID' }, { status: 400 });
  try {
    await deleteToken(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const err = e as RepoError;
    return NextResponse.json({ error: err.code || 'TOKEN_DELETE', message: err.message }, { status: 500 });
  }
}
