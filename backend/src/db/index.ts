import * as schema from './schema.js';

const mod = process.env.POSTGRES_URL
  ? await import('./postgres.js')
  : await import('./sqlite.js');

// Cast so TS sees one DB type; at runtime db is Postgres when POSTGRES_URL is set
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const db = mod.db as any;
export const initDb = mod.initDb;
export const users = mod.users as typeof schema.users;
export const waterBodies = mod.waterBodies as typeof schema.waterBodies;
export const referenceSections = mod.referenceSections as typeof schema.referenceSections;
export const permitOrganizations = mod.permitOrganizations as typeof schema.permitOrganizations;
export const pageSettings = (mod as { pageSettings?: typeof schema.pageSettings }).pageSettings ?? schema.pageSettings;
export const subscriptions = (mod as { subscriptions?: typeof schema.subscriptions }).subscriptions ?? schema.subscriptions;
export type User = typeof schema.users.$inferSelect;
