import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db, users, subscriptions } from '../db/index.js';
import { eq, desc, and, gte } from 'drizzle-orm';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

export interface JwtPayload {
  userId: number;
  email: string;
  role: string;
}

export function getClientIp(req: Request): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string') return xff.split(',')[0].trim();
  return req.socket.remoteAddress || '';
}

export function createToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Недействительный токен' });
  }
  const [user] = await db.select().from(users).where(eq(users.id, payload.userId));
  if (!user) {
    return res.status(401).json({ error: 'Пользователь не найден' });
  }
  const clientIp = getClientIp(req);
  if (user.allowedIp && user.allowedIp !== clientIp) {
    return res.status(403).json({ error: 'Доступ разрешён только с привязанного IP-адреса' });
  }
  req.user = user;
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const u = req.user;
  if (!u || u.role !== 'admin') {
    return res.status(403).json({ error: 'Требуются права администратора' });
  }
  next();
}

/** Доступ к карте: админ, hasAccess от админа, или активная подписка */
export async function requireMapAccess(req: Request, res: Response, next: NextFunction) {
  const u = req.user;
  if (!u) return res.status(401).json({ error: 'Требуется авторизация' });
  if (u.role === 'admin') return next();
  if (u.hasAccess === 1) return next();
  const now = new Date().toISOString().slice(0, 10);
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.userId, u.id), eq(subscriptions.status, 'active'), gte(subscriptions.expiresAt, now)))
    .orderBy(desc(subscriptions.expiresAt))
    .limit(1);
  if (sub) return next();
  return res.status(403).json({ error: 'Доступ к карте не активирован. Оформите подписку или обратитесь к администратору.' });
}
