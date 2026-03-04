import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull().default('user'), // 'admin' | 'user'
  allowedIp: text('allowed_ip'), // null = not set, one IP per user
  hasAccess: integer('has_access').notNull().default(0), // 1 = доступ к карте выдан админом
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
  geometry: text('geometry'), // GeoJSON geometry (Polygon, LineString, Point) для отображения контуров
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

export const pageSettings = sqliteTable('page_settings', {
  pageKey: text('page_key').primaryKey(),
  title: text('title').notNull().default(''),
  intro: text('intro').notNull().default(''),
  phone: text('phone'),
  email: text('email'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const subscriptions = sqliteTable('subscriptions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull(),
  paymentId: text('payment_id'),
  status: text('status').notNull().default('pending'), // pending | active | expired
  expiresAt: text('expires_at').notNull(),
  deviceToken: text('device_token'), // привязка к устройству: один пользователь — одно устройство
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export type User = typeof users.$inferSelect;
export type PageSetting = typeof pageSettings.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type WaterBody = typeof waterBodies.$inferSelect;
export type ReferenceSection = typeof referenceSections.$inferSelect;
export type PermitOrganization = typeof permitOrganizations.$inferSelect;
