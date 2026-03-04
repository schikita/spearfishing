import { useEffect, useState } from 'react';
import { api } from '../api/client';
import PageWithBg from '../components/PageWithBg';
import styles from './Info.module.css';

export default function Info() {
  const [pageInfo, setPageInfo] = useState<{ title: string; intro: string; phone?: string; email?: string }>({
    title: 'Справочная информация',
    intro: 'Контактная информация проекта «Подводная охота в Беларуси».',
    phone: '',
    email: '',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.settings.pageInfo().then((info) => {
      const i = info.info;
      if (i) setPageInfo({ title: i.title, intro: i.intro, phone: i.phone ?? '', email: i.email ?? '' });
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className={styles.loading}>Загрузка…</div>;

  return (
    <PageWithBg pageKey="info" blur>
      <div className={styles.wrap}>
        <h1>{pageInfo.title}</h1>
        <p className={styles.intro}>{pageInfo.intro}</p>
        <div className={styles.contacts}>
          {pageInfo.phone && (
            <p className={styles.contact}>
              <strong>Телефон:</strong>{' '}
              <a href={`tel:${pageInfo.phone.replace(/\s/g, '')}`}>{pageInfo.phone}</a>
            </p>
          )}
          {pageInfo.email && (
            <p className={styles.contact}>
              <strong>Email:</strong>{' '}
              <a href={`mailto:${pageInfo.email}`}>{pageInfo.email}</a>
            </p>
          )}
          {!pageInfo.phone && !pageInfo.email && (
            <p className={styles.empty}>Контактные данные пока не указаны.</p>
          )}
        </div>
      </div>
    </PageWithBg>
  );
}
