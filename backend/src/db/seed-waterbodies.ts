import { readFileSync } from 'fs';
import path from 'path';
import { and, eq } from 'drizzle-orm';
import { db, initDb, waterBodies, waterBodySources } from './index.js';
import { geometryAccuracyFor } from '../trip/geo.js';

const ROOT = path.join(process.cwd(), '..');
const DEFAULT_FILES = [
  'brest_waterbodies.geojson',
  'minsk_waterbodies.geojson',
  'grodno_waterbodies.geojson',
  'vitebsk_waterbodies.geojson',
  'mogilev_waterbodies.geojson',
  'gomel_waterbodies.geojson',
];
const GEOJSON_FILES = process.env.WATERBODIES_GEOJSON
  ? process.env.WATERBODIES_GEOJSON.split(',').map((f) => f.trim())
  : DEFAULT_FILES.map((f) => path.join(ROOT, f));

const MONTHS: Record<string, string> = {
  января: '01',
  февраля: '02',
  марта: '03',
  апреля: '04',
  мая: '05',
  июня: '06',
  июля: '07',
  августа: '08',
  сентября: '09',
  октября: '10',
  ноября: '11',
  декабря: '12',
};

interface GeoFeature {
  type: string;
  geometry: { type: string; coordinates: unknown };
  properties: {
    id?: number;
    name?: string;
    type?: string;
    type_ru?: string;
    district?: string;
    region?: string;
    location_description?: string;
    activities?: string;
  };
}

interface ExistingWater {
  id: number;
  name: string;
  region: string;
  roadClass: string | null;
  roadNote: string | null;
  baselineVisibilityM: string | null;
  permitInfo: string | null;
}

function norm(value: string | null | undefined): string {
  return (value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseRuDate(source: string): string | null {
  const match = source.match(/(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)\s+(\d{4})/i);
  if (!match) return null;
  const month = MONTHS[match[2].toLowerCase()];
  if (!month) return null;
  return `${match[3]}-${month}-${match[1].padStart(2, '0')}`;
}

function parseDocRef(source: string): string | null {
  const match = source.match(/№\s*[\d-]+/);
  return match ? match[0].replace(/\s+/g, ' ') : null;
}

function mapBodyType(type?: string, typeRu?: string): string {
  const t = (type || '').toLowerCase();
  const ru = (typeRu || '').toLowerCase();
  if (t === 'reservoir' || ru.includes('водохранилищ')) return 'reservoir';
  if (t === 'river' || ru.includes('река')) return 'river';
  if (t === 'quarry' || ru.includes('карьер')) return 'quarry';
  if (t === 'pond' || ru.includes('пруд')) return 'pond';
  if (t === 'lake' || ru.includes('озер')) return 'lake';
  return 'unknown';
}

function getCentroid(geom: GeoFeature['geometry']): [number, number] | null {
  if (!geom || !geom.coordinates) return null;
  const c = geom.coordinates as unknown;
  if (geom.type === 'Point' && Array.isArray(c)) {
    if (c.length >= 2 && typeof (c as number[])[0] === 'number') {
      const p = c as number[];
      return [p[0], p[1]];
    }
  }
  if (geom.type === 'LineString' && Array.isArray(c) && c.length) {
    const pts = c as number[][];
    const mid = pts[Math.floor(pts.length / 2)];
    if (Array.isArray(mid) && mid.length >= 2) return [mid[0], mid[1]];
  }
  if (geom.type === 'Polygon' && Array.isArray(c) && (c as unknown[])[0]) {
    const ring = (c as number[][][])[0];
    const first = ring?.[0];
    if (Array.isArray(first) && first.length >= 2) return [first[0], first[1]];
  }
  if (geom.type === 'MultiPolygon' && Array.isArray(c) && (c as unknown[])[0]) {
    const first = ((c as number[][][][])[0]?.[0]?.[0]) as number[] | undefined;
    if (Array.isArray(first) && first.length >= 2) return [first[0], first[1]];
  }
  return null;
}

async function replaceOfficialSource(
  waterBodyId: number,
  meta: { title?: string; source?: string },
  feature: GeoFeature
) {
  await db
    .delete(waterBodySources)
    .where(and(eq(waterBodySources.waterBodyId, waterBodyId), eq(waterBodySources.sourceType, 'oblast_decision')));
  const sourceText = meta.source || '';
  await db.insert(waterBodySources).values({
    waterBodyId,
    sourceType: 'oblast_decision',
    title: meta.title || 'Перечень водоёмов',
    documentRef: sourceText ? parseDocRef(sourceText) : null,
    documentDate: sourceText ? parseRuDate(sourceText) : null,
    documentUrl: null,
    region: feature.properties.region || null,
    excerpt: feature.properties.location_description || null,
    geometryAccuracy: geometryAccuracyFor(feature.geometry?.type),
    importedAt: new Date().toISOString(),
  });
}

async function seedWaterBodies() {
  await Promise.resolve(initDb());
  const existing = (await db.select().from(waterBodies)) as ExistingWater[];
  const byKey = new Map<string, ExistingWater[]>();
  for (const row of existing) {
    const key = `${norm(row.region)}|${norm(row.name)}`;
    const list = byKey.get(key) ?? [];
    list.push(row);
    byKey.set(key, list);
  }
  const used = new Set<number>();
  let updated = 0;
  let inserted = 0;
  let order = 0;

  for (const filePath of GEOJSON_FILES) {
    let raw: string;
    try {
      raw = readFileSync(filePath, 'utf-8');
    } catch (err) {
      console.warn(`  ${path.basename(filePath)}: skip (${err instanceof Error ? err.message : err})`);
      continue;
    }
    const geojson = JSON.parse(raw) as { metadata?: { title?: string; source?: string }; features?: GeoFeature[] };
    const features = geojson.features || [];
    for (const feature of features) {
      order += 1;
      const coords = getCentroid(feature.geometry);
      if (!coords) continue;
      const [lng, lat] = coords;
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
      const p = feature.properties || {};
      const name = p.name || 'Без названия';
      const region = p.region || 'Не указана';
      const desc = [p.type_ru ? `Тип: ${p.type_ru}` : null, p.district ? `Район: ${p.district}` : null, p.location_description, p.activities ? `Виды деятельности: ${p.activities}` : '']
        .filter(Boolean)
        .join('\n');
      const geom = feature.geometry?.type && feature.geometry?.coordinates ? JSON.stringify(feature.geometry) : null;
      const bodyType = mapBodyType(p.type, p.type_ru);
      const spearfishing = (p.activities || '').toLowerCase().includes('подводная охота');
      const key = `${norm(region)}|${norm(name)}`;
      const match = (byKey.get(key) ?? []).find((row) => !used.has(row.id));
      const shared = {
        name,
        nameRu: p.name || null,
        region,
        description: desc || null,
        lat: String(lat),
        lng: String(lng),
        geometry: geom,
        bodyType,
        district: p.district || null,
        locationDescription: p.location_description || null,
        countryCode: 'BY',
        orderIndex: p.id ?? order,
      };
      let id: number;
      if (match) {
        used.add(match.id);
        id = match.id;
        await db
          .update(waterBodies)
          .set({
            ...shared,
            permitInfo: spearfishing ? 'Подводная охота по путёвке' : match.permitInfo,
            roadClass: match.roadClass && match.roadClass !== 'unknown' ? match.roadClass : 'unknown',
            roadNote: match.roadNote,
            baselineVisibilityM: match.baselineVisibilityM,
          })
          .where(eq(waterBodies.id, match.id));
        updated += 1;
      } else {
        const [row] = await db
          .insert(waterBodies)
          .values({
            ...shared,
            permitInfo: spearfishing ? 'Подводная охота по путёвке' : null,
            roadClass: 'unknown',
            roadNote: null,
            baselineVisibilityM: null,
          })
          .returning({ id: waterBodies.id });
        id = row.id;
        const created: ExistingWater = {
          id,
          name,
          region,
          roadClass: 'unknown',
          roadNote: null,
          baselineVisibilityM: null,
          permitInfo: spearfishing ? 'Подводная охота по путёвке' : null,
        };
        const list = byKey.get(key) ?? [];
        list.push(created);
        byKey.set(key, list);
        used.add(id);
        inserted += 1;
      }
      await replaceOfficialSource(id, geojson.metadata || {}, feature);
    }
    console.log(`  ${path.basename(filePath)}: ${features.length} features`);
  }

  console.log(`Water bodies updated ${updated}, inserted ${inserted}. Manual rows and wintering pits were kept.`);
}

seedWaterBodies().catch((err) => {
  console.error(err);
  process.exit(1);
});
