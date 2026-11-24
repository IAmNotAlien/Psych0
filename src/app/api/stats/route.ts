import { NextRequest, NextResponse } from 'next/server';
import { isStudioRequest } from '@/lib/studio';
import { bumpCounter, getStats, getCounters, listMessages, RepoError } from '@/lib/repo';

export const dynamic = 'force-dynamic';

/** POST — public visit ping: bumps total + per-path counters */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { path?: string };
    const path = String(body.path || '/').slice(0, 120);
    await bumpCounter('visit:total');
    await bumpCounter('visit:path:' + path);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const err = e as RepoError;
    return NextResponse.json({ error: err.code || 'VISIT', message: err.message }, { status: 500 });
  }
}

/** GET — dashboard stats; the studio cookie unlocks inbox + per-path detail */
export async function GET(req: NextRequest) {
  const studio = isStudioRequest(req);
  try {
    const stats = await getStats();
    if (!studio) return NextResponse.json({ stats });
    const [paths, msgs] = await Promise.all([
      getCounters('visit:path:'),
      listMessages({ includePrivate: true }),
    ]);
    return NextResponse.json({
      stats,
      paths: Object.fromEntries(Object.entries(paths).map(([k, v]) => [k.slice('visit:path:'.length), v])),
      unread: msgs.filter(m => !m.read).length,
    });
  } catch (e) {
    const err = e as RepoError;
    return NextResponse.json({ error: err.code || 'STATS', message: err.message }, { status: 500 });
  }
}
