import fs from 'fs/promises';
import path from 'path';
import { asc, eq } from 'drizzle-orm';
import { db, waterBodies, referenceSections, blogPosts } from './db/index.js';
import { BLOG_ARTICLES } from './db/blog-articles.js';

export const SITE_URL = (process.env.SITE_URL || 'https://spearfishing.space').replace(/\/$/, '');
export const SITE_NAME = 'Подводная охота — Беларусь';
export const DEFAULT_DESCRIPTION =
  'Подводная охота в Беларуси — справочник водоёмов, карта, правила и контакты организаций';
export const OG_IMAGE = `${SITE_URL}/og-image.png`;
export const SITE_LOGO = `${SITE_URL}/apple-touch-icon.png`;

const NO_INDEX_PREFIXES = ['/login', '/register', '/admin', '/subscription'];

const STATIC_PAGES: Record<string, { title: string; description: string }> = {
  '/': {
    title: 'Подводная охота в Беларуси',
    description:
      'Справочник разрешённых водоёмов для подводной охоты в Беларуси. Карта водоёмов, правила, экипировка и контакты организаций для получения путёвок.',
  },
  '/map': {
    title: 'Карта водоёмов',
    description:
      'Интерактивная карта водоёмов Беларуси, где разрешена подводная охота. Построение маршрута от вашего местоположения.',
  },
  '/reference': {
    title: 'Справочная информация',
    description: 'Экипировка, правила и полезная информация для подводной охоты в Беларуси.',
  },
  '/blog': {
    title: 'Блог о подводной охоте в Беларуси',
    description:
      'Статьи о подводной охоте в Беларуси: правила, путёвки, экипировка, карта водоёмов, безопасность и советы новичкам.',
  },
  '/contacts': {
    title: 'Организации, выдающие разрешения',
    description:
      'Организации, выдающие разрешения на подводную охоту в Беларуси. БООР и другие. Контакты для получения путёвок.',
  },
  '/info': {
    title: 'Справочная информация',
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

export interface SeoData {
  title: string;
  description: string;
  path: string;
  noIndex?: boolean;
  image?: string;
  ogType?: 'website' | 'article';
  publishedTime?: string;
  modifiedTime?: string;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  bodyHtml?: string;
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

function toIsoDate(value?: string | null): string | undefined {
  if (!value) return undefined;
  const raw = String(value).trim();
  if (/^CURRENT_/i.test(raw)) return undefined;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

function breadcrumbList(items: { name: string; path?: string }[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.path ? `${SITE_URL}/${item.path.replace(/^\//, '')}` : SITE_URL,
    })),
  };
}

function organizationLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    logo: SITE_LOGO,
    inLanguage: 'ru-BY',
  };
}

function publisherLd(): Record<string, unknown> {
  return {
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    logo: { '@type': 'ImageObject', url: SITE_LOGO },
  };
}

/** Minimal markdown → safe HTML for crawler noscript fallback. */
function markdownToSafeHtml(md: string): string {
  let html = escapeHtml(md);
  html = html
    .replace(/^### (.*)$/gim, '<h3>$1</h3>')
    .replace(/^## (.*)$/gim, '<h2>$1</h2>')
    .replace(/^# (.*)$/gim, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/^\d+\.\s+(.*)$/gim, '<li>$1</li>')
    .replace(/^[-*] (.*)$/gim, '<li>$1</li>')
    .replace(/(?:<li>.*?<\/li>\n?)+/g, (m) => `<ul>${m.replace(/\n/g, '')}</ul>`)
    .replace(/\n{2,}/g, '</p><p>')
    .replace(/\n/g, '<br />');
  return `<p>${html}</p>`
    .replace(/<p><h([1-3])>/g, '<h$1>')
    .replace(/<\/h([1-3])><\/p>/g, '</h$1>')
    .replace(/<p><ul>/g, '<ul>')
    .replace(/<\/ul><\/p>/g, '</ul>')
    .replace(/<p><\/p>/g, '');
}

function asJsonLdArray(
  ...parts: Array<Record<string, unknown> | Record<string, unknown>[] | undefined | null>
): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const part of parts) {
    if (!part) continue;
    if (Array.isArray(part)) out.push(...part);
    else out.push(part);
  }
  return out;
}

async function mapHubBodyHtml(): Promise<string> {
  const waters = await db
    .select({
      id: waterBodies.id,
      name: waterBodies.name,
      nameRu: waterBodies.nameRu,
      region: waterBodies.region,
    })
    .from(waterBodies)
    .orderBy(asc(waterBodies.region), asc(waterBodies.nameRu), asc(waterBodies.name));

  const byRegion = new Map<string, typeof waters>();
  for (const w of waters) {
    const region = w.region || 'Другие';
    if (!byRegion.has(region)) byRegion.set(region, []);
    byRegion.get(region)!.push(w);
  }

  const regionsHtml = [...byRegion.entries()]
    .map(([region, list]) => {
      const items = list
        .map((w) => {
          const name = w.nameRu || w.name;
          return `<li><a href="/water/${w.id}">${escapeHtml(name)}</a></li>`;
        })
        .join('');
      return `<section><h2>${escapeHtml(region)}</h2><ul>${items}</ul></section>`;
    })
    .join('');

  return `<article><h1>Карта водоёмов для подводной охоты в Беларуси</h1><p>Список разрешённых водоёмов по регионам. Откройте карту для маршрута или карточку водоёма для описания.</p><nav aria-label="Водоёмы по регионам">${regionsHtml}</nav><p><a href="/contacts">Организации, выдающие разрешения</a> · <a href="/blog">Блог</a></p></article>`;
}

async function blogIndexBodyHtml(): Promise<string> {
  let posts: { slug: string; title: string; titleRu: string | null; excerpt: string | null }[] = [];
  try {
    posts = await db
      .select({
        slug: blogPosts.slug,
        title: blogPosts.title,
        titleRu: blogPosts.titleRu,
        excerpt: blogPosts.excerpt,
      })
      .from(blogPosts)
      .orderBy(asc(blogPosts.orderIndex));
  } catch {
    posts = [];
  }
  const items = posts
    .map((p) => {
      const title = p.titleRu || p.title;
      const excerpt = p.excerpt ? `<p>${escapeHtml(p.excerpt)}</p>` : '';
      return `<li><a href="/blog/${escapeHtml(p.slug)}"><strong>${escapeHtml(title)}</strong></a>${excerpt}</li>`;
    })
    .join('');
  return `<article><h1>Блог о подводной охоте в Беларуси</h1><p>Статьи о правилах, путёвках, экипировке и водоёмах.</p><ul>${items}</ul><p><a href="/map">Карта водоёмов</a> · <a href="/contacts">Разрешения</a></p></article>`;
}

async function referenceIndexBodyHtml(): Promise<string> {
  const sections = await db
    .select({ slug: referenceSections.slug, title: referenceSections.title, titleRu: referenceSections.titleRu })
    .from(referenceSections)
    .orderBy(asc(referenceSections.orderIndex));
  const items = sections
    .map((s) => `<li><a href="/reference/${escapeHtml(s.slug)}">${escapeHtml(s.titleRu || s.title)}</a></li>`)
    .join('');
  return `<article><h1>Справочник подводной охоты</h1><ul>${items}</ul><p><a href="/blog">Блог</a> · <a href="/map">Карта</a></p></article>`;
}

export async function resolveSeo(pathname: string): Promise<SeoData | null> {
  if (isNoIndex(pathname)) {
    return { title: SITE_NAME, description: DEFAULT_DESCRIPTION, path: pathname.slice(1), noIndex: true };
  }

  const staticPage = STATIC_PAGES[pathname];
  if (staticPage) {
    const path = pathname === '/' ? '' : pathname.slice(1);
    let bodyHtml: string | undefined;
    let jsonLd: Record<string, unknown> | Record<string, unknown>[] | undefined;

    if (pathname === '/') {
      jsonLd = [
        {
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: SITE_NAME,
          url: SITE_URL,
          description: staticPage.description,
          inLanguage: 'ru-BY',
          publisher: { '@id': `${SITE_URL}/#organization` },
        },
        { ...organizationLd(), '@id': `${SITE_URL}/#organization` },
      ];
    } else if (pathname === '/map') {
      bodyHtml = await mapHubBodyHtml();
      jsonLd = breadcrumbList([
        { name: 'Главная' },
        { name: 'Карта', path: 'map' },
      ]);
    } else if (pathname === '/blog') {
      bodyHtml = await blogIndexBodyHtml();
      jsonLd = [
        {
          '@context': 'https://schema.org',
          '@type': 'Blog',
          name: staticPage.title,
          description: staticPage.description,
          url: `${SITE_URL}/blog`,
          inLanguage: 'ru-BY',
        },
        breadcrumbList([
          { name: 'Главная' },
          { name: 'Блог', path: 'blog' },
        ]),
      ];
    } else if (pathname === '/reference') {
      bodyHtml = await referenceIndexBodyHtml();
      jsonLd = breadcrumbList([
        { name: 'Главная' },
        { name: 'Справочник', path: 'reference' },
      ]);
    } else if (pathname === '/contacts') {
      bodyHtml = `<article><h1>${escapeHtml(staticPage.title)}</h1><p>${escapeHtml(staticPage.description)}</p><p><a href="/map">Карта водоёмов</a> · <a href="/blog/kak-poluchit-razreshenie-na-podvodnuyu-ohotu">Как получить путёвку</a> · <a href="/blog/boor-putevki-i-kontakty">БООР и контакты</a></p></article>`;
      jsonLd = breadcrumbList([
        { name: 'Главная' },
        { name: 'Разрешения', path: 'contacts' },
      ]);
    }

    return { ...staticPage, path, jsonLd, bodyHtml };
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
    const place: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'Place',
      name,
      description,
      address: { '@type': 'PostalAddress', addressRegion: wb.region, addressCountry: 'BY' },
    };
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      place.geo = { '@type': 'GeoCoordinates', latitude: lat, longitude: lng };
    }
    const crumbs = breadcrumbList([
      { name: 'Главная' },
      { name: 'Карта', path: 'map' },
      { name, path: `water/${wb.id}` },
    ]);
    return {
      title: name,
      description,
      path: `water/${wb.id}`,
      jsonLd: asJsonLdArray(place, crumbs),
      bodyHtml: `<article><h1>${escapeHtml(name)}</h1><p>${escapeHtml(wb.region)}</p>${wb.description ? `<p>${escapeHtml(wb.description)}</p>` : ''}${wb.permitInfo ? `<p>${escapeHtml(wb.permitInfo)}</p>` : ''}<p><a href="/map">Карта водоёмов</a> · <a href="/contacts">Разрешения</a> · <a href="/blog">Блог</a></p></article>`,
    };
  }

  const refMatch = pathname.match(/^\/reference\/([^/]+)$/);
  if (refMatch) {
    const slug = refMatch[1];
    const [section] = await db.select().from(referenceSections).where(eq(referenceSections.slug, slug));
    if (!section) return null;
    const title = section.titleRu || section.title;
    const description = section.content.slice(0, 160).replace(/\s+/g, ' ').trim() + '…';
    return {
      title,
      description,
      path: `reference/${slug}`,
      jsonLd: breadcrumbList([
        { name: 'Главная' },
        { name: 'Справочник', path: 'reference' },
        { name: title, path: `reference/${slug}` },
      ]),
      bodyHtml: `<article><h1>${escapeHtml(title)}</h1>${markdownToSafeHtml(section.content)}<p><a href="/reference">Все разделы</a> · <a href="/blog">Блог</a></p></article>`,
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
    const publishedTime = toIsoDate(post.createdAt);
    const modifiedTime = toIsoDate(post.updatedAt) || publishedTime;
    const seed = BLOG_ARTICLES.find((a) => a.slug === slug);
    const article: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: title,
      description,
      image,
      inLanguage: 'ru-BY',
      author: { '@type': 'Organization', name: SITE_NAME },
      publisher: publisherLd(),
      mainEntityOfPage: `${SITE_URL}/blog/${slug}`,
    };
    if (publishedTime) article.datePublished = publishedTime;
    if (modifiedTime) article.dateModified = modifiedTime;

    const crumbs = breadcrumbList([
      { name: 'Главная' },
      { name: 'Блог', path: 'blog' },
      { name: title, path: `blog/${slug}` },
    ]);

    const faqLd =
      seed?.faq && seed.faq.length > 0
        ? {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: seed.faq.map((f) => ({
              '@type': 'Question',
              name: f.question,
              acceptedAnswer: { '@type': 'Answer', text: f.answer },
            })),
          }
        : null;

    return {
      title,
      description,
      path: `blog/${slug}`,
      image,
      ogType: 'article',
      publishedTime,
      modifiedTime,
      jsonLd: asJsonLdArray(article, crumbs, faqLd),
      bodyHtml: `<article><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p><img src="${escapeHtml(image)}" alt="" />${markdownToSafeHtml(post.content)}<p><a href="/blog">Все статьи</a> · <a href="/map">Карта</a> · <a href="/contacts">Разрешения</a></p></article>`,
    };
  }

  return null;
}

function buildHeadTags(seo: SeoData): string {
  const title = fullTitle(seo.title);
  const url = seo.path ? `${SITE_URL}/${seo.path}` : SITE_URL;
  const image = seo.image || OG_IMAGE;
  const imageType = image.endsWith('.jpg') || image.endsWith('.jpeg') ? 'image/jpeg' : 'image/png';
  const ogType = seo.ogType || 'website';
  const robots = seo.noIndex ? '<meta name="robots" content="noindex, nofollow" />' : '';
  const articleMeta = [
    seo.publishedTime
      ? `<meta property="article:published_time" content="${escapeHtml(seo.publishedTime)}" />`
      : '',
    seo.modifiedTime
      ? `<meta property="article:modified_time" content="${escapeHtml(seo.modifiedTime)}" />`
      : '',
  ]
    .filter(Boolean)
    .join('\n    ');
  const jsonLdBlocks = seo.jsonLd
    ? (Array.isArray(seo.jsonLd) ? seo.jsonLd : [seo.jsonLd])
        .map((block) => `<script type="application/ld+json">${JSON.stringify(block)}</script>`)
        .join('\n    ')
    : '';

  return `
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(seo.description)}" />
    <link rel="canonical" href="${escapeHtml(url)}" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(seo.description)}" />
    <meta property="og:url" content="${escapeHtml(url)}" />
    <meta property="og:type" content="${ogType}" />
    <meta property="og:locale" content="ru_BY" />
    <meta property="og:site_name" content="${escapeHtml(SITE_NAME)}" />
    <meta property="og:image" content="${escapeHtml(image)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:type" content="${imageType}" />
    ${articleMeta}
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(seo.description)}" />
    <meta name="twitter:image" content="${escapeHtml(image)}" />
    ${robots}
    ${jsonLdBlocks}
  `.trim();
}

export function injectSeo(html: string, seo: SeoData): string {
  const headTags = buildHeadTags(seo);
  let result = html
    .replace(/<title>[^<]*<\/title>/i, '')
    .replace(/<meta\s+name="description"[^>]*>/i, '');

  result = result.replace('</head>', `${headTags}\n  </head>`);

  if (seo.bodyHtml) {
    result = result.replace(
      '<div id="root"></div>',
      `<div id="root"></div>\n    <noscript>${seo.bodyHtml}</noscript>`
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
