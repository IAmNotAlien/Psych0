import { NextResponse } from 'next/server';
import { STUDIO_COOKIE } from '@/lib/studio';

export const dynamic = 'force-dynamic';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(STUDIO_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}
