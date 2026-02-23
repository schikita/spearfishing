import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull().default('user'), // 'admin' | 'user'
  allowedIp: text('allowed_ip'), // null = not set, one IP per user
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const waterBodies = sqliteTable('water_bodies', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  nameRu: text('name_ru'),
  region: text('region').notNull(),
  description: text('description'),
  lat: text('lat').notNull(),
  lng: text('lng').notNull(),
  permitInfo: text('permit_info'),
  orderIndex: integer('order_index').default(0),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const referenceSections = sqliteTable('reference_sections', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  titleRu: text('title_ru'),
  content: text('content').notNull(),
  orderIndex: integer('order_index').default(0),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const permitOrganizations = sqliteTable('permit_organizations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  nameRu: text('name_ru'),
  region: text('region').notNull(),
  description: text('description'),
  url: text('url'),
  phone: text('phone'),
  address: text('address'),
  orderIndex: integer('order_index').default(0),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export type User = typeof users.$inferSelect;
export type WaterBody = typeof waterBodies.$inferSelect;
export type ReferenceSection = typeof referenceSections.$inferSelect;
export type PermitOrganization = typeof permitOrganizations.$inferSelect;
