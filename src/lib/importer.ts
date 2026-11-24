/* PSYCH0 — import engine. Turns raw markdown (with optional front-matter),
 * pasted/saved HTML pages and WordPress WXR exports into clean posts.
 * Everything runs client-side; nothing leaves the browser until you save. */

import { uid, slugify } from './types';

export interface ImportedDraft {
  id: string;
  title: string;
  date: string;          // yyyy-mm-dd
  tags: string[];
  body: string;
  published: boolean;
  cover: string;
  source: string;        // file name / origin, shown in the review list
  words: number;
}

const nowDate = () => new Date().toISOString().slice(0, 10);

function finish(title: string, body: string, date: string, tags: string[], published: boolean, cover: string, source: string): ImportedDraft {
  const clean = body.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+\n/g, '\n').trim();
  return {
    id: 'imp_' + uid(), title: (title || 'IMPORTED POST').slice(0, 140), date: date || nowDate(),
    tags, body: clean || '(empty import)', published, cover: cover || '',
    source, words: clean ? clean.split(/\s+/).length : 0,
  };
}

/* ---------- markdown (+ front-matter) ---------- */

export function parseMarkdownDoc(raw: string, source = 'pasted markdown'): ImportedDraft | null {
  let s = String(raw || '').replace(/\r\n/g, '\n').trim();
  if (!s) return null;
  const meta: Record<string, string> = {};
  const fm = s.match(/^---\n([\s\S]*?)\n---\s*\n?/);
  if (fm) {
    for (const line of fm[1].split('\n')) {
      const m = line.match(/^([A-Za-z_-]+)\s*:\s*(.*)$/);
      if (m) meta[m[1].toLowerCase()] = m[2].trim().replace(/^["']|["']$/g, '');
    }
    s = s.slice(fm[0].length);
  }
  const h1 = s.match(/^#\s+(.+)\n?/);
  const title = meta.title || (h1 ? h1[1].trim() : '');
  if (!meta.title && h1) s = s.replace(h1[0], '');
  const tags = (meta.tags || meta.categories || '')
    .split(/[,;]/).map(t => t.trim().toLowerCase().replace(/^#/, '')).filter(Boolean).slice(0, 8);
  const date = /^\d{4}-\d{2}-\d{2}/.test(meta.date || '') ? meta.date.slice(0, 10) : nowDate();
  const cover = meta.cover || meta.image || '';
  const published = /^(true|yes|publish|published|1)$/i.test(meta.published || meta.status || '');
  return finish(title, s, date, tags, published, cover, source);
}

/* ---------- HTML → markdown ---------- */

const DROP = new Set(['script', 'style', 'noscript', 'nav', 'footer', 'aside', 'form', 'iframe', 'svg', 'button', 'select', 'input', 'head', 'meta', 'link']);

function nodeToMd(n: Node): string {
  if (n.nodeType === Node.TEXT_NODE) return (n.textContent || '').replace(/\s+/g, ' ');
  if (n.nodeType !== Node.ELEMENT_NODE) return '';
  const el = n as Element;
  const tag = el.tagName.toLowerCase();
  if (DROP.has(tag)) return '';
  const kids = Array.from(el.childNodes).map(nodeToMd).join('');
  switch (tag) {
    case 'h1': return '\n\n# ' + kids.trim() + '\n\n';
    case 'h2': return '\n\n## ' + kids.trim() + '\n\n';
    case 'h3': return '\n\n### ' + kids.trim() + '\n\n';
    case 'h4': case 'h5': case 'h6': return '\n\n#### ' + kids.trim() + '\n\n';
    case 'p': return '\n\n' + kids.trim() + '\n\n';
    case 'br': return '\n';
    case 'hr': return '\n\n---\n\n';
    case 'strong': case 'b': return kids.trim() ? '**' + kids.trim() + '**' : '';
    case 'em': case 'i': return kids.trim() ? '*' + kids.trim() + '*' : '';
    case 'code': return el.closest('pre') ? kids : '`' + kids.trim() + '`';
    case 'pre': return '\n\n~~~\n' + (el.textContent || '') + '\n~~~\n\n';
    case 'blockquote': return '\n\n> ' + kids.trim().replace(/\n{2,}/g, '\n\n> ') + '\n\n';
    case 'li': return kids; // handled by the list parents
    case 'ul': return '\n\n' + Array.from(el.children).filter(li => li.tagName.toLowerCase() === 'li')
      .map(li => '- ' + nodeToMd(li).trim().replace(/\s*\n\s*/g, ' ')).join('\n') + '\n\n';
    case 'ol': return '\n\n' + Array.from(el.children).filter(li => li.tagName.toLowerCase() === 'li')
      .map((li, i) => (i + 1) + '. ' + nodeToMd(li).trim().replace(/\s*\n\s*/g, ' ')).join('\n') + '\n\n';
    case 'img': {
      const src = el.getAttribute('src') || '';
      if (!src || src.startsWith('data:')) return '';
      return '![' + (el.getAttribute('alt') || '') + '](' + src + ')';
    }
    case 'a': {
      const href = el.getAttribute('href') || '';
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) return kids;
      return '[' + kids.trim() + '](' + href + ')';
    }
    case 'figure': case 'figcaption': case 'table': case 'tr': case 'td': case 'th':
      return tag === 'tr' ? '\n\n' + kids.trim() + '\n\n' : kids;
    case 'div': case 'section': case 'article': case 'main': case 'span': case 'body':
      return kids;
    default: return kids;
  }
}

export function parseHtmlDoc(raw: string, source = 'pasted html'): ImportedDraft | null {
  const text = String(raw || '').trim();
  if (!text) return null;
  let doc: Document;
  try { doc = new DOMParser().parseFromString(text, 'text/html'); } catch { return null; }
  doc.querySelectorAll('script,style,noscript,nav,footer,aside,form,iframe,svg').forEach(e => e.remove());
  const title = (doc.querySelector('h1')?.textContent || doc.title || 'IMPORTED PAGE').trim().replace(/\s+/g, ' ');
  const metaTime = doc.querySelector('meta[property="article:published_time"], meta[name="date"], time[datetime]')?.getAttribute('content')
    || doc.querySelector('time[datetime]')?.getAttribute('datetime') || '';
  const date = /^\d{4}-\d{2}-\d{2}/.test(metaTime) ? metaTime.slice(0, 10) : nowDate();
  const ogImg = doc.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';
  const md = Array.from(doc.body ? doc.body.childNodes : []).map(nodeToMd).join('');
  return finish(title, md, date, ['import'], false, ogImg, source);
}

/* ---------- WordPress WXR export ---------- */

export function parseWxr(raw: string, source = 'wordpress export'): ImportedDraft[] {
  let doc: Document;
  try { doc = new DOMParser().parseFromString(String(raw || ''), 'text/xml'); } catch { return []; }
  if (doc.getElementsByTagName('parsererror').length) return [];
  const out: ImportedDraft[] = [];
  for (const item of Array.from(doc.getElementsByTagName('item'))) {
    const get = (t: string) => {
      const el = item.getElementsByTagName(t)[0];
      return el ? (el.textContent || '').trim() : '';
    };
    const postType = get('wp:post_type') || get('post_type') || 'post';
    if (postType && postType !== 'post') continue;               // skip pages, attachments, revisions
    const status = get('wp:status') || get('status') || 'publish';
    const title = get('title');
    const content = get('content:encoded') || get('content') || get('description');
    if (!content) continue;
    const tags: string[] = [];
    for (const cat of Array.from(item.getElementsByTagName('category'))) {
      const dom = cat.getAttribute('domain') || 'category';
      if (dom === 'post_tag' || dom === 'category') {
        const t = (cat.textContent || '').trim().toLowerCase();
        if (t && !tags.includes(t) && t !== 'uncategorized') tags.push(t);
      }
    }
    const pub = get('pubDate');
    const d = pub ? new Date(pub) : null;
    const date = d && !isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : nowDate();
    const body = /<\/[a-z]/i.test(content) ? (parseHtmlBody(content)) : content;
    out.push(finish(title, body, date, tags.slice(0, 8), status === 'publish', '', source));
  }
  return out;
}

/** html fragment → markdown (no title extraction; used for wp content) */
function parseHtmlBody(html: string): string {
  let doc: Document;
  try { doc = new DOMParser().parseFromString('<div>' + html + '</div>', 'text/html'); } catch { return html; }
  return Array.from(doc.body.firstChild ? doc.body.childNodes : []).map(nodeToMd).join('');
}

/* ---------- auto-detect ---------- */

export function autoImport(raw: string, name = 'pasted'): ImportedDraft[] {
  const s = String(raw || '').trim();
  if (!s) return [];
  const lower = name.toLowerCase();
  if (lower.endsWith('.xml') || s.startsWith('<?xml') || /<rss[\s>]|<channel[\s>]|xmlns:wp/.test(s.slice(0, 2000))) {
    const wxr = parseWxr(s, name);
    if (wxr.length) return wxr;
  }
  if (lower.endsWith('.html') || lower.endsWith('.htm') || /^<!doctype html|<html[\s>]/i.test(s.slice(0, 200))) {
    const h = parseHtmlDoc(s, name);
    return h ? [h] : [];
  }
  const md = parseMarkdownDoc(s, name);
  return md ? [md] : [];
}

export { slugify };
