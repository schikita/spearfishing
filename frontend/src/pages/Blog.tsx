import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, BlogPost } from '../api/client';
import PageWithBg from '../components/PageWithBg';
import SeoHead from '../components/SeoHead';
import styles from './Blog.module.css';

function Markdown({ text }: { text: string }) {
  const html = text
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/^\d+\.\s+(.*)$/gim, '<li>$1</li>')
    .replace(/^[-*]\s+(.*)$/gim, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
    .replace(/\n/g, '<br />')
    .replace(/<\/ul><br \/>/g, '</ul>')
    .replace(/<br \/><ul>/g, '<ul>');
  return <div className={styles.content} dangerouslySetInnerHTML={{ __html: html }} />;
}

export default function Blog() {
  const { slug } = useParams();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [current, setCurrent] = useState<BlogPost | null>(null);
  const [pageInfo, setPageInfo] = useState({
    title: 'Блог о подводной охоте',
    intro: 'Познавательные статьи о подводной охоте в Беларуси: правила, экипировка, водоёмы и безопасность.',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.blog()
      .then(setPosts)
      .catch(() => setError('Не удалось загрузить статьи'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    api.settings.pageInfo().then((info) => {
      const b = info.blog;
      if (b) setPageInfo({ title: b.title, intro: b.intro });
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!slug) {
      setCurrent(null);
      return;
    }
    api.blogBySlug(slug).then(setCurrent).catch(() => setCurrent(null));
  }, [slug]);

  if (loading) return <div className={styles.loading}>Загрузка…</div>;
  if (error) return <div className={styles.error}>{error}</div>;

  const pageTitle = current ? (current.titleRu || current.title) : pageInfo.title;
  const pageDesc = current
    ? (current.excerpt || current.content.slice(0, 160).replace(/\n/g, ' ') + '…')
    : pageInfo.intro;

  return (
    <PageWithBg pageKey="blog" blur>
      <SeoHead
        title={pageTitle}
        description={pageDesc}
        path={slug ? `blog/${slug}` : 'blog'}
        jsonLd={
          current
            ? {
                '@context': 'https://schema.org',
                '@type': 'Article',
                headline: current.titleRu || current.title,
                description: pageDesc,
                inLanguage: 'ru-BY',
              }
            : {
                '@context': 'https://schema.org',
                '@type': 'Blog',
                name: pageInfo.title,
                description: pageInfo.intro,
                inLanguage: 'ru-BY',
              }
        }
      />
      <div className={styles.wrap}>
        {current ? (
          <article className={styles.article}>
            <Link to="/blog" className={styles.back}>← Все статьи</Link>
            <h1>{current.titleRu || current.title}</h1>
            {current.excerpt && <p className={styles.lead}>{current.excerpt}</p>}
            <Markdown text={current.content} />
            <div className={styles.cta}>
              <Link to="/map" className={styles.ctaPrimary}>Открыть карту водоёмов</Link>
              <Link to="/contacts" className={styles.ctaSecondary}>Где оформить путёвку</Link>
            </div>
            <aside className={styles.related}>
              <h2>Читайте также</h2>
              <ul>
                {posts
                  .filter((p) => p.slug !== current.slug)
                  .slice(0, 4)
                  .map((p) => (
                    <li key={p.id}>
                      <Link to={`/blog/${p.slug}`}>{p.titleRu || p.title}</Link>
                    </li>
                  ))}
              </ul>
            </aside>
          </article>
        ) : (
          <>
            <h1>{pageInfo.title}</h1>
            <p className={styles.intro}>{pageInfo.intro}</p>
            <div className={styles.list}>
              {posts.map((p) => (
                <Link key={p.id} to={`/blog/${p.slug}`} className={styles.card}>
                  <h2>{p.titleRu || p.title}</h2>
                  <p>{p.excerpt || p.content.slice(0, 140).replace(/\n/g, ' ') + '…'}</p>
                  <span className={styles.readMore}>Читать →</span>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </PageWithBg>
  );
}
