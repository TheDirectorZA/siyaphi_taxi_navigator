-- Create extensions and basic roles
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- Create taxi schema
CREATE SCHEMA IF NOT EXISTS taxi;

-- Table: stops
CREATE TABLE IF NOT EXISTS taxi.stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  description text,
  location geography(Point,4326) NOT NULL,
  rank boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Table: routes
CREATE TABLE IF NOT EXISTS taxi.routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  notes text,
  geom geometry(LineString,4326) NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Table: route_stops
CREATE TABLE IF NOT EXISTS taxi.route_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid REFERENCES taxi.routes(id) ON DELETE CASCADE,
  stop_id uuid REFERENCES taxi.stops(id) ON DELETE CASCADE,
  stop_order integer NOT NULL
);

-- Table: fares
CREATE TABLE IF NOT EXISTS taxi.fares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid REFERENCES taxi.routes(id) ON DELETE CASCADE,
  min_cents integer,
  max_cents integer,
  currency text DEFAULT 'ZAR',
  source text,
  confidence numeric(3,2) DEFAULT 0.5,
  updated_at timestamptz DEFAULT now()
);

-- Table: reports (crowd-sourced)
CREATE TABLE IF NOT EXISTS taxi.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  payload jsonb NOT NULL,
  lat numeric,
  lon numeric,
  location geography(Point,4326),
  source text,
  confidence numeric(3,2) DEFAULT 0.5,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  processed_at timestamptz
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_stops_location ON taxi.stops USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_routes_geom ON taxi.routes USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_reports_location ON taxi.reports USING GIST(location);

-- Helper functions
CREATE OR REPLACE FUNCTION taxi.point_from_latlon(lat numeric, lon numeric)
RETURNS geography AS $$
  SELECT ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography;
$$ LANGUAGE sql IMMUTABLE;
