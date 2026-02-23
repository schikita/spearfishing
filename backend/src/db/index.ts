const mod = process.env.POSTGRES_URL
  ? await import('./postgres.js')
  : await import('./sqlite.js');

export const db = mod.db;
export const initDb = mod.initDb;
export const users = mod.users;
export const waterBodies = mod.waterBodies;
export const referenceSections = mod.referenceSections;
export const permitOrganizations = mod.permitOrganizations;
export type User = typeof users.$inferSelect;
