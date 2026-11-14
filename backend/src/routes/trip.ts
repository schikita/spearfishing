import { Router } from 'express';
import { getClientIp, requireAuth } from '../middleware/auth.js';
import {
  DISCLAIMER,
  buildVerdict,
  createCorrection,
  createVisibilityReport,
  parseTripDate,
  permissionStatus,
  pitCheck,
  publicPits,
} from '../trip/verdict.js';
import { getGridWeather } from '../trip/weather.js';

const router = Router();

const COLORS = new Set(['clear', 'green', 'brown', 'bloom']);
const SUGGESTION_TYPES = new Set(['geometry', 'name', 'permission', 'wintering_pit', 'other']);

router.get('/wintering-pits', async (req, res) => {
  res.json(await publicPits(parseTripDate(req.query.date)));
});

router.post('/geo/wintering-pit-check', async (req, res) => {
  const lat = Number(req.body?.lat);
  const lng = Number(req.body?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: 'Нужны числовые lat и lng', disclaimer: DISCLAIMER });
  }
  res.json(await pitCheck(lat, lng, parseTripDate(req.body?.date)));
});

router.get('/water-bodies/:id/verdict', async (req, res) => {
  const lat = req.query.lat != null && req.query.lat !== '' ? Number(req.query.lat) : undefined;
  const lng = req.query.lng != null && req.query.lng !== '' ? Number(req.query.lng) : undefined;
  const data = await buildVerdict(Number(req.params.id), parseTripDate(req.query.date), lat, lng);
  if (!data) return res.status(404).json({ error: 'Водоём не найден', disclaimer: DISCLAIMER });
  res.json(data);
});

router.get('/water-bodies/:id/permission-status', async (req, res) => {
  const data = await permissionStatus(Number(req.params.id));
  if (!data) return res.status(404).json({ error: 'Водоём не найден', disclaimer: DISCLAIMER });
  res.json(data);
});

router.post('/water-bodies/:id/visibility-reports', requireAuth, async (req, res) => {
  const visibilityM = Number(req.body?.visibilityM);
  const observedOn = typeof req.body?.observedOn === 'string' ? req.body.observedOn : '';
  const waterColor = typeof req.body?.waterColor === 'string' ? req.body.waterColor : null;
  const note = typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 500) : null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(observedOn)) {
    return res.status(400).json({ error: 'Дата наблюдения в формате ГГГГ-ММ-ДД', disclaimer: DISCLAIMER });
  }
  if (!Number.isFinite(visibilityM) || visibilityM < 0 || visibilityM > 30) {
    return res.status(400).json({ error: 'Видимость укажите в метрах от 0 до 30', disclaimer: DISCLAIMER });
  }
  if (waterColor && !COLORS.has(waterColor)) {
    return res.status(400).json({ error: 'Неизвестный цвет воды', disclaimer: DISCLAIMER });
  }
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Требуется авторизация', disclaimer: DISCLAIMER });
  const result = await createVisibilityReport({
    waterBodyId: Number(req.params.id),
    userId,
    observedOn,
    visibilityM,
    waterColor,
    note: note || null,
  });
  if ('error' in result) return res.status(404).json({ error: result.error, disclaimer: DISCLAIMER });
  res.status(201).json(result);
});

router.post('/corrections', async (req, res) => {
  const suggestionType = String(req.body?.suggestionType || '');
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  if (!SUGGESTION_TYPES.has(suggestionType)) {
    return res.status(400).json({ error: 'Укажите тип исправления', disclaimer: DISCLAIMER });
  }
  if (message.length < 5 || message.length > 2000) {
    return res.status(400).json({ error: 'Опишите исправление текстом от 5 до 2000 символов', disclaimer: DISCLAIMER });
  }
  const waterBodyId = req.body?.waterBodyId != null && req.body.waterBodyId !== '' ? Number(req.body.waterBodyId) : null;
  const externalFeatureId =
    req.body?.externalFeatureId != null && req.body.externalFeatureId !== '' ? Number(req.body.externalFeatureId) : null;
  const contact = typeof req.body?.contact === 'string' ? req.body.contact.trim().slice(0, 200) : '';
  const result = await createCorrection({
    waterBodyId: waterBodyId != null && Number.isFinite(waterBodyId) ? waterBodyId : null,
    externalFeatureId: externalFeatureId != null && Number.isFinite(externalFeatureId) ? externalFeatureId : null,
    suggestionType,
    message,
    contact: contact || null,
    clientIp: getClientIp(req),
  });
  if ('error' in result) return res.status(429).json({ error: result.error, disclaimer: DISCLAIMER });
  res.status(201).json(result);
});

router.get('/weather/grid', async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: 'Нужны lat и lng', disclaimer: DISCLAIMER });
  }
  const weather = await getGridWeather(lat, lng, true);
  res.json({
    disclaimer: DISCLAIMER,
    weather,
    waterTempNote: 'Температура воды — оценка по воздуху, не измерение.',
  });
});

export default router;
