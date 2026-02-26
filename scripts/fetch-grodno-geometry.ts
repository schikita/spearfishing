/**
 * Скрипт для получения полигонов/линий водоёмов Гродненской области из OpenStreetMap.
 * Один запрос на весь регион, затем сопоставление по координатам.
 */
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import https from 'https';

const OVERPASS_HOST = 'overpass-api.de';
const OVERPASS_PATH = '/api/interpreter';
const ROOT = path.join(process.cwd(), '..');
const INPUT_FILE = path.join(ROOT, 'grodno_waterbodies.geojson');
const OUTPUT_FILE = path.join(ROOT, 'grodno_waterbodies.geojson');

// Гродненская область: юг, запад, север, восток
const GRODNO_BBOX = '52.9,23.5,54.7,27.2';

interface GeoFeature {
  type: string;
  geometry: { type: string; coordinates: unknown };
  properties: Record<string, unknown>;
}

interface OverpassNode {
  lat: number;
  lon: number;
}

interface OverpassElement {
  type: string;
  id: number;
  tags?: Record<string, string>;
  geometry?: OverpassNode[];
  nodes?: number[];
  members?: Array<{ type: string; ref: number; role: string; geometry?: OverpassNode[] }>;
  center?: { lat: number; lon: number };
  bounds?: { minlat: number; minlon: number; maxlat: number; maxlon: number };
}

interface OverpassResponse {
  elements: OverpassElement[];
}

function osmToGeoJSON(elem: OverpassElement): { type: string; coordinates: unknown } | null {
  if (elem.type === 'way' && elem.geometry?.length) {
    const coords = elem.geometry.map((p) => [p.lon, p.lat] as [number, number]);
    const closed = coords.length >= 4 && coords[0][0] === coords[coords.length - 1][0] && coords[0][1] === coords[coords.length - 1][1];
    return closed ? { type: 'Polygon', coordinates: [coords] } : { type: 'LineString', coordinates: coords };
  }
  if (elem.type === 'relation' && elem.members?.length) {
    const outer = elem.members.filter((m) => m.role === 'outer' && m.geometry?.length);
    if (outer.length === 0) return null;
    const rings = outer.map((m) => {
      const g = m.geometry!;
      const c = g.map((p) => [p.lon, p.lat] as [number, number]);
      if (c.length < 4) return null;
      if (c[0][0] !== c[c.length - 1][0] || c[0][1] !== c[c.length - 1][1]) c.push(c[0]);
      return c;
    }).filter(Boolean) as number[][][];
    if (rings.length === 0) return null;
    return rings.length === 1 ? { type: 'Polygon', coordinates: rings } : { type: 'MultiPolygon', coordinates: rings.map((r) => [r]) };
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
    [out:json][timeout:90];
    (
      way["natural"="water"](${GRODNO_BBOX});
      relation["natural"="water"]["type"="multipolygon"](${GRODNO_BBOX});
    );
    out geom;
  `;
  const data = await queryOverpass(query);
  return (data.elements ?? []).filter((e) => e.type === 'way' || e.type === 'relation');
}

async function fetchAllRivers(): Promise<OverpassElement[]> {
  const query = `
    [out:json][timeout:90];
    (
      way["waterway"="river"](${GRODNO_BBOX});
      way["waterway"="stream"]["intermittent"!="yes"](${GRODNO_BBOX});
      way["waterway"="canal"](${GRODNO_BBOX});
    );
    out geom;
  `;
  const data = await queryOverpass(query);
  return (data.elements ?? []).filter((e) => e.type === 'way');
}

function findBestWater(
  elements: OverpassElement[],
  targetLat: number,
  targetLon: number,
  nameHint: string
): OverpassElement | null {
  if (elements.length === 0) return null;
  const nameParts = nameHint.toLowerCase().replace(/[^\p{L}\s]/gu, '').split(/\s+/).filter(Boolean);
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
    if (geom && geom.length > 10) s += 50;
    return s;
  };
  elements.sort((a, b) => score(b) - score(a));
  const best = elements[0];
  const c = elemCenter(best);
  if (!c || dist(targetLat, targetLon, c.lat, c.lon) > 0.2) return null;
  return best;
}

function findBestRiver(
  elements: OverpassElement[],
  targetLat: number,
  targetLon: number,
  nameHint: string
): OverpassElement | null {
  if (elements.length === 0) return null;
  const nameParts = nameHint.toLowerCase().replace(/[^\p{L}\s]/gu, '').split(/\s+/).filter(Boolean);
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
      if (part.length >= 3 && (name.includes(part) || part === 'неман' && name.includes('nieman'))) s += 300;
    }
    if (geom.length > 20) s += 30;
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
  if (minD > 0.15) return null;
  return best;
}

async function main() {
  const raw = readFileSync(INPUT_FILE, 'utf-8');
  const geojson = JSON.parse(raw) as { type: string; metadata: Record<string, unknown>; features: GeoFeature[] };
  const features = geojson.features ?? [];

  console.log('Загрузка геометрии из OpenStreetMap...\n');

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
  for (let i = 0; i < features.length; i++) {
    const f = features[i];
    const geom = f.geometry;
    if (geom.type !== 'Point' || !Array.isArray(geom.coordinates)) continue;
    const [lon, lat] = geom.coordinates as number[];
    const name = (f.properties?.name as string) ?? '';
    const featureType = (f.properties?.type as string) ?? 'lake';

    process.stdout.write(`  [${i + 1}/${features.length}] ${name}... `);

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
      console.log('—');
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
