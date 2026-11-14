import { useEffect, useState, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline, Polygon, GeoJSON, Circle, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import buffer from '@turf/buffer';
import { lineString } from '@turf/helpers';
import { api, WaterBody, WinteringPit } from '../api/client';
import VerdictPanel from '../components/VerdictPanel';
import { DISCLAIMER } from '../disclaimer';
import { nextWeekendISO } from '../tripDate';
import PageWithBg from '../components/PageWithBg';
import SeoHead from '../components/SeoHead';
import Breadcrumbs from '../components/Breadcrumbs';
import { breadcrumbList } from '../seo/jsonLd';
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

const pitIcon = new L.DivIcon({
  className: '',
  html: '<span style="font-size:20px">⛔</span>',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

function turbidityColor(level?: string): string {
  if (level === 'low') return '#16a34a';
  if (level === 'medium') return '#ca8a04';
  if (level === 'high') return '#92400e';
  return '#6b7280';
}

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
  const [tripDate, setTripDate] = useState(nextWeekendISO);
  const [pits, setPits] = useState<WinteringPit[]>([]);
  const [verdictWater, setVerdictWater] = useState<WaterBody | null>(null);
  const [regionFilter, setRegionFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [turbidityFilter, setTurbidityFilter] = useState('all');
  const [roadFilter, setRoadFilter] = useState('all');
  const [hidePits, setHidePits] = useState(false);
  const [showWaters, setShowWaters] = useState(true);
  const [showPits, setShowPits] = useState(true);
  const [showReports, setShowReports] = useState(true);
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
    setLoading(true);
    Promise.all([api.waterBodies(tripDate), api.winteringPits(tripDate)])
      .then(([waters, pitData]) => {
        setWaterBodies(waters.waterBodies);
        setPits(pitData.pits);
      })
      .finally(() => setLoading(false));
  }, [tripDate]);

  const requestLocation = useCallback(() => {
    setGeoError('');
    if (!navigator.geolocation) {
      setGeoError('Геолокация не поддерживается браузером');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserPos([pos.coords.latitude, pos.coords.longitude]),
      (err) => {
        const msg =
          err.code === 1
            ? 'Доступ к геолокации запрещён. Разрешите в настройках браузера.'
            : err.code === 2
              ? 'Местоположение недоступно. Проверьте GPS/Wi‑Fi.'
              : err.code === 3
                ? 'Превышено время ожидания. Попробуйте ещё раз.'
                : !window.isSecureContext
                  ? 'Геолокация работает только по HTTPS. Откройте сайт по защищённому адресу (https://).'
                  : 'Не удалось определить местоположение. Разрешите доступ к геолокации.';
        setGeoError(msg);
      },
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

  const allRegions = Array.from(new Set(waterBodies.map((wb) => wb.region || 'Другие'))).sort((a, b) => a.localeCompare(b, 'ru'));
  const visibleWaters = waterBodies.filter((wb) => {
    if (regionFilter !== 'all' && wb.region !== regionFilter) return false;
    if (typeFilter !== 'all' && (wb.bodyType || 'unknown') !== typeFilter) return false;
    if (turbidityFilter !== 'all' && (wb.tripHint?.turbidity || 'missing') !== turbidityFilter) return false;
    if (roadFilter !== 'all' && (wb.tripHint?.road || 'unknown') !== roadFilter) return false;
    if (hidePits && wb.tripHint?.hasWinteringPit) return false;
    return true;
  });

  const byRegion = visibleWaters.reduce<Record<string, WaterBody[]>>((acc, wb) => {
    const region = wb.region || 'Другие';
    if (!acc[region]) acc[region] = [];
    acc[region].push(wb);
    return acc;
  }, {});
  const regionNames = Object.keys(byRegion).sort((a, b) => a.localeCompare(b, 'ru'));

  return (
    <PageWithBg pageKey="map">
    <SeoHead
      title="Карта водоёмов"
      description="Интерактивная карта водоёмов Беларуси, где разрешена подводная охота. Построение маршрута от вашего местоположения."
      path="map"
      jsonLd={breadcrumbList([
        { name: 'Главная' },
        { name: 'Карта', path: 'map' },
      ])}
    />
    <div className={styles.page}>
    <div className={styles.wrap} style={{ position: 'relative' }}>
      <Breadcrumbs items={[{ name: 'Главная', to: '/' }, { name: 'Карта' }]} />
      <h1>Карта водоёмов</h1>
      <p className={styles.subtitle}>
        Водоёмы, где разрешена подводная охота. Выберите дату и водоём: сводка покажет перечень, путёвку, ямы и погоду. Это не разрешение на охоту.
      </p>
      <div className={styles.toolbar}>
        <label>
          Дата выезда{' '}
          <input type="date" value={tripDate} onChange={(e) => setTripDate(e.target.value)} />
        </label>
        <select value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)} aria-label="Область">
          <option value="all">Все области</option>
          {allRegions.map((region) => (
            <option key={region} value={region}>{region}</option>
          ))}
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} aria-label="Тип водоёма">
          <option value="all">Все типы</option>
          <option value="lake">Озеро</option>
          <option value="reservoir">Водохранилище</option>
          <option value="river">Река</option>
          <option value="quarry">Карьер</option>
          <option value="pond">Пруд</option>
          <option value="unknown">Тип не указан</option>
        </select>
        <select value={turbidityFilter} onChange={(e) => setTurbidityFilter(e.target.value)} aria-label="Мутность">
          <option value="all">Любая мутность</option>
          <option value="low">Низкая</option>
          <option value="medium">Средняя</option>
          <option value="high">Высокая</option>
          <option value="missing">Нет данных</option>
        </select>
        <select value={roadFilter} onChange={(e) => setRoadFilter(e.target.value)} aria-label="Дорога">
          <option value="all">Любая дорога</option>
          <option value="ok">Проезд ок</option>
          <option value="risky">Рискован</option>
          <option value="only_4x4">Только внедорожник</option>
          <option value="likely_closed">Скорее закрыто</option>
          <option value="unknown">Нет данных</option>
        </select>
        <label>
          <input type="checkbox" checked={hidePits} onChange={(e) => setHidePits(e.target.checked)} /> скрыть водоёмы с ямами
        </label>
        <label><input type="checkbox" checked={showWaters} onChange={(e) => setShowWaters(e.target.checked)} /> водоёмы</label>
        <label><input type="checkbox" checked={showPits} onChange={(e) => setShowPits(e.target.checked)} /> ямы</label>
        <label><input type="checkbox" checked={showReports} onChange={(e) => setShowReports(e.target.checked)} /> свежие отчёты</label>
      </div>
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
        <div className={styles.mapDisclaimer}>{DISCLAIMER}</div>
        {verdictWater && (
          <div className={styles.verdictDock}>
            <button type="button" className={styles.routePanelClose} onClick={() => setVerdictWater(null)} aria-label="Закрыть сводку">×</button>
            <VerdictPanel
              waterBodyId={verdictWater.id}
              date={tripDate}
              lat={userPos?.[0]}
              lng={userPos?.[1]}
              onBuildRoute={() => buildRoute(verdictWater)}
            />
          </div>
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
          {showWaters && visibleWaters.map((wb) => {
            const geom = wb.geometry ? (() => { try { return JSON.parse(wb.geometry!); } catch { return null; } })() : null;
            const lat = parseFloat(wb.lat);
            const lng = parseFloat(wb.lng);
            const center: [number, number] = [lat, lng];
            const centerValid = Number.isFinite(lat) && Number.isFinite(lng);
            const color = turbidityColor(wb.tripHint?.turbidity);
            const popupHtml = `<strong>${wb.nameRu || wb.name}</strong><br/>${wb.region}${wb.tripHint?.hasWinteringPit ? '<br/><b>Есть зимовальные ямы</b>' : ''}<br/><button class="${styles.popupBtn}" data-wb-id="${wb.id}">Сводка и маршрут</button><br/><a href="/water/${wb.id}" class="${styles.popupLink}" data-water-link="${wb.id}">Полная информация о водоёме</a>`;

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
                      pathOptions={{ color, fillColor: color, fillOpacity: 0.35, weight: 2 }}
                      eventHandlers={{ click: () => setVerdictWater(wb) }}
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
                  style={{ color, fillColor: color, fillOpacity: 0.35, weight: 2 }}
                  onEachFeature={(_, layer) => {
                    layer.bindPopup(popupHtml, { offset: [70, -20] });
                    layer.on('click', () => setVerdictWater(wb));
                    layer.on('popupopen', () => {
                      const el = layer.getPopup()?.getElement();
                      el?.querySelector(`[data-wb-id="${wb.id}"]`)?.addEventListener('click', () => setVerdictWater(wb));
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
                eventHandlers={{ click: () => setVerdictWater(wb) }}
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
          {showPits && pits.map((pit) => {
            const geom = pit.geometry ? (() => { try { return JSON.parse(pit.geometry!); } catch { return null; } })() : null;
            const uncertain = pit.boundaryAccuracy !== 'exact';
            const pitPopup = (
              <Popup>
                <strong>{pit.name}</strong>
                <br />
                Охота запрещена. {pit.isYearRound ? 'Круглый год.' : `${pit.banFrom || 'начало не указано'} — ${pit.banTo || 'конец не указан'}.`}
                <br />
                {uncertain ? 'Границы уточняются.' : 'Границы указаны как точные, всё равно сверьте источник.'}
                {pit.sourceTitle && <><br />Источник: {pit.sourceTitle}</>}
                <br />
                <small>{DISCLAIMER}</small>
              </Popup>
            );
            if (geom?.type === 'Polygon') {
              const positions = toLeafletPolygon(geom);
              if (positions) {
                return (
                  <Polygon
                    key={`pit-${pit.id}`}
                    positions={positions}
                    pathOptions={{
                      color: '#9b1c1c',
                      weight: 2,
                      fillColor: '#9b1c1c',
                      fillOpacity: 0.35,
                      dashArray: uncertain ? '6 4' : undefined,
                    }}
                  >
                    {pitPopup}
                  </Polygon>
                );
              }
            }
            if (geom?.type === 'Point' && Array.isArray(geom.coordinates)) {
              const [lng, lat] = geom.coordinates as number[];
              const radius = Number(pit.radiusM);
              if (Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(radius) && radius > 0) {
                return (
                  <Circle
                    key={`pit-${pit.id}`}
                    center={[lat, lng]}
                    radius={radius}
                    pathOptions={{ color: '#9b1c1c', fillColor: '#9b1c1c', fillOpacity: 0.35, dashArray: uncertain ? '6 4' : undefined }}
                  >
                    {pitPopup}
                  </Circle>
                );
              }
              if (Number.isFinite(lat) && Number.isFinite(lng)) {
                return (
                  <Marker key={`pit-${pit.id}`} position={[lat, lng]} icon={pitIcon}>
                    {pitPopup}
                  </Marker>
                );
              }
            }
            return null;
          })}
          {showReports && visibleWaters.filter((wb) => wb.tripHint?.latestVisibilityM != null).map((wb) => {
            const lat = parseFloat(wb.lat);
            const lng = parseFloat(wb.lng);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
            return (
              <CircleMarker
                key={`report-${wb.id}`}
                center={[lat, lng]}
                radius={7}
                pathOptions={{ color: '#0f766e', fillColor: '#14b8a6', fillOpacity: 0.9 }}
              >
                <Popup>Свежая видимость: {wb.tripHint?.latestVisibilityM} м. Это отчёт, не официальный замер.</Popup>
              </CircleMarker>
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
    {!loading && regionNames.length > 0 && (
      <section className={styles.catalog} aria-label="Список водоёмов по регионам">
        <h2>Водоёмы по регионам</h2>
        <p className={styles.catalogIntro}>
          Полный перечень для индексации и быстрого перехода к карточке водоёма.
        </p>
        <div className={styles.catalogGrid}>
          {regionNames.map((region) => (
            <div key={region} className={styles.catalogRegion}>
              <h3>{region}</h3>
              <ul>
                {byRegion[region]
                  .slice()
                  .sort((a, b) => (a.nameRu || a.name).localeCompare(b.nameRu || b.name, 'ru'))
                  .map((wb) => (
                    <li key={wb.id}>
                      <Link to={`/water/${wb.id}`}>{wb.nameRu || wb.name}</Link>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    )}
    </div>
    </PageWithBg>
  );
}
