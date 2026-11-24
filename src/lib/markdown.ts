/* PSYCH0 — markdown engine (ported from the one-file version)
 * XSS-safe by construction: everything is escaped, then a tiny allowlist of
 * inline tags (kbd, b, i, mark) is restored. Directives (@embed, @youtube,
 * @img, @gallery, @html, :::callouts) become inert HTML that the <MD> React
 * component hydrates (click-to-load frames, lightboxes). */

const esc = (s: unknown) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const escAttr = esc;

export function host(u: string): string {
  try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; }
}

export function ytId(u: string): string {
  const s = String(u || '').trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  const m = s.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);
  return m ? m[1] : '';
}

function sanitizeHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<script[^>]*>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript\s*:/gi, '');
}

function inline(s: string): string {
  let out = esc(s);
  // restore allowlisted raw inline tags
  out = out.replace(/&lt;(\/?)(kbd|b|i|mark)&gt;/gi, '<$1$2>');
  // wiki-links [[slug]] — hydrated with real titles by the <MD> component
  out = out.replace(/\[\[([a-z0-9\u00c0-\u024f-]+)\]\]/gi, (_, slug) =>
    '<a class="wl" data-wl="' + escAttr(slug) + '" href="#/blog/' + escAttr(slug) + '">' + escAttr(slug) + '</a>');
  // code spans
  out = out.replace(/`([^`]+)`/g, (_, c) => '<code>' + c + '</code>');
  // images before links
  out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, src) =>
    '<img src="' + escAttr(src) + '" alt="' + escAttr(alt) + '" loading="lazy">');
  // links
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) =>
    '<a href="' + escAttr(u) + '"' + (/^https?:/.test(u) ? ' target="_blank" rel="noopener"' : '') + '>' + t + '</a>');
  // emphasis
  out = out.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  out = out.replace(/\*([^*]+)\*/g, '<i>$1</i>');
  out = out.replace(/==([^=]+)==/g, '<mark>$1</mark>');
  out = out.replace(/~~([^~]+)~~/g, '<s>$1</s>');
  return out;
}

function framebox(url: string, h: number, note: string, kind = 'site'): string {
  const inner = kind === 'yt'
    ? '<div class="fbnote">' + esc(note || host(url)) + '</div>'
    : '<div class="fbnote">' + esc(note || host(url)) + '</div>';
  return '<div class="framebox" data-url="' + escAttr(url) + '" style="min-height:' + (h | 0 || 420) + 'px">'
    + '<div class="fbbar"><span>' + esc(host(url)) + '</span>'
    + '<a href="' + escAttr(url) + '" target="_blank" rel="noopener">OPEN ↗</a></div>'
    + '<div class="fboverlay"><button class="btn" data-frameload>▶ LOAD LIVE FRAME</button>' + inner + '</div>'
    + '</div>';
}

export function mdParse(src: string): string {
  const lines = String(src ?? '').split('\n');
  const out: string[] = [];
  let i = 0;
  let para: string[] = [];

  const flushPara = () => {
    if (para.length) {
      out.push('<p>' + para.map(inline).join('<br>') + '</p>');
      para = [];
    }
  };

  while (i < lines.length) {
    const line = lines[i];

    // fenced code
    if (/^~~~/.test(line)) {
      flushPara();
      const lang = line.slice(3).trim();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^~~~/.test(lines[i])) { buf.push(lines[i]); i++; }
      i++;
      out.push('<pre' + (lang ? ' data-lang="' + escAttr(lang) + '"' : '') + '><code>' + esc(buf.join('\n')) + '</code></pre>');
      continue;
    }

    // raw html block
    if (/^@html\b/.test(line)) {
      flushPara();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^@endhtml/.test(lines[i])) { buf.push(lines[i]); i++; }
      i++;
      out.push('<div class="rawhtml">' + sanitizeHtml(buf.join('\n')) + '</div>');
      continue;
    }

    // callouts
    const cm = line.match(/^:::(tip|warn|note|danger)\s*(.*)$/i);
    if (cm) {
      flushPara();
      const kind = cm[1].toLowerCase();
      const title = cm[2].trim();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^:::/.test(lines[i])) { buf.push(lines[i]); i++; }
      i++;
      out.push('<div class="callout ' + kind + '">' + (title ? '<b class="ct">' + esc(title) + '</b>' : '')
        + buf.map(l => '<p>' + inline(l) + '</p>').join('') + '</div>');
      continue;
    }

    // @embed
    const em = line.match(/^@embed\s+(\S+)(?:\s+(\d+))?\s*$/);
    if (em) { flushPara(); out.push(framebox(em[1], parseInt(em[2] || '420', 10), '')); i++; continue; }

    // @youtube
    const ym = line.match(/^@youtube\s+(\S+)\s*$/);
    if (ym) {
      flushPara();
      const id = ytId(ym[1]);
      if (id) out.push(framebox('https://www.youtube.com/embed/' + escAttr(id), 0, 'youtube', 'yt').replace('min-height:0px', 'aspect-ratio:16/9;min-height:0'));
      else out.push('<p class="dim">bad youtube id</p>');
      i++; continue;
    }

    // @img
    const im = line.match(/^@img\s+(\S+)(?:\s+\|\s*(.*))?$/);
    if (im) {
      flushPara();
      out.push('<figure class="fig"><img src="' + escAttr(im[1]) + '" alt="" loading="lazy" data-lb>'
        + (im[2] ? '<figcaption>' + esc(im[2]) + '</figcaption>' : '') + '</figure>');
      i++; continue;
    }

    // @gallery
    const gm = line.match(/^@gallery\s+(.+)$/);
    if (gm) {
      flushPara();
      const urls = gm[1].split('|').map(s => s.trim()).filter(Boolean);
      out.push('<div class="gal">' + urls.map(u => '<img src="' + escAttr(u) + '" alt="" loading="lazy" data-lb>').join('') + '</div>');
      i++; continue;
    }

    // headings
    const hm = line.match(/^(#{2,3})\s+(.*)$/);
    if (hm) { flushPara(); out.push('<h' + (hm[1].length + 1) + '>' + inline(hm[2]) + '</h' + (hm[1].length + 1) + '>'); i++; continue; }

    // table
    if (/^\|.+\|$/.test(line) && i + 1 < lines.length && /^\|[\s:|-]+\|$/.test(lines[i + 1])) {
      flushPara();
      const cells = (r: string) => r.slice(1, -1).split('|').map(c => c.trim());
      const head = cells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /^\|.+\|$/.test(lines[i])) { rows.push(cells(lines[i])); i++; }
      out.push('<table><thead><tr>' + head.map(h => '<th>' + inline(h) + '</th>').join('') + '</tr></thead><tbody>'
        + rows.map(r => '<tr>' + head.map((_, ci) => '<td>' + inline(r[ci] ?? '') + '</td>').join('') + '</tr>').join('') + '</tbody></table>');
      continue;
    }

    // blockquote
    if (/^>\s?/.test(line)) {
      flushPara();
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, '')); i++; }
      out.push('<blockquote>' + buf.map(l => '<p>' + inline(l) + '</p>').join('') + '</blockquote>');
      continue;
    }

    // unordered list
    if (/^[-*]\s+/.test(line)) {
      flushPara();
      const buf: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) { buf.push(lines[i].replace(/^[-*]\s+/, '')); i++; }
      out.push('<ul>' + buf.map(l => '<li>' + inline(l) + '</li>').join('') + '</ul>');
      continue;
    }

    // ordered list
    if (/^\d+\.\s+/.test(line)) {
      flushPara();
      const buf: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) { buf.push(lines[i].replace(/^\d+\.\s+/, '')); i++; }
      out.push('<ol>' + buf.map(l => '<li>' + inline(l) + '</li>').join('') + '</ol>');
      continue;
    }

    // hr
    if (/^(---+|\*\*\*+)$/.test(line)) { flushPara(); out.push('<hr>'); i++; continue; }

    if (line.trim() === '') { flushPara(); i++; continue; }

    para.push(line);
    i++;
  }
  flushPara();
  return out.join('\n');
}

export function excerpt(md: string, n: number): string {
  const text = String(md ?? '')
    .replace(/^@.*$/gm, '').replace(/^:::.*$/gm, '').replace(/^~~~[\s\S]*?~~~$/gm, '')
    .replace(/[#>*`|~-]/g, ' ').replace(/!\[|\]\(/g, ' ').replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ').trim();
  return text.length > n ? text.slice(0, n - 1) + '…' : text;
}
