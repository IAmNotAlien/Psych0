import { NextRequest, NextResponse } from 'next/server';
import { isStudioRequest } from '@/lib/studio';
import { listMedia, deleteMedia, RepoError } from '@/lib/repo';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!isStudioRequest(req)) return NextResponse.json({ error: 'STUDIO_ONLY' }, { status: 401 });
  try {
    return NextResponse.json({ media: await listMedia() });
  } catch (e) {
    const err = e as RepoError;
    return NextResponse.json({ error: err.code || 'MEDIA_READ', message: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!isStudioRequest(req)) return NextResponse.json({ error: 'STUDIO_ONLY' }, { status: 401 });
  const id = req.nextUrl.searchParams.get('id') || '';
  if (!id) return NextResponse.json({ error: 'NO_ID' }, { status: 400 });
  try {
    await deleteMedia(id, req.nextUrl.searchParams.get('path') || undefined);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const err = e as RepoError;
    return NextResponse.json({ error: err.code || 'MEDIA_DELETE', message: err.message }, { status: 500 });
  }
}
