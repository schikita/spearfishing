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
  const c = geom.coordinates as unknown;
  if (geom.type === 'Point' && Array.isArray(c)) {
    if (c.length >= 2 && typeof (c as number[])[0] === 'number') {
      const p = c as number[];
      return [p[0], p[1]];
    }
    const p0 = (c as unknown[])[0];
    if (Array.isArray(p0) && p0.length >= 2) return [Number(p0[0]), Number(p0[1])];
  }
  if (geom.type === 'LineString' && Array.isArray(c) && c.length) {
    const pts = c as number[][];
    const mid = Math.floor(pts.length / 2);
    const p = pts[mid];
    if (Array.isArray(p) && p.length >= 2) return [p[0], p[1]];
  }
  if (geom.type === 'Polygon' && Array.isArray(c) && (c as unknown[])[0]) {
    const ring = (c as number[][])[0];
    if (Array.isArray(ring) && ring[0] && Array.isArray(ring[0])) {
      const first = ring[0] as number[];
      return [first[0], first[1]];
    }
  }
  if (geom.type === 'MultiPolygon' && Array.isArray(c) && (c as unknown[])[0]) {
    const firstPoly = (c as number[][][])[0];
    const firstRing = firstPoly?.[0];
    const first = firstRing?.[0];
    if (Array.isArray(first) && first.length >= 2) return [first[0], first[1]];
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
