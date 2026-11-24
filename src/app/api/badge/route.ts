import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-static';

/** GET /api/badge?text=PSYCH0&fg=%23ff5c00&bg=%23000 — classic 88×31 pixel badge (SVG) */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const text = (sp.get('text') || 'PSYCH0').toUpperCase().slice(0, 12);
  const fg = /^#[0-9a-fA-F]{3,8}$/.test(sp.get('fg') || '') ? sp.get('fg')! : '#ff5c00';
  const bg = /^#[0-9a-fA-F]{3,8}$/.test(sp.get('bg') || '') ? sp.get('bg')! : '#0a0a0c';
  const fs = Math.min(18, Math.max(9, 132 / Math.max(4, text.length)));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="88" height="31" viewBox="0 0 88 31" role="img" aria-label="${text}">
<rect width="88" height="31" fill="${bg}"/>
<rect x="1" y="1" width="86" height="29" fill="none" stroke="${fg}" stroke-width="1" stroke-dasharray="2 2"/>
<rect x="1" y="1" width="86" height="3" fill="${fg}" opacity="0.35"/>
<rect x="1" y="27" width="86" height="3" fill="${fg}" opacity="0.35"/>
<text x="44" y="20" font-family="'Silkscreen','Courier New',monospace" font-size="${fs}" font-weight="bold" fill="${fg}" text-anchor="middle" letter-spacing="1">${text.replace(/[<>&]/g, '')}</text>
<rect x="2" y="2" width="1" height="1" fill="${fg}" opacity="0.6"/><rect x="85" y="28" width="1" height="1" fill="${fg}" opacity="0.6"/>
</svg>`;
  return new NextResponse(svg, {
    headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400' },
  });
}
