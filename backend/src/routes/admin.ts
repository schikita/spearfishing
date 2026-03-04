import { Router } from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { db, users, waterBodies, referenceSections, permitOrganizations, pageSettings } from '../db/index.js';
import { eq, asc } from 'drizzle-orm';
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
const PAGE_KEYS = ['home', 'map', 'reference', 'contacts', 'info'];

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
  if (!['reference', 'contacts', 'info'].includes(pageKey)) {
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

export default router;
