import { NextRequest, NextResponse } from 'next/server';
import { fullBackup } from '@/lib/osrepo';
import { isStudioRequest } from '@/lib/studio';

export const dynamic = 'force-dynamic';

/* GET /api/backup — PSYCH://OS mega backup: everything (site, posts, projects,
 * embeds, vault items, drive metadata, short links) as one JSON file.
 * Encrypted secrets come back as ciphertext only — safe to store. */
export async function GET(req: NextRequest) {
  if (!isStudioRequest(req)) return NextResponse.json({ error: 'STUDIO_ONLY' }, { status: 401 });
  try {
    const data = await fullBackup();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: 'BACKUP', message: String(e).slice(0, 200) }, { status: 500 });
  }
}
