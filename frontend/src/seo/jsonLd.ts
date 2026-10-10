import { SITE_NAME, SITE_URL } from '../config';

const base = SITE_URL.replace(/\/$/, '');

export function breadcrumbList(items: { name: string; path?: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.path ? `${base}/${item.path.replace(/^\//, '')}` : base,
    })),
  };
}

export function organizationLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: base,
    logo: `${base}/apple-touch-icon.png`,
    inLanguage: 'ru-BY',
  };
}

export function toIsoDate(value?: string | null): string | undefined {
  if (!value) return undefined;
  const raw = String(value).trim();
  if (/^CURRENT_/i.test(raw)) return undefined;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}
