import { useState, useEffect, type ImgHTMLAttributes } from 'react';
import { api, API_BASE } from '../api/client';
import styles from './PageWithBg.module.css';

interface PageWithBgProps {
  pageKey: string;
  children: React.ReactNode;
  blur?: boolean;
  /** Prioritize LCP background (homepage). */
  priority?: boolean;
}

export default function PageWithBg({ pageKey, children, blur, priority }: PageWithBgProps) {
  const [bgUrl, setBgUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.settings.pageBg(pageKey).then((r) => {
      if (!cancelled && r.url) setBgUrl((API_BASE || '') + r.url);
    }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pageKey]);

  const webpUrl = bgUrl && /\.jpe?g($|\?)/i.test(bgUrl) ? bgUrl.replace(/\.jpe?g($|\?)/i, '.webp$1') : null;

  return (
    <div className={styles.pageWithBg} style={{ backgroundColor: '#000' }}>
      {bgUrl && (
        <picture>
          {webpUrl && <source srcSet={webpUrl} type="image/webp" />}
          <img
            className={styles.bgImg}
            src={bgUrl}
            alt=""
            width={1600}
            height={900}
            decoding={priority ? 'sync' : 'async'}
            loading={priority ? 'eager' : 'lazy'}
            {...(priority ? ({ fetchPriority: 'high' } as ImgHTMLAttributes<HTMLImageElement>) : {})}
          />
        </picture>
      )}
      {bgUrl && <div className={styles.overlay} aria-hidden />}
      <div className={`${styles.content} ${blur ? styles.contentBlur : ''}`}>{children}</div>
    </div>
  );
}
