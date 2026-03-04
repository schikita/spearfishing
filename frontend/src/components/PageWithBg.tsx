import { useState, useEffect } from 'react';
import { api, API_BASE } from '../api/client';
import styles from './PageWithBg.module.css';

interface PageWithBgProps {
  pageKey: string;
  children: React.ReactNode;
  blur?: boolean;
}

export default function PageWithBg({ pageKey, children, blur }: PageWithBgProps) {
  const [bgUrl, setBgUrl] = useState<string | null>(null);

  useEffect(() => {
    api.settings.pageBg(pageKey).then((r) => {
      if (r.url) setBgUrl((API_BASE || '') + r.url);
    }).catch(() => {});
  }, [pageKey]);

  return (
    <div
      className={styles.pageWithBg}
      style={{
        backgroundColor: '#000',
        backgroundImage: bgUrl ? `url(${bgUrl})` : undefined,
      }}
    >
      {bgUrl && <div className={styles.overlay} aria-hidden />}
      <div className={`${styles.content} ${blur ? styles.contentBlur : ''}`}>{children}</div>
    </div>
  );
}
