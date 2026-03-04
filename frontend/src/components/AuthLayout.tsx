import { useState, useEffect } from 'react';
import { api, API_BASE } from '../api/client';
import styles from '../pages/Login.module.css';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const [bgUrl, setBgUrl] = useState<string | null>(null);

  useEffect(() => {
    api.settings.authBg().then((r) => {
      if (r.url) setBgUrl((API_BASE || '') + r.url);
    }).catch(() => {});
  }, []);

  return (
    <div
      className={styles.authPage}
      style={{
        backgroundImage: bgUrl ? `url(${bgUrl})` : undefined,
      }}
    >
      {bgUrl && <div className={styles.authOverlay} aria-hidden />}
      <div className={styles.authContent}>{children}</div>
    </div>
  );
}
