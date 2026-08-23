import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db, pageSettings } from '../db/index.js';
import { eq } from 'drizzle-orm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, '../../uploads');

function ensureUploadsDir() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

function findFile(prefix: string): string | null {
  ensureUploadsDir();
  const files = fs.readdirSync(UPLOADS_DIR);
  const match = files.find((f) => f.startsWith(prefix + '.'));
  return match ? `/uploads/${match}` : null;
}

export function getAuthBgUrl(): string | null {
  ensureUploadsDir();
  const filePath = path.join(UPLOADS_DIR, 'auth-bg.jpg');
  return fs.existsSync(filePath) ? '/uploads/auth-bg.jpg' : null;
}

export function getLogoUrl(): string | null {
  return findFile('logo');
}

export function getFaviconUrl(): string | null {
  return findFile('favicon');
}

export function getPageBgUrl(pageKey: string): string | null {
  const allowed = ['home', 'map', 'reference', 'contacts', 'info', 'blog'];
  if (!allowed.includes(pageKey)) return null;
  return findFile(`${pageKey}-bg`);
}

const router = Router();

router.get('/auth-bg', (_req, res) => {
  res.json({ url: getAuthBgUrl() });
});

router.get('/logo', (_req, res) => {
  res.json({ url: getLogoUrl() });
});

router.get('/favicon', (_req, res) => {
  res.json({ url: getFaviconUrl() });
});

router.get('/page-bg/:pageKey', (req, res) => {
  const url = getPageBgUrl(req.params.pageKey || '');
  res.json({ url });
});

router.get('/page-info', async (_req, res) => {
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

export default router;
