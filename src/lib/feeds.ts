/* PSYCH0 — RSS / Atom feed parsing for the read-later clipper.
 * The /api/fetch proxy pulls the raw XML (browsers can't, CORS); this file
 * turns it into items. Runs client-side with DOMParser. */

export interface FeedItem {
  id: string;          // stable id (link or hashed title)
  title: string;
  link: string;
  date: string;        // ISO, best effort
  summary: string;     // plain text, html stripped
  source: string;      // feed label
}

function stripHtml(s: string): string {
  const el = document.createElement('div');
  el.innerHTML = s || '';
  return (el.textContent || '').replace(/\s+/g, ' ').trim();
}

function isoDate(s: string): string {
  const d = s ? new Date(s) : null;
  return d && !isNaN(d.getTime()) ? d.toISOString() : '';
}

function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; }
  return (h >>> 0).toString(36);
}

function firstLink(item: Element): string {
  const links = Array.from(item.getElementsByTagName('link'));
  for (const l of links) {
    const rel = l.getAttribute('rel');
    if (!rel || rel === 'alternate') return l.getAttribute('href') || l.textContent || '';
  }
  return links[0]?.getAttribute('href') || '';
}

export function parseFeed(xml: string, source: string): FeedItem[] {
  let doc: Document;
  try { doc = new DOMParser().parseFromString(xml, 'text/xml'); } catch { return []; }
  if (doc.getElementsByTagName('parsererror').length) return [];

  const out: FeedItem[] = [];
  const seen = new Set<string>();
  const push = (title: string, link: string, date: string, summary: string) => {
    title = stripHtml(title).slice(0, 200) || '(untitled)';
    link = link.trim();
    const id = link || hash(title + source);
    if (!title || seen.has(id)) return;
    seen.add(id);
    out.push({ id, title, link, date: isoDate(date), summary: stripHtml(summary).slice(0, 500), source });
  };

  // RSS 2.0 / RDF
  for (const item of Array.from(doc.getElementsByTagName('item'))) {
    const get = (t: string) => item.getElementsByTagName(t)[0]?.textContent || '';
    push(get('title'), get('link') || firstLink(item), get('pubDate') || get('dc:date'),
      get('description') || get('content:encoded'));
  }
  // Atom
  for (const entry of Array.from(doc.getElementsByTagName('entry'))) {
    const get = (t: string) => entry.getElementsByTagName(t)[0]?.textContent || '';
    push(get('title'), firstLink(entry), get('published') || get('updated'),
      get('summary') || get('content'));
  }
  return out.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}
