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

const FOOTER_SECTIONS = [
  {
    title: 'Разделы',
    links: [
      { to: '/map', label: 'Карта водоёмов' },
      { to: '/blog', label: 'Блог' },
      { to: '/reference', label: 'Справочник' },
      { to: '/contacts', label: 'Разрешения' },
    ],
  },
  {
    title: 'Справка',
    links: [
      { to: '/info', label: 'Справочная информация' },
      { to: '/reference', label: 'Правила и экипировка' },
      { to: '/blog', label: 'Статьи для новичков' },
    ],
  },
  {
    title: 'Документы',
    links: [
      { to: '/privacy', label: 'Политика конфиденциальности' },
      { to: '/terms', label: 'Пользовательское соглашение' },
    ],
  },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const year = new Date().getFullYear();

  const closeMenu = () => setMenuOpen(false);

  useEffect(() => {
    const setIcon = (rel: string, href: string, type?: string, sizes?: string) => {
      let link = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]${sizes ? `[sizes="${sizes}"]` : ''}`);
      if (!link) {
        link = document.createElement('link');
        link.rel = rel;
        if (sizes) link.sizes = sizes;
        document.head.appendChild(link);
      }
      link.href = href;
      if (type) link.type = type;
    };

    api.settings.favicon().then((r) => {
      const url = r.url ? (API_BASE || '') + r.url : '/uploads/logo.png';
      setIcon('icon', url, 'image/png');
      setIcon('apple-touch-icon', url, 'image/png');
    }).catch(() => {
      setIcon('icon', '/uploads/logo.png', 'image/png');
    });
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
          <Link to="/blog" className={location.pathname.startsWith('/blog') ? styles.active : ''} onClick={closeMenu}>Блог</Link>
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
          ['/', '/map', '/contacts', '/info', '/blog'].includes(location.pathname) || location.pathname.startsWith('/reference') || location.pathname.startsWith('/water') || location.pathname.startsWith('/blog')
            ? styles.mainPageBg
            : ''
        }`}
      >
        <Outlet />
      </main>
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerGrid}>
            <div className={styles.footerBrand}>
              <Logo />
              <p>
                Справочник разрешённых водоёмов, правил и контактов организаций для получения путёвок на подводную охоту в Беларуси.
              </p>
            </div>
            {FOOTER_SECTIONS.map(({ title, links }) => (
              <div key={title} className={styles.footerCol}>
                <h3>{title}</h3>
                <nav className={styles.footerLinks} aria-label={title}>
                  {links.map(({ to, label }) => (
                    <Link key={to + label} to={to}>{label}</Link>
                  ))}
                </nav>
              </div>
            ))}
          </div>
          <div className={styles.footerBottom}>
            <span>© {year} Подводная охота — Беларусь</span>
            <span>
              <Link to="/privacy">Конфиденциальность</Link>
              {' · '}
              <Link to="/terms">Соглашение</Link>
            </span>
          </div>
        </div>
      </footer>
      <CookieConsent />
      <YandexMetrika />
      <GoogleAnalytics />
    </div>
  );
}
