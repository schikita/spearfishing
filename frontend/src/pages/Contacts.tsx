import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, PermitOrganization } from '../api/client';
import PageWithBg from '../components/PageWithBg';
import SeoHead from '../components/SeoHead';
import { SITE_URL, SITE_NAME, LOGO_URL } from '../config';
import styles from './Contacts.module.css';

const OrgIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 48 48" fill="none" aria-hidden>
    <path d="M8 42V18l16-10 16 10v24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M18 42V28h12v14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const MapIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 48 48" fill="none" aria-hidden>
    <path d="M5 11l12-4 12 4 14-4v32l-14 4-12-4-12 4V11z" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ArrowIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const STEPS = [
  {
    n: '01',
    title: 'Выберите водоём на карте',
    text: 'Подводная охота разрешена только на водоёмах из утверждённых перечней. Найдите подходящий водоём в вашем регионе.',
  },
  {
    n: '02',
    title: 'Свяжитесь с организацией',
    text: 'Путёвки выдают организации, за которыми закреплены водоёмы — БООР и другие. Контакты и сайты указаны в карточках ниже.',
  },
  {
    n: '03',
    title: 'Изучите правила',
    text: 'Перед выездом ознакомьтесь с сезонами, запретами и требованиями к снаряжению в справочнике и статьях блога.',
  },
];

const FAQ = [
  {
    question: 'Кто выдаёт путёвки на подводную охоту?',
    answer:
      'Путёвки выдают организации общественных объединений охотников и рыболовов (БООР) и другие уполномоченные организации, за которыми закреплены конкретные водоёмы. Перечень и контакты — на этой странице.',
  },
  {
    question: 'Где посмотреть список разрешённых водоёмов?',
    answer:
      'Интерактивная карта с водоёмами доступна в разделе «Карта». Для каждого водоёма указана организация, выдающая путёвки.',
  },
  {
    question: 'Нужна ли путёвка на каждый выезд?',
    answer:
      'Да, подводная охота на водоёмах из перечня возможна только при наличии действующей путёвки. Условия оформления и стоимость уточняйте у организации, закреплённой за водоёмом.',
  },
];

const base = SITE_URL.replace(/\/$/, '');

function groupByRegion(list: PermitOrganization[]): [string, PermitOrganization[]][] {
  const map = new Map<string, PermitOrganization[]>();
  for (const org of list) {
    const region = org.region?.trim() || 'Беларусь';
    const group = map.get(region) ?? [];
    group.push(org);
    map.set(region, group);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, 'ru'));
}

export default function Contacts() {
  const [list, setList] = useState<PermitOrganization[]>([]);
  const [pageInfo, setPageInfo] = useState<{ title: string; intro: string }>({
    title: 'Организации, выдающие разрешения',
    intro: 'Контактная информация для получения путёвок на подводную охоту. Актуальные перечни водоёмов и условия — на сайтах организаций.',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.permitOrganizations()
      .then(setList)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    api.settings.pageInfo().then((info) => {
      const c = info.contacts;
      if (c) setPageInfo({ title: c.title, intro: c.intro });
    }).catch(() => {});
  }, []);

  const grouped = useMemo(() => groupByRegion(list), [list]);

  const jsonLd = useMemo(
    () => ({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage',
          '@id': `${base}/contacts#webpage`,
          url: `${base}/contacts`,
          name: pageInfo.title,
          description: pageInfo.intro,
          isPartOf: { '@id': `${base}/#website` },
          inLanguage: 'ru-BY',
        },
        {
          '@type': 'ItemList',
          name: 'Организации, выдающие разрешения на подводную охоту',
          itemListElement: list.map((org, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            item: {
              '@type': 'Organization',
              name: org.nameRu || org.name,
              ...(org.url ? { url: org.url } : {}),
              ...(org.region ? { areaServed: org.region } : {}),
            },
          })),
        },
        {
          '@type': 'FAQPage',
          mainEntity: FAQ.map((item) => ({
            '@type': 'Question',
            name: item.question,
            acceptedAnswer: { '@type': 'Answer', text: item.answer },
          })),
        },
        {
          '@type': 'Organization',
          '@id': `${base}/#organization`,
          name: SITE_NAME,
          url: base,
          logo: LOGO_URL,
        },
      ],
    }),
    [list, pageInfo.title, pageInfo.intro],
  );

  if (loading) return <div className={styles.loading}>Загрузка…</div>;

  return (
    <PageWithBg pageKey="contacts" blur>
      <SeoHead
        title={pageInfo.title}
        description="Организации, выдающие разрешения на подводную охоту в Беларуси. БООР и другие. Контакты для получения путёвок."
        path="contacts"
        jsonLd={jsonLd}
      />
      <div className={styles.page}>
        <section className={styles.hero}>
          <div className={styles.heroGlow} aria-hidden />
          <span className={styles.badge}>Путёвки и разрешения</span>
          <h1>{pageInfo.title}</h1>
          <p className={styles.lead}>{pageInfo.intro}</p>
          <div className={styles.cta}>
            <Link to="/map" className={styles.primary}>
              <MapIcon />
              Карта водоёмов
            </Link>
            <Link to="/reference" className={styles.secondary}>
              Правила и экипировка
            </Link>
          </div>
        </section>

        <section className={styles.steps} aria-labelledby="permit-steps">
          <div className={styles.sectionHead}>
            <h2 id="permit-steps">Как получить путёвку</h2>
            <p>Три шага от выбора водоёма до легального выезда на подводную охоту</p>
          </div>
          <ol className={styles.stepsList}>
            {STEPS.map(({ n, title, text }) => (
              <li key={n}>
                <span className={styles.stepNum}>{n}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {list.length === 0 ? (
          <p className={styles.empty}>Список организаций пока пуст. Данные добавляются администратором.</p>
        ) : (
          grouped.map(([region, orgs]) => (
            <section key={region} className={styles.regionBlock} aria-labelledby={`region-${region}`}>
              <div className={styles.sectionHead}>
                <span id={`region-${region}`} className={styles.regionTitle}>{region}</span>
              </div>
              <ul className={styles.orgGrid}>
                {orgs.map((org) => (
                  <li key={org.id} className={styles.card}>
                    <div className={styles.cardTop}>
                      <span className={styles.cardIcon}><OrgIcon /></span>
                      <span className={styles.cardTag}>Организация</span>
                    </div>
                    <h2>{org.nameRu || org.name}</h2>
                    {org.description && <p className={styles.cardDesc}>{org.description}</p>}
                    <div className={styles.meta}>
                      {org.phone && (
                        <span>
                          Тел.:{' '}
                          <a href={`tel:${org.phone.replace(/\s/g, '')}`}>{org.phone}</a>
                        </span>
                      )}
                      {org.address && <span>Адрес: {org.address}</span>}
                    </div>
                    {org.url && (
                      <a
                        href={org.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.cardLink}
                      >
                        Перейти на сайт
                        <ArrowIcon />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}

        <p className={styles.note}>
          Актуальные перечни водоёмов, цены и порядок оформления путёвок публикуются на сайтах организаций.
          Общие правила подводной охоты — в{' '}
          <Link to="/reference">справочнике</Link>, практические советы — в{' '}
          <Link to="/blog">блоге</Link>.
        </p>

        <section className={styles.faq} aria-labelledby="contacts-faq">
          <div className={styles.sectionHead}>
            <h2 id="contacts-faq">Частые вопросы</h2>
            <p>О путёвках и организациях, выдающих разрешения</p>
          </div>
          <div className={styles.faqList}>
            {FAQ.map(({ question, answer }) => (
              <details key={question} className={styles.faqItem}>
                <summary>{question}</summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </PageWithBg>
  );
}
