import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, API_BASE } from '../api/client';
import styles from './Logo.module.css';

interface LogoProps {
  onClick?: () => void;
}

export default function Logo({ onClick }: LogoProps) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    api.settings.logo().then((r) => {
      if (r.url) setLogoUrl((API_BASE || '') + r.url);
    }).catch(() => {});
  }, []);

  return (
    <Link to="/" className={styles.logo} onClick={onClick}>
      {logoUrl && <img src={logoUrl} alt="" className={styles.logoImg} />}
      <span className={styles.logoText}>
        <span className={styles.line1}>подводная охота</span>
        <span className={styles.line2}>БЕЛАРУСЬ</span>
      </span>
    </Link>
  );
}
