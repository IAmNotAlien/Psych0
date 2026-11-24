import { NextRequest, NextResponse } from 'next/server';
import { bumpCounter, getCounter, RepoError } from '@/lib/repo';

export const dynamic = 'force-dynamic';

/** GET ?id= — vote count. POST {id} — cast a vote (light client-side dedupe). */
export async function GET(req: NextRequest) {
  const id = (req.nextUrl.searchParams.get('id') || '').slice(0, 60);
  if (!id) return NextResponse.json({ error: 'NO_ID' }, { status: 400 });
  try {
    return NextResponse.json({ id, n: await getCounter('vote:' + id) });
  } catch (e) {
    const err = e as RepoError;
    return NextResponse.json({ error: err.code || 'VOTE_READ', message: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { id?: string };
    const id = String(body.id || '').slice(0, 60);
    if (!id) return NextResponse.json({ error: 'NO_ID' }, { status: 400 });
    const n = await bumpCounter('vote:' + id);
    return NextResponse.json({ id, n });
  } catch (e) {
    const err = e as RepoError;
    return NextResponse.json({ error: err.code || 'VOTE', message: err.message }, { status: 500 });
  }
}
