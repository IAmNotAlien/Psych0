/* PSYCH0 — studio gate.
 * Hobby-grade passcode auth: correct passcode → signed httpOnly cookie.
 * Upgrade path: Supabase Auth (magic link) — documented in README. */
import crypto from 'crypto';
import { cookies } from 'next/headers';

export const STUDIO_COOKIE = 'psych0_studio';
const TTL_DAYS = 30;

/* No passcode in the repo — set STUDIO_PASSCODE in env (local .env or Vercel
 * → Settings → Environment Variables). Falls back to the demo 'psych0' with
 * a visible warning until you set a real one. */
function passcode(): string {
  return process.env.STUDIO_PASSCODE || 'psych0';
}

export function passcodeIsDefault(): boolean {
  return !process.env.STUDIO_PASSCODE;
}

function secret(): string {
  return process.env.STUDIO_SECRET || ('psych0-secret::' + passcode());
}

function sign(): string {
  return crypto.createHmac('sha256', secret()).update('psych0-studio-v1').digest('hex');
}

export function checkPasscode(input: string): boolean {
  const a = Buffer.from(String(input ?? ''));
  const b = Buffer.from(passcode());
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: TTL_DAYS * 24 * 60 * 60,
  };
}

export function makeToken(): string {
  return sign();
}

/** Server components: read the studio flag from the cookie jar. */
export async function isStudioServer(): Promise<boolean> {
  const jar = await cookies();
  const t = jar.get(STUDIO_COOKIE)?.value;
  return !!t && t === sign();
}

/** Route handlers: read the studio flag from the request. */
export function isStudioRequest(req: Request): boolean {
  const raw = req.headers.get('cookie') || '';
  const m = raw.match(new RegExp('(?:^|;\\s*)' + STUDIO_COOKIE + '=([^;]+)'));
  return !!m && m[1] === sign();
}
