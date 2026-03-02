import { useEffect, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline, Polygon, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import buffer from '@turf/buffer';
import { lineString } from '@turf/helpers';
import { api, WaterBody } from '../api/client';
import styles from './MapPage.module.css';

// LineString → Polygon через буфер (реки отображаются как полигоны)
const LINE_BUFFER_KM = 0.15; // ~150 м ширина «коридора» реки
function lineStringToPolygonPositions(geom: { type: string; coordinates: unknown }): [number, number][] | null {
  if (geom?.type !== 'LineString' || !Array.isArray(geom.coordinates) || geom.coordinates.length < 2) return null;
  try {
    const line = lineString(geom.coordinates as [number, number][]);
    const buffered = buffer(line, LINE_BUFFER_KM, { units: 'kilometers' });
    if (!buffered?.geometry) return null;
    const g = buffered.geometry;
    const coords =
      g.type === 'Polygon' && g.coordinates?.[0]
        ? g.coordinates[0]
        : g.type === 'MultiPolygon' && g.coordinates?.[0]?.[0]
          ? g.coordinates[0][0]
          : null;
    if (!coords?.length) return null;
    return coords.map((pos: number[]) => [pos[1], pos[0]] as [number, number]);
  } catch {
    return null;
  }
}

const isValidCoord = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

// Polygon: GeoJSON [[[lng,lat],...]] or [[ring1],[ring2],...] → Leaflet [lat,lng][] or [[ring1],[ring2],...]
function toLeafletPolygon(geom: { type: string; coordinates: unknown }): [number, number][] | [number, number][][] | null {
  if (geom?.type !== 'Polygon' || !Array.isArray(geom.coordinates)) return null;
  const c = geom.coordinates as number[][][];
  const toRing = (ring: number[][]) =>
    ring
      .map((pos) => (isValidCoord(pos[0]) && isValidCoord(pos[1]) ? [pos[1], pos[0]] as [number, number] : null))
      .filter((p): p is [number, number] => p !== null);
  if (!c.length) return null;
  const rings = c.map((ring) => toRing(ring)).filter((r) => r.length >= 3);
  if (!rings.length) return null;
  return rings.length === 1 ? rings[0] : rings;
}

const BELARUS_CENTER: [number, number] = [53.9, 27.5];
const DEFAULT_ZOOM = 6;

const waterIcon = new L.DivIcon({
  className: styles.markerWater,
  html: '<span>🟦</span>',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const userIcon = new L.DivIcon({
  className: styles.markerUser,
  html: '<span>📍</span>',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length < 2) return;
    map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 14 });
  }, [map, points]);
  return null;
}

export default function MapPage() {
  const [waterBodies, setWaterBodies] = useState<WaterBody[]>([]);
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const [selectedWater, setSelectedWater] = useState<WaterBody | null>(null);
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
  const [loading, setLoading] = useState(true);
  const [geoError, setGeoError] = useState('');
  const [routeLoading, setRouteLoading] = useState(false);

  useEffect(() => {
    api.waterBodies().then(setWaterBodies).finally(() => setLoading(false));
  }, []);

  const requestLocation = useCallback(() => {
    setGeoError('');
    if (!navigator.geolocation) {
      setGeoError('Геолокация не поддерживается браузером');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserPos([pos.coords.latitude, pos.coords.longitude]),
      () => setGeoError('Не удалось определить местоположение. Разрешите доступ к геолокации.'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  const buildRoute = useCallback((wb: WaterBody) => {
    setSelectedWater(wb);
    if (!userPos) {
      setRouteCoords([]);
      return;
    }
    setRouteLoading(true);
    setRouteCoords([]);
    const to: [number, number] = [parseFloat(wb.lat), parseFloat(wb.lng)];
    const from = userPos;
    const onLoaded = (coords: [number, number][]) => {
      setRouteCoords(coords);
      setRouteLoading(false);
    };
    const [lat1, lng1] = from;
    const [lat2, lng2] = to;
    const url = `https://router.project-osrm.org/route/v1/driving/${lng1},${lat1};${lng2},${lat2}?overview=full&geometries=geojson`;
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (data.code === 'Ok' && data.routes?.[0]?.geometry?.coordinates?.length) {
          const coords = data.routes[0].geometry.coordinates.map((c: number[]) => [c[1], c[0]] as [number, number]);
          onLoaded(coords);
        } else {
          onLoaded([]);
        }
      })
      .catch(() => onLoaded([]));
  }, [userPos]);

  const clearRoute = useCallback(() => {
    setSelectedWater(null);
    setRouteCoords([]);
  }, []);

  const toPoint = selectedWater ? [parseFloat(selectedWater.lat), parseFloat(selectedWater.lng)] as [number, number] : null;
  const fitPoints = userPos && toPoint && Number.isFinite(toPoint[0]) && Number.isFinite(toPoint[1])
    ? [userPos, toPoint]
    : [];

  return (
    <div className={styles.wrap} style={{ position: 'relative' }}>
      <h1>Карта водоёмов</h1>
      <p className={styles.subtitle}>
        Водоёмы, где разрешена подводная охота. Включите геолокацию и выберите водоём, чтобы построить маршрут.
      </p>
      <div className={styles.toolbar}>
        <button type="button" onClick={requestLocation} className={styles.btn}>
          📍 Моё местоположение
        </button>
        {userPos && <span className={styles.geoOk}>Геолокация включена</span>}
        {geoError && <span className={styles.geoErr}>{geoError}</span>}
        {routeLoading && <span className={styles.loading}>Построение маршрута…</span>}
        {selectedWater && (
          <button type="button" onClick={clearRoute} className={styles.btnSecondary}>
            Сбросить маршрут
          </button>
        )}
      </div>
      <div className={styles.mapWrap}>
        <MapContainer
          center={BELARUS_CENTER}
          zoom={DEFAULT_ZOOM}
          className={styles.map}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {waterBodies.map((wb) => {
            const geom = wb.geometry ? (() => { try { return JSON.parse(wb.geometry!); } catch { return null; } })() : null;
            const lat = parseFloat(wb.lat);
            const lng = parseFloat(wb.lng);
            const center: [number, number] = [lat, lng];
            const centerValid = Number.isFinite(lat) && Number.isFinite(lng);
            const popupHtml = `<strong>${wb.nameRu || wb.name}</strong><br/>${wb.region}${wb.description ? `<br/><small>${wb.description.replace(/</g, '&lt;')}</small>` : ''}<br/><button class="${styles.popupBtn}" data-wb-id="${wb.id}">Построить маршрут сюда</button>`;

            if (geom && (geom.type === 'Polygon' || geom.type === 'MultiPolygon' || geom.type === 'LineString')) {
              if (geom.type === 'Polygon') {
                const positions = toLeafletPolygon(geom);
                const validPositions =
                  positions &&
                  (Array.isArray(positions[0]) && !Array.isArray(positions[0][0])
                    ? (positions as [number, number][]).length >= 3 &&
                      (positions as [number, number][]).every((p) => isValidCoord(p[0]) && isValidCoord(p[1]))
                    : (positions as [number, number][][]).every(
                        (r) => r.length >= 3 && r.every((p) => isValidCoord(p[0]) && isValidCoord(p[1]))
                      ));
                if (validPositions) {
                  return (
                    <Polygon
                      key={wb.id}
                      positions={positions as [number, number][] | [number, number][][]}
                      pathOptions={{ color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.3, weight: 2 }}
                      eventHandlers={{ click: () => buildRoute(wb) }}
                    >
                      <Popup>
                        <strong>{wb.nameRu || wb.name}</strong>
                        <br />
                        {wb.region}
                        {wb.description && <><br /><small>{wb.description}</small></>}
                        <br />
                        <button type="button" onClick={() => buildRoute(wb)} className={styles.popupBtn}>
                          Построить маршрут сюда
                        </button>
                      </Popup>
                    </Polygon>
                  );
                }
              }
              let geojsonData: GeoJSON.Feature | null = null;
              if (geom.type === 'LineString') {
                const buffered = lineStringToPolygonPositions(geom);
                if (buffered && buffered.length >= 3) {
                  geojsonData = { type: 'Feature', geometry: { type: 'Polygon', coordinates: [buffered.map((p) => [p[1], p[0]])] }, properties: { id: wb.id } };
                }
              } else {
                geojsonData = { type: 'Feature', geometry: geom as GeoJSON.Geometry, properties: { id: wb.id } };
              }
              if (geojsonData && geojsonData.geometry.type !== 'LineString') {
                return (
                <GeoJSON
                  key={wb.id}
                  data={geojsonData}
                  style={{ color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.3, weight: 2 }}
                  onEachFeature={(_, layer) => {
                    layer.bindPopup(popupHtml);
                    layer.on('click', () => buildRoute(wb));
                    layer.on('popupopen', () => {
                      const el = layer.getPopup()?.getElement();
                      el?.querySelector(`[data-wb-id="${wb.id}"]`)?.addEventListener('click', () => buildRoute(wb));
                    });
                  }}
                />
              );
              }
            }
            if (!centerValid) return null;
            return (
              <Marker
                key={wb.id}
                position={center}
                icon={waterIcon}
                eventHandlers={{ click: () => buildRoute(wb) }}
              >
                <Popup>
                  <strong>{wb.nameRu || wb.name}</strong>
                  <br />
                  {wb.region}
                  {wb.description && <><br /><small>{wb.description}</small></>}
                  <br />
                  <button type="button" onClick={() => buildRoute(wb)} className={styles.popupBtn}>
                    Построить маршрут сюда
                  </button>
                </Popup>
              </Marker>
            );
          })}
          {userPos && isValidCoord(userPos[0]) && isValidCoord(userPos[1]) && (
            <Marker position={userPos} icon={userIcon} />
          )}
          {routeCoords.length > 0 && (
            <Polyline
              positions={routeCoords.filter((c) => isValidCoord(c[0]) && isValidCoord(c[1]))}
              color="#3fb950"
              weight={4}
              opacity={0.9}
            />
          )}
          {fitPoints.length >= 2 && fitPoints.every((p) => isValidCoord(p[0]) && isValidCoord(p[1])) && (
            <FitBounds points={fitPoints} />
          )}
        </MapContainer>
      </div>
      {loading && <div className={styles.loadingOverlay}>Загрузка водоёмов…</div>}
    </div>
  );
}
