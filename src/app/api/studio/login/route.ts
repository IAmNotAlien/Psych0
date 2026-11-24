import { NextRequest, NextResponse } from 'next/server';
import { checkPasscode, makeToken, cookieOptions, STUDIO_COOKIE, passcodeIsDefault } from '@/lib/studio';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let passcode = '';
  try {
    const body = await req.json() as { passcode?: string };
    passcode = String(body.passcode ?? '');
  } catch {
    return NextResponse.json({ error: 'BAD_PAYLOAD', message: 'Send { passcode } as JSON.' }, { status: 400 });
  }
  if (!checkPasscode(passcode)) {
    return NextResponse.json({ error: 'WRONG_PASSCODE', message: 'Access denied.' }, { status: 401 });
  }
  const res = NextResponse.json({
    ok: true,
    passcodeIsDefault: passcodeIsDefault(),
    hint: passcodeIsDefault() ? 'You are using the demo passcode. Set STUDIO_PASSCODE in env to secure the studio.' : null,
  });
  res.cookies.set(STUDIO_COOKIE, makeToken(), cookieOptions());
  return res;
}
