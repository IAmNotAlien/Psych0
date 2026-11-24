import { NextRequest, NextResponse } from 'next/server';
import { isStudioRequest } from '@/lib/studio';
import { requireSupabase, addMedia, RepoError } from '@/lib/repo';
import { uid } from '@/lib/types';

export const dynamic = 'force-dynamic';

const MIME_OK = /^image\/(png|jpe?g|gif|webp|avif|svg\+xml)$/;
const MAX = 12 * 1024 * 1024;

export async function POST(req: NextRequest) {
  if (!isStudioRequest(req)) return NextResponse.json({ error: 'STUDIO_ONLY', message: 'Enter the studio passcode first.' }, { status: 401 });
  try {
    const db = requireSupabase();
    // ensure the public bucket exists (idempotent)
    try { await db.storage.createBucket('media', { public: true, fileSizeLimit: '15MB' }); } catch { /* exists */ }
    const form = await req.formData();
    const file = form.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'NO_FILE', message: 'No file received.' }, { status: 400 });
    if (!MIME_OK.test(file.type)) return NextResponse.json({ error: 'BAD_TYPE', message: 'Images only (png, jpg, gif, webp, avif, svg).' }, { status: 415 });
    if (file.size > MAX) return NextResponse.json({ error: 'TOO_BIG', message: 'Max 12 MB per file.' }, { status: 413 });
    const ext = (file.name.split('.').pop() || 'img').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'img';
    const path = `u/${Date.now().toString(36)}-${uid()}.${ext}`;
    const buf = Buffer.from(await file.arrayBuffer());
    const { error } = await db.storage.from('media').upload(path, buf, { contentType: file.type, upsert: false });
    if (error) throw new RepoError('UPLOAD', error.message);
    const { data } = db.storage.from('media').getPublicUrl(path);
    const item = await addMedia({
      id: 'f_' + uid(), path, url: data.publicUrl, mime: file.type,
      size: file.size, created_at: new Date().toISOString(),
    });
    return NextResponse.json({ item });
  } catch (e) {
    const err = e as RepoError;
    const status = err.code === 'SUPABASE_NOT_CONNECTED' ? 503 : 500;
    return NextResponse.json({ error: err.code || 'UPLOAD', message: err.message }, { status });
  }
}
