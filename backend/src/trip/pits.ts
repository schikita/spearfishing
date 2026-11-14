import { bbox, centroid, distanceM, geometriesTouch, parseGeom, pointInGeom, type GeoJsonGeom } from './geo.js';

export interface PitRow {
  id: number;
  waterBodyId: number | null;
  name: string;
  region: string | null;
  waterBodyNameRaw: string | null;
  geometry: string | null;
  radiusM: string | null;
  boundaryAccuracy: string;
  banFrom: string | null;
  banTo: string | null;
  isYearRound: number;
  sourceTitle: string | null;
  sourceUrl: string | null;
  sourceDate: string | null;
  status: string;
  notes: string | null;
}

export function pitActiveOn(pit: Pick<PitRow, 'status' | 'isYearRound' | 'banFrom' | 'banTo'>, dateISO: string): boolean {
  if (pit.status === 'inactive') return false;
  if (pit.isYearRound === 1) return true;
  const from = pit.banFrom?.trim() || '';
  const to = pit.banTo?.trim() || '';
  if (!from && !to) return true;
  if (/^\d{2}-\d{2}$/.test(from) && /^\d{2}-\d{2}$/.test(to)) {
    const md = dateISO.slice(5, 10);
    if (from <= to) return md >= from && md <= to;
    return md >= from || md <= to;
  }
  if (from && dateISO < from) return false;
  if (to && dateISO > to) return false;
  return true;
}

export function banPeriodLabel(pit: Pick<PitRow, 'isYearRound' | 'banFrom' | 'banTo'>): string {
  if (pit.isYearRound === 1) return 'круглый год';
  if (pit.banFrom && pit.banTo) return `${pit.banFrom} — ${pit.banTo}`;
  if (pit.banFrom || pit.banTo) return pit.banFrom || pit.banTo || 'период не указан';
  return 'период не указан';
}

export function boundariesUncertain(accuracy: string | null | undefined): boolean {
  return accuracy !== 'exact';
}

function norm(value: string | null | undefined): string {
  return (value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function radiusOf(pit: PitRow): number | null {
  if (pit.radiusM == null || pit.radiusM === '') return null;
  const n = Number(pit.radiusM);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export interface PitHit {
  id: number;
  name: string;
  waterBodyId: number | null;
  boundaryAccuracy: string;
  boundariesUncertain: boolean;
  banPeriod: string;
  sourceTitle: string | null;
  sourceUrl: string | null;
  sourceDate: string | null;
  notes: string | null;
  contourMissing: boolean;
}

export function toHit(pit: PitRow): PitHit {
  const geom = parseGeom(pit.geometry);
  return {
    id: pit.id,
    name: pit.name,
    waterBodyId: pit.waterBodyId,
    boundaryAccuracy: pit.boundaryAccuracy || 'unknown',
    boundariesUncertain: boundariesUncertain(pit.boundaryAccuracy),
    banPeriod: banPeriodLabel(pit),
    sourceTitle: pit.sourceTitle,
    sourceUrl: pit.sourceUrl,
    sourceDate: pit.sourceDate,
    notes: pit.notes,
    contourMissing: !geom,
  };
}

export function pitsForWater(water: { id: number; name: string; nameRu?: string | null; region: string; geometry?: string | null }, pits: PitRow[], dateISO: string): PitHit[] {
  const active = pits.filter((p) => pitActiveOn(p, dateISO));
  const names = new Set([norm(water.name), norm(water.nameRu)]);
  const waterGeom = parseGeom(water.geometry);
  const hits: PitHit[] = [];
  for (const pit of active) {
    const linkedById = pit.waterBodyId != null && pit.waterBodyId === water.id;
    const linkedByName =
      norm(pit.region) === norm(water.region) &&
      (names.has(norm(pit.waterBodyNameRaw)) || names.has(norm(pit.name)));
    let linkedByGeom = false;
    const pitGeom = parseGeom(pit.geometry);
    if (waterGeom && pitGeom) {
      if (pitGeom.type === 'Point') {
        const c = pitGeom.coordinates as number[];
        const r = radiusOf(pit);
        if (c?.length >= 2) linkedByGeom = pointInGeom(c[0], c[1], waterGeom, r);
      } else {
        linkedByGeom = geometriesTouch(waterGeom, pitGeom);
      }
    }
    if (linkedById || linkedByName || linkedByGeom) hits.push(toHit(pit));
  }
  return hits;
}

export function checkPoint(lat: number, lng: number, pits: PitRow[], dateISO: string): {
  inside: PitHit[];
  nearby: PitHit[];
  boundariesUncertain: boolean;
} {
  const inside: PitHit[] = [];
  const nearby: PitHit[] = [];
  for (const pit of pits) {
    if (!pitActiveOn(pit, dateISO)) continue;
    const geom = parseGeom(pit.geometry);
    if (!geom) continue;
    const radius = radiusOf(pit);
    const hit = pointInGeom(lng, lat, geom, radius);
    if (hit) {
      inside.push(toHit(pit));
      continue;
    }
    const c = centroid(geom);
    if (!c) continue;
    const dist = distanceM(lng, lat, c[0], c[1]);
    const nearLimit = (radius ?? 0) + 500;
    const box = bbox(geom);
    const edgePad = box ? Math.max(nearLimit, 500) : 500;
    if (dist <= edgePad) nearby.push(toHit(pit));
  }
  const all = [...inside, ...nearby];
  return {
    inside,
    nearby,
    boundariesUncertain: all.some((p) => p.boundariesUncertain),
  };
}
