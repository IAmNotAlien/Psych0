import { NextRequest, NextResponse } from 'next/server';
import { isStudioRequest } from '@/lib/studio';
import { requireSupabase, listFiles, saveFile, deleteFile, RepoError } from '@/lib/osrepo';
import { uid } from '@/lib/types';

export const dynamic = 'force-dynamic';

/* PSYCH://OS — the drive. Any file type, folders, share tokens.
 * GET    /api/files            — list metadata
 * POST   /api/files            — multipart upload (file + folder + text?)
 * PUT    /api/files            — patch metadata (rename/move/share token)
 * DELETE /api/files?id=&path=  — remove */

const MAX = 25 * 1024 * 1024;

export async function GET(req: NextRequest) {
  if (!isStudioRequest(req)) return NextResponse.json({ error: 'STUDIO_ONLY' }, { status: 401 });
  try {
    return NextResponse.json({ files: await listFiles() });
  } catch (e) {
    const err = e as RepoError;
    const status = err.code === 'SUPABASE_NOT_CONNECTED' ? 503 : 500;
    return NextResponse.json({ error: err.code || 'FILES_READ', message: err.message }, { status });
  }
}

export async function POST(req: NextRequest) {
  if (!isStudioRequest(req)) return NextResponse.json({ error: 'STUDIO_ONLY' }, { status: 401 });
  try {
    const db = requireSupabase();
    try { await db.storage.createBucket('drive', { public: true, fileSizeLimit: '30MB' }); } catch { /* exists */ }
    const form = await req.formData();
    const file = form.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'NO_FILE', message: 'No file received.' }, { status: 400 });
    if (file.size > MAX) return NextResponse.json({ error: 'TOO_BIG', message: 'Max 25 MB per file.' }, { status: 413 });
    const folder = String(form.get('folder') || '/').slice(0, 180) || '/';
    const text = String(form.get('text') || '').slice(0, 100000);
    const name = file.name.replace(/[^\w.\-() ]/g, '_').slice(0, 120) || 'file';
    const safe = name.replace(/[^\w.\-()]/g, '_');
    const path = `d/${Date.now().toString(36)}-${uid()}-${safe}`;
    const buf = Buffer.from(await file.arrayBuffer());
    const { error } = await db.storage.from('drive').upload(path, buf, { contentType: file.type || 'application/octet-stream', upsert: false });
    if (error) throw new RepoError('UPLOAD', error.message);
    const { data } = db.storage.from('drive').getPublicUrl(path);
    const row = await saveFile({
      name, folder, mime: file.type || 'application/octet-stream', size: file.size,
      path, url: data.publicUrl, text,
    });
    return NextResponse.json({ file: row });
  } catch (e) {
    const err = e as RepoError;
    const status = err.code === 'SUPABASE_NOT_CONNECTED' ? 503 : 500;
    return NextResponse.json({ error: err.code || 'UPLOAD', message: err.message }, { status });
  }
}

export async function PUT(req: NextRequest) {
  if (!isStudioRequest(req)) return NextResponse.json({ error: 'STUDIO_ONLY' }, { status: 401 });
  try {
    const patch = await req.json() as { id?: string; name?: string; folder?: string; share?: string; share_expires?: string | null; text?: string };
    if (!patch.id) return NextResponse.json({ error: 'NO_ID', message: 'id required.' }, { status: 400 });
    const row = await saveFile({ ...patch, created_at: undefined } as never);
    return NextResponse.json({ file: row });
  } catch (e) {
    const err = e as RepoError;
    const status = err.code === 'SUPABASE_NOT_CONNECTED' ? 503 : 500;
    return NextResponse.json({ error: err.code || 'FILE_WRITE', message: err.message }, { status });
  }
}

export async function DELETE(req: NextRequest) {
  if (!isStudioRequest(req)) return NextResponse.json({ error: 'STUDIO_ONLY' }, { status: 401 });
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'NO_ID', message: 'id required.' }, { status: 400 });
  try {
    await deleteFile(id, url.searchParams.get('path') || undefined);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const err = e as RepoError;
    const status = err.code === 'SUPABASE_NOT_CONNECTED' ? 503 : 500;
    return NextResponse.json({ error: err.code || 'FILE_DELETE', message: err.message }, { status });
  }
}
