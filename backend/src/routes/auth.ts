import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { createToken, getClientIp, requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

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
  res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
});

router.get('/me', requireAuth, (req, res) => {
  const u = req.user!;
  res.json({ user: { id: u.id, email: u.email, role: u.role } });
});

export default router;
