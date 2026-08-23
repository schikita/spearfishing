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
import { SITE_URL, injectSeo, loadIndexHtml, resolveSeo } from './seo.js';

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

// Dynamic sitemap (before static files so it is not shadowed by a stale sitemap.xml)
app.get('/sitemap.xml', async (_req, res) => {
  try {
    const { db, waterBodies, referenceSections, blogPosts } = await import('./db/index.js');
    const { asc } = await import('drizzle-orm');
    const base = SITE_URL;
    const waters = await db.select({ id: waterBodies.id, createdAt: waterBodies.createdAt }).from(waterBodies).orderBy(asc(waterBodies.id));
    const refs = await db.select({ slug: referenceSections.slug, updatedAt: referenceSections.updatedAt }).from(referenceSections).orderBy(asc(referenceSections.orderIndex));
    const posts = await db.select({ slug: blogPosts.slug, updatedAt: blogPosts.updatedAt }).from(blogPosts).orderBy(asc(blogPosts.orderIndex));
    const today = new Date().toISOString().slice(0, 10);
    const urls = [
      { loc: base, priority: '1.0', changefreq: 'weekly', lastmod: today },
      { loc: `${base}/map`, priority: '0.9', changefreq: 'weekly', lastmod: today },
      { loc: `${base}/blog`, priority: '0.9', changefreq: 'weekly', lastmod: today },
      ...posts.map((p: { slug: string; updatedAt?: string | null }) => ({
        loc: `${base}/blog/${p.slug}`,
        priority: '0.8',
        changefreq: 'monthly',
        lastmod: p.updatedAt?.slice(0, 10) || today,
      })),
      { loc: `${base}/reference`, priority: '0.8', changefreq: 'monthly', lastmod: today },
      ...refs.map((r: { slug: string; updatedAt?: string | null }) => ({
        loc: `${base}/reference/${r.slug}`,
        priority: '0.7',
        changefreq: 'monthly',
        lastmod: r.updatedAt?.slice(0, 10) || today,
      })),
      { loc: `${base}/contacts`, priority: '0.8', changefreq: 'monthly', lastmod: today },
      { loc: `${base}/info`, priority: '0.7', changefreq: 'monthly', lastmod: today },
      { loc: `${base}/privacy`, priority: '0.5', changefreq: 'yearly', lastmod: today },
      { loc: `${base}/terms`, priority: '0.5', changefreq: 'yearly', lastmod: today },
      ...waters.map((w: { id: number; createdAt?: string | null }) => ({
        loc: `${base}/water/${w.id}`,
        priority: '0.6',
        changefreq: 'monthly',
        lastmod: w.createdAt?.slice(0, 10) || today,
      })),
    ];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u.loc}</loc><lastmod>${u.lastmod}</lastmod><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`).join('\n')}
</urlset>`;
    res.type('application/xml').send(xml);
  } catch {
    const fallback = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${SITE_URL}</loc><changefreq>weekly</changefreq><priority>1.0</priority></url></urlset>`;
    res.type('application/xml').send(fallback);
  }
});

app.use(express.static(staticDir));

app.get('*', async (req, res, next) => {
  if (req.path.includes('.')) return next();
  try {
    const seo = await resolveSeo(req.path);
    if (!seo) {
      res.sendFile(path.join(staticDir, 'index.html'));
      return;
    }
    const html = await loadIndexHtml(staticDir);
    res.type('html').send(injectSeo(html, seo));
  } catch {
    res.sendFile(path.join(staticDir, 'index.html'));
  }
});

export { app };

export const ready = (async () => {
  await Promise.resolve(initDb());
  if (!process.env.VERCEL) {
    app.listen(PORT, () => console.log('Server on http://localhost:' + PORT));
  }
})();
