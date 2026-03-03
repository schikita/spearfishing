import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db, users, waterBodies, referenceSections, permitOrganizations } from '../db/index.js';
import { eq, asc } from 'drizzle-orm';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireAdmin);

router.get('/users', async (_req, res) => {
  const list = await db.select({
    id: users.id,
    email: users.email,
    role: users.role,
    allowedIp: users.allowedIp,
    hasAccess: users.hasAccess,
    createdAt: users.createdAt,
  }).from(users).orderBy(asc(users.id));
  res.json(list);
});

router.post('/users', async (req, res) => {
  const { email, password, allowedIp, hasAccess } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Укажите email и пароль' });
  }
  const hash = await bcrypt.hash(String(password), 10);
  await db.insert(users).values({
    email: String(email).trim().toLowerCase(),
    passwordHash: hash,
    role: 'user',
    allowedIp: allowedIp ? String(allowedIp).trim() || null : null,
    hasAccess: hasAccess ? 1 : 0,
  });
  res.status(201).json({ ok: true });
});

router.patch('/users/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { allowedIp, password, hasAccess } = req.body;
  const updates: { allowedIp?: string | null; passwordHash?: string; hasAccess?: number } = {};
  if (allowedIp !== undefined) updates.allowedIp = allowedIp === '' ? null : String(allowedIp).trim();
  if (password) updates.passwordHash = await bcrypt.hash(String(password), 10);
  if (hasAccess !== undefined) updates.hasAccess = hasAccess ? 1 : 0;
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'Нет данных для обновления' });
  }
  await db.update(users).set(updates).where(eq(users.id, id));
  res.json({ ok: true });
});

router.delete('/users/:id', async (req, res) => {
  const id = Number(req.params.id);
  const u = req.user!;
  if (id === u.id) return res.status(400).json({ error: 'Нельзя удалить себя' });
  await db.delete(users).where(eq(users.id, id));
  res.json({ ok: true });
});

// Water bodies CRUD
router.get('/water-bodies', async (_req, res) => {
  const list = await db.select().from(waterBodies).orderBy(asc(waterBodies.orderIndex), asc(waterBodies.id));
  res.json(list);
});

router.post('/water-bodies', async (req, res) => {
  const { name, nameRu, region, description, lat, lng, permitInfo, orderIndex } = req.body;
  if (!name || !region || lat == null || lng == null) {
    return res.status(400).json({ error: 'Обязательны: name, region, lat, lng' });
  }
  const [row] = await db.insert(waterBodies).values({
    name: String(name),
    nameRu: nameRu ? String(nameRu) : null,
    region: String(region),
    description: description ? String(description) : null,
    lat: String(lat),
    lng: String(lng),
    permitInfo: permitInfo ? String(permitInfo) : null,
    orderIndex: orderIndex != null ? Number(orderIndex) : 0,
  }).returning({ id: waterBodies.id });
  res.status(201).json(row);
});

router.patch('/water-bodies/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { name, nameRu, region, description, lat, lng, permitInfo, orderIndex } = req.body;
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = String(name);
  if (nameRu !== undefined) updates.nameRu = nameRu ? String(nameRu) : null;
  if (region !== undefined) updates.region = String(region);
  if (description !== undefined) updates.description = description ? String(description) : null;
  if (lat !== undefined) updates.lat = String(lat);
  if (lng !== undefined) updates.lng = String(lng);
  if (permitInfo !== undefined) updates.permitInfo = permitInfo ? String(permitInfo) : null;
  if (orderIndex !== undefined) updates.orderIndex = Number(orderIndex);
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'Нет данных' });
  await db.update(waterBodies).set(updates).where(eq(waterBodies.id, id));
  res.json({ ok: true });
});

router.delete('/water-bodies/:id', async (req, res) => {
  await db.delete(waterBodies).where(eq(waterBodies.id, Number(req.params.id)));
  res.json({ ok: true });
});

// Reference sections CRUD
router.get('/reference', async (_req, res) => {
  const list = await db.select().from(referenceSections).orderBy(asc(referenceSections.orderIndex), asc(referenceSections.id));
  res.json(list);
});

router.post('/reference', async (req, res) => {
  const { slug, title, titleRu, content, orderIndex } = req.body;
  if (!slug || !title || content === undefined) {
    return res.status(400).json({ error: 'Обязательны: slug, title, content' });
  }
  const [row] = await db.insert(referenceSections).values({
    slug: String(slug),
    title: String(title),
    titleRu: titleRu ? String(titleRu) : null,
    content: String(content),
    orderIndex: orderIndex != null ? Number(orderIndex) : 0,
    updatedAt: new Date().toISOString(),
  }).returning({ id: referenceSections.id });
  res.status(201).json(row);
});

router.patch('/reference/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { slug, title, titleRu, content, orderIndex } = req.body;
  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (slug !== undefined) updates.slug = String(slug);
  if (title !== undefined) updates.title = String(title);
  if (titleRu !== undefined) updates.titleRu = titleRu ? String(titleRu) : null;
  if (content !== undefined) updates.content = String(content);
  if (orderIndex !== undefined) updates.orderIndex = Number(orderIndex);
  await db.update(referenceSections).set(updates).where(eq(referenceSections.id, id));
  res.json({ ok: true });
});

router.delete('/reference/:id', async (req, res) => {
  await db.delete(referenceSections).where(eq(referenceSections.id, Number(req.params.id)));
  res.json({ ok: true });
});

// Permit organizations CRUD
router.get('/permit-organizations', async (_req, res) => {
  const list = await db.select().from(permitOrganizations).orderBy(asc(permitOrganizations.orderIndex), asc(permitOrganizations.id));
  res.json(list);
});

router.post('/permit-organizations', async (req, res) => {
  const { name, nameRu, region, description, url, phone, address, orderIndex } = req.body;
  if (!name || !region) return res.status(400).json({ error: 'Обязательны: name, region' });
  const [row] = await db.insert(permitOrganizations).values({
    name: String(name),
    nameRu: nameRu ? String(nameRu) : null,
    region: String(region),
    description: description ? String(description) : null,
    url: url ? String(url) : null,
    phone: phone ? String(phone) : null,
    address: address ? String(address) : null,
    orderIndex: orderIndex != null ? Number(orderIndex) : 0,
  }).returning({ id: permitOrganizations.id });
  res.status(201).json(row);
});

router.patch('/permit-organizations/:id', async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as Record<string, unknown>;
  const allowed = ['name', 'nameRu', 'region', 'description', 'url', 'phone', 'address', 'orderIndex'];
  const updates: Record<string, unknown> = {};
  for (const k of allowed) {
    if (body[k] !== undefined) updates[k] = body[k] === '' ? null : body[k];
  }
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'Нет данных' });
  await db.update(permitOrganizations).set(updates).where(eq(permitOrganizations.id, id));
  res.json({ ok: true });
});

router.delete('/permit-organizations/:id', async (req, res) => {
  await db.delete(permitOrganizations).where(eq(permitOrganizations.id, Number(req.params.id)));
  res.json({ ok: true });
});

export default router;
