import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb } from './db/index.js';
import authRoutes from './routes/auth.js';
import publicRoutes from './routes/public.js';
import adminRoutes from './routes/admin.js';
import subscriptionRoutes from './routes/subscription.js';
import settingsRoutes from './routes/settings.js';
import { SITE_URL, injectSeo, isValidAppRoute, loadIndexHtml, resolveSeo } from './seo.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api', publicRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/settings', settingsRoutes);

const uploadsDir = path.join(__dirname, '../uploads');
app.use('/uploads', express.static(uploadsDir));

const staticDir = path.join(__dirname, '../public');

function siteBaseFromRequest(req: { headers: Record<string, unknown>; protocol?: string }): string {
  const forwardedHost = req.headers['x-forwarded-host'];
  const hostHeader = req.headers.host;
  const host = String(forwardedHost || hostHeader || '')
    .split(',')[0]
    .trim()
    .replace(/:\d+$/, '');
  if (host && !/^localhost|127\.0\.0\.1/i.test(host)) {
    const protoHeader = req.headers['x-forwarded-proto'];
    const proto = String(protoHeader || 'https').split(',')[0].trim() || 'https';
    return `${proto}://${host}`.replace(/\/$/, '');
  }
  return SITE_URL;
}

/** W3C date for sitemap: YYYY-MM-DD only. Invalid DB values → today. */
function toSitemapDate(value?: string | null): string {
  const today = new Date().toISOString().slice(0, 10);
  if (!value) return today;
  const raw = String(value).trim();
  const isoDay = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoDay) {
    const d = new Date(`${isoDay[1]}T00:00:00Z`);
    if (!Number.isNaN(d.getTime()) && d.getUTCFullYear() >= 2000 && d.getUTCFullYear() <= 2100) {
      return isoDay[1];
    }
  }
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getUTCFullYear();
    if (y >= 2000 && y <= 2100) return parsed.toISOString().slice(0, 10);
  }
  return today;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Dynamic sitemap (before static files so it is not shadowed by a stale sitemap.xml)
app.get('/sitemap.xml', async (req, res) => {
  try {
    const { db, waterBodies, referenceSections, blogPosts } = await import('./db/index.js');
    const { asc } = await import('drizzle-orm');
    const base = siteBaseFromRequest(req);
    const waters = await db.select({ id: waterBodies.id, createdAt: waterBodies.createdAt }).from(waterBodies).orderBy(asc(waterBodies.id));
    const refs = await db.select({ slug: referenceSections.slug, updatedAt: referenceSections.updatedAt }).from(referenceSections).orderBy(asc(referenceSections.orderIndex));
    let posts: { slug: string; updatedAt?: string | null }[] = [];
    try {
      posts = await db.select({ slug: blogPosts.slug, updatedAt: blogPosts.updatedAt }).from(blogPosts).orderBy(asc(blogPosts.orderIndex));
    } catch {
      posts = [];
    }
    const urls = [
      { loc: base, priority: '1.0', changefreq: 'weekly', lastmod: toSitemapDate(null) },
      { loc: `${base}/map`, priority: '0.9', changefreq: 'weekly', lastmod: toSitemapDate(null) },
      { loc: `${base}/blog`, priority: '0.9', changefreq: 'weekly', lastmod: toSitemapDate(null) },
      ...posts.map((p) => ({
        loc: `${base}/blog/${encodeURI(p.slug)}`,
        priority: '0.8',
        changefreq: 'monthly',
        lastmod: toSitemapDate(p.updatedAt),
      })),
      { loc: `${base}/reference`, priority: '0.8', changefreq: 'monthly', lastmod: toSitemapDate(null) },
      ...refs.map((r: { slug: string; updatedAt?: string | null }) => ({
        loc: `${base}/reference/${encodeURI(r.slug)}`,
        priority: '0.7',
        changefreq: 'monthly',
        lastmod: toSitemapDate(r.updatedAt),
      })),
      { loc: `${base}/contacts`, priority: '0.8', changefreq: 'monthly', lastmod: toSitemapDate(null) },
      { loc: `${base}/info`, priority: '0.7', changefreq: 'monthly', lastmod: toSitemapDate(null) },
      { loc: `${base}/privacy`, priority: '0.5', changefreq: 'yearly', lastmod: toSitemapDate(null) },
      { loc: `${base}/terms`, priority: '0.5', changefreq: 'yearly', lastmod: toSitemapDate(null) },
      ...waters.map((w: { id: number; createdAt?: string | null }) => ({
        loc: `${base}/water/${w.id}`,
        priority: '0.6',
        changefreq: 'monthly',
        lastmod: toSitemapDate(w.createdAt),
      })),
    ];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) =>
      `  <url><loc>${escapeXml(u.loc)}</loc><lastmod>${u.lastmod}</lastmod><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`
  )
  .join('\n')}
</urlset>`;
    res.type('application/xml').send(xml);
  } catch (err) {
    console.error('sitemap.xml error:', err);
    const base = siteBaseFromRequest(req);
    const fallback = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${escapeXml(base)}</loc><lastmod>${toSitemapDate(null)}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url></urlset>`;
    res.type('application/xml').send(fallback);
  }
});

app.use(express.static(staticDir));

function sendNotFound(res: express.Response): void {
  res
    .status(404)
    .type('html')
    .send(
      '<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><title>404 — страница не найдена</title></head><body><h1>404</h1><p>Страница не найдена.</p><p><a href="/">На главную</a></p></body></html>'
    );
}

app.get('*', async (req, res, next) => {
  if (req.path.includes('.')) return next();
  if (!isValidAppRoute(req.path)) {
    sendNotFound(res);
    return;
  }
  try {
    const seo = await resolveSeo(req.path);
    if (!seo) {
      sendNotFound(res);
      return;
    }
    const html = await loadIndexHtml(staticDir);
    res.type('html').send(injectSeo(html, seo));
  } catch {
    sendNotFound(res);
  }
});

export { app };

export const ready = (async () => {
  await Promise.resolve(initDb());
  if (!process.env.VERCEL) {
    app.listen(PORT, () => console.log('Server on http://localhost:' + PORT));
  }
})();
