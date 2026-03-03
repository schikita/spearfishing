/**
 * Загрузка геометрии водоёмов Гомельской области из OpenStreetMap.
 * Для объектов с geometry: null использует приблизительные координаты районов.
 */
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import https from 'https';

const OVERPASS_HOST = 'overpass-api.de';
const OVERPASS_PATH = '/api/interpreter';
const ROOT = path.join(process.cwd(), path.basename(process.cwd()) === 'scripts' ? '..' : '.');
const INPUT_FILE = path.join(ROOT, 'gomel_waterbodies.geojson');
const OUTPUT_FILE = path.join(ROOT, 'gomel_waterbodies.geojson');

// Гомельская область: юг, запад, север, восток
const GOMEL_BBOX = '51.5,27.0,53.2,31.6';

// Приблизительные центры районов Гомельской области [lat, lon]
const DISTRICT_CENTERS: Record<string, [number, number]> = {
  Брагинский: [51.78, 30.27],
  'Буда-Кошелевский': [52.72, 30.57],
  Ветковский: [52.55, 31.18],
  Гомель: [52.43, 30.98],
  Гомельский: [52.43, 30.98],
  Добрушский: [52.42, 31.32],
  Ельский: [51.82, 29.15],
  Ельска: [51.82, 29.15],
  Житковичский: [52.22, 27.86],
  Жлобинский: [52.9, 30.02],
  Калинковичский: [52.13, 29.33],
  Кормянский: [53.13, 30.8],
  Лельчицкий: [51.78, 28.32],
  Лоевский: [51.95, 30.5],
  Мозырский: [52.05, 29.25],
  Наровлянский: [51.8, 29.5],
  Октябрьский: [52.65, 28.9],
  Петриковский: [52.13, 28.5],
  Речицкий: [52.37, 30.38],
  Рогачевский: [53.08, 30.05],
  Светлогорский: [52.63, 29.73],
  Хойникский: [51.9, 29.9],
  Чечерск: [52.92, 30.92],
  Чечерский: [52.92, 30.92],
};

interface GeoFeature {
  type: string;
  geometry: { type: string; coordinates: unknown } | null;
  properties: Record<string, unknown>;
}

interface OverpassElement {
  type: string;
  id: number;
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
  members?: Array<{ type: string; ref: number; role: string; geometry?: { lat: number; lon: number }[] }>;
  center?: { lat: number; lon: number };
}

interface OverpassResponse {
  elements: OverpassElement[];
}

function osmToGeoJSON(elem: OverpassElement): { type: string; coordinates: unknown } | null {
  if (elem.type === 'way' && elem.geometry?.length) {
    const coords = elem.geometry.map((p) => [p.lon, p.lat] as [number, number]);
    const closed =
      coords.length >= 4 &&
      Math.abs(coords[0][0] - coords[coords.length - 1][0]) < 1e-10 &&
      Math.abs(coords[0][1] - coords[coords.length - 1][1]) < 1e-10;
    return closed ? { type: 'Polygon', coordinates: [coords] } : { type: 'LineString', coordinates: coords };
  }
  if (elem.type === 'relation' && elem.members?.length) {
    const outer = elem.members.filter((m) => m.role === 'outer' && m.geometry?.length);
    if (outer.length === 0) return null;
    const rings = outer
      .map((m) => {
        const g = m.geometry!;
        const c = g.map((p) => [p.lon, p.lat] as [number, number]);
        if (c.length < 4) return null;
        if (Math.abs(c[0][0] - c[c.length - 1][0]) > 1e-10 || Math.abs(c[0][1] - c[c.length - 1][1]) > 1e-10) {
          c.push(c[0]);
        }
        return c;
      })
      .filter(Boolean) as number[][][];
    if (rings.length === 0) return null;
    return rings.length === 1
      ? { type: 'Polygon', coordinates: rings }
      : { type: 'MultiPolygon', coordinates: rings.map((r) => [r]) };
  }
  return null;
}

function dist(lat1: number, lon1: number, lat2: number, lon2: number): number {
  return Math.hypot(lat1 - lat2, lon1 - lon2);
}

function elemCenter(elem: OverpassElement): { lat: number; lon: number } | null {
  if (elem.center) return elem.center;
  if (elem.geometry?.length) {
    const g = elem.geometry;
    return { lat: g.reduce((s, p) => s + p.lat, 0) / g.length, lon: g.reduce((s, p) => s + p.lon, 0) / g.length };
  }
  const m = elem.members?.[0] as OverpassElement | undefined;
  if (m?.geometry?.length) {
    const g = m.geometry;
    return { lat: g.reduce((s, p) => s + p.lat, 0) / g.length, lon: g.reduce((s, p) => s + p.lon, 0) / g.length };
  }
  return null;
}

function queryOverpass(query: string): Promise<OverpassResponse> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: OVERPASS_HOST,
        path: OVERPASS_PATH,
        method: 'POST',
        rejectUnauthorized: process.env.NODE_TLS_REJECT_UNAUTHORIZED === '1',
        headers: {
          'Content-Type': 'text/plain',
          'Content-Length': Buffer.byteLength(query),
          'User-Agent': 'SpearfishingBY/1.0 (Belarus water bodies)',
        },
      },
      (res) => {
        let data = '';
        res.on('data', (ch) => (data += ch));
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`Overpass: ${res.statusCode} ${res.statusMessage}`));
            return;
          }
          try {
            resolve(JSON.parse(data) as OverpassResponse);
          } catch {
            reject(new Error(`Invalid JSON: ${data.slice(0, 200)}...`));
          }
        });
      }
    );
    req.on('error', reject);
    req.write(query);
    req.end();
  });
}

async function fetchAllWater(): Promise<OverpassElement[]> {
  const query = `
    [out:json][timeout:120];
    (
      way["natural"="water"](${GOMEL_BBOX});
      relation["natural"="water"]["type"="multipolygon"](${GOMEL_BBOX});
    );
    out geom;
  `;
  const data = await queryOverpass(query);
  return (data.elements ?? []).filter((e) => e.type === 'way' || e.type === 'relation');
}

async function fetchAllRivers(): Promise<OverpassElement[]> {
  const query = `
    [out:json][timeout:120];
    (
      way["waterway"="river"](${GOMEL_BBOX});
      way["waterway"="stream"]["intermittent"!="yes"](${GOMEL_BBOX});
      way["waterway"="canal"](${GOMEL_BBOX});
    );
    out geom;
  `;
  const data = await queryOverpass(query);
  return (data.elements ?? []).filter((e) => e.type === 'way');
}

function extractNameHint(name: string): string {
  const m = name.match(/^(?:Река|Озеро|Пруд|Водохранилище)\s+([^(]+)/);
  return (m ? m[1] : name).trim().replace(/\s*\(.*$/, '');
}

function findBestWater(
  elements: OverpassElement[],
  targetLat: number,
  targetLon: number,
  nameHint: string
): OverpassElement | null {
  if (elements.length === 0) return null;
  const hint = extractNameHint(nameHint).toLowerCase();
  const nameParts = hint.replace(/[^\p{L}\s]/gu, '').split(/\s+/).filter((s) => s.length >= 2);
  const score = (e: OverpassElement) => {
    const c = elemCenter(e);
    if (!c) return -1e9;
    const d = dist(targetLat, targetLon, c.lat, c.lon);
    let s = -d * 100;
    const name = (e.tags?.name ?? e.tags?.['name:ru'] ?? '').toLowerCase();
    for (const part of nameParts) {
      if (part.length >= 3 && name.includes(part)) s += 200;
    }
    const geom = e.geometry ?? (e.members?.[0] as OverpassElement)?.geometry;
    if (geom && geom.length > 8) s += 40;
    return s;
  };
  elements.sort((a, b) => score(b) - score(a));
  const best = elements[0];
  const c = elemCenter(best);
  if (!c || dist(targetLat, targetLon, c.lat, c.lon) > 0.3) return null;
  return best;
}

function findBestRiver(
  elements: OverpassElement[],
  targetLat: number,
  targetLon: number,
  nameHint: string
): OverpassElement | null {
  if (elements.length === 0) return null;
  const hint = extractNameHint(nameHint).toLowerCase();
  const nameParts = hint.replace(/[^\p{L}\s]/gu, '').split(/\s+/).filter((s) => s.length >= 2);
  const score = (e: OverpassElement) => {
    const geom = e.geometry;
    if (!geom?.length) return -1e9;
    let minD = 1e9;
    for (const p of geom) {
      const d = dist(targetLat, targetLon, p.lat, p.lon);
      if (d < minD) minD = d;
    }
    let s = -minD * 100;
    const name = (e.tags?.name ?? e.tags?.['name:ru'] ?? '').toLowerCase();
    for (const part of nameParts) {
      if (part.length >= 3 && name.includes(part)) s += 300;
    }
    if (geom.length > 15) s += 20;
    return s;
  };
  elements.sort((a, b) => score(b) - score(a));
  const best = elements[0];
  const geom = best.geometry;
  if (!geom?.length) return null;
  let minD = 1e9;
  for (const p of geom) {
    const d = dist(targetLat, targetLon, p.lat, p.lon);
    if (d < minD) minD = d;
  }
  if (minD > 0.25) return null;
  return best;
}

async function main() {
  const raw = readFileSync(INPUT_FILE, 'utf-8');
  const geojson = JSON.parse(raw) as { type: string; metadata: Record<string, unknown>; features: GeoFeature[] };
  const features = geojson.features ?? [];

  console.log('Загрузка геометрии Гомельской области из OpenStreetMap...\n');

  let waterElements: OverpassElement[] = [];
  let riverElements: OverpassElement[] = [];

  try {
    console.log('  Запрос водоёмов (озёра, пруды, водохранилища)...');
    waterElements = await fetchAllWater();
    console.log(`  Найдено ${waterElements.length} объектов\n`);
  } catch (e) {
    console.error('  Ошибка:', e instanceof Error ? e.message : e);
  }

  try {
    console.log('  Запрос рек и каналов...');
    riverElements = await fetchAllRivers();
    console.log(`  Найдено ${riverElements.length} объектов\n`);
  } catch (e) {
    console.error('  Ошибка:', e instanceof Error ? e.message : e);
  }

  const isRiverOrCanal = (t: string) => t === 'river' || t === 'canal';
  let updated = 0;

  for (const f of features) {
    const district = (f.properties?.district as string) ?? '';
    const center = DISTRICT_CENTERS[district] ?? [52.43, 30.98];
    const [lat, lon] = center;

    const name = (f.properties?.name as string) ?? '';
    const featureType = (f.properties?.type as string) ?? 'lake';
    const id = (f.properties?.id as number) ?? 0;

    process.stdout.write(`  [${id}] ${name}... `);

    let best: OverpassElement | null = null;
    if (isRiverOrCanal(featureType)) {
      best = findBestRiver(riverElements, lat, lon, name);
    } else {
      best = findBestWater(waterElements, lat, lon, name);
    }

    const newGeom = best ? osmToGeoJSON(best) : null;
    if (newGeom) {
      f.geometry = newGeom;
      (f.properties as Record<string, string>).coordinate_source = 'osm_geometry';
      updated++;
      console.log('OK');
    } else {
      f.geometry = { type: 'Point', coordinates: [lon, lat] };
      (f.properties as Record<string, string>).coordinate_source = 'district_center';
      console.log('точка');
    }
  }

  geojson.metadata = geojson.metadata ?? {};
  (geojson.metadata as Record<string, unknown>).updated_from_osm = new Date().toISOString().slice(0, 10);

  writeFileSync(OUTPUT_FILE, JSON.stringify(geojson, null, 2), 'utf-8');
  console.log(`\nОбновлено ${updated} из ${features.length}. Файл: ${OUTPUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
