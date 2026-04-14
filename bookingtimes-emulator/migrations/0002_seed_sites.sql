-- 0002_seed_sites.sql
-- Seed data: 5 driving school sites for the Bookingtimes Content Emulator

INSERT INTO sites (id, name, url, theme) VALUES
  ('site-001', 'Affordable Driving School Brisbane', 'https://affordabledrivingschoolbrisbane.com.au/', 'light'),
  ('site-002', 'RACSOM', 'https://racsom.com.au/', 'light'),
  ('site-003', 'Easy As DTA', 'https://easyasdta.com.au/', 'light'),
  ('site-004', 'Metro Driving', 'https://metrodriving.com.au/', 'light'),
  ('site-005', 'Learners Driver Training', 'https://learnersdrivertraining.com.au/', 'light');
