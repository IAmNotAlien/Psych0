import { NextRequest, NextResponse } from 'next/server';
import { getBundle, upsertSite, RepoError } from '@/lib/repo';
import { isStudioRequest } from '@/lib/studio';
import type { SiteData } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const bundle = await getBundle();
    return NextResponse.json({ site: bundle.site });
  } catch (e) {
    const err = e as RepoError;
    return NextResponse.json({ error: err.code || 'SITE_READ', message: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  if (!isStudioRequest(req)) return NextResponse.json({ error: 'STUDIO_ONLY', message: 'Enter the studio passcode first.' }, { status: 401 });
  try {
    const body = await req.json() as Partial<SiteData>;
    const bundle = await getBundle();
    const site: SiteData = { ...bundle.site, ...body, fx: { ...bundle.site.fx, ...(body.fx || {}) } } as SiteData;
    const saved = await upsertSite(site);
    return NextResponse.json({ site: saved });
  } catch (e) {
    const err = e as RepoError;
    const status = err.code === 'SUPABASE_NOT_CONNECTED' ? 503 : 500;
    return NextResponse.json({ error: err.code || 'SITE_WRITE', message: err.message }, { status });
  }
}
