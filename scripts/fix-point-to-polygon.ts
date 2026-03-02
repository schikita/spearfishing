/**
 * Исправляет объекты с type "Point" но несколькими координатами → Polygon или LineString.
 */
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';

const ROOT = path.join(process.cwd(), '..');
const FILES = ['vitebsk_waterbodies.geojson', 'grodno_waterbodies.geojson', 'minsk_waterbodies.geojson', 'brest_waterbodies.geojson'];

interface GeoFeature {
  type: string;
  geometry: { type: string; coordinates: unknown };
  properties: Record<string, unknown>;
}

function getCoordsArray(c: unknown): number[][] | null {
  if (!Array.isArray(c)) return null;
  if (c.length === 0) return null;
  const first = c[0];
  if (typeof first === 'number' && c.length >= 2) return null; // [lng, lat] - Point
  if (Array.isArray(first)) {
    if (typeof first[0] === 'number') return c as number[][]; // [[lng,lat], [lng,lat], ...]
    if (Array.isArray(first[0]) && typeof first[0][0] === 'number') return first as number[][]; // [[[lng,lat],...]]
  }
  return null;
}

function isClosedRing(ring: number[][]): boolean {
  if (ring.length < 4) return false;
  const [a, b] = ring[0];
  const [x, y] = ring[ring.length - 1];
  return Math.abs(a - x) < 1e-10 && Math.abs(b - y) < 1e-10;
}

function fixFeature(f: GeoFeature): boolean {
  if (f.geometry?.type !== 'Point') return false;
  const c = f.geometry.coordinates;
  if (!Array.isArray(c)) return false;
  if (c.length >= 2 && typeof c[0] === 'number') return false; // valid Point [lng, lat]

  const coords = getCoordsArray(c);
  if (!coords || coords.length < 2) return false;

  if (isClosedRing(coords)) {
    f.geometry = { type: 'Polygon', coordinates: [coords] };
  } else {
    f.geometry = { type: 'LineString', coordinates: coords };
  }
  return true;
}

function processFile(filePath: string): number {
  let fixed = 0;
  try {
    const raw = readFileSync(filePath, 'utf-8');
    const geojson = JSON.parse(raw) as { features?: GeoFeature[] };
    const features = geojson.features ?? [];
    for (const f of features) {
      if (fixFeature(f)) fixed++;
    }
    writeFileSync(filePath, JSON.stringify(geojson, null, 2), 'utf-8');
  } catch (e) {
    console.warn(`  ${path.basename(filePath)}: ${e instanceof Error ? e.message : e}`);
  }
  return fixed;
}

function main() {
  console.log('Исправление Point → Polygon/LineString...\n');
  let total = 0;
  for (const name of FILES) {
    const p = path.join(ROOT, name);
    try {
      const n = processFile(p);
      if (n > 0) {
        console.log(`  ${name}: исправлено ${n}`);
        total += n;
      }
    } catch {
      // skip if file not found
    }
  }
  console.log(`\nВсего исправлено: ${total}`);
}

main();
