import { NextRequest, NextResponse } from 'next/server';
import { isStudioRequest, passcodeIsDefault } from '@/lib/studio';
import { supabaseStatus } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return NextResponse.json({
    studio: isStudioRequest(req),
    mode: supabaseStatus(),
    passcodeIsDefault: passcodeIsDefault(),
  });
}
