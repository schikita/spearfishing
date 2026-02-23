import { Router } from 'express';
import { db, waterBodies, referenceSections, permitOrganizations } from '../db/index.js';
import { asc, eq } from 'drizzle-orm';

const router = Router();

router.get('/water-bodies', async (_req, res) => {
  const list = await db.select().from(waterBodies).orderBy(asc(waterBodies.orderIndex), asc(waterBodies.id));
  res.json(list);
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

router.get('/permit-organizations', async (_req, res) => {
  const list = await db.select().from(permitOrganizations).orderBy(asc(permitOrganizations.orderIndex), asc(permitOrganizations.id));
  res.json(list);
});

export default router;
