import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, API_BASE } from '../api/client';
import styles from './Logo.module.css';

interface LogoProps {
  onClick?: () => void;
}

export default function Logo({ onClick }: LogoProps) {
  const [logoUrl, setLogoUrl] = useState<string>('/uploads/logo.png');

  useEffect(() => {
    api.settings.logo().then((r) => {
      if (r.url) setLogoUrl((API_BASE || '') + r.url);
    }).catch(() => {});
  }, []);

  return (
    <Link to="/" className={styles.logo} onClick={onClick}>
      <img
        src={logoUrl}
        alt=""
        className={styles.logoImg}
        width={44}
        height={44}
        decoding="async"
        loading="eager"
      />
      <span className={styles.logoText}>
        <span className={styles.line1}>подводная охота</span>
        <span className={styles.line2}>БЕЛАРУСЬ</span>
      </span>
    </Link>
  );
}
