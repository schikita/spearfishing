import { pgTable, text, integer, serial } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull().default('user'),
  allowedIp: text('allowed_ip'),
  hasAccess: integer('has_access').notNull().default(0),
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
  geometry: text('geometry'),
  permitInfo: text('permit_info'),
  orderIndex: integer('order_index').default(0),
  createdAt: text('created_at').notNull().default('now()'),
  bodyType: text('body_type').notNull().default('unknown'),
  district: text('district'),
  locationDescription: text('location_description'),
  roadClass: text('road_class').notNull().default('unknown'),
  roadNote: text('road_note'),
  baselineVisibilityM: text('baseline_visibility_m'),
  countryCode: text('country_code').notNull().default('BY'),
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

export const blogPosts = pgTable('blog_posts', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  titleRu: text('title_ru'),
  excerpt: text('excerpt'),
  content: text('content').notNull(),
  orderIndex: integer('order_index').default(0),
  createdAt: text('created_at').notNull().default('now()'),
  updatedAt: text('updated_at').notNull().default('now()'),
});

export const pageSettings = pgTable('page_settings', {
  pageKey: text('page_key').primaryKey(),
  title: text('title').notNull().default(''),
  intro: text('intro').notNull().default(''),
  phone: text('phone'),
  email: text('email'),
  updatedAt: text('updated_at').notNull().default('now()'),
});

export const subscriptions = pgTable('subscriptions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  paymentId: text('payment_id'),
  status: text('status').notNull().default('pending'),
  expiresAt: text('expires_at').notNull(),
  deviceToken: text('device_token'),
  createdAt: text('created_at').notNull().default('now()'),
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

export const waterBodySources = pgTable('water_body_sources', {
  id: serial('id').primaryKey(),
  waterBodyId: integer('water_body_id').notNull(),
  sourceType: text('source_type').notNull(),
  title: text('title'),
  documentRef: text('document_ref'),
  documentDate: text('document_date'),
  documentUrl: text('document_url'),
  region: text('region'),
  excerpt: text('excerpt'),
  geometryAccuracy: text('geometry_accuracy').notNull().default('unknown'),
  importedAt: text('imported_at').notNull(),
});

export const externalSourceFeatures = pgTable('external_source_features', {
  id: serial('id').primaryKey(),
  sourceKey: text('source_key').notNull(),
  region: text('region'),
  name: text('name'),
  description: text('description'),
  geometry: text('geometry'),
  parseStatus: text('parse_status').notNull().default('ok'),
  matchedWaterBodyId: integer('matched_water_body_id'),
  createdAt: text('created_at').notNull(),
});

export const externalVerifications = pgTable('external_verifications', {
  id: serial('id').primaryKey(),
  waterBodyId: integer('water_body_id'),
  externalSourceId: integer('external_source_id'),
  matchStatus: text('match_status').notNull(),
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

export const winteringPits = pgTable('wintering_pits', {
  id: serial('id').primaryKey(),
  waterBodyId: integer('water_body_id'),
  name: text('name').notNull(),
  region: text('region'),
  waterBodyNameRaw: text('water_body_name_raw'),
  geometry: text('geometry'),
  radiusM: text('radius_m'),
  boundaryAccuracy: text('boundary_accuracy').notNull().default('unknown'),
  banFrom: text('ban_from'),
  banTo: text('ban_to'),
  isYearRound: integer('is_year_round').notNull().default(1),
  sourceTitle: text('source_title'),
  sourceUrl: text('source_url'),
  sourceDate: text('source_date'),
  status: text('status').notNull().default('needs_review'),
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
});

export const weatherCache = pgTable('weather_cache', {
  id: serial('id').primaryKey(),
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

export const visibilityReports = pgTable('visibility_reports', {
  id: serial('id').primaryKey(),
  waterBodyId: integer('water_body_id').notNull(),
  userId: integer('user_id').notNull(),
  observedOn: text('observed_on').notNull(),
  visibilityM: text('visibility_m').notNull(),
  waterColor: text('water_color'),
  note: text('note'),
  status: text('status').notNull().default('pending'),
  outlier: integer('outlier').notNull().default(0),
  createdAt: text('created_at').notNull(),
});

export const correctionSuggestions = pgTable('correction_suggestions', {
  id: serial('id').primaryKey(),
  waterBodyId: integer('water_body_id'),
  externalFeatureId: integer('external_feature_id'),
  suggestionType: text('suggestion_type').notNull(),
  message: text('message').notNull(),
  contact: text('contact'),
  clientIp: text('client_ip'),
  status: text('status').notNull().default('new'),
  createdAt: text('created_at').notNull(),
});
