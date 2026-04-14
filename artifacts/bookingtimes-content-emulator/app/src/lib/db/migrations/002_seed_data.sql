-- 002_seed_data.sql
-- Seed the 5 driving school sites

INSERT INTO sites (name, url, slug, bootstrap_version, pipeline_stage) VALUES
  ('Metro Driving School', 'https://metrodriving.com.au', 'metro-driving', '5.0.2', 'not_started'),
  ('Racsom Driving School', 'https://racsom.com.au', 'racsom', '5.0.2', 'not_started'),
  ('Noyelling Driving School', 'https://noyelling.com.au', 'noyelling', '5.0.2', 'not_started'),
  ('Pinnacle Driving School', 'https://pinnacledrivingschool.com.au', 'pinnacle', '5.0.2', 'not_started'),
  ('YLOODrive', 'https://yloodrive.com.au', 'yloodrive', '5.0.2', 'not_started');
