import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db, users, subscriptions } from '../db/index.js';
import { eq, desc, and, gte } from 'drizzle-orm';
import { createToken, requireAuth } from '../middleware/auth.js';

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

router.post('/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Укажите email и пароль' });
  }
  const normalizedEmail = String(email).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return res.status(400).json({ error: 'Некорректный email' });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: 'Пароль должен быть не менее 6 символов' });
  }
  const [existing] = await db.select().from(users).where(eq(users.email, normalizedEmail));
  if (existing) {
    return res.status(409).json({ error: 'Пользователь с таким email уже зарегистрирован' });
  }
  const passwordHash = await bcrypt.hash(String(password), 10);
  const [newUser] = await db
    .insert(users)
    .values({ email: normalizedEmail, passwordHash, role: 'user' })
    .returning({ id: users.id, email: users.email, role: users.role });
  if (!newUser) {
    return res.status(500).json({ error: 'Ошибка создания пользователя' });
  }
  const token = createToken({ userId: newUser.id, email: newUser.email, role: newUser.role });
  const fullUser = { id: newUser.id, email: newUser.email, role: newUser.role, hasAccess: 0 };
  const hasAccess = await computeHasAccess(fullUser);
  res.status(201).json({ token, user: { id: newUser.id, email: newUser.email, role: newUser.role, hasAccess } });
});

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
