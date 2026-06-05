// Offline database — SQLite via expo-sqlite
// Stores: routes, stops, fares, queued reports
// This is the source of truth when offline.

import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync('siyaphi_offline.db');
  await initSchema(db);
  return db;
}

async function initSchema(db: SQLite.SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS cities (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      bounding_box TEXT,
      synced_at TEXT
    );

    CREATE TABLE IF NOT EXISTS routes (
      id TEXT PRIMARY KEY,
      city_id TEXT,
      name TEXT NOT NULL,
      short_code TEXT,
      origin_name TEXT,
      destination_name TEXT,
      distance_km REAL,
      operating_hours TEXT,
      frequency_minutes INTEGER,
      data_confidence TEXT DEFAULT 'LOW',
      synced_at TEXT
    );

    CREATE TABLE IF NOT EXISTS stops (
      id TEXT PRIMARY KEY,
      city_id TEXT,
      name TEXT NOT NULL,
      aliases TEXT,
      type TEXT,
      latitude REAL,
      longitude REAL,
      landmark TEXT,
      data_confidence TEXT DEFAULT 'LOW',
      synced_at TEXT
    );

    CREATE TABLE IF NOT EXISTS route_stops (
      id TEXT PRIMARY KEY,
      route_id TEXT,
      stop_id TEXT,
      sequence INTEGER,
      is_terminal INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS fares (
      id TEXT PRIMARY KEY,
      route_id TEXT,
      min_fare_zar REAL,
      max_fare_zar REAL,
      typical_fare_zar REAL,
      confidence TEXT,
      source TEXT,
      synced_at TEXT
    );

    CREATE TABLE IF NOT EXISTS report_queue (
      id TEXT PRIMARY KEY,
      city_id TEXT NOT NULL,
      type TEXT NOT NULL,
      severity TEXT,
      description TEXT,
      latitude REAL,
      longitude REAL,
      route_id TEXT,
      stop_id TEXT,
      created_at TEXT NOT NULL,
      status TEXT DEFAULT 'PENDING'
    );

    CREATE TABLE IF NOT EXISTS active_reports (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      severity TEXT,
      description TEXT,
      latitude REAL,
      longitude REAL,
      trust_score REAL,
      route_id TEXT,
      stop_id TEXT,
      city_id TEXT,
      created_at TEXT,
      expires_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_routes_city ON routes(city_id);
    CREATE INDEX IF NOT EXISTS idx_stops_city ON stops(city_id);
    CREATE INDEX IF NOT EXISTS idx_route_stops_route ON route_stops(route_id);
    CREATE INDEX IF NOT EXISTS idx_report_queue_status ON report_queue(status);
    CREATE INDEX IF NOT EXISTS idx_active_reports_city ON active_reports(city_id);
  `);
}

// ── Route search in offline DB ──────────────────────────────────
export async function searchRoutesOffline(originQuery: string, destQuery?: string): Promise<any[]> {
  const db = await getDb();
  const origin = `%${originQuery}%`;
  const dest = destQuery ? `%${destQuery}%` : '%';

  return db.getAllAsync(
    `SELECT r.*,
      f.min_fare_zar, f.max_fare_zar, f.typical_fare_zar, f.confidence as fare_confidence
     FROM routes r
     LEFT JOIN fares f ON f.route_id = r.id
     WHERE (r.origin_name LIKE ? OR r.name LIKE ?)
       AND (r.destination_name LIKE ? OR r.name LIKE ?)
     LIMIT 20`,
    [origin, origin, dest, dest],
  );
}

// ── Nearby stops search in offline DB ──────────────────────────
export async function getNearbyStopsOffline(
  lat: number,
  lng: number,
  radiusKm = 2,
): Promise<any[]> {
  const db = await getDb();
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / 85;

  const stops = await db.getAllAsync(
    `SELECT * FROM stops
     WHERE latitude BETWEEN ? AND ?
       AND longitude BETWEEN ? AND ?`,
    [lat - latDelta, lat + latDelta, lng - lngDelta, lng + lngDelta],
  );

  // Sort by haversine distance
  return stops
    .map((s: any) => ({ ...s, distanceKm: haversineKm(lat, lng, s.latitude, s.longitude) }))
    .filter((s: any) => s.distanceKm <= radiusKm)
    .sort((a: any, b: any) => a.distanceKm - b.distanceKm);
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Queue a report for later upload ───────────────────────────
export async function queueReportOffline(report: {
  cityId: string;
  type: string;
  severity?: string;
  description?: string;
  latitude?: number;
  longitude?: number;
  routeId?: string;
  stopId?: string;
}): Promise<string> {
  const db = await getDb();
  const id = `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  await db.runAsync(
    `INSERT INTO report_queue (id, city_id, type, severity, description, latitude, longitude, route_id, stop_id, created_at, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
    [
      id, report.cityId, report.type, report.severity ?? 'LOW',
      report.description ?? '', report.latitude ?? null, report.longitude ?? null,
      report.routeId ?? null, report.stopId ?? null, new Date().toISOString(),
    ],
  );

  return id;
}

// ── Get all pending queued reports ──────────────────────────────
export async function getPendingQueuedReports(): Promise<any[]> {
  const db = await getDb();
  return db.getAllAsync(`SELECT * FROM report_queue WHERE status = 'PENDING'`);
}

// ── Mark queued reports as uploaded ─────────────────────────────
export async function markReportsUploaded(ids: string[]) {
  const db = await getDb();
  for (const id of ids) {
    await db.runAsync(`UPDATE report_queue SET status = 'DONE' WHERE id = ?`, [id]);
  }
}

// ── Store city bundle from server ───────────────────────────────
export async function storeCityBundle(bundle: any) {
  const db = await getDb();
  const syncedAt = new Date().toISOString();

  await db.runAsync(
    `INSERT OR REPLACE INTO cities (id, name, slug, bounding_box, synced_at) VALUES (?, ?, ?, ?, ?)`,
    [bundle.city.id, bundle.city.name, bundle.city.slug, JSON.stringify(bundle.city.boundingBox), syncedAt],
  );

  for (const route of bundle.routes ?? []) {
    await db.runAsync(
      `INSERT OR REPLACE INTO routes (id, city_id, name, short_code, origin_name, destination_name, distance_km, operating_hours, frequency_minutes, data_confidence, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [route.id, bundle.city.id, route.name, route.shortCode, route.originName,
       route.destinationName, route.distanceKm, JSON.stringify(route.operatingHours),
       route.frequencyMinutes, route.dataConfidence, syncedAt],
    );

    for (const rs of route.stops ?? []) {
      await db.runAsync(
        `INSERT OR REPLACE INTO route_stops (id, route_id, stop_id, sequence, is_terminal) VALUES (?, ?, ?, ?, ?)`,
        [`${route.id}-${rs.sequence}`, route.id, rs.stop?.id, rs.sequence, rs.isTerminal ? 1 : 0],
      );
    }

    for (const fare of route.fares ?? []) {
      await db.runAsync(
        `INSERT OR REPLACE INTO fares (id, route_id, min_fare_zar, max_fare_zar, typical_fare_zar, confidence, source, synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [fare.id, route.id, fare.minFareZAR, fare.maxFareZAR, fare.typicalFareZAR, fare.confidence, fare.source, syncedAt],
      );
    }
  }

  for (const stop of bundle.stops ?? []) {
    await db.runAsync(
      `INSERT OR REPLACE INTO stops (id, city_id, name, aliases, type, latitude, longitude, landmark, data_confidence, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [stop.id, bundle.city.id, stop.name, JSON.stringify(stop.aliases), stop.type,
       stop.latitude, stop.longitude, stop.landmark, stop.dataConfidence, syncedAt],
    );
  }
}

// ── Clear corrupted database and reinitialize ───────────────────
export async function resetOfflineDb() {
  if (db) { await db.closeAsync(); db = null; }
  await SQLite.deleteDatabaseAsync('siyaphi_offline.db');
  db = await SQLite.openDatabaseAsync('siyaphi_offline.db');
  await initSchema(db);
}
