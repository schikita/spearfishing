export const SITE_URL = (import.meta.env?.VITE_SITE_URL as string | undefined) || 'https://spearfishing.by';

export const SITE_NAME = 'Подводная охота — Беларусь';
export const DEFAULT_TITLE = SITE_NAME;
export const DEFAULT_DESCRIPTION = 'Подводная охота в Беларуси — справочник водоёмов, карта, правила и контакты организаций';
export const OG_IMAGE = `${SITE_URL.replace(/\/$/, '')}/og-image.png`;
