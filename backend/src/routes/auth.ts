import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db, users, subscriptions } from '../db/index.js';
import { eq, desc, and, gte } from 'drizzle-orm';
import { createToken, getClientIp, requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

async function computeHasAccess(user: { id: number; role: string; hasAccess: number }): Promise<boolean> {
  if (user.role === 'admin') return true;
  if (user.hasAccess === 1) return true;
  const now = new Date().toISOString().slice(0, 10);
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.userId, user.id), eq(subscriptions.status, 'active'), gte(subscriptions.expiresAt, now)))
    .orderBy(desc(subscriptions.expiresAt))
    .limit(1);
  return !!sub;
}

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Укажите email и пароль' });
  }
  const [user] = await db.select().from(users).where(eq(users.email, String(email).trim().toLowerCase()));
  if (!user) {
    return res.status(401).json({ error: 'Неверный email или пароль' });
  }
  const ok = await bcrypt.compare(String(password), user.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: 'Неверный email или пароль' });
  }
  const clientIp = getClientIp(req);
  if (user.allowedIp && user.allowedIp !== clientIp) {
    return res.status(403).json({ error: 'Доступ разрешён только с привязанного IP-адреса' });
  }
  const token = createToken({ userId: user.id, email: user.email, role: user.role });
  const hasAccess = await computeHasAccess(user);
  res.json({ token, user: { id: user.id, email: user.email, role: user.role, hasAccess } });
});

router.get('/me', requireAuth, async (req, res) => {
  const u = req.user!;
  const hasAccess = await computeHasAccess(u);
  res.json({ user: { id: u.id, email: u.email, role: u.role, hasAccess } });
});

export default router;
