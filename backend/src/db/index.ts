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
export const blogPosts = mod.blogPosts as typeof schema.blogPosts;
export const permitOrganizations = mod.permitOrganizations as typeof schema.permitOrganizations;
export const pageSettings = (mod as { pageSettings?: typeof schema.pageSettings }).pageSettings ?? schema.pageSettings;
export const subscriptions = (mod as { subscriptions?: typeof schema.subscriptions }).subscriptions ?? schema.subscriptions;
export const waterBodySources = (mod as { waterBodySources?: typeof schema.waterBodySources }).waterBodySources ?? schema.waterBodySources;
export const externalSourceFeatures = (mod as { externalSourceFeatures?: typeof schema.externalSourceFeatures }).externalSourceFeatures ?? schema.externalSourceFeatures;
export const externalVerifications = (mod as { externalVerifications?: typeof schema.externalVerifications }).externalVerifications ?? schema.externalVerifications;
export const winteringPits = (mod as { winteringPits?: typeof schema.winteringPits }).winteringPits ?? schema.winteringPits;
export const weatherCache = (mod as { weatherCache?: typeof schema.weatherCache }).weatherCache ?? schema.weatherCache;
export const visibilityReports = (mod as { visibilityReports?: typeof schema.visibilityReports }).visibilityReports ?? schema.visibilityReports;
export const correctionSuggestions = (mod as { correctionSuggestions?: typeof schema.correctionSuggestions }).correctionSuggestions ?? schema.correctionSuggestions;
export type User = typeof schema.users.$inferSelect;
