import { Router } from 'express';
import { db, waterBodies, referenceSections, permitOrganizations, blogPosts } from '../db/index.js';
import { asc, eq } from 'drizzle-orm';

const router = Router();

router.get('/water-bodies', async (_req, res) => {
  const list = await db.select().from(waterBodies).orderBy(asc(waterBodies.orderIndex), asc(waterBodies.id));
  res.json(list);
});

router.get('/water-bodies/:id', async (req, res) => {
  const id = Number(req.params.id);
  const [wb] = await db.select().from(waterBodies).where(eq(waterBodies.id, id));
  if (!wb) return res.status(404).json({ error: 'Водоём не найден' });
  res.json(wb);
});

router.get('/reference', async (_req, res) => {
  const list = await db.select().from(referenceSections).orderBy(asc(referenceSections.orderIndex), asc(referenceSections.id));
  res.json(list);
});

router.get('/reference/:slug', async (req, res) => {
  const slug = req.params.slug;
  const [section] = await db.select().from(referenceSections).where(eq(referenceSections.slug, slug));
  if (!section) return res.status(404).json({ error: 'Раздел не найден' });
  res.json(section);
});

router.get('/blog', async (_req, res) => {
  const list = await db.select().from(blogPosts).orderBy(asc(blogPosts.orderIndex), asc(blogPosts.id));
  res.json(list);
});

router.get('/blog/:slug', async (req, res) => {
  const slug = req.params.slug;
  const [post] = await db.select().from(blogPosts).where(eq(blogPosts.slug, slug));
  if (!post) return res.status(404).json({ error: 'Статья не найдена' });
  res.json(post);
});

router.get('/permit-organizations', async (_req, res) => {
  const list = await db.select().from(permitOrganizations).orderBy(asc(permitOrganizations.orderIndex), asc(permitOrganizations.id));
  res.json(list);
});

export default router;
