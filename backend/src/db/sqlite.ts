import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb as initSqlite } from './init.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.SQLITE_PATH || path.join(__dirname, '../../data/spearfishing.db');

export const sqlite = new Database(dbPath);
export const db = drizzle(sqlite, { schema });
export const initDb = initSqlite;
export * from './schema.js';
