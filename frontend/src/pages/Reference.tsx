import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, ReferenceSection } from '../api/client';
import styles from './Reference.module.css';

function Markdown({ text }: { text: string }) {
  const html = text
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br />');
  return <div className={styles.content} dangerouslySetInnerHTML={{ __html: html }} />;
}

export default function Reference() {
  const { slug } = useParams();
  const [sections, setSections] = useState<ReferenceSection[]>([]);
  const [current, setCurrent] = useState<ReferenceSection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.reference()
      .then(setSections)
      .catch(() => setError('Не удалось загрузить разделы'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!slug) {
      setCurrent(null);
      return;
    }
    api.referenceBySlug(slug).then(setCurrent).catch(() => setCurrent(null));
  }, [slug]);

  if (loading) return <div className={styles.loading}>Загрузка…</div>;
  if (error) return <div className={styles.error}>{error}</div>;

  return (
    <div className={styles.wrap}>
      <h1>Справочная информация</h1>
      <div className={styles.grid}>
        <aside className={styles.sidebar}>
          <nav>
            {sections.map((s) => (
              <Link
                key={s.id}
                to={`/reference/${s.slug}`}
                className={slug === s.slug ? styles.active : ''}
              >
                {s.titleRu || s.title}
              </Link>
            ))}
          </nav>
        </aside>
        <article className={styles.article}>
          {current ? (
            <>
              <h2>{current.titleRu || current.title}</h2>
              <Markdown text={current.content} />
            </>
          ) : slug ? (
            <p>Раздел не найден.</p>
          ) : (
            <p>Выберите раздел слева или перейдите по ссылке с главной.</p>
          )}
        </article>
      </div>
    </div>
  );
}
