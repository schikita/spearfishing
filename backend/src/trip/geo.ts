export interface GeoJsonGeom {
  type: string;
  coordinates: unknown;
}

export function parseGeom(raw: string | null | undefined): GeoJsonGeom | null {
  if (!raw) return null;
  try {
    const g = JSON.parse(raw) as GeoJsonGeom;
    if (!g || typeof g.type !== 'string' || g.coordinates == null) return null;
    return g;
  } catch {
    return null;
  }
}

export function distanceM(lng1: number, lat1: number, lng2: number, lat2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

function ringContains(ring: number[][], lng: number, lat: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    if (xi == null || yi == null || xj == null || yj == null) continue;
    const intersect = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi + 0.0) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function polygonContains(rings: number[][][], lng: number, lat: number): boolean {
  if (!rings.length || !ringContains(rings[0], lng, lat)) return false;
  for (let h = 1; h < rings.length; h++) {
    if (ringContains(rings[h], lng, lat)) return false;
  }
  return true;
}

export function pointInGeom(lng: number, lat: number, geom: GeoJsonGeom, radiusM?: number | null): boolean {
  if (geom.type === 'Point') {
    const c = geom.coordinates as number[];
    if (!Array.isArray(c) || c.length < 2) return false;
    const r = radiusM != null && radiusM > 0 ? radiusM : 0;
    if (r <= 0) return false;
    return distanceM(lng, lat, c[0], c[1]) <= r;
  }
  if (geom.type === 'Polygon') {
    return polygonContains(geom.coordinates as number[][][], lng, lat);
  }
  if (geom.type === 'MultiPolygon') {
    const polys = geom.coordinates as number[][][][];
    return polys.some((poly) => polygonContains(poly, lng, lat));
  }
  if (geom.type === 'LineString') {
    const line = geom.coordinates as number[][];
    const r = radiusM != null && radiusM > 0 ? radiusM : 150;
    return line.some((p) => Array.isArray(p) && p.length >= 2 && distanceM(lng, lat, p[0], p[1]) <= r);
  }
  return false;
}

export function centroid(geom: GeoJsonGeom | null): [number, number] | null {
  if (!geom) return null;
  if (geom.type === 'Point' && Array.isArray(geom.coordinates)) {
    const c = geom.coordinates as number[];
    if (c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1])) return [c[0], c[1]];
  }
  const points = collectPoints(geom).slice(0, 400);
  if (!points.length) return null;
  let lng = 0;
  let lat = 0;
  for (const p of points) {
    lng += p[0];
    lat += p[1];
  }
  return [lng / points.length, lat / points.length];
}

function collectPoints(geom: GeoJsonGeom): number[][] {
  const out: number[][] = [];
  const walk = (node: unknown): void => {
    if (!Array.isArray(node) || !node.length) return;
    if (typeof node[0] === 'number' && typeof node[1] === 'number') {
      out.push(node as number[]);
      return;
    }
    for (const child of node) walk(child);
  };
  walk(geom.coordinates);
  return out;
}

export function bbox(geom: GeoJsonGeom | null): [number, number, number, number] | null {
  const pts = geom ? collectPoints(geom) : [];
  if (!pts.length) return null;
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const p of pts) {
    minLng = Math.min(minLng, p[0]);
    minLat = Math.min(minLat, p[1]);
    maxLng = Math.max(maxLng, p[0]);
    maxLat = Math.max(maxLat, p[1]);
  }
  return [minLng, minLat, maxLng, maxLat];
}

function bboxOverlap(a: [number, number, number, number], b: [number, number, number, number], pad = 0): boolean {
  return a[0] - pad <= b[2] && a[2] + pad >= b[0] && a[1] - pad <= b[3] && a[3] + pad >= b[1];
}

/** Грубая проверка пересечения: центроид или вершины одной геометрии внутри другой. */
export function geometriesTouch(a: GeoJsonGeom, b: GeoJsonGeom): boolean {
  const ba = bbox(a);
  const bb = bbox(b);
  if (ba && bb && !bboxOverlap(ba, bb, 0.02)) return false;
  const ca = centroid(a);
  const cb = centroid(b);
  if (ca && pointInGeom(ca[0], ca[1], b, numberOrNull(b))) return true;
  if (cb && pointInGeom(cb[0], cb[1], a, numberOrNull(a))) return true;
  const sample = collectPoints(b).filter((_, i) => i % Math.ceil(collectPoints(b).length / 24) === 0).slice(0, 24);
  return sample.some((p) => pointInGeom(p[0], p[1], a));
}

function numberOrNull(geom: GeoJsonGeom): number | null {
  if (geom.type === 'LineString') return 150;
  return null;
}

export function geometryAccuracyFor(type: string | undefined): 'exact' | 'approximate' | 'point_only' | 'unknown' {
  if (type === 'Point') return 'point_only';
  if (type === 'Polygon' || type === 'MultiPolygon' || type === 'LineString' || type === 'MultiLineString') {
    return 'approximate';
  }
  return 'unknown';
}
