import { Router } from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { db, users, waterBodies, referenceSections, permitOrganizations, pageSettings, blogPosts, winteringPits, visibilityReports, correctionSuggestions } from '../db/index.js';
import { eq, asc, desc } from 'drizzle-orm';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { getAuthBgUrl, getLogoUrl, getFaviconUrl, getPageBgUrl } from './settings.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, '../../uploads');
const AUTH_BG_FILENAME = 'auth-bg.jpg';

const router = Router();
router.use(requireAuth, requireAdmin);

function deleteByPrefix(prefix: string) {
  if (!fs.existsSync(UPLOADS_DIR)) return;
  const files = fs.readdirSync(UPLOADS_DIR);
  for (const f of files) {
    if (f.startsWith(prefix + '.')) {
      fs.unlinkSync(path.join(UPLOADS_DIR, f));
    }
  }
}

const imageFilter = (_req: unknown, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const ok = /^image\/(jpeg|jpg|png|webp|svg\+xml|x-icon)$/i.test(file.mimetype);
  cb(null, !!ok);
};

const authBgStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    cb(null, UPLOADS_DIR);
  },
  filename: () => AUTH_BG_FILENAME,
});

const logoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    cb(null, 'logo' + ext);
  },
});

const faviconStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.ico';
    cb(null, 'favicon' + ext);
  },
});

const uploadAuthBg = multer({ storage: authBgStorage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: imageFilter });
const uploadLogo = multer({ storage: logoStorage, limits: { fileSize: 2 * 1024 * 1024 }, fileFilter: imageFilter });
const uploadFavicon = multer({ storage: faviconStorage, limits: { fileSize: 512 * 1024 }, fileFilter: imageFilter });

router.get('/users', async (_req, res) => {
  const list = await db.select({
    id: users.id,
    email: users.email,
    role: users.role,
    hasAccess: users.hasAccess,
    createdAt: users.createdAt,
  }).from(users).orderBy(asc(users.id));
  res.json(list);
});

router.post('/users', async (req, res) => {
  const { email, password, hasAccess } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Укажите email и пароль' });
  }
  const hash = await bcrypt.hash(String(password), 10);
  await db.insert(users).values({
    email: String(email).trim().toLowerCase(),
    passwordHash: hash,
    role: 'user',
    hasAccess: hasAccess ? 1 : 0,
  });
  res.status(201).json({ ok: true });
});

router.patch('/users/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { password, hasAccess } = req.body;
  const updates: { passwordHash?: string; hasAccess?: number } = {};
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

const BODY_TYPES = new Set(['lake', 'reservoir', 'river', 'quarry', 'pond', 'unknown']);
const ROAD_CLASSES = new Set(['paved', 'gravel', 'track', 'field', 'unknown']);

function waterExtras(body: Record<string, unknown>, updates: Record<string, unknown>) {
  if (body.bodyType !== undefined && BODY_TYPES.has(String(body.bodyType))) updates.bodyType = String(body.bodyType);
  if (body.district !== undefined) updates.district = body.district ? String(body.district) : null;
  if (body.locationDescription !== undefined) updates.locationDescription = body.locationDescription ? String(body.locationDescription) : null;
  if (body.roadClass !== undefined && ROAD_CLASSES.has(String(body.roadClass))) updates.roadClass = String(body.roadClass);
  if (body.roadNote !== undefined) updates.roadNote = body.roadNote ? String(body.roadNote) : null;
  if (body.baselineVisibilityM !== undefined) updates.baselineVisibilityM = body.baselineVisibilityM ? String(body.baselineVisibilityM) : null;
  if (body.countryCode !== undefined) updates.countryCode = body.countryCode ? String(body.countryCode).slice(0, 2).toUpperCase() : 'BY';
  if (body.geometry !== undefined) updates.geometry = body.geometry ? JSON.stringify(typeof body.geometry === 'string' ? JSON.parse(String(body.geometry)) : body.geometry) : null;
}

router.post('/water-bodies', async (req, res) => {
  const { name, nameRu, region, description, lat, lng, permitInfo, orderIndex } = req.body;
  if (!name || !region || lat == null || lng == null) {
    return res.status(400).json({ error: 'Обязательны: name, region, lat, lng' });
  }
  const values: Record<string, unknown> = {
    name: String(name),
    nameRu: nameRu ? String(nameRu) : null,
    region: String(region),
    description: description ? String(description) : null,
    lat: String(lat),
    lng: String(lng),
    permitInfo: permitInfo ? String(permitInfo) : null,
    orderIndex: orderIndex != null ? Number(orderIndex) : 0,
  };
  try {
    waterExtras(req.body, values);
  } catch {
    return res.status(400).json({ error: 'Геометрия должна быть JSON' });
  }
  const [row] = await db.insert(waterBodies).values(values as never).returning({ id: waterBodies.id });
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
  try {
    waterExtras(req.body, updates);
  } catch {
    return res.status(400).json({ error: 'Геометрия должна быть JSON' });
  }
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

// Blog posts CRUD
router.get('/blog', async (_req, res) => {
  const list = await db.select().from(blogPosts).orderBy(asc(blogPosts.orderIndex), asc(blogPosts.id));
  res.json(list);
});

router.post('/blog', async (req, res) => {
  const { slug, title, titleRu, excerpt, content, orderIndex } = req.body;
  if (!slug || !title || content === undefined) {
    return res.status(400).json({ error: 'Обязательны: slug, title, content' });
  }
  const [row] = await db.insert(blogPosts).values({
    slug: String(slug),
    title: String(title),
    titleRu: titleRu ? String(titleRu) : null,
    excerpt: excerpt ? String(excerpt) : null,
    content: String(content),
    orderIndex: orderIndex != null ? Number(orderIndex) : 0,
    updatedAt: new Date().toISOString(),
  }).returning({ id: blogPosts.id });
  res.status(201).json(row);
});

router.patch('/blog/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { slug, title, titleRu, excerpt, content, orderIndex } = req.body;
  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (slug !== undefined) updates.slug = String(slug);
  if (title !== undefined) updates.title = String(title);
  if (titleRu !== undefined) updates.titleRu = titleRu ? String(titleRu) : null;
  if (excerpt !== undefined) updates.excerpt = excerpt ? String(excerpt) : null;
  if (content !== undefined) updates.content = String(content);
  if (orderIndex !== undefined) updates.orderIndex = Number(orderIndex);
  await db.update(blogPosts).set(updates).where(eq(blogPosts.id, id));
  res.json({ ok: true });
});

router.delete('/blog/:id', async (req, res) => {
  await db.delete(blogPosts).where(eq(blogPosts.id, Number(req.params.id)));
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

// Настройки: фон авторизации/регистрации
router.get('/settings/auth-bg', (_req, res) => {
  const url = getAuthBgUrl();
  res.json({ url });
});

router.post('/settings/auth-bg', uploadAuthBg.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });
  res.json({ url: `/uploads/${AUTH_BG_FILENAME}` });
});

router.delete('/settings/auth-bg', (_req, res) => {
  const filePath = path.join(UPLOADS_DIR, AUTH_BG_FILENAME);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  res.json({ ok: true });
});

// Логотип
router.get('/settings/logo', (_req, res) => {
  res.json({ url: getLogoUrl() });
});

router.post('/settings/logo', uploadLogo.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });
  const keep = req.file.filename;
  const files = fs.existsSync(UPLOADS_DIR) ? fs.readdirSync(UPLOADS_DIR) : [];
  for (const f of files) {
    if (f.startsWith('logo.') && f !== keep) fs.unlinkSync(path.join(UPLOADS_DIR, f));
  }
  res.json({ url: `/uploads/${keep}` });
});

router.delete('/settings/logo', (_req, res) => {
  deleteByPrefix('logo');
  res.json({ ok: true });
});

// Фавиконка
router.get('/settings/favicon', (_req, res) => {
  res.json({ url: getFaviconUrl() });
});

router.post('/settings/favicon', uploadFavicon.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });
  const keep = req.file.filename;
  const files = fs.existsSync(UPLOADS_DIR) ? fs.readdirSync(UPLOADS_DIR) : [];
  for (const f of files) {
    if (f.startsWith('favicon.') && f !== keep) fs.unlinkSync(path.join(UPLOADS_DIR, f));
  }
  res.json({ url: `/uploads/${keep}` });
});

router.delete('/settings/favicon', (_req, res) => {
  deleteByPrefix('favicon');
  res.json({ ok: true });
});

// Фоны страниц
const PAGE_KEYS = ['home', 'map', 'reference', 'contacts', 'info', 'blog'];

function createPageBgStorage(prefix: string) {
  return multer.diskStorage({
    destination: (_req, _file, cb) => {
      if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
      cb(null, UPLOADS_DIR);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || '.jpg';
      cb(null, prefix + '-bg' + ext);
    },
  });
}

for (const key of PAGE_KEYS) {
  const storage = createPageBgStorage(key);
  const uploadMw = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: imageFilter });
  router.get(`/settings/page-bg/${key}`, (_req, res) => {
    res.json({ url: getPageBgUrl(key) });
  });
  router.post(`/settings/page-bg/${key}`, uploadMw.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });
    const keep = req.file.filename;
    const files = fs.existsSync(UPLOADS_DIR) ? fs.readdirSync(UPLOADS_DIR) : [];
    for (const f of files) {
      if (f.startsWith(`${key}-bg.`) && f !== keep) fs.unlinkSync(path.join(UPLOADS_DIR, f));
    }
    res.json({ url: `/uploads/${keep}` });
  });
  router.delete(`/settings/page-bg/${key}`, (_req, res) => {
    const files = fs.existsSync(UPLOADS_DIR) ? fs.readdirSync(UPLOADS_DIR) : [];
    for (const f of files) {
      if (f.startsWith(`${key}-bg.`)) fs.unlinkSync(path.join(UPLOADS_DIR, f));
    }
    res.json({ ok: true });
  });
}

// Информация страниц (справочник, разрешения, информация)
router.get('/settings/page-info', async (_req, res) => {
  const rows = await db.select().from(pageSettings);
  const info: Record<string, { title: string; intro: string; phone?: string; email?: string }> = {};
  for (const r of rows) {
    const entry: { title: string; intro: string; phone?: string; email?: string } = { title: r.title, intro: r.intro };
    if (r.phone) entry.phone = r.phone;
    if (r.email) entry.email = r.email;
    info[r.pageKey] = entry;
  }
  res.json(info);
});

router.patch('/settings/page-info/:pageKey', async (req, res) => {
  const pageKey = req.params.pageKey;
  if (!['reference', 'contacts', 'info', 'blog'].includes(pageKey)) {
    return res.status(400).json({ error: 'Недопустимая страница' });
  }
  const { title, intro, phone, email } = req.body;
  const [existing] = await db.select().from(pageSettings).where(eq(pageSettings.pageKey, pageKey));
  const updates: { title: string; intro: string; updatedAt: string; phone?: string | null; email?: string | null } = {
    title: title !== undefined ? String(title) : (existing?.title ?? ''),
    intro: intro !== undefined ? String(intro) : (existing?.intro ?? ''),
    updatedAt: new Date().toISOString(),
  };
  if (pageKey === 'info') {
    updates.phone = phone !== undefined ? (phone === '' ? null : String(phone)) : (existing as { phone?: string | null })?.phone ?? null;
    updates.email = email !== undefined ? (email === '' ? null : String(email)) : (existing as { email?: string | null })?.email ?? null;
  }
  if (existing) {
    await db.update(pageSettings).set(updates).where(eq(pageSettings.pageKey, pageKey));
  } else {
    await db.insert(pageSettings).values({ pageKey, ...updates });
  }
  res.json({ ok: true });
});

const PIT_ACCURACY = new Set(['exact', 'approximate', 'radius', 'unknown']);
const PIT_STATUS = new Set(['active', 'inactive', 'needs_review']);

function pitValues(body: Record<string, unknown>): Record<string, unknown> {
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  const hasPoint = String(body.lat ?? '').trim() !== '' && String(body.lng ?? '').trim() !== '' && Number.isFinite(lat) && Number.isFinite(lng);
  const geometry = body.geometry
    ? JSON.stringify(typeof body.geometry === 'string' ? JSON.parse(String(body.geometry)) : body.geometry)
    : hasPoint
      ? JSON.stringify({ type: 'Point', coordinates: [lng, lat] })
      : null;
  return {
    waterBodyId: body.waterBodyId != null && body.waterBodyId !== '' ? Number(body.waterBodyId) : null,
    name: String(body.name || '').trim(),
    region: body.region ? String(body.region) : null,
    waterBodyNameRaw: body.waterBodyNameRaw ? String(body.waterBodyNameRaw) : null,
    geometry,
    radiusM: body.radiusM != null && body.radiusM !== '' ? String(body.radiusM) : null,
    boundaryAccuracy: PIT_ACCURACY.has(String(body.boundaryAccuracy)) ? String(body.boundaryAccuracy) : 'unknown',
    banFrom: body.banFrom ? String(body.banFrom) : null,
    banTo: body.banTo ? String(body.banTo) : null,
    isYearRound: body.isYearRound === false || body.isYearRound === 0 ? 0 : 1,
    sourceTitle: body.sourceTitle ? String(body.sourceTitle) : null,
    sourceUrl: body.sourceUrl ? String(body.sourceUrl) : null,
    sourceDate: body.sourceDate ? String(body.sourceDate) : null,
    status: PIT_STATUS.has(String(body.status)) ? String(body.status) : 'needs_review',
    notes: body.notes ? String(body.notes) : null,
  };
}

router.get('/wintering-pits', async (_req, res) => {
  const list = await db.select().from(winteringPits).orderBy(desc(winteringPits.id));
  res.json(list);
});

router.post('/wintering-pits/import', async (req, res) => {
  const features = req.body?.geojson?.features ?? req.body?.features;
  if (!Array.isArray(features)) return res.status(400).json({ error: 'Ожидается GeoJSON с полем features' });
  let created = 0;
  for (const feature of features) {
    const props = feature?.properties ?? {};
    const name = String(props.name || props.title || '').trim();
    if (!name) continue;
    const geometry = feature.geometry ? JSON.stringify(feature.geometry) : null;
    await db.insert(winteringPits).values({
      waterBodyId: props.waterBodyId != null ? Number(props.waterBodyId) : null,
      name,
      region: props.region ? String(props.region) : null,
      waterBodyNameRaw: props.waterBodyName || props.waterBodyNameRaw ? String(props.waterBodyName || props.waterBodyNameRaw) : null,
      geometry,
      radiusM: props.radiusM != null ? String(props.radiusM) : null,
      boundaryAccuracy: PIT_ACCURACY.has(String(props.boundaryAccuracy)) ? String(props.boundaryAccuracy) : geometry ? 'approximate' : 'unknown',
      banFrom: props.banFrom ? String(props.banFrom) : null,
      banTo: props.banTo ? String(props.banTo) : null,
      isYearRound: props.isYearRound === false || props.isYearRound === 0 ? 0 : 1,
      sourceTitle: props.sourceTitle ? String(props.sourceTitle) : null,
      sourceUrl: props.sourceUrl ? String(props.sourceUrl) : null,
      sourceDate: props.sourceDate ? String(props.sourceDate) : null,
      status: PIT_STATUS.has(String(props.status)) ? String(props.status) : 'needs_review',
      notes: props.notes
        ? String(props.notes)
        : String(props.boundaryAccuracy) === 'exact'
          ? null
          : 'Границы уточняются.',
      createdAt: new Date().toISOString(),
    });
    created += 1;
  }
  res.status(201).json({ created });
});

router.post('/wintering-pits', async (req, res) => {
  let values: Record<string, unknown>;
  try {
    values = pitValues(req.body ?? {});
  } catch {
    return res.status(400).json({ error: 'Геометрия должна быть JSON' });
  }
  if (!values.name) return res.status(400).json({ error: 'Нужно название ямы' });
  const [row] = await db.insert(winteringPits).values({ ...values, createdAt: new Date().toISOString() } as never).returning({ id: winteringPits.id });
  res.status(201).json(row);
});

router.patch('/wintering-pits/:id', async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = String(body.name).trim();
  if (body.region !== undefined) updates.region = body.region ? String(body.region) : null;
  if (body.waterBodyId !== undefined) updates.waterBodyId = body.waterBodyId === '' || body.waterBodyId == null ? null : Number(body.waterBodyId);
  if (body.waterBodyNameRaw !== undefined) updates.waterBodyNameRaw = body.waterBodyNameRaw ? String(body.waterBodyNameRaw) : null;
  if (body.radiusM !== undefined) updates.radiusM = body.radiusM === '' || body.radiusM == null ? null : String(body.radiusM);
  if (body.boundaryAccuracy !== undefined && PIT_ACCURACY.has(String(body.boundaryAccuracy))) updates.boundaryAccuracy = String(body.boundaryAccuracy);
  if (body.banFrom !== undefined) updates.banFrom = body.banFrom ? String(body.banFrom) : null;
  if (body.banTo !== undefined) updates.banTo = body.banTo ? String(body.banTo) : null;
  if (body.isYearRound !== undefined) updates.isYearRound = body.isYearRound === false || body.isYearRound === 0 ? 0 : 1;
  if (body.sourceTitle !== undefined) updates.sourceTitle = body.sourceTitle ? String(body.sourceTitle) : null;
  if (body.sourceUrl !== undefined) updates.sourceUrl = body.sourceUrl ? String(body.sourceUrl) : null;
  if (body.sourceDate !== undefined) updates.sourceDate = body.sourceDate ? String(body.sourceDate) : null;
  if (body.status !== undefined && PIT_STATUS.has(String(body.status))) updates.status = String(body.status);
  if (body.notes !== undefined) updates.notes = body.notes ? String(body.notes) : null;
  if (body.geometry !== undefined || (body.lat != null && body.lng != null)) {
    try {
      updates.geometry = pitValues(body).geometry;
    } catch {
      return res.status(400).json({ error: 'Геометрия должна быть JSON' });
    }
  }
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'Нет данных' });
  await db.update(winteringPits).set(updates).where(eq(winteringPits.id, Number(req.params.id)));
  res.json({ ok: true });
});

router.delete('/wintering-pits/:id', async (req, res) => {
  await db.delete(winteringPits).where(eq(winteringPits.id, Number(req.params.id)));
  res.json({ ok: true });
});

router.get('/visibility-reports', async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : '';
  const rows = status
    ? await db.select().from(visibilityReports).where(eq(visibilityReports.status, status)).orderBy(desc(visibilityReports.createdAt))
    : await db.select().from(visibilityReports).orderBy(desc(visibilityReports.createdAt));
  res.json(rows);
});

router.patch('/visibility-reports/:id', async (req, res) => {
  const status = String(req.body?.status || '');
  if (!['pending', 'approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Статус: pending, approved или rejected' });
  }
  await db.update(visibilityReports).set({ status }).where(eq(visibilityReports.id, Number(req.params.id)));
  res.json({ ok: true });
});

router.get('/corrections', async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : '';
  const rows = status
    ? await db.select().from(correctionSuggestions).where(eq(correctionSuggestions.status, status)).orderBy(desc(correctionSuggestions.createdAt))
    : await db.select().from(correctionSuggestions).orderBy(desc(correctionSuggestions.createdAt));
  res.json(rows);
});

router.patch('/corrections/:id', async (req, res) => {
  const status = String(req.body?.status || '');
  if (!['new', 'accepted', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Статус: new, accepted или rejected' });
  }
  await db.update(correctionSuggestions).set({ status }).where(eq(correctionSuggestions.id, Number(req.params.id)));
  res.json({ ok: true });
});

export default router;
