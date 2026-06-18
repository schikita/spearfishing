import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

export const YANDEX_METRIKA_ID = 109952476;

export default function YandexMetrika() {
  const location = useLocation();
  const isFirstHit = useRef(true);

  useEffect(() => {
    if (isFirstHit.current) {
      isFirstHit.current = false;
      return;
    }
    if (typeof window.ym !== 'function') return;
    window.ym(YANDEX_METRIKA_ID, 'hit', window.location.href, {
      title: document.title,
      referer: document.referrer,
    });
  }, [location.pathname, location.search]);

  return null;
}
