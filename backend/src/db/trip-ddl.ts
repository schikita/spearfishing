const SQLITE_ALTERS = [
  "ALTER TABLE water_bodies ADD COLUMN body_type TEXT NOT NULL DEFAULT 'unknown'",
  'ALTER TABLE water_bodies ADD COLUMN district TEXT',
  'ALTER TABLE water_bodies ADD COLUMN location_description TEXT',
  "ALTER TABLE water_bodies ADD COLUMN road_class TEXT NOT NULL DEFAULT 'unknown'",
  'ALTER TABLE water_bodies ADD COLUMN road_note TEXT',
  'ALTER TABLE water_bodies ADD COLUMN baseline_visibility_m TEXT',
  "ALTER TABLE water_bodies ADD COLUMN country_code TEXT NOT NULL DEFAULT 'BY'",
];

const SQLITE_TABLES = `
  CREATE TABLE IF NOT EXISTS water_body_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    water_body_id INTEGER NOT NULL,
    source_type TEXT NOT NULL,
    title TEXT,
    document_ref TEXT,
    document_date TEXT,
    document_url TEXT,
    region TEXT,
    excerpt TEXT,
    geometry_accuracy TEXT NOT NULL DEFAULT 'unknown',
    imported_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS external_source_features (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_key TEXT NOT NULL,
    region TEXT,
    name TEXT,
    description TEXT,
    geometry TEXT,
    parse_status TEXT NOT NULL DEFAULT 'ok',
    matched_water_body_id INTEGER,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS external_verifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    water_body_id INTEGER,
    external_source_id INTEGER,
    match_status TEXT NOT NULL,
    confidence TEXT,
    matched_by TEXT,
    distance_m TEXT,
    external_name TEXT,
    external_description TEXT,
    external_region TEXT,
    external_updated_on TEXT,
    source_url TEXT,
    reviewed_at TEXT,
    reviewed_by TEXT
  );
  CREATE TABLE IF NOT EXISTS wintering_pits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    water_body_id INTEGER,
    name TEXT NOT NULL,
    region TEXT,
    water_body_name_raw TEXT,
    geometry TEXT,
    radius_m TEXT,
    boundary_accuracy TEXT NOT NULL DEFAULT 'unknown',
    ban_from TEXT,
    ban_to TEXT,
    is_year_round INTEGER NOT NULL DEFAULT 1,
    source_title TEXT,
    source_url TEXT,
    source_date TEXT,
    status TEXT NOT NULL DEFAULT 'needs_review',
    notes TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS weather_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    grid_lat TEXT NOT NULL,
    grid_lng TEXT NOT NULL,
    fetched_at TEXT NOT NULL,
    precip_mm_3d TEXT,
    precip_mm_7d TEXT,
    sunshine_hours_7d TEXT,
    air_temp_mean_7d TEXT,
    wind_speed_ms TEXT,
    wind_dir_deg TEXT,
    pressure_hpa TEXT,
    air_temp_c TEXT,
    water_temp_c TEXT
  );
  CREATE TABLE IF NOT EXISTS visibility_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    water_body_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    observed_on TEXT NOT NULL,
    visibility_m TEXT NOT NULL,
    water_color TEXT,
    note TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    outlier INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS correction_suggestions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    water_body_id INTEGER,
    external_feature_id INTEGER,
    suggestion_type TEXT NOT NULL,
    message TEXT NOT NULL,
    contact TEXT,
    client_ip TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_water_body_sources_wb ON water_body_sources(water_body_id);
  CREATE INDEX IF NOT EXISTS idx_external_verifications_wb ON external_verifications(water_body_id);
  CREATE INDEX IF NOT EXISTS idx_external_features_status ON external_source_features(parse_status);
  CREATE INDEX IF NOT EXISTS idx_wintering_pits_wb ON wintering_pits(water_body_id);
  CREATE INDEX IF NOT EXISTS idx_wintering_pits_region ON wintering_pits(region);
  CREATE INDEX IF NOT EXISTS idx_wintering_pits_status ON wintering_pits(status);
  CREATE INDEX IF NOT EXISTS idx_weather_cache_grid ON weather_cache(grid_lat, grid_lng);
  CREATE INDEX IF NOT EXISTS idx_visibility_reports_wb ON visibility_reports(water_body_id);
  CREATE INDEX IF NOT EXISTS idx_visibility_reports_status ON visibility_reports(status);
  CREATE INDEX IF NOT EXISTS idx_corrections_status ON correction_suggestions(status);
`;

export function applySqliteTripSchema(db: { exec(sql: string): void }): void {
  for (const sql of SQLITE_ALTERS) {
    try {
      db.exec(sql);
    } catch {
      /* column already exists */
    }
  }
  db.exec(SQLITE_TABLES);
}

export const POSTGRES_TRIP_SQL = `
  ALTER TABLE users ADD COLUMN IF NOT EXISTS has_access INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE water_bodies ADD COLUMN IF NOT EXISTS body_type TEXT NOT NULL DEFAULT 'unknown';
  ALTER TABLE water_bodies ADD COLUMN IF NOT EXISTS district TEXT;
  ALTER TABLE water_bodies ADD COLUMN IF NOT EXISTS location_description TEXT;
  ALTER TABLE water_bodies ADD COLUMN IF NOT EXISTS road_class TEXT NOT NULL DEFAULT 'unknown';
  ALTER TABLE water_bodies ADD COLUMN IF NOT EXISTS road_note TEXT;
  ALTER TABLE water_bodies ADD COLUMN IF NOT EXISTS baseline_visibility_m TEXT;
  ALTER TABLE water_bodies ADD COLUMN IF NOT EXISTS country_code TEXT NOT NULL DEFAULT 'BY';
  ALTER TABLE page_settings ADD COLUMN IF NOT EXISTS phone TEXT;
  ALTER TABLE page_settings ADD COLUMN IF NOT EXISTS email TEXT;
  CREATE TABLE IF NOT EXISTS subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    payment_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    expires_at TEXT NOT NULL,
    device_token TEXT,
    created_at TEXT NOT NULL DEFAULT now()::text
  );
  CREATE TABLE IF NOT EXISTS water_body_sources (
    id SERIAL PRIMARY KEY,
    water_body_id INTEGER NOT NULL,
    source_type TEXT NOT NULL,
    title TEXT,
    document_ref TEXT,
    document_date TEXT,
    document_url TEXT,
    region TEXT,
    excerpt TEXT,
    geometry_accuracy TEXT NOT NULL DEFAULT 'unknown',
    imported_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS external_source_features (
    id SERIAL PRIMARY KEY,
    source_key TEXT NOT NULL,
    region TEXT,
    name TEXT,
    description TEXT,
    geometry TEXT,
    parse_status TEXT NOT NULL DEFAULT 'ok',
    matched_water_body_id INTEGER,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS external_verifications (
    id SERIAL PRIMARY KEY,
    water_body_id INTEGER,
    external_source_id INTEGER,
    match_status TEXT NOT NULL,
    confidence TEXT,
    matched_by TEXT,
    distance_m TEXT,
    external_name TEXT,
    external_description TEXT,
    external_region TEXT,
    external_updated_on TEXT,
    source_url TEXT,
    reviewed_at TEXT,
    reviewed_by TEXT
  );
  CREATE TABLE IF NOT EXISTS wintering_pits (
    id SERIAL PRIMARY KEY,
    water_body_id INTEGER,
    name TEXT NOT NULL,
    region TEXT,
    water_body_name_raw TEXT,
    geometry TEXT,
    radius_m TEXT,
    boundary_accuracy TEXT NOT NULL DEFAULT 'unknown',
    ban_from TEXT,
    ban_to TEXT,
    is_year_round INTEGER NOT NULL DEFAULT 1,
    source_title TEXT,
    source_url TEXT,
    source_date TEXT,
    status TEXT NOT NULL DEFAULT 'needs_review',
    notes TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS weather_cache (
    id SERIAL PRIMARY KEY,
    grid_lat TEXT NOT NULL,
    grid_lng TEXT NOT NULL,
    fetched_at TEXT NOT NULL,
    precip_mm_3d TEXT,
    precip_mm_7d TEXT,
    sunshine_hours_7d TEXT,
    air_temp_mean_7d TEXT,
    wind_speed_ms TEXT,
    wind_dir_deg TEXT,
    pressure_hpa TEXT,
    air_temp_c TEXT,
    water_temp_c TEXT
  );
  CREATE TABLE IF NOT EXISTS visibility_reports (
    id SERIAL PRIMARY KEY,
    water_body_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    observed_on TEXT NOT NULL,
    visibility_m TEXT NOT NULL,
    water_color TEXT,
    note TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    outlier INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS correction_suggestions (
    id SERIAL PRIMARY KEY,
    water_body_id INTEGER,
    external_feature_id INTEGER,
    suggestion_type TEXT NOT NULL,
    message TEXT NOT NULL,
    contact TEXT,
    client_ip TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
  CREATE INDEX IF NOT EXISTS idx_water_body_sources_wb ON water_body_sources(water_body_id);
  CREATE INDEX IF NOT EXISTS idx_external_verifications_wb ON external_verifications(water_body_id);
  CREATE INDEX IF NOT EXISTS idx_external_features_status ON external_source_features(parse_status);
  CREATE INDEX IF NOT EXISTS idx_wintering_pits_wb ON wintering_pits(water_body_id);
  CREATE INDEX IF NOT EXISTS idx_wintering_pits_region ON wintering_pits(region);
  CREATE INDEX IF NOT EXISTS idx_wintering_pits_status ON wintering_pits(status);
  CREATE INDEX IF NOT EXISTS idx_weather_cache_grid ON weather_cache(grid_lat, grid_lng);
  CREATE INDEX IF NOT EXISTS idx_visibility_reports_wb ON visibility_reports(water_body_id);
  CREATE INDEX IF NOT EXISTS idx_visibility_reports_status ON visibility_reports(status);
  CREATE INDEX IF NOT EXISTS idx_corrections_status ON correction_suggestions(status);
`;
