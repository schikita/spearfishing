import fs from 'fs/promises';
import path from 'path';
import { db, waterBodies, referenceSections, blogPosts } from './db/index.js';
import { eq } from 'drizzle-orm';

export const SITE_URL = (process.env.SITE_URL || 'https://spearfishing.by').replace(/\/$/, '');
export const SITE_NAME = 'Подводная охота — Беларусь';
export const DEFAULT_DESCRIPTION =
  'Подводная охота в Беларуси — справочник водоёмов, карта, правила и контакты организаций';
export const OG_IMAGE = `${SITE_URL}/og-image.png`;

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

export async function resolveSeo(pathname: string): Promise<SeoData | null> {
  if (isNoIndex(pathname)) {
    return { title: SITE_NAME, description: DEFAULT_DESCRIPTION, path: pathname.slice(1), noIndex: true };
  }

  const staticPage = STATIC_PAGES[pathname];
  if (staticPage) {
    return {
      ...staticPage,
      path: pathname === '/' ? '' : pathname.slice(1),
      jsonLd: pathname === '/'
        ? {
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: SITE_NAME,
            url: SITE_URL,
            description: staticPage.description,
            inLanguage: 'ru-BY',
          }
        : undefined,
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
    const jsonLd: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'Place',
      name,
      description,
      address: { '@type': 'PostalAddress', addressRegion: wb.region, addressCountry: 'BY' },
    };
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      jsonLd.geo = { '@type': 'GeoCoordinates', latitude: lat, longitude: lng };
    }
    return {
      title: name,
      description,
      path: `water/${wb.id}`,
      jsonLd,
      bodyHtml: `<article><h1>${escapeHtml(name)}</h1><p>${escapeHtml(wb.region)}</p>${wb.description ? `<p>${escapeHtml(wb.description)}</p>` : ''}${wb.permitInfo ? `<p>${escapeHtml(wb.permitInfo)}</p>` : ''}</article>`,
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
      bodyHtml: `<article><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p></article>`,
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
    return {
      title,
      description,
      path: `blog/${slug}`,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: title,
        description,
        inLanguage: 'ru-BY',
        author: { '@type': 'Organization', name: SITE_NAME },
        publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
        mainEntityOfPage: `${SITE_URL}/blog/${slug}`,
      },
      bodyHtml: `<article><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p></article>`,
    };
  }

  return null;
}

function buildHeadTags(seo: SeoData): string {
  const title = fullTitle(seo.title);
  const url = seo.path ? `${SITE_URL}/${seo.path}` : SITE_URL;
  const robots = seo.noIndex ? '<meta name="robots" content="noindex, nofollow" />' : '';
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
    <meta property="og:image" content="${OG_IMAGE}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:type" content="image/png" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(seo.description)}" />
    <meta name="twitter:image" content="${OG_IMAGE}" />
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
