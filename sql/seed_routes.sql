-- Minimal seed data for MVP
INSERT INTO taxi.stops (id, name, description, location, rank)
VALUES
  ('00000000-0000-0000-0000-000000000001','Central Rank','Main taxi rank',ST_SetSRID(ST_MakePoint(28.0473,-26.2041),4326)::geography,true),
  ('00000000-0000-0000-0000-000000000002','East Stop','East side stop',ST_SetSRID(ST_MakePoint(28.0584,-26.2020),4326)::geography,false);

INSERT INTO taxi.routes (id, name, notes, geom)
VALUES
  ('11111111-1111-1111-1111-111111111111','Central-East','Typical minibus route',ST_SetSRID(ST_MakeLine(ST_MakePoint(28.0473,-26.2041), ST_MakePoint(28.0584,-26.2020)),4326));

INSERT INTO taxi.route_stops (route_id, stop_id, stop_order)
VALUES
  ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000001',1),
  ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000002',2);

INSERT INTO taxi.fares (route_id, min_cents, max_cents, source, confidence)
VALUES
  ('11111111-1111-1111-1111-111111111111',800,1000,'seed',0.6);

INSERT INTO taxi.reports (type, payload, lat, lon, location, source, confidence)
VALUES
  ('delay', '{"msg":"traffic at junction"}', -26.2035,28.0520, ST_SetSRID(ST_MakePoint(28.0520,-26.2035),4326)::geography,'seed',0.6);
