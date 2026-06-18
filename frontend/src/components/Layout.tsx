import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, API_BASE } from '../api/client';
import Logo from './Logo';
import CookieConsent from './CookieConsent';
import YandexMetrika from './YandexMetrika';
import GoogleAnalytics from './GoogleAnalytics';
import { Helmet } from 'react-helmet-async';
import styles from './Layout.module.css';

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  useEffect(() => {
    api.settings.favicon().then((r) => {
      if (r.url) {
        let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
        if (!link) {
          link = document.createElement('link');
          link.rel = 'icon';
          document.head.appendChild(link);
        }
        link.href = (API_BASE || '') + r.url;
      }
    }).catch(() => {});
  }, []);

  const noIndex =
    ['/login', '/register', '/admin', '/subscription', '/subscription/success'].includes(location.pathname) ||
    location.pathname.startsWith('/admin/');

  return (
    <div className={styles.layout}>
      {noIndex && (
        <Helmet>
          <meta name="robots" content="noindex, nofollow" />
        </Helmet>
      )}
      <header className={styles.header}>
        <Logo onClick={closeMenu} />
        <button
          type="button"
          className={styles.hamburger}
          onClick={() => setMenuOpen((o) => !o)}
          aria-expanded={menuOpen}
          aria-label="Меню"
        >
          <span />
          <span />
          <span />
        </button>
        <nav className={`${styles.nav} ${menuOpen ? styles.navOpen : ''}`}>
          <Link to="/" className={location.pathname === '/' ? styles.active : ''} onClick={closeMenu}>Главная</Link>
          <Link to="/map" className={location.pathname === '/map' || location.pathname.startsWith('/water/') ? styles.active : ''} onClick={closeMenu}>Карта</Link>
          <Link to="/reference" className={location.pathname.startsWith('/reference') ? styles.active : ''} onClick={closeMenu}>Справочник</Link>
          <Link to="/contacts" className={location.pathname === '/contacts' ? styles.active : ''} onClick={closeMenu}>Разрешения</Link>
          <Link to="/info" className={location.pathname === '/info' ? styles.active : ''} onClick={closeMenu}>Справочная информация</Link>
          {user ? (
            <>
              {user.role === 'admin' && (
                <Link to="/admin" className={location.pathname.startsWith('/admin') ? styles.active : ''} onClick={closeMenu}>Админка</Link>
              )}
              <button type="button" onClick={() => { logout(); closeMenu(); }} className={styles.logout}>Выход</button>
            </>
          ) : (
            <Link to="/login" onClick={closeMenu}>Вход</Link>
          )}
        </nav>
      </header>
      <main
        className={`${styles.main} ${
          location.pathname === '/login' || location.pathname === '/register' ? styles.mainAuth : ''
        } ${
          ['/', '/map', '/contacts', '/info'].includes(location.pathname) || location.pathname.startsWith('/reference') || location.pathname.startsWith('/water')
            ? styles.mainPageBg
            : ''
        }`}
      >
        <Outlet />
      </main>
      <footer className={styles.footer}>
        <div className={styles.footerMain}>
          <span>Справочник разрешённых водоёмов для подводной охоты в Беларуси</span>
          <nav className={styles.footerNav}>
            <Link to="/info">Справочная информация</Link>
            <Link to="/privacy">Политика конфиденциальности</Link>
            <Link to="/terms">Пользовательское соглашение</Link>
          </nav>
        </div>
      </footer>
      <CookieConsent />
      <YandexMetrika />
      <GoogleAnalytics />
    </div>
  );
}
