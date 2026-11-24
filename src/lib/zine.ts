/* PSYCH0 — zine compiler. Turns a year of posts into one printable,
 * self-contained HTML document: open it, hit print, save as PDF. That's the
 * whole pipeline — you are now a publisher. */

import { mdParse } from './markdown';

const esc = (s: unknown) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export interface ZineOpts {
  siteName: string;
  year: string;
  vol: string;
  posts: { title: string; date: string; tags: string[]; body: string }[];
}

export function buildZineHtml(o: ZineOpts): string {
  const posts = o.posts.slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const toc = posts.map((p, i) =>
    '<li><span class="n">' + String(i + 1).padStart(2, '0') + '</span> ' + esc(p.title) +
    ' <span class="d">' + esc(p.date) + '</span></li>').join('');

  const body = posts.map((p, i) =>
    '<section class="zpost"><div class="znum">ENTRY ' + String(i + 1).padStart(2, '0') +
    '</div><h2>' + esc(p.title) + '</h2><div class="zmeta">' + esc(p.date) +
    ((p.tags || []).length ? ' · #' + p.tags.map(esc).join(' #') : '') + '</div>' +
    mdParse(p.body) + '</section>').join('\n');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>${esc(o.siteName)} — zine ${esc(o.year)}</title>
<style>
  :root { --ink:#111; --paper:#faf7f0; --acc:#c23616; }
  * { box-sizing: border-box; }
  body { margin:0; color:var(--ink); background:var(--paper);
         font: 12pt/1.65 Georgia, 'Times New Roman', serif; }
  .cover { min-height: 96vh; display:flex; flex-direction:column; justify-content:center;
           padding: 8vw; page-break-after: always; }
  .kicker { letter-spacing:.3em; text-transform:uppercase; font-size:10pt; color:var(--acc); }
  h1 { font-size: 34pt; margin:.2em 0; letter-spacing:.02em; }
  .vol { font-size:13pt; letter-spacing:.2em; color:var(--acc); }
  .rule { height:3px; background:var(--ink); width:180px; margin:2em 0; }
  .toc { padding: 0 8vw; page-break-after: always; }
  .toc h2 { letter-spacing:.25em; font-size:12pt; text-transform:uppercase; }
  .toc ol { list-style:none; padding:0; }
  .toc li { padding:.45em 0; border-bottom:1px dotted #999; display:flex; gap:1em; align-items:baseline; }
  .toc .n { color:var(--acc); font-family:monospace; }
  .toc .d { margin-left:auto; font-size:9pt; color:#666; }
  .zpost { padding: 0 8vw; page-break-after: always; }
  .zpost h2 { font-size:20pt; margin:.1em 0; }
  .znum { letter-spacing:.3em; font-size:8pt; color:var(--acc); text-transform:uppercase; }
  .zmeta { font-size:9pt; color:#666; border-bottom:1px solid #ccc; padding-bottom:1em; margin-bottom:1.4em; }
  .zpost img { max-width:100%; height:auto; }
  .zpost pre { background:#111; color:#eee; padding:1em; overflow-x:auto; font-size:9pt; }
  .zpost code { font-family: 'Courier New', monospace; }
  .zpost table { border-collapse:collapse; width:100%; }
  .zpost td, .zpost th { border:1px solid #999; padding:.35em .6em; }
  .zpost blockquote { border-left:3px solid var(--acc); margin-left:0; padding-left:1em; color:#444; }
  .endnote { text-align:center; color:#666; font-size:9pt; padding:4vh 0; page-break-after: auto; }
  @media print {
    .cover { min-height: 90vh; }
    body { background:#fff; }
    .zpost, .toc, .cover { page-break-after: always; }
    .zpost:last-of-type { page-break-after: auto; }
  }
</style></head><body>
<div class="cover">
  <div class="kicker">A ${esc(o.siteName)} publication</div>
  <h1>${esc(o.siteName).toUpperCase()} ZINE</h1>
  <div class="vol">VOL. ${esc(o.vol)} · YEAR ${esc(o.year)}</div>
  <div class="rule"></div>
  <p>${posts.length} entries · compiled by hand, printed by machine · free forever</p>
</div>
<div class="toc">
  <h2>IN THIS ISSUE</h2>
  <ol>${toc}</ol>
</div>
${body}
<div class="endnote">— printed from ${esc(o.siteName)} · ${esc(o.year)} · no rights reserved —</div>
</body></html>`;
}
