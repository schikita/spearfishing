import fs from 'fs/promises';
import path from 'path';
import { db, waterBodies, referenceSections, blogPosts } from './db/index.js';
import { eq } from 'drizzle-orm';

export const SITE_URL = (process.env.SITE_URL || 'https://spearfishing.space').replace(/\/$/, '');
export const SITE_NAME = 'Подводная охота — Беларусь';
export const DEFAULT_DESCRIPTION =
  'Карта разрешённых водоёмов, правила, экипировка и контакты для путёвок. Справочник по подводной охоте в Беларуси.';
export const OG_IMAGE = `${SITE_URL}/og-image.jpg`;
export const LOGO_URL = `${SITE_URL}/uploads/logo.png`;

const NO_INDEX_PREFIXES = ['/login', '/register', '/admin', '/subscription'];

const HOME_DESCRIPTION =
  'Карта разрешённых водоёмов, правила, экипировка и контакты организаций для путёвок. Актуальный справочник по подводной охоте в Беларуси.';

const STATIC_PAGES: Record<string, { title: string; description: string }> = {
  '/': {
    title: 'Подводная охота в Беларуси — карта водоёмов и правила',
    description: HOME_DESCRIPTION,
  },
  '/map': {
    title: 'Карта водоёмов для подводной охоты',
    description:
      'Интерактивная карта водоёмов Беларуси, где разрешена подводная охота. Маршрут от вашего местоположения до выбранного озера или реки.',
  },
  '/reference': {
    title: 'Справочник по подводной охоте',
    description: 'Экипировка, правила и полезная информация для подводной охоты в Беларуси — кратко и по делу.',
  },
  '/blog': {
    title: 'Блог о подводной охоте в Беларуси',
    description:
      'Статьи о правилах, путёвках, экипировке, безопасности и водоёмах. Советы новичкам и опытным охотникам.',
  },
  '/contacts': {
    title: 'Разрешения и контакты организаций',
    description:
      'Куда обратиться за путёвкой на подводную охоту в Беларуси: БООР и другие организации, телефоны и сайты.',
  },
  '/info': {
    title: 'О проекте и контакты',
    description: 'Контактная информация проекта «Подводная охота в Беларуси». Телефон и email для связи.',
  },
  '/privacy': {
    title: 'Политика конфиденциальности',
    description:
      'Политика конфиденциальности сайта «Подводная охота в Беларуси». Обработка персональных данных, хранение паролей, cookies.',
  },
  '/terms': {
    title: 'Пользовательское соглашение',
    description: 'Пользовательское соглашение сайта «Подводная охота в Беларуси». Условия использования сервиса.',
  },
};

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
  { name: 'Карта водоёмов', url: `${SITE_URL}/map` },
  { name: 'Блог', url: `${SITE_URL}/blog` },
  { name: 'Справочник', url: `${SITE_URL}/reference` },
  { name: 'Разрешения', url: `${SITE_URL}/contacts` },
];

const REFERENCE_SEO: Record<string, { description: string; faq?: { question: string; answer: string }[] }> = {
  equipment: {
    description:
      'Экипировка для подводной охоты в Беларуси: гидрокостюм, маска, ласты, ружьё, грузовой пояс и аксессуары. Подробный список для новичков и советы по выбору снаряжения.',
    faq: [
      {
        question: 'Какая экипировка нужна новичку для подводной охоты?',
        answer:
          'Минимальный набор: неопреновый гидрокостюм, маска и трубка, ласты, подводное ружьё, грузовой пояс, перчатки, нож и кукан.',
      },
      {
        question: 'Какой гидрокостюм выбрать для подводной охоты в Беларуси?',
        answer:
          'Летом — 3–5 мм, весной и осенью — 5–7 мм, в холодной воде — 7–9 мм с капюшоном. Важно плотное прилегание к телу.',
      },
      {
        question: 'Можно ли использовать акваланг при подводной охоте?',
        answer:
          'Нет. В Беларуси подводная охота разрешена только на задержке дыхания; акваланги при охоте запрещены.',
      },
    ],
  },
  rules: {
    description:
      'Правила подводной охоты в Беларуси: разрешённые водоёмы, путёвки, запрет акваланга, сезоны и нормы вылова.',
    faq: [
      {
        question: 'Где разрешена подводная охота в Беларуси?',
        answer:
          'Только на водоёмах из утверждённых перечней и при наличии путёвки. Список водоёмов — на карте spearfishing.space.',
      },
      {
        question: 'Можно ли использовать акваланг при подводной охоте?',
        answer:
          'Нет. Подводная охота ведётся только на задержке дыхания; акваланги при охоте запрещены.',
      },
      {
        question: 'Нужна ли путёвка на каждый выезд?',
        answer:
          'Да. Охота без действующей путёвки на конкретный водоём запрещена.',
      },
    ],
  },
};

function plainTextExcerpt(text: string, maxLen = 160): string {
  const plain = text
    .replace(/^#{1,3}\s+/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^-\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (plain.length <= maxLen) return plain;
  return `${plain.slice(0, maxLen - 1).trim()}…`;
}

function markdownToSimpleHtml(text: string): string {
  const lines = text.split('\n');
  const out: string[] = [];
  let inList = false;
  let listTag = 'ul';
  const closeList = () => {
    if (inList) {
      out.push(`</${listTag}>`);
      inList = false;
    }
  };
  const inline = (s: string) => {
    const safe = escapeHtml(s);
    return safe
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      closeList();
      continue;
    }
    const numbered = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (trimmed.startsWith('### ')) {
      closeList();
      out.push(`<h3>${inline(trimmed.slice(4))}</h3>`);
    } else if (trimmed.startsWith('## ')) {
      closeList();
      out.push(`<h2>${inline(trimmed.slice(3))}</h2>`);
    } else if (trimmed.startsWith('- ')) {
      if (!inList || listTag !== 'ul') {
        closeList();
        out.push('<ul>');
        inList = true;
        listTag = 'ul';
      }
      out.push(`<li>${inline(trimmed.slice(2))}</li>`);
    } else if (numbered) {
      if (!inList || listTag !== 'ol') {
        closeList();
        out.push('<ol>');
        inList = true;
        listTag = 'ol';
      }
      out.push(`<li>${inline(numbered[2])}</li>`);
    } else {
      closeList();
      out.push(`<p>${inline(trimmed)}</p>`);
    }
  }
  closeList();
  return out.join('');
}

export interface SeoData {
  title: string;
  description: string;
  path: string;
  noIndex?: boolean;
  image?: string;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  bodyHtml?: string;
  /** Visible HTML shell inside #root for fast LCP (replaced by React on mount). */
  shellHtml?: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fullTitle(title: string): string {
  return title.includes('Подводная охота') ? title : `${title} | Подводная охота`;
}

function organizationLd(): Record<string, unknown> {
  return {
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: SITE_NAME,
    url: SITE_URL,
    logo: {
      '@type': 'ImageObject',
      url: LOGO_URL,
      width: 256,
      height: 235,
    },
    image: OG_IMAGE,
    description: HOME_DESCRIPTION,
    areaServed: {
      '@type': 'Country',
      name: 'Belarus',
    },
    inLanguage: 'ru-BY',
  };
}

function websiteLd(): Record<string, unknown> {
  return {
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    name: SITE_NAME,
    url: SITE_URL,
    description: HOME_DESCRIPTION,
    inLanguage: 'ru-BY',
    publisher: { '@id': `${SITE_URL}/#organization` },
  };
}

function breadcrumbLd(items: { name: string; path: string }[]): Record<string, unknown> {
  const lastPath = items[items.length - 1]?.path || '';
  const crumbId = lastPath ? `${SITE_URL}/${lastPath}#breadcrumb` : `${SITE_URL}/#breadcrumb`;
  return {
    '@type': 'BreadcrumbList',
    '@id': crumbId,
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.path ? `${SITE_URL}/${item.path}` : SITE_URL,
    })),
  };
}

function faqLd(): Record<string, unknown> {
  return {
    '@type': 'FAQPage',
    '@id': `${SITE_URL}/#faq`,
    mainEntity: HOME_FAQ.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}

function homeJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      organizationLd(),
      websiteLd(),
      {
        '@type': 'WebPage',
        '@id': `${SITE_URL}/#webpage`,
        url: SITE_URL,
        name: 'Подводная охота в Беларуси — карта водоёмов и правила',
        description: HOME_DESCRIPTION,
        isPartOf: { '@id': `${SITE_URL}/#website` },
        about: { '@id': `${SITE_URL}/#organization` },
        inLanguage: 'ru-BY',
        primaryImageOfPage: {
          '@type': 'ImageObject',
          url: OG_IMAGE,
        },
        breadcrumb: { '@id': `${SITE_URL}/#breadcrumb` },
      },
      breadcrumbLd([{ name: 'Главная', path: '' }]),
      {
        '@type': 'ItemList',
        '@id': `${SITE_URL}/#main-sections`,
        name: 'Разделы сайта',
        itemListElement: MAIN_NAV.map((item, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: item.name,
          url: item.url,
        })),
      },
      faqLd(),
    ],
  };
}

function pageJsonLd(pathname: string, title: string, description: string): Record<string, unknown> {
  const path = pathname === '/' ? '' : pathname.slice(1);
  const url = path ? `${SITE_URL}/${path}` : SITE_URL;
  const crumbs = [{ name: 'Главная', path: '' }, { name: title, path }];

  return {
    '@context': 'https://schema.org',
    '@graph': [
      organizationLd(),
      websiteLd(),
      {
        '@type': 'WebPage',
        '@id': `${url}#webpage`,
        url,
        name: fullTitle(title),
        description,
        isPartOf: { '@id': `${SITE_URL}/#website` },
        inLanguage: 'ru-BY',
        breadcrumb: { '@id': `${url}#breadcrumb` },
      },
      breadcrumbLd(crumbs),
    ],
  };
}

function isoDateOrUndefined(value?: string | null): string | undefined {
  if (!value) return undefined;
  const raw = String(value).trim();
  if (!raw || raw === 'CURRENT_TIMESTAMP') return undefined;
  const isoDay = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoDay) return isoDay[1];
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  return undefined;
}

function homeShellHtml(): string {
  return `
<div class="ssr-shell" data-ssr-shell>
  <picture class="ssr-shell__bg">
    <source srcset="/uploads/home-bg.webp" type="image/webp" />
    <img src="/uploads/home-bg.jpg" alt="" width="1029" height="767" fetchpriority="high" decoding="sync" />
  </picture>
  <div class="ssr-shell__overlay" aria-hidden="true"></div>
  <header class="ssr-shell__header">
    <a class="ssr-shell__brand" href="/">
      <img src="/uploads/logo.png" alt="" width="44" height="44" decoding="async" />
      <span><strong>подводная охота</strong><em>БЕЛАРУСЬ</em></span>
    </a>
  </header>
  <main class="ssr-shell__main">
    <section class="ssr-shell__hero">
      <span class="ssr-shell__badge">Справочник подводной охоты в РБ</span>
      <h1>Подводная охота <span class="ssr-shell__accent">в Беларуси</span></h1>
      <p>Карта разрешённых водоёмов, правила и контакты организаций для получения разрешений</p>
      <div class="ssr-shell__cta">
        <a class="ssr-shell__primary" href="/map">Открыть карту водоёмов</a>
        <a class="ssr-shell__secondary" href="/blog">Читать блог</a>
      </div>
    </section>
  </main>
</div>`.trim();
}

function homeBodyHtml(): string {
  return `<main><h1>Подводная охота в Беларуси</h1><p>${escapeHtml(HOME_DESCRIPTION)}</p><ul>${MAIN_NAV.map((n) => `<li><a href="${escapeHtml(n.url)}">${escapeHtml(n.name)}</a></li>`).join('')}</ul><section><h2>Частые вопросы</h2>${HOME_FAQ.map((f) => `<h3>${escapeHtml(f.question)}</h3><p>${escapeHtml(f.answer)}</p>`).join('')}</section></main>`;
}

function isNoIndex(pathname: string): boolean {
  return NO_INDEX_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Paths that the SPA router handles (unknown paths should return HTTP 404). */
export function isValidAppRoute(pathname: string): boolean {
  if (STATIC_PAGES[pathname]) return true;
  if (isNoIndex(pathname)) return true;
  if (pathname === '/subscription/success') return true;
  if (/^\/water\/\d+$/.test(pathname)) return true;
  if (/^\/reference\/[^/]+$/.test(pathname)) return true;
  if (/^\/blog\/[^/]+$/.test(pathname)) return true;
  return false;
}

export async function resolveSeo(pathname: string): Promise<SeoData | null> {
  if (isNoIndex(pathname)) {
    return { title: SITE_NAME, description: DEFAULT_DESCRIPTION, path: pathname.slice(1), noIndex: true };
  }

  const staticPage = STATIC_PAGES[pathname];
  if (staticPage) {
    const path = pathname === '/' ? '' : pathname.slice(1);
    return {
      ...staticPage,
      path,
      jsonLd: pathname === '/' ? homeJsonLd() : pageJsonLd(pathname, staticPage.title, staticPage.description),
      shellHtml: pathname === '/' ? homeShellHtml() : undefined,
      bodyHtml: pathname === '/' ? homeBodyHtml() : undefined,
    };
  }

  const waterMatch = pathname.match(/^\/water\/(\d+)$/);
  if (waterMatch) {
    const id = Number(waterMatch[1]);
    if (!Number.isFinite(id)) return null;
    const [wb] = await db.select().from(waterBodies).where(eq(waterBodies.id, id));
    if (!wb) return null;
    const name = wb.nameRu || wb.name;
    const description =
      wb.description ||
      `${name} — ${wb.region}. ${wb.permitInfo || 'Разрешена подводная охота.'}`;
    const lat = parseFloat(wb.lat);
    const lng = parseFloat(wb.lng);
    const pageUrl = `${SITE_URL}/water/${wb.id}`;
    const place: Record<string, unknown> = {
      '@type': 'Place',
      '@id': `${pageUrl}#place`,
      name,
      description,
      address: { '@type': 'PostalAddress', addressRegion: wb.region, addressCountry: 'BY' },
    };
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      place.geo = { '@type': 'GeoCoordinates', latitude: lat, longitude: lng };
    }
    return {
      title: name,
      description,
      path: `water/${wb.id}`,
      jsonLd: {
        '@context': 'https://schema.org',
        '@graph': [
          organizationLd(),
          websiteLd(),
          place,
          {
            '@type': 'WebPage',
            '@id': `${pageUrl}#webpage`,
            url: pageUrl,
            name: fullTitle(name),
            description,
            about: { '@id': `${pageUrl}#place` },
            isPartOf: { '@id': `${SITE_URL}/#website` },
            inLanguage: 'ru-BY',
          },
          breadcrumbLd([
            { name: 'Главная', path: '' },
            { name: 'Карта', path: 'map' },
            { name: name, path: `water/${wb.id}` },
          ]),
        ],
      },
      bodyHtml: `<article><h1>${escapeHtml(name)}</h1><p>${escapeHtml(wb.region)}</p>${wb.description ? `<p>${escapeHtml(wb.description)}</p>` : ''}${wb.permitInfo ? `<p>${escapeHtml(wb.permitInfo)}</p>` : ''}</article>`,
    };
  }

  const refMatch = pathname.match(/^\/reference\/([^/]+)$/);
  if (refMatch) {
    const slug = refMatch[1];
    const [section] = await db.select().from(referenceSections).where(eq(referenceSections.slug, slug));
    if (!section) return null;
    const title = section.titleRu || section.title;
    const refSeo = REFERENCE_SEO[slug];
    const description = refSeo?.description ?? plainTextExcerpt(section.content, 155);
    const pageUrl = `${SITE_URL}/reference/${slug}`;
    const articleHtml = markdownToSimpleHtml(section.content);
    const graph: Record<string, unknown>[] = [
      organizationLd(),
      websiteLd(),
      {
        '@type': 'WebPage',
        '@id': `${pageUrl}#webpage`,
        url: pageUrl,
        name: fullTitle(title),
        description,
        isPartOf: { '@id': `${SITE_URL}/#website` },
        inLanguage: 'ru-BY',
      },
      breadcrumbLd([
        { name: 'Главная', path: '' },
        { name: 'Справочник', path: 'reference' },
        { name: title, path: `reference/${slug}` },
      ]),
      {
        '@type': 'Article',
        '@id': `${pageUrl}#article`,
        headline: title,
        description,
        url: pageUrl,
        inLanguage: 'ru-BY',
        author: { '@id': `${SITE_URL}/#organization` },
        publisher: { '@id': `${SITE_URL}/#organization` },
        dateModified: section.updatedAt || section.createdAt,
        mainEntityOfPage: { '@id': `${pageUrl}#webpage` },
        articleSection: 'Справочник по подводной охоте',
      },
    ];
    if (refSeo?.faq?.length) {
      graph.push({
        '@type': 'FAQPage',
        mainEntity: refSeo.faq.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: { '@type': 'Answer', text: item.answer },
        })),
      });
    }
    return {
      title,
      description,
      path: `reference/${slug}`,
      jsonLd: {
        '@context': 'https://schema.org',
        '@graph': graph,
      },
      bodyHtml: `<article><h1>${escapeHtml(title)}</h1>${articleHtml}</article>`,
    };
  }

  const blogMatch = pathname.match(/^\/blog\/([^/]+)$/);
  if (blogMatch) {
    const slug = blogMatch[1];
    const [post] = await db.select().from(blogPosts).where(eq(blogPosts.slug, slug));
    if (!post) return null;
    const title = post.titleRu || post.title;
    const description =
      post.excerpt ||
      post.content.slice(0, 160).replace(/\s+/g, ' ').trim() + '…';
    const image = `${SITE_URL}/blog-covers/${slug}.jpg`;
    const pageUrl = `${SITE_URL}/blog/${slug}`;
    return {
      title,
      description,
      path: `blog/${slug}`,
      image,
      jsonLd: {
        '@context': 'https://schema.org',
        '@graph': [
          organizationLd(),
          websiteLd(),
          {
            '@type': 'Article',
            '@id': `${pageUrl}#article`,
            headline: title,
            description,
            image,
            inLanguage: 'ru-BY',
            author: { '@id': `${SITE_URL}/#organization` },
            publisher: { '@id': `${SITE_URL}/#organization` },
            mainEntityOfPage: pageUrl,
            datePublished: isoDateOrUndefined(post.createdAt),
            dateModified: isoDateOrUndefined(post.updatedAt) || isoDateOrUndefined(post.createdAt),
          },
          {
            '@type': 'WebPage',
            '@id': `${pageUrl}#webpage`,
            url: pageUrl,
            name: fullTitle(title),
            description,
            isPartOf: { '@id': `${SITE_URL}/#website` },
            primaryImageOfPage: { '@type': 'ImageObject', url: image },
            inLanguage: 'ru-BY',
          },
          breadcrumbLd([
            { name: 'Главная', path: '' },
            { name: 'Блог', path: 'blog' },
            { name: title, path: `blog/${slug}` },
          ]),
        ],
      },
      bodyHtml: `<article><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p><img src="${escapeHtml(image)}" alt="" /></article>`,
    };
  }

  return null;
}

function buildHeadTags(seo: SeoData): string {
  const title = fullTitle(seo.title);
  const url = seo.path ? `${SITE_URL}/${seo.path}` : SITE_URL;
  const image = seo.image || OG_IMAGE;
  const imageType = image.endsWith('.jpg') || image.endsWith('.jpeg') ? 'image/jpeg' : image.endsWith('.webp') ? 'image/webp' : 'image/png';
  const robots = seo.noIndex ? '<meta name="robots" content="noindex, nofollow" />' : '<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />';
  const jsonLd = seo.jsonLd
    ? `<script type="application/ld+json">${JSON.stringify(seo.jsonLd)}</script>`
    : '';

  return `
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(seo.description)}" />
    <link rel="canonical" href="${escapeHtml(url)}" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(seo.description)}" />
    <meta property="og:url" content="${escapeHtml(url)}" />
    <meta property="og:type" content="website" />
    <meta property="og:locale" content="ru_BY" />
    <meta property="og:site_name" content="${escapeHtml(SITE_NAME)}" />
    <meta property="og:image" content="${escapeHtml(image)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:type" content="${imageType}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(seo.description)}" />
    <meta name="twitter:image" content="${escapeHtml(image)}" />
    ${robots}
    ${jsonLd}
  `.trim();
}

export function injectSeo(html: string, seo: SeoData): string {
  const headTags = buildHeadTags(seo);
  let result = html
    .replace(/<title>[^<]*<\/title>/i, '')
    .replace(/<meta\s+name="description"[^>]*>/i, '');

  result = result.replace('</head>', `${headTags}\n  </head>`);

  if (seo.shellHtml) {
    result = result.replace(
      '<div id="root"></div>',
      `<div id="root">${seo.shellHtml}</div>`
    );
  }

  if (seo.bodyHtml) {
    result = result.replace(
      '</body>',
      `<noscript>${seo.bodyHtml}</noscript>\n  </body>`
    );
  }

  return result;
}

let cachedIndexHtml: string | null = null;

export async function loadIndexHtml(staticDir: string): Promise<string> {
  if (cachedIndexHtml) return cachedIndexHtml;
  const html = await fs.readFile(path.join(staticDir, 'index.html'), 'utf-8');
  cachedIndexHtml = html;
  return html;
}
