import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import bcrypt from 'bcryptjs';
import * as schema from './schema-pg.js';

export * from './schema-pg.js';

const pool = new Pool({ connectionString: process.env.POSTGRES_URL, max: 1 });
export const db = drizzle(pool, { schema });

export async function initDb(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        allowed_ip TEXT,
        created_at TEXT NOT NULL DEFAULT now()::text
      );
      CREATE TABLE IF NOT EXISTS water_bodies (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        name_ru TEXT,
        region TEXT NOT NULL,
        description TEXT,
        lat TEXT NOT NULL,
        lng TEXT NOT NULL,
        permit_info TEXT,
        order_index INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT now()::text
      );
      CREATE TABLE IF NOT EXISTS reference_sections (
        id SERIAL PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        title_ru TEXT,
        content TEXT NOT NULL,
        order_index INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT now()::text,
        updated_at TEXT NOT NULL DEFAULT now()::text
      );
      CREATE TABLE IF NOT EXISTS permit_organizations (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        name_ru TEXT,
        region TEXT NOT NULL,
        description TEXT,
        url TEXT,
        phone TEXT,
        address TEXT,
        order_index INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT now()::text
      );
      CREATE INDEX IF NOT EXISTS idx_water_bodies_region ON water_bodies(region);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    `);
    const r = await client.query('SELECT COUNT(*)::int as c FROM users');
    if (r.rows[0].c === 0) {
      const email = process.env.ADMIN_EMAIL || 'admin@spearfishing.by';
      const password = process.env.ADMIN_PASSWORD || 'admin123';
      const hash = bcrypt.hashSync(password, 10);
      await client.query(
        'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3)',
        [email, hash, 'admin']
      );
      await client.query(`
        INSERT INTO reference_sections (slug, title, title_ru, content, order_index) VALUES
        ('equipment', 'Экипировка', 'Экипировка', '## Что нужно для подводной охоты\n\n- **Гидрокостюм** — неопреновый.\n- **Маска и трубка**, **ласты**, **подводное ружьё**, **грузовой пояс**, **перчатки**, **нож**, **кукан**.', 1),
        ('rules', 'Правила', 'Правила', '## Правила подводной охоты в Беларуси\n\n- Только в разрешённых водоёмах, по путёвке. Без аквалангов.', 2)
        ON CONFLICT (slug) DO NOTHING
      `);
      await client.query(`
        INSERT INTO permit_organizations (name, name_ru, region, description, url, order_index) VALUES
        ('БООР — Брестская область', 'БООР — Брестская область', 'Брестская', 'Выдача разрешений на подводную охоту', 'https://rgooboor.by/fishing/15?type=8', 1),
        ('БООР — Гомельская область', 'БООР — Гомельская область', 'Гомельская', 'Выдача разрешений на подводную охоту', 'https://rgooboor.by/fishing/26?type=8', 2)
      `);
      await client.query(`
        INSERT INTO water_bodies (name, name_ru, region, lat, lng, description, permit_info, order_index) VALUES
        ('Озеро Белое (Брестская обл.)', 'Озеро Белое (Брестская обл.)', 'Брестская', '52.0875', '25.8019', 'Разрешена подводная охота по путёвкам БООР.', 'Путёвка БООР', 1),
        ('Водохранилище (пример)', 'Водохранилище (пример)', 'Гомельская', '52.4345', '30.9754', 'Уточняйте перечень в БООР.', 'Путёвка БООР', 2)
      `);
      console.log('DB seeded. Admin:', email);
    }
  } finally {
    client.release();
  }
}
