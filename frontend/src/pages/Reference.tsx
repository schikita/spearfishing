import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, ReferenceSection } from '../api/client';
import PageWithBg from '../components/PageWithBg';
import SeoHead from '../components/SeoHead';
import { SITE_URL, SITE_NAME, LOGO_URL } from '../config';
import { markdownExcerpt } from '../components/ReferenceContent';
import { ReferenceContent } from '../components/ReferenceContent';
import { REFERENCE_SEO } from './referenceSeo';
import styles from './Reference.module.css';

function Markdown({ text }: { text: string }) {
  return (
    <div className={styles.content}>
      <ReferenceContent text={text} />
    </div>
  );
}

const base = SITE_URL.replace(/\/$/, '');

export default function Reference() {
  const { slug } = useParams();
  const [sections, setSections] = useState<ReferenceSection[]>([]);
  const [current, setCurrent] = useState<ReferenceSection | null>(null);
  const [pageInfo, setPageInfo] = useState<{ title: string; intro: string }>({
    title: 'Справочник',
    intro: 'Экипировка, правила и полезная информация для подводной охоты в Беларуси.',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.reference()
      .then(setSections)
      .catch(() => setError('Не удалось загрузить разделы'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    api.settings.pageInfo().then((info) => {
      const ref = info.reference;
      if (ref) setPageInfo({ title: ref.title, intro: ref.intro });
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!slug) {
      setCurrent(null);
      return;
    }
    api.referenceBySlug(slug).then(setCurrent).catch(() => setCurrent(null));
  }, [slug]);

  const sectionTitle = current ? (current.titleRu || current.title) : pageInfo.title;
  const seoMeta = slug ? REFERENCE_SEO[slug] : undefined;
  const pageDesc = seoMeta?.description
    ?? (current?.content ? markdownExcerpt(current.content, 155) : pageInfo.intro);

  const heroIntro = seoMeta?.intro ?? (current?.content ? markdownExcerpt(current.content, 220) : pageInfo.intro);

  const jsonLd = useMemo(() => {
    if (!slug || !current) return undefined;

    const pageUrl = `${base}/reference/${slug}`;
    const graph: Record<string, unknown>[] = [
      {
        '@type': 'Organization',
        '@id': `${base}/#organization`,
        name: SITE_NAME,
        url: base,
        logo: LOGO_URL,
      },
      {
        '@type': 'WebPage',
        '@id': `${pageUrl}#webpage`,
        url: pageUrl,
        name: sectionTitle,
        description: pageDesc,
        isPartOf: { '@id': `${base}/#website` },
        inLanguage: 'ru-BY',
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Главная', item: base },
          { '@type': 'ListItem', position: 2, name: 'Справочник', item: `${base}/reference` },
          { '@type': 'ListItem', position: 3, name: sectionTitle, item: pageUrl },
        ],
      },
      {
        '@type': 'Article',
        '@id': `${pageUrl}#article`,
        headline: sectionTitle,
        description: pageDesc,
        url: pageUrl,
        inLanguage: 'ru-BY',
        author: { '@id': `${base}/#organization` },
        publisher: { '@id': `${base}/#organization` },
        dateModified: current.updatedAt || current.createdAt,
        mainEntityOfPage: { '@id': `${pageUrl}#webpage` },
        articleSection: 'Справочник по подводной охоте',
      },
    ];

    if (seoMeta?.faq?.length) {
      graph.push({
        '@type': 'FAQPage',
        mainEntity: seoMeta.faq.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: { '@type': 'Answer', text: item.answer },
        })),
      });
    }

    return { '@context': 'https://schema.org', '@graph': graph };
  }, [slug, current, sectionTitle, pageDesc, seoMeta]);

  if (loading) return <div className={styles.loading}>Загрузка…</div>;
  if (error) return <div className={styles.error}>{error}</div>;

  return (
    <PageWithBg pageKey="reference" blur>
      <SeoHead
        title={slug ? sectionTitle : pageInfo.title}
        description={pageDesc}
        path={slug ? `reference/${slug}` : 'reference'}
        jsonLd={jsonLd}
      />
      <div className={styles.page}>
        <nav className={styles.breadcrumbs} aria-label="Навигация">
          <Link to="/">Главная</Link>
          <span aria-hidden>›</span>
          {slug && current ? (
            <>
              <Link to="/reference">Справочник</Link>
              <span aria-hidden>›</span>
              <span aria-current="page">{sectionTitle}</span>
            </>
          ) : (
            <span aria-current="page">Справочник</span>
          )}
        </nav>

        <section className={styles.hero}>
          <div className={styles.heroGlow} aria-hidden />
          <span className={styles.badge}>Справочник</span>
          <h1>{slug && current ? sectionTitle : pageInfo.title}</h1>
          <p className={styles.lead}>{heroIntro}</p>
        </section>

        <div className={styles.grid}>
          <aside className={styles.sidebar}>
            <div className={styles.sidebarTitle}>Разделы</div>
            <nav aria-label="Разделы справочника">
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

          <div className={styles.mainCol}>
            {current ? (
              <>
                <article className={styles.article}>
                  <Markdown text={current.content} />
                </article>

                <aside className={styles.related} aria-label="Полезные ссылки">
                  <div className={styles.relatedTitle}>Дальше по теме</div>
                  <div className={styles.relatedLinks}>
                    <Link to="/map">Карта водоёмов</Link>
                    <Link to="/contacts">Получить путёвку</Link>
                    <Link to="/blog">Статьи в блоге</Link>
                    {slug !== 'rules' && <Link to="/reference/rules">Правила охоты</Link>}
                    {slug !== 'equipment' && <Link to="/reference/equipment">Экипировка</Link>}
                  </div>
                </aside>

                {seoMeta?.faq && (
                  <section className={styles.faq} aria-labelledby="ref-faq-title">
                    <div className={styles.faqHead}>
                      <h2 id="ref-faq-title">Частые вопросы</h2>
                      <p>Краткие ответы по теме «{sectionTitle}»</p>
                    </div>
                    <div className={styles.faqList}>
                      {seoMeta.faq.map(({ question, answer }) => (
                        <details key={question} className={styles.faqItem}>
                          <summary>{question}</summary>
                          <p>{answer}</p>
                        </details>
                      ))}
                    </div>
                  </section>
                )}
              </>
            ) : slug ? (
              <p className={styles.emptyIntro}>Раздел не найден. Выберите другой раздел в меню слева.</p>
            ) : (
              <p className={styles.emptyIntro}>{pageInfo.intro}</p>
            )}
          </div>
        </div>
      </div>
    </PageWithBg>
  );
}
