import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** hostnames a server must never fetch on behalf of a visitor */
const BLOCKED = /^(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[::1\]|.*\.local$|.*\.internal$)/i;

/**
 * GET /api/fetch?url=… — tiny server-side text proxy for the read-later clipper.
 * Exists because browsers block cross-origin RSS reads (CORS); the server doesn't care.
 * Guardrails: public http(s) only, never private/loopback hosts, 8s timeout, 400 KB cap.
 */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('url') || '';
  let u: URL;
  try { u = new URL(raw); } catch { return NextResponse.json({ error: 'BAD_URL', message: 'Not a valid URL.' }, { status: 400 }); }
  if (!/^https?:$/.test(u.protocol)) return NextResponse.json({ error: 'BAD_PROTO', message: 'Only http(s) URLs.' }, { status: 400 });
  if (BLOCKED.test(u.hostname)) return NextResponse.json({ error: 'BLOCKED_HOST', message: 'That host is not fetchable.' }, { status: 403 });
  try {
    const res = await fetch(u.toString(), {
      headers: { 'User-Agent': 'PSYCH0-feed-reader/1.0 (+personal den)' },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    });
    if (!res.ok) return NextResponse.json({ error: 'UPSTREAM', message: 'Feed server answered ' + res.status }, { status: 502 });
    const ct = res.headers.get('content-type') || '';
    const text = (await res.text()).slice(0, 400_000);
    return NextResponse.json({ ok: true, ct, bytes: text.length, text });
  } catch (e) {
    const msg = (e as Error).name === 'TimeoutError' ? 'Feed server timed out (8s).' : 'Fetch failed — check the URL.';
    return NextResponse.json({ error: 'FETCH', message: msg }, { status: 502 });
  }
}
