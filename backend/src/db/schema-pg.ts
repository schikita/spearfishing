import { pgTable, text, integer, serial } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull().default('user'),
  allowedIp: text('allowed_ip'),
  createdAt: text('created_at').notNull().default('now()'),
});

export const waterBodies = pgTable('water_bodies', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  nameRu: text('name_ru'),
  region: text('region').notNull(),
  description: text('description'),
  lat: text('lat').notNull(),
  lng: text('lng').notNull(),
  permitInfo: text('permit_info'),
  orderIndex: integer('order_index').default(0),
  createdAt: text('created_at').notNull().default('now()'),
});

export const referenceSections = pgTable('reference_sections', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  titleRu: text('title_ru'),
  content: text('content').notNull(),
  orderIndex: integer('order_index').default(0),
  createdAt: text('created_at').notNull().default('now()'),
  updatedAt: text('updated_at').notNull().default('now()'),
});

export const permitOrganizations = pgTable('permit_organizations', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  nameRu: text('name_ru'),
  region: text('region').notNull(),
  description: text('description'),
  url: text('url'),
  phone: text('phone'),
  address: text('address'),
  orderIndex: integer('order_index').default(0),
  createdAt: text('created_at').notNull().default('now()'),
});
