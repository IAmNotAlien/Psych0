import { NextRequest, NextResponse } from 'next/server';
import { upsertPost, deletePost, RepoError } from '@/lib/repo';
import { isStudioRequest } from '@/lib/studio';
import type { Post } from '@/lib/types';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  if (!isStudioRequest(req)) return NextResponse.json({ error: 'STUDIO_ONLY', message: 'Enter the studio passcode first.' }, { status: 401 });
  const { id } = await ctx.params;
  try {
    const body = await req.json() as Partial<Post>;
    const post = { ...body, id } as Post;
    if (typeof post.slug !== 'string' || !post.slug) {
      return NextResponse.json({ error: 'BAD_PAYLOAD', message: 'Post needs a slug.' }, { status: 400 });
    }
    const saved = await upsertPost(post);
    return NextResponse.json({ post: saved });
  } catch (e) {
    const err = e as RepoError;
    const status = err.code === 'SUPABASE_NOT_CONNECTED' ? 503 : 500;
    return NextResponse.json({ error: err.code || 'POST_WRITE', message: err.message }, { status });
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  if (!isStudioRequest(req)) return NextResponse.json({ error: 'STUDIO_ONLY', message: 'Enter the studio passcode first.' }, { status: 401 });
  const { id } = await ctx.params;
  try {
    await deletePost(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const err = e as RepoError;
    const status = err.code === 'SUPABASE_NOT_CONNECTED' ? 503 : 500;
    return NextResponse.json({ error: err.code || 'POST_DELETE', message: err.message }, { status });
  }
}
