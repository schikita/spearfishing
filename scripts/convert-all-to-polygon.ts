/**
 * Конвертирует все геометрии водоёмов в Polygon.
 * - Point (одна точка) → маленький круг-полигон
 * - Point (несколько точек) → Polygon или LineString→Polygon
 * - LineString → Polygon через буфер
 * - Polygon, MultiPolygon → без изменений
 */
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import buffer from '@turf/buffer';
import { point, lineString } from '@turf/helpers';

const ROOT = path.join(process.cwd(), path.basename(process.cwd()) === 'scripts' ? '..' : '.');
const FILES = ['brest_waterbodies.geojson', 'minsk_waterbodies.geojson', 'grodno_waterbodies.geojson', 'vitebsk_waterbodies.geojson'];

const LINE_BUFFER_KM = 0.15;
const POINT_BUFFER_KM = 0.002; // ~2 м — маленькая точка на карте

interface GeoFeature {
  type: string;
  geometry: { type: string; coordinates: unknown };
  properties: Record<string, unknown>;
}

function getCoordsArray(c: unknown): number[][] | null {
  if (!Array.isArray(c)) return null;
  if (c.length === 0) return null;
  const first = c[0];
  if (typeof first === 'number' && c.length >= 2) return null;
  if (Array.isArray(first)) {
    if (typeof first[0] === 'number') return c as number[][];
    if (Array.isArray(first[0]) && typeof first[0][0] === 'number') return first as number[][];
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
  const g = f.geometry;
  if (!g?.coordinates) return false;

  if (g.type === 'Polygon' || g.type === 'MultiPolygon') return false;

  if (g.type === 'Point') {
    const c = g.coordinates as number[] | number[][];
    if (Array.isArray(c) && c.length >= 2 && typeof c[0] === 'number') {
      const pt = point(c as [number, number]);
      const buffered = buffer(pt, POINT_BUFFER_KM, { units: 'kilometers' });
      if (buffered?.geometry?.type === 'Polygon' && buffered.geometry.coordinates) {
        f.geometry = buffered.geometry as { type: 'Polygon'; coordinates: number[][][] };
        return true;
      }
    }
    const coords = getCoordsArray(c);
    if (coords && coords.length >= 2) {
      if (isClosedRing(coords)) {
        f.geometry = { type: 'Polygon', coordinates: [coords] };
      } else {
        const line = lineString(coords);
        const buffered = buffer(line, LINE_BUFFER_KM, { units: 'kilometers' });
        if (buffered?.geometry?.type === 'Polygon' && buffered.geometry.coordinates) {
          f.geometry = buffered.geometry as { type: 'Polygon'; coordinates: number[][][] };
        } else {
          f.geometry = { type: 'LineString', coordinates: coords };
        }
      }
      return true;
    }
    return false;
  }

  if (g.type === 'LineString') {
    const c = g.coordinates as number[][];
    if (!Array.isArray(c) || c.length < 2) return false;
    try {
      const line = lineString(c);
      const buffered = buffer(line, LINE_BUFFER_KM, { units: 'kilometers' });
      if (buffered?.geometry?.type === 'Polygon' && buffered.geometry.coordinates) {
        f.geometry = buffered.geometry as { type: 'Polygon'; coordinates: number[][][] };
        return true;
      }
    } catch {
      // ignore
    }
  }
  return false;
}

function processFile(filePath: string): { fixed: number; types: Record<string, number> } {
  let fixed = 0;
  try {
    const raw = readFileSync(filePath, 'utf-8');
    const geojson = JSON.parse(raw) as { features?: GeoFeature[] };
    const features = geojson.features ?? [];
    for (const f of features) {
      if (fixFeature(f)) fixed++;
    }
    const types: Record<string, number> = {};
    for (const f of features) {
      const t = f.geometry?.type ?? 'unknown';
      types[t] = (types[t] || 0) + 1;
    }
    writeFileSync(filePath, JSON.stringify(geojson, null, 2), 'utf-8');
    return { fixed, types };
  } catch (e) {
    console.warn(`  ${path.basename(filePath)}: ${e instanceof Error ? e.message : e}`);
    return { fixed: 0, types: {} };
  }
}

function main() {
  console.log('Конвертация всех геометрий в Polygon...\n');
  let total = 0;
  for (const name of FILES) {
    const p = path.join(ROOT, name);
    try {
      const { fixed, types } = processFile(p);
      const summary = Object.entries(types)
        .filter(([k]) => !k.startsWith('_'))
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
      console.log(`  ${name}: исправлено ${fixed} | после: ${summary}`);
      total += fixed;
    } catch (e) {
      console.warn(`  ${name}: ${e instanceof Error ? e.message : e}`);
    }
  }
  console.log(`\nВсего конвертировано: ${total}`);
}

main();
