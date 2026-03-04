import { useEffect, useState, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline, Polygon, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import buffer from '@turf/buffer';
import { lineString } from '@turf/helpers';
import { api, WaterBody } from '../api/client';
import PageWithBg from '../components/PageWithBg';
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

function MapResizeOnFullscreen() {
  const map = useMap();
  useEffect(() => {
    const onFullscreenChange = () => {
      setTimeout(() => map.invalidateSize(), 100);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, [map]);
  return null;
}

export default function MapPage() {
  const [waterBodies, setWaterBodies] = useState<WaterBody[]>([]);
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const [selectedWater, setSelectedWater] = useState<WaterBody | null>(null);
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
  const [routeInfo, setRouteInfo] = useState<{ duration: number; distance: number } | null>(null);
  const [panelExiting, setPanelExiting] = useState(false);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [geoError, setGeoError] = useState('');
  const [routeLoading, setRouteLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const mapWrapRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (!mapWrapRef.current) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await mapWrapRef.current.requestFullscreen();
    }
  }, []);

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
    setRouteInfo(null);
    setPanelCollapsed(false);
    if (!userPos) {
      setRouteCoords([]);
      return;
    }
    setRouteLoading(true);
    setRouteCoords([]);
    const to: [number, number] = [parseFloat(wb.lat), parseFloat(wb.lng)];
    const from = userPos;
    const onLoaded = (coords: [number, number][], info?: { duration: number; distance: number }) => {
      setRouteCoords(coords);
      setRouteInfo(info ?? null);
      setRouteLoading(false);
    };
    const [lat1, lng1] = from;
    const [lat2, lng2] = to;
    const url = `https://router.project-osrm.org/route/v1/driving/${lng1},${lat1};${lng2},${lat2}?overview=full&geometries=geojson`;
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (data.code === 'Ok' && data.routes?.[0]?.geometry?.coordinates?.length) {
          const route = data.routes[0];
          const coords = route.geometry.coordinates.map((c: number[]) => [c[1], c[0]] as [number, number]);
          const duration = typeof route.duration === 'number' ? route.duration : 0;
          const distance = typeof route.distance === 'number' ? route.distance : 0;
          onLoaded(coords, { duration, distance });
        } else {
          onLoaded([]);
        }
      })
      .catch(() => onLoaded([]));
  }, [userPos]);

  const clearRoute = useCallback(() => {
    setPanelExiting(true);
    setTimeout(() => {
      setSelectedWater(null);
      setRouteCoords([]);
      setRouteInfo(null);
      setPanelExiting(false);
      setPanelCollapsed(false);
    }, 320);
  }, []);

  const formatDuration = (sec: number): string => {
    if (sec < 60) return `${Math.round(sec)} мин`;
    const h = Math.floor(sec / 3600);
    const m = Math.round((sec % 3600) / 60);
    if (h === 0) return `${m} мин`;
    if (m === 0) return `${h} ч`;
    return `${h} ч ${m} мин`;
  };

  const formatDistance = (m: number): string => {
    if (m < 1000) return `${Math.round(m)} м`;
    return `${(m / 1000).toFixed(1).replace(/\.0$/, '')} км`;
  };

  const openInNavigator = useCallback(() => {
    if (!userPos || !selectedWater) return;
    const [lat1, lng1] = userPos;
    const lat2 = parseFloat(selectedWater.lat);
    const lng2 = parseFloat(selectedWater.lng);
    const url = `https://www.google.com/maps/dir/?api=1&origin=${lat1},${lng1}&destination=${lat2},${lng2}`;
    window.open(url, '_blank', 'noopener');
  }, [userPos, selectedWater]);

  const toPoint = selectedWater ? [parseFloat(selectedWater.lat), parseFloat(selectedWater.lng)] as [number, number] : null;
  const fitPoints = userPos && toPoint && Number.isFinite(toPoint[0]) && Number.isFinite(toPoint[1])
    ? [userPos, toPoint]
    : [];

  return (
    <PageWithBg pageKey="map">
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
      <div className={styles.mapWrap} ref={mapWrapRef}>
        {selectedWater && (routeCoords.length > 0 || routeLoading) && (
          <>
            {panelCollapsed ? (
              <div className={`${styles.routeBar} ${panelExiting ? styles.routePanelExiting : ''} ${isFullscreen ? styles.routeBarFullscreen : ''}`}>
                <div className={styles.routeBarContent}>
                  <Link to={`/water/${selectedWater.id}`} className={styles.routeBarLink} title="Подробнее о водоёме">
                    Подробнее
                  </Link>
                  {routeLoading ? (
                    <span className={styles.routeBarText}>Построение маршрута…</span>
                  ) : routeInfo ? (
                    <>
                      <span className={styles.routeBarStat}>{formatDuration(routeInfo.duration)}</span>
                      <span className={styles.routeBarStat}>{formatDistance(routeInfo.distance)}</span>
                      <button type="button" className={styles.routeBarNavBtn} onClick={openInNavigator}>
                        🧭 Навигатор
                      </button>
                    </>
                  ) : (
                    <span className={styles.routeBarText}>Маршрут не найден</span>
                  )}
                  <button type="button" className={styles.routeBarToggle} onClick={() => setPanelCollapsed(false)} title="Развернуть">
                    ▲
                  </button>
                  <button type="button" className={styles.routeBarClose} onClick={clearRoute} title="Закрыть">×</button>
                </div>
              </div>
            ) : (
              <div className={`${styles.routePanel} ${panelExiting ? styles.routePanelExiting : ''} ${isFullscreen ? styles.routePanelFullscreen : ''}`}>
                <div className={styles.routePanelHeader}>
                  <h3>Маршрут до водоёма</h3>
                  <div className={styles.routePanelActions}>
                    <button type="button" className={styles.routePanelToggle} onClick={() => setPanelCollapsed(true)} title="Свернуть">
                      ▼
                    </button>
                    <button type="button" className={styles.routePanelClose} onClick={clearRoute} aria-label="Закрыть">×</button>
                  </div>
                </div>
                <p className={styles.routeDestination}>
                  <Link to={`/water/${selectedWater.id}`} className={styles.routeDestinationLink}>
                    {selectedWater.nameRu || selectedWater.name}
                  </Link>
                </p>
                {routeLoading ? (
                  <p className={styles.routeLoading}>Построение маршрута…</p>
                ) : routeInfo ? (
                  <>
                    <div className={styles.routeStats}>
                      <div className={styles.routeStat}>
                        <span className={styles.routeStatValue}>{formatDuration(routeInfo.duration)}</span>
                        <span className={styles.routeStatLabel}>Время в пути</span>
                      </div>
                      <div className={styles.routeStat}>
                        <span className={styles.routeStatValue}>{formatDistance(routeInfo.distance)}</span>
                        <span className={styles.routeStatLabel}>Расстояние</span>
                      </div>
                    </div>
                    <button type="button" className={styles.routeNavBtn} onClick={openInNavigator}>
                      🧭 Открыть в навигаторе
                    </button>
                    <p className={styles.routeNavHint}>
                      Откроется Google Maps. Для Беларуси также удобны Яндекс.Карты и 2GIS.
                    </p>
                  </>
                ) : (
                  <p className={styles.routeError}>Маршрут не найден</p>
                )}
              </div>
            )}
          </>
        )}
        <button
          type="button"
          className={styles.fullscreenBtn}
          onClick={toggleFullscreen}
          title={isFullscreen ? 'Свернуть' : 'На весь экран'}
          aria-label={isFullscreen ? 'Свернуть карту' : 'Развернуть карту на весь экран'}
        >
          {isFullscreen ? '✕' : '⛶'}
        </button>
        <MapContainer
          center={BELARUS_CENTER}
          zoom={DEFAULT_ZOOM}
          className={styles.map}
          scrollWheelZoom
        >
          <MapResizeOnFullscreen />
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
            const popupHtml = `<strong>${wb.nameRu || wb.name}</strong><br/>${wb.region}${wb.description ? `<br/><small>${wb.description.replace(/</g, '&lt;')}</small>` : ''}<br/><button class="${styles.popupBtn}" data-wb-id="${wb.id}">Построить маршрут сюда</button><br/><a href="/water/${wb.id}" class="${styles.popupLink}" data-water-link="${wb.id}">Полная информация о водоёме</a>`;

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
                      <Popup offset={[70, -20]}>
                        <strong>{wb.nameRu || wb.name}</strong>
                        <br />
                        {wb.region}
                        {wb.description && <><br /><small>{wb.description}</small></>}
                        <br />
                        <button type="button" onClick={() => buildRoute(wb)} className={styles.popupBtn}>
                          Построить маршрут сюда
                        </button>
                        <br />
                        <Link to={`/water/${wb.id}`} className={styles.popupLink}>
                          Полная информация о водоёме
                        </Link>
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
                    layer.bindPopup(popupHtml, { offset: [70, -20] });
                    layer.on('click', () => buildRoute(wb));
                    layer.on('popupopen', () => {
                      const el = layer.getPopup()?.getElement();
                      el?.querySelector(`[data-wb-id="${wb.id}"]`)?.addEventListener('click', () => buildRoute(wb));
                      el?.querySelector(`[data-water-link="${wb.id}"]`)?.addEventListener('click', (e: Event) => {
                        e.preventDefault();
                        navigate(`/water/${wb.id}`);
                      });
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
                <Popup offset={[0, -35]}>
                  <strong>{wb.nameRu || wb.name}</strong>
                  <br />
                  {wb.region}
                  {wb.description && <><br /><small>{wb.description}</small></>}
                  <br />
                  <button type="button" onClick={() => buildRoute(wb)} className={styles.popupBtn}>
                    Построить маршрут сюда
                  </button>
                  <br />
                  <Link to={`/water/${wb.id}`} className={styles.popupLink}>
                    Полная информация о водоёме
                  </Link>
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
    </PageWithBg>
  );
}
