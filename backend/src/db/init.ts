import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { mkdirSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '../../data');
const dbPath = process.env.SQLITE_PATH || path.join(dataDir, 'spearfishing.db');

export function initDb(): void {
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  const db = new Database(dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      allowed_ip TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS water_bodies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      name_ru TEXT,
      region TEXT NOT NULL,
      description TEXT,
      lat TEXT NOT NULL,
      lng TEXT NOT NULL,
      geometry TEXT,
      permit_info TEXT,
      order_index INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS reference_sections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      title_ru TEXT,
      content TEXT NOT NULL,
      order_index INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS permit_organizations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      name_ru TEXT,
      region TEXT NOT NULL,
      description TEXT,
      url TEXT,
      phone TEXT,
      address TEXT,
      order_index INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_water_bodies_region ON water_bodies(region);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  `);
  try {
    db.exec('ALTER TABLE water_bodies ADD COLUMN geometry TEXT');
  } catch {
    /* column already exists */
  }
  try {
    db.exec('ALTER TABLE users ADD COLUMN has_access INTEGER NOT NULL DEFAULT 0');
  } catch {
    /* column already exists */
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      payment_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
  `);

  const adminCount = db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number };
  if (adminCount.c === 0) {
    const email = process.env.ADMIN_EMAIL || 'admin@spearfishing.by';
    const password = process.env.ADMIN_PASSWORD || 'admin123';
    const hash = bcrypt.hashSync(password, 10);
    db.prepare('INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)').run(email, hash, 'admin');
    const refContent1 = '## Что нужно для подводной охоты\n\n- **Гидрокостюм** — неопреновый.\n- **Маска и трубка**, **ласты**, **подводное ружьё**, **грузовой пояс**, **перчатки**, **нож**, **кукан**.';
    const refContent2 = '## Правила подводной охоты в Беларуси\n\n- Только в разрешённых водоёмах, по путёвке. Без аквалангов.';
    db.prepare('INSERT OR IGNORE INTO reference_sections (slug, title, title_ru, content, order_index) VALUES (?, ?, ?, ?, ?)').run('equipment', 'Экипировка', 'Экипировка', refContent1, 1);
    db.prepare('INSERT OR IGNORE INTO reference_sections (slug, title, title_ru, content, order_index) VALUES (?, ?, ?, ?, ?)').run('rules', 'Правила', 'Правила', refContent2, 2);
    db.prepare(`INSERT OR IGNORE INTO permit_organizations (name, name_ru, region, description, url, order_index) VALUES 
      ('БООР — Брестская область', 'БООР — Брестская область', 'Брестская', 'Выдача разрешений на подводную охоту', 'https://rgooboor.by/fishing/15?type=8', 1),
      ('БООР — Гомельская область', 'БООР — Гомельская область', 'Гомельская', 'Выдача разрешений на подводную охоту', 'https://rgooboor.by/fishing/26?type=8', 2)`).run();
    db.prepare(`INSERT OR IGNORE INTO water_bodies (name, name_ru, region, lat, lng, description, permit_info, order_index) VALUES 
      ('Озеро Белое (Брестская обл.)', 'Озеро Белое (Брестская обл.)', 'Брестская', '52.0875', '25.8019', 'Разрешена подводная охота по путёвкам БООР.', 'Путёвка БООР', 1),
      ('Водохранилище (пример)', 'Водохранилище (пример)', 'Гомельская', '52.4345', '30.9754', 'Уточняйте перечень в БООР.', 'Путёвка БООР', 2)`).run();
    console.log('DB seeded. Admin:', email);
  }
  db.close();
}
