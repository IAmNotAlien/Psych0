import { NextRequest, NextResponse } from 'next/server';
import { verifyApiToken, upsertPost, listPosts, RepoError } from '@/lib/repo';
import { uid, slugify, type Post } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * POST /api/hook — post-from-anything. Auth: Authorization: Bearer <api token>
 * (create tokens in STUDIO → SETTINGS → API TOKENS).
 * Body (JSON): { title, body, tags?: string[], publish?: boolean }
 * Creates a DRAFT by default — review in the studio, then publish.
 * Works with iOS Shortcuts, Tasker, IFTTT webhooks, curl, scripts…
 */
export async function POST(req: NextRequest) {
  let ok = false;
  try { ok = await verifyApiToken(req); } catch { ok = false; }
  if (!ok) return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Valid Bearer token required.' }, { status: 401 });
  try {
    const body = await req.json() as { title?: string; body?: string; tags?: unknown; publish?: boolean };
    if (!body.body || !String(body.body).trim()) {
      return NextResponse.json({ error: 'EMPTY', message: 'body is required.' }, { status: 400 });
    }
    const posts = await listPosts({ includeDrafts: true });
    const title = String(body.title || 'POST FROM THE VOID').slice(0, 140);
    const base = slugify(title);
    let slug = base, n = 2;
    while (posts.some(p => p.slug === slug)) { slug = base + '-' + n; n++; }
    const tags = Array.isArray(body.tags)
      ? (body.tags as unknown[]).map(t => String(t).toLowerCase().replace(/[^a-z0-9-]/g, '')).filter(Boolean).slice(0, 8)
      : ['inbox'];
    const post: Post = {
      id: 'p_hk' + uid(), slug, title,
      date: new Date().toISOString().slice(0, 10),
      tags, cover: '', pinned: false,
      published: body.publish === true,   // default: draft for review
      body: String(body.body).slice(0, 40000),
    };
    await upsertPost(post);
    return NextResponse.json({ ok: true, slug, url: '/#/blog/' + slug, published: post.published });
  } catch (e) {
    const err = e as RepoError;
    const status = err.code === 'SUPABASE_NOT_CONNECTED' ? 503 : 500;
    return NextResponse.json({ error: err.code || 'HOOK', message: err.message }, { status });
  }
}
