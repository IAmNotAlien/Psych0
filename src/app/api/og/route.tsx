import { ImageResponse } from 'next/og';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

let fontCache: ArrayBuffer | null = null;
async function silkscreen(): Promise<ArrayBuffer | null> {
  if (fontCache) return fontCache;
  try {
    const origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://psych0.vercel.app';
    const r = await fetch(origin + '/fonts/Silkscreen-Bold.ttf', { cache: 'force-cache' });
    if (!r.ok) return null;
    fontCache = await r.arrayBuffer();
    return fontCache;
  } catch { return null; }
}

/** GET /api/og?title=...&tag=...&accent=%23ff5c00 — pixel-font social card */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const title = (searchParams.get('title') || 'PSYCH0').slice(0, 28).toUpperCase();
  const tag = (searchParams.get('tag') || 'hand-crafted web den — blog // portfolio // lab').slice(0, 70);
  const accent = /^#[0-9a-fA-F]{3,8}$/.test(searchParams.get('accent') || '') ? searchParams.get('accent')! : '#ff5c00';
  const accent2 = /^#[0-9a-fA-F]{3,8}$/.test(searchParams.get('accent2') || '') ? searchParams.get('accent2')! : '#00e0c8';

  const font = await silkscreen();
  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
        justifyContent: 'space-between', padding: 64, background: '#0a0a0c',
        backgroundImage: 'radial-gradient(circle, rgba(214,208,196,0.12) 2px, transparent 2px)',
        backgroundSize: '34px 34px', color: '#d6d0c4', fontFamily: font ? 'Silkscreen' : 'monospace',
        border: `4px solid ${accent}`,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 22, letterSpacing: 4, color: '#8a8578' }}>
          <span>SIGNAL // ONLINE</span><span style={{ color: accent2 }}>SUPABASE BACKED</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ fontSize: title.length > 10 ? 110 : 150, fontWeight: 700, color: '#d6d0c4', lineHeight: 1 }}>{title}</div>
          <div style={{ fontSize: 30, color: '#8a8578', letterSpacing: 2 }}>{tag}</div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ width: 14, height: 14, background: accent }} />
          <div style={{ fontSize: 24, color: accent, letterSpacing: 4 }}>PSYCH0 // NEXT.JS + SUPABASE</div>
        </div>
      </div>
    ),
    { ...size, fonts: font ? [{ name: 'Silkscreen', data: font, weight: 700, style: 'normal' }] : [] },
  );
}
