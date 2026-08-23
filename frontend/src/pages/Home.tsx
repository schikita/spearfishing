import { Link } from 'react-router-dom';
import PageWithBg from '../components/PageWithBg';
import SeoHead from '../components/SeoHead';
import { SITE_URL } from '../config';
import styles from './Home.module.css';

const MapIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 48 48" fill="none" className={styles.cardIconSvg}>
    <path d="M5 11l12-4 12 4 14-4v32l-14 4-12-4-12 4V11z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <path d="M17 7v34M31 11v34" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const ReferenceIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 48 48" fill="none" className={styles.cardIconSvg}>
    <rect x="9" y="8" width="30" height="34" rx="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <rect x="15" y="4" width="18" height="8" rx="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <path d="M15 22h18M15 28h18M15 34h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const PhoneIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 48 48" fill="none" className={styles.cardIconSvg}>
    <path d="M14 8h8l4 10-5 3a22 22 0 0 0 6 6l3-5 10 4v8c0 2-2 4-4 4C18 38 10 22 10 12c0-2 2-4 4-4z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

const BlogIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 48 48" fill="none" className={styles.cardIconSvg}>
    <path d="M10 12h28v28H10z" stroke="currentColor" strokeWidth="2" fill="none" rx="3" />
    <path d="M16 20h16M16 26h16M16 32h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export default function Home() {
  return (
    <PageWithBg pageKey="home" blur>
    <SeoHead
      title="Подводная охота в Беларуси"
      description="Справочник разрешённых водоёмов для подводной охоты в Беларуси. Карта водоёмов, правила, экипировка и контакты организаций для получения путёвок."
      path=""
      jsonLd={{
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'Подводная охота — Беларусь',
        url: SITE_URL,
        description: 'Справочник разрешённых водоёмов для подводной охоты в Беларуси',
        inLanguage: 'ru-BY',
      }}
    />
    <div className={styles.home}>
      <section className={styles.hero}>
        <h1>Подводная охота в Беларуси</h1>
        <p>Справочник разрешённых водоёмов, правила и контакты организаций для получения разрешений</p>
        <div className={styles.cta}>
          <Link to="/map" className={styles.primary}>Открыть карту водоёмов</Link>
          <Link to="/blog" className={styles.secondary}>Читать блог</Link>
        </div>
      </section>
      <section className={styles.cards}>
        <Link to="/map" className={styles.card}>
          <span className={styles.cardIcon}><MapIcon /></span>
          <h2>Карта</h2>
          <p>Водоёмы, где разрешена подводная охота, построение маршрута от вашего местоположения</p>
        </Link>
        <Link to="/blog" className={styles.card}>
          <span className={styles.cardIcon}><BlogIcon /></span>
          <h2>Блог</h2>
          <p>Правила, путёвки, экипировка и советы по подводной охоте в Беларуси</p>
        </Link>
        <Link to="/reference" className={styles.card}>
          <span className={styles.cardIcon}><ReferenceIcon /></span>
          <h2>Справочник</h2>
          <p>Экипировка, правила и полезная информация для подводной охоты</p>
        </Link>
        <Link to="/contacts" className={styles.card}>
          <span className={styles.cardIcon}><PhoneIcon /></span>
          <h2>Разрешения</h2>
          <p>Организации, выдающие путёвки на подводную охоту (БООР и др.)</p>
        </Link>
      </section>
    </div>
    </PageWithBg>
  );
}
