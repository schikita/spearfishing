import { and, desc, eq } from 'drizzle-orm';
import { db, weatherCache } from '../db/index.js';

const GRID = 0.25;
const TTL_MS = 6 * 60 * 60 * 1000;

export interface GridWeather {
  gridLat: string;
  gridLng: string;
  fetchedAt: string;
  precipMm3d: number | null;
  precipMm7d: number | null;
  sunshineHours7d: number | null;
  airTempMean7d: number | null;
  windSpeedMs: number | null;
  windDirDeg: number | null;
  pressureHpa: number | null;
  airTempC: number | null;
  waterTempC: number | null;
  freshness: 'ok' | 'stale' | 'missing';
}

export function gridKey(lat: number, lng: number): { gridLat: string; gridLng: string } {
  const gLat = Math.round(lat / GRID) * GRID;
  const gLng = Math.round(lng / GRID) * GRID;
  return { gridLat: gLat.toFixed(2), gridLng: gLng.toFixed(2) };
}

function num(value: string | null | undefined): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function freshnessOf(fetchedAt: string | null | undefined): 'ok' | 'stale' | 'missing' {
  if (!fetchedAt) return 'missing';
  const age = Date.now() - new Date(fetchedAt).getTime();
  if (!Number.isFinite(age)) return 'missing';
  return age <= TTL_MS ? 'ok' : 'stale';
}

type CacheRow = {
  gridLat: string;
  gridLng: string;
  fetchedAt: string;
  precipMm3d: string | null;
  precipMm7d: string | null;
  sunshineHours7d: string | null;
  airTempMean7d: string | null;
  windSpeedMs: string | null;
  windDirDeg: string | null;
  pressureHpa: string | null;
  airTempC: string | null;
  waterTempC: string | null;
};

export function toGrid(row: CacheRow | undefined): GridWeather {
  if (!row) {
    return {
      gridLat: '',
      gridLng: '',
      fetchedAt: '',
      precipMm3d: null,
      precipMm7d: null,
      sunshineHours7d: null,
      airTempMean7d: null,
      windSpeedMs: null,
      windDirDeg: null,
      pressureHpa: null,
      airTempC: null,
      waterTempC: null,
      freshness: 'missing',
    };
  }
  return {
    gridLat: row.gridLat,
    gridLng: row.gridLng,
    fetchedAt: row.fetchedAt,
    precipMm3d: num(row.precipMm3d),
    precipMm7d: num(row.precipMm7d),
    sunshineHours7d: num(row.sunshineHours7d),
    airTempMean7d: num(row.airTempMean7d),
    windSpeedMs: num(row.windSpeedMs),
    windDirDeg: num(row.windDirDeg),
    pressureHpa: num(row.pressureHpa),
    airTempC: num(row.airTempC),
    waterTempC: num(row.waterTempC),
    freshness: freshnessOf(row.fetchedAt),
  };
}

export async function readGridWeather(lat: number, lng: number): Promise<GridWeather> {
  const key = gridKey(lat, lng);
  const rows = await db
    .select()
    .from(weatherCache)
    .where(and(eq(weatherCache.gridLat, key.gridLat), eq(weatherCache.gridLng, key.gridLng)))
    .orderBy(desc(weatherCache.fetchedAt))
    .limit(1);
  const weather = toGrid(rows[0] as CacheRow | undefined);
  weather.gridLat = key.gridLat;
  weather.gridLng = key.gridLng;
  return weather;
}

function sumLast(values: Array<number | null>, days: number): number | null {
  const slice = values.slice(-days);
  const nums = slice.filter((v): v is number => v != null && Number.isFinite(v));
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0);
}

function avgLast(values: Array<number | null>, days: number): number | null {
  const slice = values.slice(-days);
  const nums = slice.filter((v): v is number => v != null && Number.isFinite(v));
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export async function refreshGridWeather(lat: number, lng: number): Promise<GridWeather | null> {
  const key = gridKey(lat, lng);
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${key.gridLat}&longitude=${key.gridLng}` +
    '&past_days=7&forecast_days=1' +
    '&daily=precipitation_sum,sunshine_duration,temperature_2m_mean' +
    '&current=temperature_2m,wind_speed_10m,wind_direction_10m,surface_pressure' +
    '&timezone=Europe%2FMinsk';
  let payload: {
    daily?: {
      precipitation_sum?: Array<number | null>;
      sunshine_duration?: Array<number | null>;
      temperature_2m_mean?: Array<number | null>;
    };
    current?: {
      temperature_2m?: number;
      wind_speed_10m?: number;
      wind_direction_10m?: number;
      surface_pressure?: number;
    };
  };
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    payload = await res.json();
  } catch {
    return null;
  }
  const daily = payload.daily;
  if (!daily) return null;
  const precip = daily.precipitation_sum ?? [];
  const precip7 = sumLast(precip, 7);
  const precip3 = sumLast(precip, 3);
  if (precip7 == null || precip3 == null) return null;
  const sunSec = sumLast(daily.sunshine_duration ?? [], 7);
  const sunHours = sunSec == null ? null : sunSec / 3600;
  const tempMean = avgLast(daily.temperature_2m_mean ?? [], 7);
  const current = payload.current ?? {};
  const waterTemp = tempMean == null ? null : Math.max(0, tempMean - 2);
  const now = new Date().toISOString();
  const values = {
    gridLat: key.gridLat,
    gridLng: key.gridLng,
    fetchedAt: now,
    precipMm3d: String(Math.round(precip3 * 10) / 10),
    precipMm7d: String(Math.round(precip7 * 10) / 10),
    sunshineHours7d: sunHours == null ? null : String(Math.round(sunHours * 10) / 10),
    airTempMean7d: tempMean == null ? null : String(Math.round(tempMean * 10) / 10),
    windSpeedMs: current.wind_speed_10m == null ? null : String(current.wind_speed_10m),
    windDirDeg: current.wind_direction_10m == null ? null : String(current.wind_direction_10m),
    pressureHpa: current.surface_pressure == null ? null : String(current.surface_pressure),
    airTempC: current.temperature_2m == null ? null : String(current.temperature_2m),
    waterTempC: waterTemp == null ? null : String(Math.round(waterTemp * 10) / 10),
  };
  const existing = await db
    .select({ id: weatherCache.id })
    .from(weatherCache)
    .where(and(eq(weatherCache.gridLat, key.gridLat), eq(weatherCache.gridLng, key.gridLng)))
    .limit(1);
  if (existing[0]) {
    await db.update(weatherCache).set(values).where(eq(weatherCache.id, existing[0].id));
  } else {
    await db.insert(weatherCache).values(values);
  }
  return readGridWeather(lat, lng);
}

const inflight = new Set<string>();

export function scheduleGridRefresh(lat: number, lng: number): boolean {
  const key = gridKey(lat, lng);
  const id = `${key.gridLat},${key.gridLng}`;
  if (inflight.has(id)) return false;
  inflight.add(id);
  void refreshGridWeather(lat, lng)
    .catch(() => null)
    .finally(() => inflight.delete(id));
  return true;
}

export async function getGridWeather(lat: number, lng: number, wait: boolean): Promise<GridWeather> {
  const cached = await readGridWeather(lat, lng);
  if (cached.freshness === 'ok') return cached;
  if (!wait) {
    scheduleGridRefresh(lat, lng);
    return cached;
  }
  const fresh = await refreshGridWeather(lat, lng);
  return fresh ?? cached;
}
