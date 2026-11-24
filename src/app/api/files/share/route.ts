import { NextRequest, NextResponse } from 'next/server';
import { findSharedFile } from '@/lib/osrepo';
import type { DriveFile } from '@/lib/types';

export const dynamic = 'force-dynamic';

/* GET /api/files/share?token=… — public download for a shared drive file.
 * The file itself lives in the (public) storage bucket; the token gate lives
 * here: without a valid, unexpired token the bytes are never handed out. */
export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get('token') || '';
  let file: DriveFile | null = null;
  try { file = await findSharedFile(token); } catch { file = null; }
  if (!file) return NextResponse.json({ error: 'NOT_FOUND', message: 'This share link is invalid or expired.' }, { status: 404 });
  return NextResponse.json({
    file: { name: file.name, mime: file.mime, size: file.size, url: file.url, folder: file.folder },
  });
}
