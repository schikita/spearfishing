import { Outlet } from 'react-router-dom';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './Layout.module.css';

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <Link to="/" className={styles.logo}>
          Подводная охота — Беларусь
        </Link>
        <nav className={styles.nav}>
          <Link to="/" className={location.pathname === '/' ? styles.active : ''}>Главная</Link>
          <Link to="/map" className={location.pathname === '/map' ? styles.active : ''}>Карта</Link>
          <Link to="/reference" className={location.pathname.startsWith('/reference') ? styles.active : ''}>Справочник</Link>
          <Link to="/contacts" className={location.pathname === '/contacts' ? styles.active : ''}>Разрешения</Link>
          {user ? (
            <>
              {user.role === 'admin' && (
                <Link to="/admin" className={location.pathname.startsWith('/admin') ? styles.active : ''}>Админка</Link>
              )}
              <button type="button" onClick={logout} className={styles.logout}>Выход</button>
            </>
          ) : (
            <Link to="/login">Вход</Link>
          )}
        </nav>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
      <footer className={styles.footer}>
        <span>Справочник разрешённых водоёмов для подводной охоты в Беларуси</span>
      </footer>
    </div>
  );
}
