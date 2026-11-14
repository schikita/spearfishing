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
  bodyType: text('body_type').notNull().default('unknown'),
  district: text('district'),
  locationDescription: text('location_description'),
  roadClass: text('road_class').notNull().default('unknown'),
  roadNote: text('road_note'),
  baselineVisibilityM: text('baseline_visibility_m'),
  countryCode: text('country_code').notNull().default('BY'),
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

export const blogPosts = sqliteTable('blog_posts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  titleRu: text('title_ru'),
  excerpt: text('excerpt'),
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

export const waterBodySources = sqliteTable('water_body_sources', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  waterBodyId: integer('water_body_id').notNull(),
  sourceType: text('source_type').notNull(), // oblast_decision | unofficial_map | manual
  title: text('title'),
  documentRef: text('document_ref'),
  documentDate: text('document_date'),
  documentUrl: text('document_url'),
  region: text('region'),
  excerpt: text('excerpt'),
  geometryAccuracy: text('geometry_accuracy').notNull().default('unknown'),
  importedAt: text('imported_at').notNull(),
});

export const externalSourceFeatures = sqliteTable('external_source_features', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sourceKey: text('source_key').notNull(),
  region: text('region'),
  name: text('name'),
  description: text('description'),
  geometry: text('geometry'),
  parseStatus: text('parse_status').notNull().default('ok'), // ok | unresolved | note
  matchedWaterBodyId: integer('matched_water_body_id'),
  createdAt: text('created_at').notNull(),
});

export const externalVerifications = sqliteTable('external_verifications', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  waterBodyId: integer('water_body_id'),
  externalSourceId: integer('external_source_id'),
  matchStatus: text('match_status').notNull(), // matched | not_found_on_map | not_in_official_list | needs_review | name_conflict
  confidence: text('confidence'),
  matchedBy: text('matched_by'),
  distanceM: text('distance_m'),
  externalName: text('external_name'),
  externalDescription: text('external_description'),
  externalRegion: text('external_region'),
  externalUpdatedOn: text('external_updated_on'),
  sourceUrl: text('source_url'),
  reviewedAt: text('reviewed_at'),
  reviewedBy: text('reviewed_by'),
});

export const winteringPits = sqliteTable('wintering_pits', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  waterBodyId: integer('water_body_id'),
  name: text('name').notNull(),
  region: text('region'),
  waterBodyNameRaw: text('water_body_name_raw'),
  geometry: text('geometry'),
  radiusM: text('radius_m'),
  boundaryAccuracy: text('boundary_accuracy').notNull().default('unknown'), // exact | approximate | radius | unknown
  banFrom: text('ban_from'),
  banTo: text('ban_to'),
  isYearRound: integer('is_year_round').notNull().default(1),
  sourceTitle: text('source_title'),
  sourceUrl: text('source_url'),
  sourceDate: text('source_date'),
  status: text('status').notNull().default('needs_review'), // active | inactive | needs_review
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
});

export const weatherCache = sqliteTable('weather_cache', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gridLat: text('grid_lat').notNull(),
  gridLng: text('grid_lng').notNull(),
  fetchedAt: text('fetched_at').notNull(),
  precipMm3d: text('precip_mm_3d'),
  precipMm7d: text('precip_mm_7d'),
  sunshineHours7d: text('sunshine_hours_7d'),
  airTempMean7d: text('air_temp_mean_7d'),
  windSpeedMs: text('wind_speed_ms'),
  windDirDeg: text('wind_dir_deg'),
  pressureHpa: text('pressure_hpa'),
  airTempC: text('air_temp_c'),
  waterTempC: text('water_temp_c'),
});

export const visibilityReports = sqliteTable('visibility_reports', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  waterBodyId: integer('water_body_id').notNull(),
  userId: integer('user_id').notNull(),
  observedOn: text('observed_on').notNull(),
  visibilityM: text('visibility_m').notNull(),
  waterColor: text('water_color'), // clear | green | brown | bloom
  note: text('note'),
  status: text('status').notNull().default('pending'), // pending | approved | rejected
  outlier: integer('outlier').notNull().default(0),
  createdAt: text('created_at').notNull(),
});

export const correctionSuggestions = sqliteTable('correction_suggestions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  waterBodyId: integer('water_body_id'),
  externalFeatureId: integer('external_feature_id'),
  suggestionType: text('suggestion_type').notNull(), // geometry | name | permission | wintering_pit | other
  message: text('message').notNull(),
  contact: text('contact'),
  clientIp: text('client_ip'),
  status: text('status').notNull().default('new'), // new | accepted | rejected
  createdAt: text('created_at').notNull(),
});

export type User = typeof users.$inferSelect;
export type PageSetting = typeof pageSettings.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type WaterBody = typeof waterBodies.$inferSelect;
export type ReferenceSection = typeof referenceSections.$inferSelect;
export type BlogPost = typeof blogPosts.$inferSelect;
export type PermitOrganization = typeof permitOrganizations.$inferSelect;
