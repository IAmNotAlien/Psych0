import { NextRequest, NextResponse } from 'next/server';
import { listPosts, upsertPost, RepoError } from '@/lib/repo';
import { isStudioRequest } from '@/lib/studio';
import type { Post } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const drafts = req.nextUrl.searchParams.get('drafts') === '1';
  if (drafts && !isStudioRequest(req)) {
    return NextResponse.json({ error: 'STUDIO_ONLY', message: 'Drafts need the studio passcode.' }, { status: 401 });
  }
  try {
    const posts = await listPosts({ includeDrafts: drafts });
    return NextResponse.json({ posts });
  } catch (e) {
    const err = e as RepoError;
    return NextResponse.json({ error: err.code || 'POSTS_READ', message: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isStudioRequest(req)) return NextResponse.json({ error: 'STUDIO_ONLY', message: 'Enter the studio passcode first.' }, { status: 401 });
  try {
    const post = await req.json() as Post;
    if (!post || typeof post.id !== 'string' || typeof post.slug !== 'string') {
      return NextResponse.json({ error: 'BAD_PAYLOAD', message: 'Post needs at least id and slug.' }, { status: 400 });
    }
    const saved = await upsertPost(post);
    return NextResponse.json({ post: saved });
  } catch (e) {
    const err = e as RepoError;
    const status = err.code === 'SUPABASE_NOT_CONNECTED' ? 503 : 500;
    return NextResponse.json({ error: err.code || 'POST_WRITE', message: err.message }, { status });
  }
}
