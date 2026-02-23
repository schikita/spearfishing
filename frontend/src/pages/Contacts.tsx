import { useEffect, useState } from 'react';
import { api, PermitOrganization } from '../api/client';
import styles from './Contacts.module.css';

export default function Contacts() {
  const [list, setList] = useState<PermitOrganization[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.permitOrganizations()
      .then(setList)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className={styles.loading}>Загрузка…</div>;

  return (
    <div className={styles.wrap}>
      <h1>Организации, выдающие разрешения</h1>
      <p className={styles.intro}>
        Контактная информация для получения путёвок на подводную охоту. Актуальные перечни водоёмов и условия — на сайтах организаций.
      </p>
      <ul className={styles.list}>
        {list.map((org) => (
          <li key={org.id} className={styles.card}>
            <h2>{org.nameRu || org.name}</h2>
            {org.region && <span className={styles.region}>{org.region}</span>}
            {org.description && <p>{org.description}</p>}
            {org.url && (
              <a href={org.url} target="_blank" rel="noopener noreferrer" className={styles.link}>
                Перейти на сайт →
              </a>
            )}
            {org.phone && <p className={styles.contact}>Тел.: {org.phone}</p>}
            {org.address && <p className={styles.contact}>Адрес: {org.address}</p>}
          </li>
        ))}
      </ul>
      {list.length === 0 && (
        <p className={styles.empty}>Список организаций пока пуст.</p>
      )}
    </div>
  );
}
