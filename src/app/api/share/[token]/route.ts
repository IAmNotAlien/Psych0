import { NextRequest, NextResponse } from 'next/server';
import { readSharedItem } from '@/lib/osrepo';

export const dynamic = 'force-dynamic';

/* GET /api/share/<token> — public reader for shared private notes.
 * Self-destructing notes (burns > 0) are consumed here: when the read count
 * reaches the limit the item is deleted from the database for good. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  try {
    const { item, burned } = await readSharedItem(token);
    if (!item) return NextResponse.json({ error: 'NOT_FOUND', message: 'This link is invalid or expired.' }, { status: 404 });
    return NextResponse.json({
      title: item.title,
      body: item.body,
      burned,
      burnsLeft: Math.max(0, item.burns - item.reads - (item.burns > 0 ? 1 : 0)),
    });
  } catch (e) {
    return NextResponse.json({ error: 'SHARE_FAIL', message: String(e).slice(0, 200) }, { status: 500 });
  }
}
