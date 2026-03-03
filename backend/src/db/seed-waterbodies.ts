import { readFileSync } from 'fs';
import path from 'path';
import { db, waterBodies } from './index.js';
import { gt } from 'drizzle-orm';

// По умолчанию: brest и minsk в корне проекта
const ROOT = path.join(process.cwd(), '..');
const DEFAULT_FILES = ['brest_waterbodies.geojson', 'minsk_waterbodies.geojson', 'grodno_waterbodies.geojson', 'vitebsk_waterbodies.geojson', 'mogilev_waterbodies.geojson', 'gomel_waterbodies.geojson'];
const GEOJSON_FILES = process.env.WATERBODIES_GEOJSON
  ? process.env.WATERBODIES_GEOJSON.split(',').map((f) => f.trim())
  : DEFAULT_FILES.map((f) => path.join(ROOT, f));

interface GeoFeature {
  type: string;
  geometry: {
    type: string;
    coordinates: number[] | number[][] | number[][][];
  };
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

function getCentroid(geom: GeoFeature['geometry']): [number, number] | null {
  if (!geom || !geom.coordinates) return null;
  const c = geom.coordinates;
  if (geom.type === 'Point' && Array.isArray(c)) {
    if (c.length >= 2 && typeof c[0] === 'number') return [c[0] as number, c[1] as number];
    if (c[0] && Array.isArray(c[0]) && c[0].length >= 2) return [c[0][0], c[0][1]];
  }
  if (geom.type === 'LineString' && Array.isArray(c) && c.length) {
    const pts = c as number[][];
    const mid = Math.floor(pts.length / 2);
    return [pts[mid][0], pts[mid][1]];
  }
  if (geom.type === 'Polygon' && Array.isArray(c) && c[0]?.length) {
    return [c[0][0][0], c[0][0][1]];
  }
  if (geom.type === 'MultiPolygon' && Array.isArray(c) && c[0]) {
    const firstPoly = c[0] as number[][][];
    const firstRing = firstPoly?.[0];
    if (firstRing?.[0] && Array.isArray(firstRing[0]) && firstRing[0].length >= 2) {
      return [firstRing[0][0], firstRing[0][1]];
    }
  }
  return null;
}

function featureToRow(f: GeoFeature, orderOffset: number): Record<string, unknown> | null {
  const coords = getCentroid(f.geometry);
  if (!coords || coords.length < 2) return null;
  const [lng, lat] = coords;
  if (typeof lng !== 'number' || typeof lat !== 'number' || !Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  const p = f.properties || {};
  const desc = [
    p.type_ru ? `Тип: ${p.type_ru}` : null,
    p.district ? `Район: ${p.district}` : null,
    p.location_description,
    p.activities ? `Виды деятельности: ${p.activities}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  const geom = f.geometry?.type && f.geometry?.coordinates ? JSON.stringify(f.geometry) : null;
  return {
    name: p.name || 'Без названия',
    nameRu: p.name || null,
    region: p.region || 'Не указана',
    description: desc || null,
    lat: String(lat),
    lng: String(lng),
    geometry: geom,
    permitInfo: p.activities?.includes('подводная охота') ? 'Подводная охота по путёвке' : null,
    orderIndex: p.id ?? orderOffset,
  };
}

async function seedWaterBodies() {
  await db.delete(waterBodies).where(gt(waterBodies.id, 0));

  const rows: Record<string, unknown>[] = [];
  let order = 0;

  for (const filePath of GEOJSON_FILES) {
    try {
      const raw = readFileSync(filePath, 'utf-8');
      const geojson = JSON.parse(raw) as { features?: GeoFeature[] };
      const features = geojson.features || [];
      for (const f of features) {
        const row = featureToRow(f, ++order);
        if (row) {
          row.orderIndex = order;
          rows.push(row);
        }
      }
      console.log(`  ${path.basename(filePath)}: ${features.length} features`);
    } catch (err) {
      console.warn(`  ${path.basename(filePath)}: skip (${err instanceof Error ? err.message : err})`);
    }
  }

  const BATCH = 100;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    await db.insert(waterBodies).values(chunk);
  }

  console.log(`Loaded ${rows.length} water bodies from ${GEOJSON_FILES.length} file(s)`);
}

seedWaterBodies().catch((err) => {
  console.error(err);
  process.exit(1);
});
