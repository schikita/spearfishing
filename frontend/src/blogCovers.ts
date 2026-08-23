import { SITE_URL } from './config';

/** Обложки статей: /blog-covers/{slug}.jpg */
export function blogCoverPath(slug: string): string {
  return `/blog-covers/${slug}.jpg`;
}

export function blogCoverUrl(slug: string): string {
  return `${SITE_URL.replace(/\/$/, '')}${blogCoverPath(slug)}`;
}
