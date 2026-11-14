import { Link } from 'react-router-dom';
import PageWithBg from '../components/PageWithBg';
import SeoHead from '../components/SeoHead';
import { SITE_URL, SITE_NAME, OG_IMAGE, LOGO_URL, DEFAULT_DESCRIPTION } from '../config';
import styles from './Home.module.css';

const MapIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 48 48" fill="none" aria-hidden>
    <path d="M5 11l12-4 12 4 14-4v32l-14 4-12-4-12 4V11z" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M17 7v34M31 11v34" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

const ReferenceIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 48 48" fill="none" aria-hidden>
    <rect x="9" y="8" width="30" height="34" rx="3" stroke="currentColor" strokeWidth="2.5" />
    <path d="M15 22h18M15 28h18M15 34h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

const PhoneIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 48 48" fill="none" aria-hidden>
    <path d="M14 8h8l4 10-5 3a22 22 0 0 0 6 6l3-5 10 4v8c0 2-2 4-4 4C18 38 10 22 10 12c0-2 2-4 4-4z" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const BlogIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 48 48" fill="none" aria-hidden>
    <path d="M10 12h28v28H10z" stroke="currentColor" strokeWidth="2.5" rx="3" />
    <path d="M16 20h16M16 26h16M16 32h10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

const ArrowIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const base = SITE_URL.replace(/\/$/, '');

const HOME_FAQ = [
  {
    question: 'Где разрешена подводная охота в Беларуси?',
    answer:
      'Подводная охота разрешена только на водоёмах из утверждённых перечней и при наличии путёвки. На сайте spearfishing.space есть карта разрешённых водоёмов по областям.',
  },
  {
    question: 'Как получить разрешение или путёвку?',
    answer:
      'Путёвки выдают организации, за которыми закреплены водоёмы (в том числе БООР и другие). Контакты организаций собраны в разделе «Разрешения».',
  },
  {
    question: 'Можно ли использовать акваланг?',
    answer:
      'Подводная охота в Беларуси ведётся на задержке дыхания: использование акваланга и других средств принудительной подачи воздуха при охоте запрещено.',
  },
  {
    question: 'Какая экипировка нужна новичку?',
    answer:
      'Базовый набор: маска, трубка, ласты, гидрокостюм по сезону, грузовой пояс и подводное ружьё. Подробности — в справочнике и статьях блога.',
  },
];

const MAIN_NAV = [
  { name: 'Карта водоёмов', url: `${base}/map` },
  { name: 'Блог', url: `${base}/blog` },
  { name: 'Справочник', url: `${base}/reference` },
  { name: 'Разрешения', url: `${base}/contacts` },
];

const SECTIONS = [
  {
    to: '/map',
    icon: MapIcon,
    title: 'Карта водоёмов',
    tag: 'Интерактивно',
    description: 'Водоёмы, где разрешена подводная охота. Постройте маршрут от вашего местоположения.',
  },
  {
    to: '/blog',
    icon: BlogIcon,
    title: 'Блог',
    tag: '10+ статей',
    description: 'Правила, путёвки, экипировка и советы по подводной охоте в Беларуси.',
  },
  {
    to: '/reference',
    icon: ReferenceIcon,
    title: 'Справочник',
    tag: 'Для новичков',
    description: 'Экипировка, правила и полезная информация — кратко и по делу.',
  },
  {
    to: '/contacts',
    icon: PhoneIcon,
    title: 'Разрешения',
    tag: 'Контакты',
    description: 'Организации, выдающие путёвки на подводную охоту (БООР и др.).',
  },
];

const STEPS = [
  { n: '01', title: 'Выберите водоём', text: 'Откройте карту и найдите разрешённый водоём рядом с вами.', to: '/map' },
  { n: '02', title: 'Получите путёвку', text: 'Обратитесь в организацию, за которой закреплён водоём.', to: '/contacts' },
  { n: '03', title: 'Изучите правила', text: 'Сезоны, запреты и требования к снаряжению — в справочнике и блоге.', to: '/reference' },
];

const homeJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${base}/#organization`,
      name: SITE_NAME,
      url: base,
      logo: { '@type': 'ImageObject', url: LOGO_URL, width: 256, height: 235 },
      image: OG_IMAGE,
      description: DEFAULT_DESCRIPTION,
      areaServed: { '@type': 'Country', name: 'Belarus' },
      inLanguage: 'ru-BY',
    },
    {
      '@type': 'WebSite',
      '@id': `${base}/#website`,
      name: SITE_NAME,
      url: base,
      description: DEFAULT_DESCRIPTION,
      inLanguage: 'ru-BY',
      publisher: { '@id': `${base}/#organization` },
    },
    {
      '@type': 'WebPage',
      '@id': `${base}/#webpage`,
      url: base,
      name: 'Подводная охота в Беларуси — карта водоёмов и правила',
      description: DEFAULT_DESCRIPTION,
      isPartOf: { '@id': `${base}/#website` },
      about: { '@id': `${base}/#organization` },
      inLanguage: 'ru-BY',
      primaryImageOfPage: { '@type': 'ImageObject', url: OG_IMAGE },
    },
    {
      '@type': 'ItemList',
      name: 'Разделы сайта',
      itemListElement: MAIN_NAV.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        url: item.url,
      })),
    },
    {
      '@type': 'FAQPage',
      '@id': `${base}/#faq`,
      mainEntity: HOME_FAQ.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    },
  ],
};

export default function Home() {
  return (
    <PageWithBg pageKey="home" blur priority>
      <SeoHead
        title="Подводная охота в Беларуси — карта водоёмов и правила"
        description={DEFAULT_DESCRIPTION}
        path=""
        jsonLd={homeJsonLd}
      />
      <div className={styles.home}>
        <section className={styles.hero}>
          <div className={styles.heroGlow} aria-hidden />
          <span className={styles.badge}>Справочник подводной охоты в РБ</span>
          <h1>
            Подводная охота
            <span className={styles.heroAccent}> в Беларуси</span>
          </h1>
          <p className={styles.lead}>
            Карта разрешённых водоёмов, правила, экипировка и контакты организаций для получения путёвок
          </p>
          <div className={styles.cta}>
            <Link to="/map" className={styles.primary}>
              <MapIcon />
              Открыть карту водоёмов
            </Link>
            <Link to="/blog" className={styles.secondary}>
              Читать блог
            </Link>
          </div>
          <ul className={styles.stats} aria-label="Ключевые возможности">
            <li>
              <strong>70+</strong>
              <span>водоёмов на карте</span>
            </li>
            <li>
              <strong>10+</strong>
              <span>статей в блоге</span>
            </li>
            <li>
              <strong>24/7</strong>
              <span>доступ к справочнику</span>
            </li>
          </ul>
        </section>

        <section className={styles.cards} aria-label="Разделы сайта">
          {SECTIONS.map(({ to, icon: Icon, title, tag, description }) => (
            <Link key={to} to={to} className={styles.card}>
              <div className={styles.cardTop}>
                <span className={styles.cardIcon}><Icon /></span>
                <span className={styles.cardTag}>{tag}</span>
              </div>
              <h2>{title}</h2>
              <p>{description}</p>
              <span className={styles.cardLink}>
                Подробнее
                <ArrowIcon />
              </span>
            </Link>
          ))}
        </section>

        <section className={styles.steps} aria-labelledby="steps-title">
          <div className={styles.sectionHead}>
            <h2 id="steps-title">Как начать</h2>
            <p>Три шага от выбора водоёма до первого погружения</p>
          </div>
          <ol className={styles.stepsList}>
            {STEPS.map(({ n, title, text, to }) => (
              <li key={n}>
                <span className={styles.stepNum}>{n}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                  <Link to={to} className={styles.stepLink}>Перейти →</Link>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.faq} aria-labelledby="faq-title">
          <div className={styles.sectionHead}>
            <h2 id="faq-title">Частые вопросы</h2>
            <p>Кратко о правилах и организации подводной охоты</p>
          </div>
          <div className={styles.faqList}>
            {HOME_FAQ.map(({ question, answer }) => (
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
