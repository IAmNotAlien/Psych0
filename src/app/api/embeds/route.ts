import { NextRequest, NextResponse } from 'next/server';
import { listEmbeds, upsertEmbed, RepoError } from '@/lib/repo';
import { isStudioRequest } from '@/lib/studio';
import type { Embed } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const embeds = await listEmbeds();
    return NextResponse.json({ embeds });
  } catch (e) {
    const err = e as RepoError;
    return NextResponse.json({ error: err.code || 'EMBEDS_READ', message: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isStudioRequest(req)) return NextResponse.json({ error: 'STUDIO_ONLY', message: 'Enter the studio passcode first.' }, { status: 401 });
  try {
    const embed = await req.json() as Embed;
    if (!embed || typeof embed.id !== 'string' || typeof embed.url !== 'string') {
      return NextResponse.json({ error: 'BAD_PAYLOAD', message: 'Embed needs at least id and url.' }, { status: 400 });
    }
    const saved = await upsertEmbed(embed);
    return NextResponse.json({ embed: saved });
  } catch (e) {
    const err = e as RepoError;
    const status = err.code === 'SUPABASE_NOT_CONNECTED' ? 503 : 500;
    return NextResponse.json({ error: err.code || 'EMBED_WRITE', message: err.message }, { status });
  }
}
