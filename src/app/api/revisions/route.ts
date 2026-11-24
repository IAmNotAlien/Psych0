import { NextRequest, NextResponse } from 'next/server';
import { isStudioRequest } from '@/lib/studio';
import { listRevisions, restoreRevision, RepoError } from '@/lib/repo';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!isStudioRequest(req)) return NextResponse.json({ error: 'STUDIO_ONLY' }, { status: 401 });
  const entity = req.nextUrl.searchParams.get('entity') || '';
  const id = req.nextUrl.searchParams.get('id') || '';
  if (!entity || !id) return NextResponse.json({ error: 'NO_ARGS', message: 'Need entity + id.' }, { status: 400 });
  try {
    return NextResponse.json({ revisions: await listRevisions(entity, id) });
  } catch (e) {
    const err = e as RepoError;
    return NextResponse.json({ error: err.code || 'REV_READ', message: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isStudioRequest(req)) return NextResponse.json({ error: 'STUDIO_ONLY' }, { status: 401 });
  try {
    const body = await req.json() as { rev?: number };
    if (!body.rev) return NextResponse.json({ error: 'NO_REV' }, { status: 400 });
    const out = await restoreRevision(body.rev);
    return NextResponse.json({ ok: true, entity: out.entity, data: out.data });
  } catch (e) {
    const err = e as RepoError;
    return NextResponse.json({ error: err.code || 'REV_RESTORE', message: err.message }, { status: 500 });
  }
}
