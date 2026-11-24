import { NextRequest, NextResponse } from 'next/server';
import { isStudioRequest } from '@/lib/studio';
import { listLinks, saveLink, deleteLink, RepoError } from '@/lib/osrepo';

export const dynamic = 'force-dynamic';

/* PSYCH://OS — your own link shortener. Links live on /l/<slug>. */

export async function GET(req: NextRequest) {
  if (!isStudioRequest(req)) return NextResponse.json({ error: 'STUDIO_ONLY' }, { status: 401 });
  try { return NextResponse.json({ links: await listLinks() }); }
  catch (e) {
    const err = e as RepoError;
    const status = err.code === 'SUPABASE_NOT_CONNECTED' ? 503 : 500;
    return NextResponse.json({ error: err.code || 'LINKS_READ', message: err.message }, { status });
  }
}

export async function POST(req: NextRequest) {
  if (!isStudioRequest(req)) return NextResponse.json({ error: 'STUDIO_ONLY' }, { status: 401 });
  try {
    const b = await req.json() as { url?: string; slug?: string };
    const url = String(b.url || '').trim();
    if (!/^https?:\/\//i.test(url)) return NextResponse.json({ error: 'BAD_URL', message: 'Need an http(s) URL.' }, { status: 400 });
    const link = await saveLink(url, b.slug);
    return NextResponse.json({ link });
  } catch (e) {
    const err = e as RepoError;
    const status = err.code === 'SUPABASE_NOT_CONNECTED' ? 503 : err.code === 'SLUG_TAKEN' ? 409 : 500;
    return NextResponse.json({ error: err.code || 'LINK_WRITE', message: err.message }, { status });
  }
}

export async function DELETE(req: NextRequest) {
  if (!isStudioRequest(req)) return NextResponse.json({ error: 'STUDIO_ONLY' }, { status: 401 });
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'NO_ID', message: 'id required.' }, { status: 400 });
  try { await deleteLink(id); return NextResponse.json({ ok: true }); }
  catch (e) {
    const err = e as RepoError;
    return NextResponse.json({ error: err.code || 'LINK_DELETE', message: err.message }, { status: 500 });
  }
}
