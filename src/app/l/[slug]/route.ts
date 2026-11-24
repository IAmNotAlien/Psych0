import { NextRequest, NextResponse } from 'next/server';
import { resolveLink, bumpLink } from '@/lib/osrepo';
import type { ShortLink } from '@/lib/types';

export const dynamic = 'force-dynamic';

/* GET /l/<slug> — your own short links. 302 to the target, count the click. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  let link: ShortLink | null = null;
  try { link = await resolveLink(slug); } catch { link = null; }
  if (!link) return NextResponse.redirect(new URL('/#/os/links', _req.url), 302);
  bumpLink(slug); // best-effort, never blocks the redirect
  return NextResponse.redirect(link.url, 302);
}
