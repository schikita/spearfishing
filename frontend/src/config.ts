export const SITE_URL = (import.meta.env?.VITE_SITE_URL as string | undefined) || 'https://spearfishing.space';

export const SITE_NAME = 'Подводная охота — Беларусь';
export const DEFAULT_TITLE = 'Подводная охота в Беларуси — карта водоёмов и правила';
export const DEFAULT_DESCRIPTION =
  'Карта разрешённых водоёмов, правила, экипировка и контакты для путёвок. Справочник по подводной охоте в Беларуси.';
export const OG_IMAGE = `${SITE_URL.replace(/\/$/, '')}/og-image.jpg`;
export const LOGO_URL = `${SITE_URL.replace(/\/$/, '')}/uploads/logo.png`;
export const FAVICON_URL = `${SITE_URL.replace(/\/$/, '')}/uploads/logo.png`;
