import { readFileSync } from 'fs';
import path from 'path';
import { db, waterBodies } from './index.js';
import { gt } from 'drizzle-orm';

// По умолчанию: brest_waterbodies.geojson в корне проекта
const GEOJSON_PATH =
  process.env.WATERBODIES_GEOJSON ||
  path.join(process.cwd(), '..', 'brest_waterbodies.geojson');

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
  if (!geom?.coordinates) return null;
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
    const first = c[0];
    if (Array.isArray(first) && first[0] && Array.isArray(first[0])) return [first[0][0], first[0][1]];
    if (Array.isArray(first) && typeof first[0] === 'number') return [first[0], first[1]];
  }
  return null;
}

async function seedWaterBodies() {
  const raw = readFileSync(GEOJSON_PATH, 'utf-8');
  const geojson = JSON.parse(raw) as { features?: GeoFeature[] };
  const features = geojson.features || [];
  if (!features.length) {
    console.log('No features in GeoJSON');
    return;
  }

  await db.delete(waterBodies).where(gt(waterBodies.id, 0));

  const rows = features
    .map((f) => {
      const coords = getCentroid(f.geometry);
      if (!coords || coords.length < 2) return null;
      const [lng, lat] = coords;
      if (typeof lng !== 'number' || typeof lat !== 'number' || !Number.isFinite(lng) || !Number.isFinite(lat)) return null;
      const p = f.properties || {};
      const desc = [
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
        orderIndex: p.id ?? 0,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const BATCH = 100;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    await db.insert(waterBodies).values(chunk);
  }

  console.log(`Loaded ${rows.length} water bodies from ${path.basename(GEOJSON_PATH)}`);
}

seedWaterBodies().catch((err) => {
  console.error(err);
  process.exit(1);
});
