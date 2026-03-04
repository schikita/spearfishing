import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import styles from './CookieConsent.module.css';

const STORAGE_KEY = 'spearfishing_cookie_consent';

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(STORAGE_KEY);
    if (!consent) {
      setVisible(true);
    }
  }, []);

  const handleConfirm = () => {
    setExiting(true);
    setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, 'accepted');
      setVisible(false);
      setExiting(false);
    }, 400);
  };

  if (!visible) return null;

  return (
    <div
      className={`${styles.banner} ${exiting ? styles.bannerExiting : ''}`}
      role="dialog"
      aria-live="polite"
      aria-label="Уведомление о cookies"
    >
      <div className={styles.content}>
        <p className={styles.text}>
          Мы используем cookies для работы сайта и авторизации. Продолжая использовать сайт, вы соглашаетесь с{' '}
          <Link to="/privacy" className={styles.link}>Политикой конфиденциальности</Link>.
        </p>
        <button type="button" className={styles.btn} onClick={handleConfirm}>
          Подтвердить
        </button>
      </div>
    </div>
  );
}
