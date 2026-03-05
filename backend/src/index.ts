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
app.use(express.static(staticDir));

// Dynamic sitemap (before catch-all)
app.get('/sitemap.xml', async (_req, res) => {
  try {
    const { db, waterBodies, referenceSections } = await import('./db/index.js');
    const { asc } = await import('drizzle-orm');
    const base = process.env.SITE_URL || 'https://spearfishing.by';
    const waters = await db.select({ id: waterBodies.id }).from(waterBodies).orderBy(asc(waterBodies.id));
    const refs = await db.select({ slug: referenceSections.slug }).from(referenceSections).orderBy(asc(referenceSections.orderIndex));
    const urls = [
      { loc: base, priority: '1.0', changefreq: 'weekly' },
      { loc: `${base}/map`, priority: '0.9', changefreq: 'weekly' },
      { loc: `${base}/reference`, priority: '0.8', changefreq: 'monthly' },
      ...refs.map((r: { slug: string }) => ({ loc: `${base}/reference/${r.slug}`, priority: '0.7', changefreq: 'monthly' })),
      { loc: `${base}/contacts`, priority: '0.8', changefreq: 'monthly' },
      { loc: `${base}/info`, priority: '0.7', changefreq: 'monthly' },
      { loc: `${base}/privacy`, priority: '0.5', changefreq: 'yearly' },
      { loc: `${base}/terms`, priority: '0.5', changefreq: 'yearly' },
      ...waters.map((w: { id: number }) => ({ loc: `${base}/water/${w.id}`, priority: '0.6', changefreq: 'monthly' })),
    ];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u.loc}</loc><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`).join('\n')}
</urlset>`;
    res.type('application/xml').send(xml);
  } catch {
    const base = process.env.SITE_URL || 'https://spearfishing.by';
    const fallback = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${base}</loc><changefreq>weekly</changefreq><priority>1.0</priority></url></urlset>`;
    res.type('application/xml').send(fallback);
  }
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(staticDir, 'index.html'));
});

export { app };

export const ready = (async () => {
  await Promise.resolve(initDb());
  if (!process.env.VERCEL) {
    app.listen(PORT, () => console.log('Server on http://localhost:' + PORT));
  }
})();
