import { Router } from 'express';
import YooKassa from 'yookassa-ts/lib/yookassa.js';
import { db, users, subscriptions } from '../db/index.js';
import { eq, desc } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const SHOP_ID = process.env.YOOKASSA_SHOP_ID || '';
const SECRET_KEY = process.env.YOOKASSA_SECRET_KEY || '';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

export const SUBSCRIPTION_PLANS = [
  { id: '1d', days: 1, amount: '5', label: '1 день', currency: 'BYN' as const },
  { id: '1m', days: 30, amount: '30', label: '1 месяц', currency: 'BYN' as const },
  { id: '3m', days: 90, amount: '60', label: '3 месяца', currency: 'BYN' as const },
];

function getYooKassa() {
  if (!SHOP_ID || !SECRET_KEY) {
    throw new Error('YOOKASSA_SHOP_ID и YOOKASSA_SECRET_KEY должны быть заданы в .env');
  }
  return new YooKassa({ shopId: SHOP_ID, secretKey: SECRET_KEY });
}

/** Список тарифов */
router.get('/plans', (_req, res) => {
  res.json({ plans: SUBSCRIPTION_PLANS });
});

/** Создать платёж для подписки */
router.post('/create', requireAuth, async (req, res) => {
  const user = req.user!;
  if (user.role === 'admin') {
    return res.status(400).json({ error: 'Админ не нуждается в подписке' });
  }
  const { planId } = req.body;
  const plan = SUBSCRIPTION_PLANS.find((p) => p.id === planId) || SUBSCRIPTION_PLANS[1];
  const amount = plan.amount;
  const days = plan.days;

  try {
    const yk = getYooKassa();
    const returnUrl = `${FRONTEND_URL}/subscription/success`;
    const payment = await yk.createPayment({
      amount: { value: amount, currency: plan.currency },
      payment_method_data: { type: 'bank_card' },
      confirmation: { type: 'redirect', return_url: returnUrl },
      description: `Подписка на карту водоёмов (${plan.label}) — ${user.email}`,
      metadata: { user_id: String(user.id), plan_id: plan.id },
    });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    await db.insert(subscriptions).values({
      userId: user.id,
      paymentId: payment.id,
      status: 'pending',
      expiresAt: expiresAt.toISOString().slice(0, 10),
    });

    const url = (payment as { confirmationUrl?: string }).confirmationUrl;
    if (!url) {
      return res.status(500).json({ error: 'Не получен URL оплаты' });
    }
    res.json({ paymentUrl: url, paymentId: payment.id });
  } catch (err) {
    console.error('YooKassa create:', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Ошибка создания платежа',
    });
  }
});

/** Webhook от ЮKassa (без auth) */
router.post('/webhook', async (req, res) => {
  const body = req.body as { event?: string; object?: { id?: string; status?: string; metadata?: { user_id?: string } } };
  if (body.event !== 'payment.succeeded' || !body.object) {
    return res.status(200).send('ok');
  }
  const { id: paymentId, status, metadata } = body.object;
  if (status !== 'succeeded' || !paymentId) return res.status(200).send('ok');

  const userId = metadata?.user_id ? Number(metadata.user_id) : null;
  if (!userId) return res.status(200).send('ok');

  try {
    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.paymentId, paymentId))
      .orderBy(desc(subscriptions.id))
      .limit(1);

    if (sub && sub.status === 'pending') {
      await db.update(subscriptions).set({ status: 'active' }).where(eq(subscriptions.id, sub.id));
      // Не ставим users.hasAccess — доступ идёт через подписку с привязкой к устройству
    }
  } catch (err) {
    console.error('Webhook error:', err);
  }
  res.status(200).send('ok');
});

/** Статус подписки пользователя (подписка привязана к аккаунту по email) */
router.get('/status', requireAuth, async (req, res) => {
  const user = req.user!;
  if (user.role === 'admin') {
    return res.json({ hasAccess: true, expiresAt: null, isAdmin: true });
  }

  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, user.id))
    .orderBy(desc(subscriptions.expiresAt))
    .limit(1);

  const now = new Date().toISOString().slice(0, 10);
  const subActive = sub && sub.status === 'active' && sub.expiresAt >= now;
  const hasAccessByAdmin = user.hasAccess === 1;
  const hasAccessBySub = !!subActive;

  res.json({
    hasAccess: !!hasAccessByAdmin || !!hasAccessBySub,
    expiresAt: sub?.expiresAt ?? null,
    status: sub?.status ?? null,
  });
});

export default router;
