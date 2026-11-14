import { and, desc, eq } from 'drizzle-orm';
import {
  correctionSuggestions,
  db,
  externalVerifications,
  permitOrganizations,
  visibilityReports,
  waterBodies,
  waterBodySources,
  weatherCache,
  winteringPits,
} from '../db/index.js';
import { parseGeom } from './geo.js';
import { checkPoint, pitActiveOn, pitsForWater, type PitRow } from './pits.js';
import {
  CHECKLIST,
  DISCLAIMER,
  bloomRisk,
  isVisibilityOutlier,
  levelLabel,
  roadLabel,
  roadStatus,
  turbidityRisk,
  verificationLabel,
  type RiskLevel,
  type RoadStatus,
} from './risk.js';
import { getGridWeather, scheduleGridRefresh, toGrid, type GridWeather } from './weather.js';

export { DISCLAIMER };

type WaterRow = {
  id: number;
  name: string;
  nameRu: string | null;
  region: string;
  description: string | null;
  lat: string;
  lng: string;
  geometry: string | null;
  permitInfo: string | null;
  bodyType?: string | null;
  district?: string | null;
  locationDescription?: string | null;
  roadClass?: string | null;
  roadNote?: string | null;
  countryCode?: string | null;
  orderIndex?: number | null;
};

type SourceRow = {
  id: number;
  waterBodyId: number;
  sourceType: string;
  title: string | null;
  documentRef: string | null;
  documentDate: string | null;
  documentUrl: string | null;
  excerpt: string | null;
  geometryAccuracy: string;
};

type ReportRow = {
  id: number;
  waterBodyId: number;
  observedOn: string;
  visibilityM: string;
  waterColor: string | null;
  note: string | null;
  status: string;
  outlier: number;
  createdAt: string;
};

type VerRow = {
  waterBodyId: number | null;
  matchStatus: string;
  sourceUrl: string | null;
  externalUpdatedOn: string | null;
  confidence: string | null;
};

export interface TripHint {
  weather: 'ok' | 'stale' | 'missing';
  turbidity: RiskLevel;
  bloom: RiskLevel;
  road: RoadStatus;
  hasWinteringPit: boolean;
  verificationStatus: string;
  latestVisibilityM: number | null;
}

export function todayMinsk(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Minsk',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function parseTripDate(raw: unknown): string {
  if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return todayMinsk();
}

function ageDays(observedOn: string, dateISO: string): number {
  const a = Date.parse(`${observedOn.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${dateISO.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 999;
  return Math.round((b - a) / 86400000);
}

function normRegion(value: string): string {
  return value
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/область/g, '')
    .replace(/обл\.?/g, '')
    .replace(/[^a-zа-я0-9]+/gi, ' ')
    .trim();
}

const STATUS_RANK = ['name_conflict', 'needs_review', 'not_in_official_list', 'not_found_on_map', 'matched'];

function pickVerification(rows: VerRow[]): VerRow | null {
  if (!rows.length) return null;
  return [...rows].sort((a, b) => STATUS_RANK.indexOf(a.matchStatus) - STATUS_RANK.indexOf(b.matchStatus))[0];
}

interface Bundle {
  waters: WaterRow[];
  pits: PitRow[];
  sources: SourceRow[];
  reports: ReportRow[];
  verifications: VerRow[];
  orgs: { id: number; name: string; nameRu: string | null; region: string; url: string | null }[];
  weatherByGrid: Map<string, GridWeather>;
}

async function loadBundle(): Promise<Bundle> {
  const [waters, pits, sources, reports, verifications, orgs, weatherRows] = await Promise.all([
    db.select().from(waterBodies),
    db.select().from(winteringPits),
    db.select().from(waterBodySources),
    db.select().from(visibilityReports).where(eq(visibilityReports.status, 'approved')).orderBy(desc(visibilityReports.observedOn)),
    db.select().from(externalVerifications),
    db.select().from(permitOrganizations),
    db.select().from(weatherCache).orderBy(desc(weatherCache.fetchedAt)),
  ]);
  const weatherByGrid = new Map<string, GridWeather>();
  for (const row of weatherRows as Parameters<typeof toGrid>[0][]) {
    if (!row) continue;
    const id = `${row.gridLat},${row.gridLng}`;
    if (weatherByGrid.has(id)) continue;
    weatherByGrid.set(id, toGrid(row));
  }
  return {
    waters: waters as WaterRow[],
    pits: pits as PitRow[],
    sources: sources as SourceRow[],
    reports: reports as ReportRow[],
    verifications: verifications as VerRow[],
    orgs,
    weatherByGrid,
  };
}

function weatherFor(bundle: Bundle, water: WaterRow, waitMissing: boolean): GridWeather | null {
  const lat = Number(water.lat);
  const lng = Number(water.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const keyLat = (Math.round(lat / 0.25) * 0.25).toFixed(2);
  const keyLng = (Math.round(lng / 0.25) * 0.25).toFixed(2);
  return bundle.weatherByGrid.get(`${keyLat},${keyLng}`) ?? null;
}

function influencingReport(reports: ReportRow[], dateISO: string): { visibilityM: number; ageDays: number; waterColor: string | null } | null {
  for (const report of reports) {
    if (report.outlier === 1) continue;
    const age = ageDays(report.observedOn, dateISO);
    if (age < 0 || age > 14) continue;
    const visibilityM = Number(report.visibilityM);
    if (!Number.isFinite(visibilityM)) continue;
    return { visibilityM, ageDays: age, waterColor: report.waterColor };
  }
  return null;
}

export function buildHint(water: WaterRow, bundle: Bundle, dateISO: string, sources: SourceRow[], reports: ReportRow[], vers: VerRow[]): TripHint {
  const wx = weatherFor(bundle, water, false);
  const month = Number(dateISO.slice(5, 7));
  const report = influencingReport(reports, dateISO);
  const turbidity = turbidityRisk({
    precip3d: wx?.precipMm3d ?? null,
    precip7d: wx?.precipMm7d ?? null,
    bodyType: water.bodyType,
    report,
  });
  const bloom = bloomRisk({
    tempMean7d: wx?.airTempMean7d ?? null,
    sunshineHours7d: wx?.sunshineHours7d ?? null,
    precip7d: wx?.precipMm7d ?? null,
    bodyType: water.bodyType,
    month,
    ugcBloom: report?.waterColor === 'bloom',
  });
  const road = roadStatus(water.roadClass, wx?.precipMm3d ?? null, wx?.precipMm7d ?? null);
  const pitHits = pitsForWater(water, bundle.pits, dateISO);
  const verification = pickVerification(vers);
  void sources;
  return {
    weather: wx?.freshness ?? 'missing',
    turbidity: turbidity.level,
    bloom: bloom.level,
    road,
    hasWinteringPit: pitHits.length > 0,
    verificationStatus: verification?.matchStatus ?? 'not_checked',
    latestVisibilityM: report ? report.visibilityM : null,
  };
}

export async function listWaterBodies(dateISO: string) {
  const bundle = await loadBundle();
  const sourcesByWater = group(bundle.sources, (s) => s.waterBodyId);
  const reportsByWater = group(bundle.reports, (r) => r.waterBodyId);
  const verByWater = group(
    bundle.verifications.filter((v) => v.waterBodyId != null),
    (v) => v.waterBodyId as number
  );
  let scheduled = 0;
  const items = bundle.waters.map((water) => {
    const hint = buildHint(
      water,
      bundle,
      dateISO,
      sourcesByWater.get(water.id) ?? [],
      reportsByWater.get(water.id) ?? [],
      verByWater.get(water.id) ?? []
    );
    if (hint.weather !== 'ok' && scheduled < 12) {
      const lat = Number(water.lat);
      const lng = Number(water.lng);
      if (Number.isFinite(lat) && Number.isFinite(lng) && scheduleGridRefresh(lat, lng)) scheduled += 1;
    }
    return { ...water, tripHint: hint };
  });
  items.sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0) || a.id - b.id);
  return { disclaimer: DISCLAIMER, date: dateISO, waterBodies: items };
}

function group<T>(rows: T[], key: (row: T) => number): Map<number, T[]> {
  const map = new Map<number, T[]>();
  for (const row of rows) {
    const id = key(row);
    const list = map.get(id) ?? [];
    list.push(row);
    map.set(id, list);
  }
  return map;
}

export async function buildVerdict(waterId: number, dateISO: string, lat?: number, lng?: number) {
  const bundle = await loadBundle();
  const water = bundle.waters.find((w) => w.id === waterId);
  if (!water) return null;
  const wLat = Number(water.lat);
  const wLng = Number(water.lng);
  let wx: GridWeather | null = null;
  if (Number.isFinite(wLat) && Number.isFinite(wLng)) {
    wx = await getGridWeather(wLat, wLng, true);
  }
  const localBundle: Bundle = {
    ...bundle,
    weatherByGrid: new Map(bundle.weatherByGrid),
  };
  if (wx && Number.isFinite(wLat) && Number.isFinite(wLng)) {
    const keyLat = (Math.round(wLat / 0.25) * 0.25).toFixed(2);
    const keyLng = (Math.round(wLng / 0.25) * 0.25).toFixed(2);
    localBundle.weatherByGrid.set(`${keyLat},${keyLng}`, wx);
  }
  const sources = bundle.sources.filter((s) => s.waterBodyId === water.id);
  const official = sources.find((s) => s.sourceType === 'oblast_decision') ?? null;
  const reports = bundle.reports.filter((r) => r.waterBodyId === water.id);
  const vers = bundle.verifications.filter((v) => v.waterBodyId === water.id);
  const hint = buildHint(water, localBundle, dateISO, sources, reports, vers);
  const month = Number(dateISO.slice(5, 7));
  const report = influencingReport(reports, dateISO);
  const turbidity = turbidityRisk({
    precip3d: wx?.precipMm3d ?? null,
    precip7d: wx?.precipMm7d ?? null,
    bodyType: water.bodyType,
    report,
  });
  const bloom = bloomRisk({
    tempMean7d: wx?.airTempMean7d ?? null,
    sunshineHours7d: wx?.sunshineHours7d ?? null,
    precip7d: wx?.precipMm7d ?? null,
    bodyType: water.bodyType,
    month,
    ugcBloom: report?.waterColor === 'bloom',
  });
  const road = roadStatus(water.roadClass, wx?.precipMm3d ?? null, wx?.precipMm7d ?? null);
  const pitHits = pitsForWater(water, bundle.pits, dateISO);
  const point =
    lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)
      ? checkPoint(lat, lng, bundle.pits, dateISO)
      : null;
  const org = bundle.orgs.find((o) => {
    const a = normRegion(o.region);
    const b = normRegion(water.region);
    return a && b && (a.includes(b) || b.includes(a));
  });
  const permitText = (water.permitInfo || '').toLowerCase();
  const permitRequired =
    permitText.includes('путёв') || permitText.includes('путев') || permitText.includes('подвод')
      ? true
      : water.permitInfo
        ? true
        : null;
  const verification = pickVerification(vers);
  const recentReports = reports.slice(0, 3).map((r) => ({
    id: r.id,
    observedOn: r.observedOn,
    visibilityM: Number(r.visibilityM),
    waterColor: r.waterColor,
    note: r.note,
    outlier: r.outlier === 1,
    affectsMap: r.outlier !== 1 && ageDays(r.observedOn, dateISO) >= 0 && ageDays(r.observedOn, dateISO) <= 14,
  }));
  const geometryAccuracy = official?.geometryAccuracy ?? (parseGeom(water.geometry) ? 'approximate' : 'unknown');
  return {
    disclaimer: DISCLAIMER,
    date: dateISO,
    waterBody: {
      id: water.id,
      name: water.nameRu || water.name,
      region: water.region,
      bodyType: water.bodyType || 'unknown',
      geometryAccuracy,
      district: water.district ?? null,
      locationDescription: water.locationDescription ?? null,
    },
    onOfficialList: {
      listed: !!official,
      documentTitle: official?.title ?? null,
      documentRef: official?.documentRef ?? null,
      documentDate: official?.documentDate ?? null,
      documentUrl: official?.documentUrl ?? null,
      excerpt: official?.excerpt ?? null,
      geometryAccuracy,
      note: official
        ? geometryAccuracy === 'exact'
          ? 'Водоём есть в сохранённом перечне решения облисполкома.'
          : 'Водоём есть в сохранённом перечне. Границы на карте условные: участок часто задан текстом, а контур — приближение.'
        : 'В сохранённых решениях облисполкомов запись не найдена. Это не запрет и не разрешение.',
    },
    permit: {
      required: permitRequired,
      organization: org ? { name: org.nameRu || org.name, url: org.url } : null,
      note:
        permitRequired === true
          ? 'По карточке водоёма для подводной охоты нужна путёвка. Сайт не проверяет, что она оформлена.'
          : 'Нужна ли путёвка, по этой карточке не подтверждено. Уточните в организации области.',
    },
    winteringPits: {
      recorded: pitHits.length > 0,
      message:
        pitHits.length > 0
          ? 'Внимание: в водоёме есть зимовальные ямы, подводная охота в них запрещена.'
          : 'Данные о зимовальных ямах для этого водоёма не внесены. Это не значит, что ям нет.',
      items: pitHits,
      userPoint: point
        ? {
            inside: point.inside,
            nearby: point.nearby,
            boundariesUncertain: point.boundariesUncertain,
          }
        : null,
    },
    verification: {
      status: verification?.matchStatus ?? 'not_checked',
      label: verificationLabel(verification?.matchStatus ?? 'not_checked'),
      unofficial: true,
      sourceUrl: verification?.sourceUrl ?? null,
      externalUpdatedOn: verification?.externalUpdatedOn ?? null,
      confidence: verification?.confidence ?? null,
      note: 'Внешняя карта ознакомительная. Отсутствие водоёма на ней не отменяет запись в решении облисполкома.',
    },
    risks: {
      weather: wx?.freshness ?? 'missing',
      turbidity: { ...turbidity, label: levelLabel(turbidity.level, 'turbidity') },
      bloom: { ...bloom, label: levelLabel(bloom.level, 'bloom') },
      road: { status: road, label: roadLabel(road), note: water.roadNote ?? null },
      diving: {
        windSpeedMs: wx?.windSpeedMs ?? null,
        windDirDeg: wx?.windDirDeg ?? null,
        pressureHpa: wx?.pressureHpa ?? null,
        airTempC: wx?.airTempC ?? null,
        waterTempC: wx?.waterTempC ?? null,
        waterTempNote: 'Оценка по температуре воздуха за 7 дней, не измерение воды.',
      },
    },
    reports: recentReports,
    checklist: CHECKLIST,
    tripHint: hint,
  };
}

export async function permissionStatus(waterId: number) {
  const [water] = await db.select().from(waterBodies).where(eq(waterBodies.id, waterId));
  if (!water) return null;
  const sources = await db.select().from(waterBodySources).where(eq(waterBodySources.waterBodyId, waterId));
  const vers = await db.select().from(externalVerifications).where(eq(externalVerifications.waterBodyId, waterId));
  const official = (sources as SourceRow[]).find((s) => s.sourceType === 'oblast_decision') ?? null;
  const verification = pickVerification(vers as VerRow[]);
  return {
    disclaimer: DISCLAIMER,
    waterBodyId: waterId,
    onOfficialList: !!official,
    documentTitle: official?.title ?? null,
    documentRef: official?.documentRef ?? null,
    documentDate: official?.documentDate ?? null,
    geometryAccuracy: official?.geometryAccuracy ?? 'unknown',
    excerpt: official?.excerpt ?? null,
    external: {
      status: verification?.matchStatus ?? 'not_checked',
      label: verificationLabel(verification?.matchStatus ?? 'not_checked'),
      unofficial: true,
      sourceUrl: verification?.sourceUrl ?? null,
      note: 'Статус внешней карты не заменяет решение облисполкома и сам по себе не делает охоту разрешённой.',
    },
  };
}

export async function publicPits(dateISO: string) {
  const rows = (await db.select().from(winteringPits)) as PitRow[];
  return {
    disclaimer: DISCLAIMER,
    date: dateISO,
    pits: rows.filter((p) => pitActiveOn(p, dateISO)),
  };
}

export async function pitCheck(lat: number, lng: number, dateISO: string) {
  const rows = (await db.select().from(winteringPits)) as PitRow[];
  const result = checkPoint(lat, lng, rows, dateISO);
  return { disclaimer: DISCLAIMER, date: dateISO, ...result };
}

export async function createVisibilityReport(input: {
  waterBodyId: number;
  userId: number;
  observedOn: string;
  visibilityM: number;
  waterColor: string | null;
  note: string | null;
}) {
  const [water] = await db.select({ id: waterBodies.id }).from(waterBodies).where(eq(waterBodies.id, input.waterBodyId));
  if (!water) return { error: 'Водоём не найден' as const };
  const previous = await db
    .select({ visibilityM: visibilityReports.visibilityM })
    .from(visibilityReports)
    .where(and(eq(visibilityReports.waterBodyId, input.waterBodyId), eq(visibilityReports.status, 'approved')))
    .orderBy(desc(visibilityReports.observedOn))
    .limit(5);
  const prevValues = previous
    .map((r: { visibilityM: string }) => Number(r.visibilityM))
    .filter((n: number) => Number.isFinite(n));
  const outlier = isVisibilityOutlier(input.visibilityM, prevValues) ? 1 : 0;
  const now = new Date().toISOString();
  const [row] = await db
    .insert(visibilityReports)
    .values({
      waterBodyId: input.waterBodyId,
      userId: input.userId,
      observedOn: input.observedOn,
      visibilityM: String(input.visibilityM),
      waterColor: input.waterColor,
      note: input.note,
      status: 'pending',
      outlier,
      createdAt: now,
    })
    .returning({ id: visibilityReports.id });
  return {
    id: row.id,
    status: 'pending' as const,
    outlier: outlier === 1,
    disclaimer: DISCLAIMER,
    message: 'Отчёт сохранён и появится на карте только после проверки.',
  };
}

export async function createCorrection(input: {
  waterBodyId: number | null;
  externalFeatureId: number | null;
  suggestionType: string;
  message: string;
  contact: string | null;
  clientIp: string;
}) {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const recent = await db
    .select({ id: correctionSuggestions.id, createdAt: correctionSuggestions.createdAt })
    .from(correctionSuggestions)
    .where(eq(correctionSuggestions.clientIp, input.clientIp));
  const count = (recent as { createdAt: string }[]).filter((r) => r.createdAt >= since).length;
  if (count >= 5) return { error: 'Слишком много сообщений. Попробуйте позже.' as const };
  const now = new Date().toISOString();
  const [row] = await db
    .insert(correctionSuggestions)
    .values({
      waterBodyId: input.waterBodyId,
      externalFeatureId: input.externalFeatureId,
      suggestionType: input.suggestionType,
      message: input.message,
      contact: input.contact,
      clientIp: input.clientIp,
      status: 'new',
      createdAt: now,
    })
    .returning({ id: correctionSuggestions.id });
  return { id: row.id, status: 'new' as const, disclaimer: DISCLAIMER };
}
