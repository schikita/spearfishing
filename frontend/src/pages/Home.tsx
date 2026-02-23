import { Link } from 'react-router-dom';
import styles from './Home.module.css';

export default function Home() {
  return (
    <div className={styles.home}>
      <section className={styles.hero}>
        <h1>Подводная охота в Беларуси</h1>
        <p>Справочник разрешённых водоёмов, правила и контакты организаций для получения разрешений</p>
        <div className={styles.cta}>
          <Link to="/map" className={styles.primary}>Открыть карту водоёмов</Link>
          <Link to="/reference" className={styles.secondary}>Справочная информация</Link>
        </div>
      </section>
      <section className={styles.cards}>
        <Link to="/map" className={styles.card}>
          <span className={styles.cardIcon}>🗺️</span>
          <h2>Карта</h2>
          <p>Водоёмы, где разрешена подводная охота, построение маршрута от вашего местоположения</p>
        </Link>
        <Link to="/reference" className={styles.card}>
          <span className={styles.cardIcon}>📋</span>
          <h2>Справочник</h2>
          <p>Экипировка, правила и полезная информация для подводной охоты</p>
        </Link>
        <Link to="/contacts" className={styles.card}>
          <span className={styles.cardIcon}>📞</span>
          <h2>Разрешения</h2>
          <p>Организации, выдающие путёвки на подводную охоту (БООР и др.)</p>
        </Link>
      </section>
    </div>
  );
}
