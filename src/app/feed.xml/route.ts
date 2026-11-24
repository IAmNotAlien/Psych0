import { listPosts } from '@/lib/repo';
import type { Post } from '@/lib/types';

export const dynamic = 'force-dynamic';

const esc = (s: string) => String(s || '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** GET /feed.xml — RSS 2.0 of published posts (the indieweb etiquette pack) */
export async function GET(req: Request) {
  const origin = process.env.NEXT_PUBLIC_SITE_URL
    || process.env.VERCEL_PROJECT_PRODUCTION_URL && ('https://' + process.env.VERCEL_PROJECT_PRODUCTION_URL)
    || 'https://psych0.vercel.app';
  let posts: Post[] = [];
  try { posts = (await listPosts()).slice(0, 30); } catch { posts = []; }
  const items = posts.map(p => `
    <item>
      <title>${esc(p.title)}</title>
      <link>${origin}/#/blog/${esc(p.slug)}</link>
      <guid isPermaLink="false">${esc(p.id)}</guid>
      <pubDate>${new Date(p.date || Date.now()).toUTCString()}</pubDate>
      <description>${esc((p.body || '').slice(0, 500))}</description>
      ${p.tags.map(t => `<category>${esc(t)}</category>`).join('\n      ')}
    </item>`).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>PSYCH0 — hand-crafted web den</title>
    <link>${origin}</link>
    <description>blog // portfolio // lab — field notes from a terminal-punk web den</description>
    <language>en</language>
    <atom:link href="${origin}/feed.xml" rel="self" type="application/rss+xml"/>
    ${items}
  </channel>
</rss>`;
  return new Response(xml, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, max-age=600' },
  });
}
