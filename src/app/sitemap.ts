import type { MetadataRoute } from 'next';
import { listPosts } from '@/lib/repo';

export const dynamic = 'force-dynamic';

const BASE = process.env.NEXT_PUBLIC_SITE_URL || 'https://psych0.vercel.app';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let posts: { slug: string; date: string }[] = [];
  try { posts = (await listPosts()).map(p => ({ slug: p.slug, date: p.date })); } catch { posts = []; }
  const statics: MetadataRoute.Sitemap = [
    { url: BASE, changeFrequency: 'daily', priority: 1 },
    { url: BASE + '/#/blog', changeFrequency: 'daily', priority: 0.8 },
    { url: BASE + '/#/projects', changeFrequency: 'weekly', priority: 0.8 },
    { url: BASE + '/#/lab', changeFrequency: 'monthly', priority: 0.5 },
    { url: BASE + '/#/about', changeFrequency: 'monthly', priority: 0.6 },
    { url: BASE + '/#/graph', changeFrequency: 'daily', priority: 0.4 },
  ];
  return [
    ...statics,
    ...posts.map(p => ({
      url: `${BASE}/#/blog/${p.slug}`,
      lastModified: p.date ? new Date(p.date) : new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
  ];
}
