import { NextRequest, NextResponse } from 'next/server';
import { isStudioRequest } from '@/lib/studio';
import { listItems, saveItem, deleteItem, listItemRevisions, getRules, RepoError } from '@/lib/osrepo';
import type { VaultItem } from '@/lib/types';

export const dynamic = 'force-dynamic';

/* PSYCH://OS — the everything endpoint for vault items.
 * GET  /api/items[?type=task]           — list (newest first)
 * GET  /api/items?revs=<itemId>         — revision snapshots of one item
 * POST /api/items                       — upsert (runs the rules engine on create)
 * DELETE /api/items?id=<id>             — remove */

export async function GET(req: NextRequest) {
  if (!isStudioRequest(req)) return NextResponse.json({ error: 'STUDIO_ONLY' }, { status: 401 });
  try {
    const url = new URL(req.url);
    const revs = url.searchParams.get('revs');
    if (revs) return NextResponse.json({ revisions: await listItemRevisions(revs) });
    const type = url.searchParams.get('type') || undefined;
    return NextResponse.json({ items: await listItems(type) });
  } catch (e) {
    const err = e as RepoError;
    const status = err.code === 'SUPABASE_NOT_CONNECTED' ? 503 : 500;
    return NextResponse.json({ error: err.code || 'ITEMS_READ', message: err.message }, { status });
  }
}

export async function POST(req: NextRequest) {
  if (!isStudioRequest(req)) return NextResponse.json({ error: 'STUDIO_ONLY' }, { status: 401 });
  try {
    const raw = await req.json() as Partial<VaultItem>;
    const rules = raw.created_at ? [] : await getRules();
    const item = await saveItem(raw, { applyRules: rules });
    return NextResponse.json({ item });
  } catch (e) {
    const err = e as RepoError;
    const status = err.code === 'SUPABASE_NOT_CONNECTED' ? 503 : 500;
    return NextResponse.json({ error: err.code || 'ITEM_WRITE', message: err.message }, { status });
  }
}

export async function DELETE(req: NextRequest) {
  if (!isStudioRequest(req)) return NextResponse.json({ error: 'STUDIO_ONLY' }, { status: 401 });
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'NO_ID', message: 'id required.' }, { status: 400 });
  try {
    await deleteItem(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const err = e as RepoError;
    const status = err.code === 'SUPABASE_NOT_CONNECTED' ? 503 : 500;
    return NextResponse.json({ error: err.code || 'ITEM_DELETE', message: err.message }, { status });
  }
}
