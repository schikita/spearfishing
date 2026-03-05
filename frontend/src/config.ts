export const SITE_URL = (typeof process !== 'undefined' && process.env?.VITE_SITE_URL)
  || (typeof import.meta !== 'undefined' && (import.meta as { env?: { VITE_SITE_URL?: string } }).env?.VITE_SITE_URL)
  || 'https://spearfishing.by';

export const DEFAULT_TITLE = 'Подводная охота — Беларусь';
export const DEFAULT_DESCRIPTION = 'Подводная охота в Беларуси — справочник водоёмов, карта, правила и контакты организаций';
