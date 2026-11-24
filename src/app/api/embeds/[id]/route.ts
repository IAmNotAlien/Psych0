import { NextRequest, NextResponse } from 'next/server';
import { upsertEmbed, deleteEmbed, RepoError } from '@/lib/repo';
import { isStudioRequest } from '@/lib/studio';
import type { Embed } from '@/lib/types';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  if (!isStudioRequest(req)) return NextResponse.json({ error: 'STUDIO_ONLY', message: 'Enter the studio passcode first.' }, { status: 401 });
  const { id } = await ctx.params;
  try {
    const body = await req.json() as Partial<Embed>;
    const embed = { ...body, id } as Embed;
    if (typeof embed.url !== 'string' || !embed.url) {
      return NextResponse.json({ error: 'BAD_PAYLOAD', message: 'Embed needs a url.' }, { status: 400 });
    }
    const saved = await upsertEmbed(embed);
    return NextResponse.json({ embed: saved });
  } catch (e) {
    const err = e as RepoError;
    const status = err.code === 'SUPABASE_NOT_CONNECTED' ? 503 : 500;
    return NextResponse.json({ error: err.code || 'EMBED_WRITE', message: err.message }, { status });
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  if (!isStudioRequest(req)) return NextResponse.json({ error: 'STUDIO_ONLY', message: 'Enter the studio passcode first.' }, { status: 401 });
  const { id } = await ctx.params;
  try {
    await deleteEmbed(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const err = e as RepoError;
    const status = err.code === 'SUPABASE_NOT_CONNECTED' ? 503 : 500;
    return NextResponse.json({ error: err.code || 'EMBED_DELETE', message: err.message }, { status });
  }
}
