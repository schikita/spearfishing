import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, WaterBody } from '../api/client';
import PageWithBg from '../components/PageWithBg';
import styles from './WaterBodyPage.module.css';

export default function WaterBodyPage() {
  const { id } = useParams<{ id: string }>();
  const [wb, setWb] = useState<WaterBody | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const numId = Number(id);
    if (!Number.isFinite(numId)) {
      setError('Некорректный адрес');
      setLoading(false);
      return;
    }
    api.waterBodyById(numId)
      .then(setWb)
      .catch((e) => setError(e.message || 'Водоём не найден'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className={styles.loading}>Загрузка…</div>;
  if (error || !wb) {
    return (
      <PageWithBg pageKey="map" blur>
        <div className={styles.wrap}>
          <h1>Водоём не найден</h1>
          <p className={styles.error}>{error}</p>
          <Link to="/map" className={styles.backLink}>← На карту</Link>
        </div>
      </PageWithBg>
    );
  }

  return (
    <PageWithBg pageKey="map" blur>
      <div className={styles.wrap}>
        <Link to="/map" className={styles.backLink}>← На карту</Link>
        <h1>{wb.nameRu || wb.name}</h1>
        <p className={styles.region}>{wb.region}</p>
        {wb.description && (
          <div className={styles.section}>
            <h2>Описание</h2>
            <p>{wb.description}</p>
          </div>
        )}
        {wb.permitInfo && (
          <div className={styles.section}>
            <h2>Разрешение</h2>
            <p>{wb.permitInfo}</p>
          </div>
        )}
        <Link to="/contacts" className={styles.link}>Организации, выдающие разрешения →</Link>
        <Link to="/map" className={styles.btn}>
          Построить маршрут
        </Link>
      </div>
    </PageWithBg>
  );
}
