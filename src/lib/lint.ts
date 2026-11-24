/* PSYCH0 — the post doctor. Static linting over every post: broken wiki-links,
 * missing tags/cover/alt text, stuck schedules, ghost drafts, slug collisions.
 * Image URL liveness is checked separately (async, image-object probing) by the
 * doctor page — it never blocks the static report. */

import type { Post } from './types';

export type IssueLevel = 'err' | 'warn' | 'info';
export interface LintIssue { level: IssueLevel; msg: string }
export interface LintReport { post: Post; issues: LintIssue[]; score: number }

const WIKI = /\[\[([a-z0-9\u00c0-\u024f-]+)\]\]/gi;
const MD_IMG = /!\[([^\]]*)\]\(([^)\s]+)\)/g;
const AT_IMG = /^@img\s+(\S+)/gm;

/** every image url a post references (body directives + markdown + cover) */
export function collectImageUrls(p: Post): string[] {
  const urls: string[] = [];
  if (p.cover) urls.push(p.cover);
  let m: RegExpExecArray | null;
  MD_IMG.lastIndex = 0;
  while ((m = MD_IMG.exec(p.body || ''))) urls.push(m[2]);
  AT_IMG.lastIndex = 0;
  while ((m = AT_IMG.exec(p.body || ''))) urls.push(m[1]);
  return [...new Set(urls)].filter(u => /^https?:\/\//i.test(u));
}

export function lintPost(p: Post, all: Post[]): LintIssue[] {
  const issues: LintIssue[] = [];
  const body = p.body || '';

  // broken wiki-links — [[slug]] pointing at a post that doesn't exist
  const targets = [...new Set((body.match(WIKI) || []).map(w => w.slice(2, -2).toLowerCase()))];
  for (const t of targets) {
    if (!all.some(x => x.slug.toLowerCase() === t)) {
      issues.push({ level: 'err', msg: 'broken link: [[ ' + t + ' ]] — no post with that slug' });
    }
  }

  // slug collisions
  if (all.filter(x => x.slug === p.slug).length > 1) {
    issues.push({ level: 'err', msg: 'duplicate slug "' + p.slug + '" — one of these will 404' });
  }

  // stuck schedule: publish_at passed but never published
  if (p.publish_at && p.publish_at < new Date().toISOString() && !p.published) {
    issues.push({ level: 'err', msg: 'scheduled ' + p.publish_at.slice(0, 10) + ' but still a draft — flip ● published or clear PUBLISH AT' });
  }

  // ghost draft: unpublished and older than a month
  if (!p.published) {
    const age = (Date.now() - new Date(p.date + 'T12:00:00Z').getTime()) / 86400000;
    if (age > 30 && !p.publish_at) issues.push({ level: 'info', msg: 'draft has been sitting since ' + p.date });
  }

  // missing metadata
  if (!(p.tags || []).length) issues.push({ level: 'warn', msg: 'no tags — invisible in the blog filters' });
  if (!p.cover) issues.push({ level: 'info', msg: 'no cover image' });

  // alt text on markdown images
  MD_IMG.lastIndex = 0;
  let mi: RegExpExecArray | null;
  while ((mi = MD_IMG.exec(body))) {
    if (!mi[1].trim()) issues.push({ level: 'warn', msg: 'image missing alt text: ' + mi[2].slice(0, 60) });
  }

  // very short body
  if (p.published && body.trim().length < 120) {
    issues.push({ level: 'warn', msg: 'published but very short (' + body.trim().length + ' chars)' });
  }

  return issues;
}

const PENALTY: Record<IssueLevel, number> = { err: 15, warn: 7, info: 2 };

export function lintAll(posts: Post[]): LintReport[] {
  return posts.map(p => {
    const issues = lintPost(p, posts);
    const score = Math.max(0, 100 - issues.reduce((n, i) => n + PENALTY[i.level], 0));
    return { post: p, issues, score };
  }).sort((a, b) => a.score - b.score);
}

export function healthScore(reports: LintReport[]): number {
  if (!reports.length) return 100;
  return Math.round(reports.reduce((n, r) => n + r.score, 0) / reports.length);
}
