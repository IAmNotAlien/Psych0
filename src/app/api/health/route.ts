import { NextResponse } from 'next/server';
import { supabaseStatus, supabaseEnv, supabase, canWriteSupabase } from '@/lib/supabase';
import { passcodeIsDefault } from '@/lib/studio';

export const dynamic = 'force-dynamic';

export async function GET() {
  const env = supabaseEnv();
  // probe the migrate-2 columns + the OS tables so the UI can show
  // "run migration X" banners with the exact status
  let columns = { stage: true, loc: true };
  let osTables = false;
  const db = supabase();
  if (db) {
    try {
      const p = await db.from('posts').select('stage,fossil').limit(1);
      if (p.error && /column/i.test(p.error.message)) columns = { stage: false, loc: false };
      else {
        const m = await db.from('messages').select('loc').limit(1);
        if (m.error && /column/i.test(m.error.message)) columns = { stage: true, loc: false };
      }
      const items = await db.from('items').select('id').limit(1);
      osTables = !items.error;
    } catch { /* probe is best-effort */ }
  }
  return NextResponse.json({
    ok: true,
    mode: supabaseStatus(),
    canWrite: canWriteSupabase(),
    supabaseUrl: env ? new URL(env.url).hostname : null,
    studioPasscodeDefault: passcodeIsDefault(),
    columns,
    osTables,
    now: new Date().toISOString(),
  });
}
