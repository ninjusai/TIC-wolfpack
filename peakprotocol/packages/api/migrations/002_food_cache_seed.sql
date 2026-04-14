-- ============================================================================
-- PeakProtocol D1 Food Cache Seed Migration
-- Migration: 002_food_cache_seed
-- Created:   2026-04-01
--
-- Pre-populates the food_cache table with ~50 common foods so the app
-- can return results immediately without hitting the USDA API.
-- All nutritional values are per 100 g serving (USDA SR Legacy basis).
-- Uses INSERT OR IGNORE so re-running is safe.
-- ============================================================================

-- ── Proteins ─────────────────────────────────────────────────────────

INSERT OR IGNORE INTO food_cache (fdc_id, name, serving_size, serving_unit, calories, protein, carbs, fat, fiber, cached_at)
VALUES ('171077', 'Chicken breast, boneless, skinless, raw', 100, 'g', 120, 22.5, 0, 2.6, 0, '2026-04-01T00:00:00.000Z');

INSERT OR IGNORE INTO food_cache (fdc_id, name, serving_size, serving_unit, calories, protein, carbs, fat, fiber, cached_at)
VALUES ('175167', 'Salmon, Atlantic, raw', 100, 'g', 208, 20.4, 0, 13.4, 0, '2026-04-01T00:00:00.000Z');

INSERT OR IGNORE INTO food_cache (fdc_id, name, serving_size, serving_unit, calories, protein, carbs, fat, fiber, cached_at)
VALUES ('171287', 'Egg, whole, raw', 100, 'g', 143, 12.6, 0.7, 9.9, 0, '2026-04-01T00:00:00.000Z');

INSERT OR IGNORE INTO food_cache (fdc_id, name, serving_size, serving_unit, calories, protein, carbs, fat, fiber, cached_at)
VALUES ('174032', 'Ground beef, 85% lean, raw', 100, 'g', 215, 18.6, 0, 15, 0, '2026-04-01T00:00:00.000Z');

INSERT OR IGNORE INTO food_cache (fdc_id, name, serving_size, serving_unit, calories, protein, carbs, fat, fiber, cached_at)
VALUES ('174272', 'Tofu, firm, raw', 100, 'g', 144, 17.3, 2.8, 8.7, 2.3, '2026-04-01T00:00:00.000Z');

INSERT OR IGNORE INTO food_cache (fdc_id, name, serving_size, serving_unit, calories, protein, carbs, fat, fiber, cached_at)
VALUES ('175159', 'Turkey breast, raw', 100, 'g', 104, 24.6, 0, 0.6, 0, '2026-04-01T00:00:00.000Z');

INSERT OR IGNORE INTO food_cache (fdc_id, name, serving_size, serving_unit, calories, protein, carbs, fat, fiber, cached_at)
VALUES ('174608', 'Shrimp, raw', 100, 'g', 85, 20.1, 0.9, 0.5, 0, '2026-04-01T00:00:00.000Z');

INSERT OR IGNORE INTO food_cache (fdc_id, name, serving_size, serving_unit, calories, protein, carbs, fat, fiber, cached_at)
VALUES ('171534', 'Tuna, canned in water, drained', 100, 'g', 116, 25.5, 0, 0.8, 0, '2026-04-01T00:00:00.000Z');

INSERT OR IGNORE INTO food_cache (fdc_id, name, serving_size, serving_unit, calories, protein, carbs, fat, fiber, cached_at)
VALUES ('174833', 'Pork tenderloin, raw', 100, 'g', 120, 22.2, 0, 3.0, 0, '2026-04-01T00:00:00.000Z');

-- ── Carbs / Grains ───────────────────────────────────────────────────

INSERT OR IGNORE INTO food_cache (fdc_id, name, serving_size, serving_unit, calories, protein, carbs, fat, fiber, cached_at)
VALUES ('169756', 'Rice, white, long-grain, cooked', 100, 'g', 130, 2.7, 28.2, 0.3, 0.4, '2026-04-01T00:00:00.000Z');

INSERT OR IGNORE INTO food_cache (fdc_id, name, serving_size, serving_unit, calories, protein, carbs, fat, fiber, cached_at)
VALUES ('172686', 'Rice, brown, long-grain, cooked', 100, 'g', 123, 2.7, 25.6, 1.0, 1.6, '2026-04-01T00:00:00.000Z');

INSERT OR IGNORE INTO food_cache (fdc_id, name, serving_size, serving_unit, calories, protein, carbs, fat, fiber, cached_at)
VALUES ('172193', 'Bread, whole wheat', 100, 'g', 252, 12.3, 43.1, 3.5, 6.0, '2026-04-01T00:00:00.000Z');

INSERT OR IGNORE INTO food_cache (fdc_id, name, serving_size, serving_unit, calories, protein, carbs, fat, fiber, cached_at)
VALUES ('173757', 'Oats, rolled, dry', 100, 'g', 379, 13.2, 67.7, 6.5, 10.1, '2026-04-01T00:00:00.000Z');

INSERT OR IGNORE INTO food_cache (fdc_id, name, serving_size, serving_unit, calories, protein, carbs, fat, fiber, cached_at)
VALUES ('168916', 'Pasta, spaghetti, cooked', 100, 'g', 158, 5.8, 30.9, 0.9, 1.8, '2026-04-01T00:00:00.000Z');

INSERT OR IGNORE INTO food_cache (fdc_id, name, serving_size, serving_unit, calories, protein, carbs, fat, fiber, cached_at)
VALUES ('170026', 'Potatoes, russet, raw', 100, 'g', 79, 2.1, 17.5, 0.1, 1.3, '2026-04-01T00:00:00.000Z');

INSERT OR IGNORE INTO food_cache (fdc_id, name, serving_size, serving_unit, calories, protein, carbs, fat, fiber, cached_at)
VALUES ('170027', 'Sweet potatoes, raw', 100, 'g', 86, 1.6, 20.1, 0.1, 3.0, '2026-04-01T00:00:00.000Z');

INSERT OR IGNORE INTO food_cache (fdc_id, name, serving_size, serving_unit, calories, protein, carbs, fat, fiber, cached_at)
VALUES ('169705', 'Quinoa, cooked', 100, 'g', 120, 4.4, 21.3, 1.9, 2.8, '2026-04-01T00:00:00.000Z');

INSERT OR IGNORE INTO food_cache (fdc_id, name, serving_size, serving_unit, calories, protein, carbs, fat, fiber, cached_at)
VALUES ('168880', 'Tortilla, flour, whole wheat', 100, 'g', 306, 8.8, 49.5, 8.4, 4.3, '2026-04-01T00:00:00.000Z');

-- ── Vegetables ───────────────────────────────────────────────────────

INSERT OR IGNORE INTO food_cache (fdc_id, name, serving_size, serving_unit, calories, protein, carbs, fat, fiber, cached_at)
VALUES ('170379', 'Broccoli, raw', 100, 'g', 34, 2.8, 6.6, 0.4, 2.6, '2026-04-01T00:00:00.000Z');

INSERT OR IGNORE INTO food_cache (fdc_id, name, serving_size, serving_unit, calories, protein, carbs, fat, fiber, cached_at)
VALUES ('168462', 'Spinach, raw', 100, 'g', 23, 2.9, 3.6, 0.4, 2.2, '2026-04-01T00:00:00.000Z');

INSERT OR IGNORE INTO food_cache (fdc_id, name, serving_size, serving_unit, calories, protein, carbs, fat, fiber, cached_at)
VALUES ('170393', 'Carrots, raw', 100, 'g', 41, 0.9, 9.6, 0.2, 2.8, '2026-04-01T00:00:00.000Z');

INSERT OR IGNORE INTO food_cache (fdc_id, name, serving_size, serving_unit, calories, protein, carbs, fat, fiber, cached_at)
VALUES ('170457', 'Tomatoes, red, raw', 100, 'g', 18, 0.9, 3.9, 0.2, 1.2, '2026-04-01T00:00:00.000Z');

INSERT OR IGNORE INTO food_cache (fdc_id, name, serving_size, serving_unit, calories, protein, carbs, fat, fiber, cached_at)
VALUES ('169228', 'Kale, raw', 100, 'g', 35, 2.9, 4.4, 1.5, 4.1, '2026-04-01T00:00:00.000Z');

INSERT OR IGNORE INTO food_cache (fdc_id, name, serving_size, serving_unit, calories, protein, carbs, fat, fiber, cached_at)
VALUES ('169986', 'Bell pepper, red, raw', 100, 'g', 31, 1.0, 6.0, 0.3, 2.1, '2026-04-01T00:00:00.000Z');

INSERT OR IGNORE INTO food_cache (fdc_id, name, serving_size, serving_unit, calories, protein, carbs, fat, fiber, cached_at)
VALUES ('170440', 'Onion, raw', 100, 'g', 40, 1.1, 9.3, 0.1, 1.7, '2026-04-01T00:00:00.000Z');

INSERT OR IGNORE INTO food_cache (fdc_id, name, serving_size, serving_unit, calories, protein, carbs, fat, fiber, cached_at)
VALUES ('170409', 'Cucumber, raw, with peel', 100, 'g', 15, 0.7, 3.6, 0.1, 0.5, '2026-04-01T00:00:00.000Z');

INSERT OR IGNORE INTO food_cache (fdc_id, name, serving_size, serving_unit, calories, protein, carbs, fat, fiber, cached_at)
VALUES ('169402', 'Cauliflower, raw', 100, 'g', 25, 1.9, 5.0, 0.3, 2.0, '2026-04-01T00:00:00.000Z');

INSERT OR IGNORE INTO food_cache (fdc_id, name, serving_size, serving_unit, calories, protein, carbs, fat, fiber, cached_at)
VALUES ('170546', 'Zucchini, raw', 100, 'g', 17, 1.2, 3.1, 0.3, 1.0, '2026-04-01T00:00:00.000Z');

INSERT OR IGNORE INTO food_cache (fdc_id, name, serving_size, serving_unit, calories, protein, carbs, fat, fiber, cached_at)
VALUES ('170484', 'Green beans, raw', 100, 'g', 31, 1.8, 7.0, 0.1, 3.4, '2026-04-01T00:00:00.000Z');

INSERT OR IGNORE INTO food_cache (fdc_id, name, serving_size, serving_unit, calories, protein, carbs, fat, fiber, cached_at)
VALUES ('170406', 'Asparagus, raw', 100, 'g', 20, 2.2, 3.9, 0.1, 2.1, '2026-04-01T00:00:00.000Z');

-- ── Fruits ───────────────────────────────────────────────────────────

INSERT OR IGNORE INTO food_cache (fdc_id, name, serving_size, serving_unit, calories, protein, carbs, fat, fiber, cached_at)
VALUES ('173944', 'Banana, raw', 100, 'g', 89, 1.1, 22.8, 0.3, 2.6, '2026-04-01T00:00:00.000Z');

INSERT OR IGNORE INTO food_cache (fdc_id, name, serving_size, serving_unit, calories, protein, carbs, fat, fiber, cached_at)
VALUES ('171688', 'Apple, raw, with skin', 100, 'g', 52, 0.3, 13.8, 0.2, 2.4, '2026-04-01T00:00:00.000Z');

INSERT OR IGNORE INTO food_cache (fdc_id, name, serving_size, serving_unit, calories, protein, carbs, fat, fiber, cached_at)
VALUES ('171711', 'Blueberries, raw', 100, 'g', 57, 0.7, 14.5, 0.3, 2.4, '2026-04-01T00:00:00.000Z');

INSERT OR IGNORE INTO food_cache (fdc_id, name, serving_size, serving_unit, calories, protein, carbs, fat, fiber, cached_at)
VALUES ('171706', 'Avocado, raw', 100, 'g', 160, 2.0, 8.5, 14.7, 6.7, '2026-04-01T00:00:00.000Z');

INSERT OR IGNORE INTO food_cache (fdc_id, name, serving_size, serving_unit, calories, protein, carbs, fat, fiber, cached_at)
VALUES ('167762', 'Strawberries, raw', 100, 'g', 32, 0.7, 7.7, 0.3, 2.0, '2026-04-01T00:00:00.000Z');

INSERT OR IGNORE INTO food_cache (fdc_id, name, serving_size, serving_unit, calories, protein, carbs, fat, fiber, cached_at)
VALUES ('169097', 'Orange, raw', 100, 'g', 47, 0.9, 11.8, 0.1, 2.4, '2026-04-01T00:00:00.000Z');

INSERT OR IGNORE INTO food_cache (fdc_id, name, serving_size, serving_unit, calories, protein, carbs, fat, fiber, cached_at)
VALUES ('171719', 'Grapes, red, raw', 100, 'g', 69, 0.7, 18.1, 0.2, 0.9, '2026-04-01T00:00:00.000Z');

INSERT OR IGNORE INTO food_cache (fdc_id, name, serving_size, serving_unit, calories, protein, carbs, fat, fiber, cached_at)
VALUES ('169926', 'Watermelon, raw', 100, 'g', 30, 0.6, 7.6, 0.2, 0.4, '2026-04-01T00:00:00.000Z');

-- ── Dairy ────────────────────────────────────────────────────────────

INSERT OR IGNORE INTO food_cache (fdc_id, name, serving_size, serving_unit, calories, protein, carbs, fat, fiber, cached_at)
VALUES ('171265', 'Milk, whole, 3.25%', 100, 'g', 61, 3.2, 4.8, 3.3, 0, '2026-04-01T00:00:00.000Z');

INSERT OR IGNORE INTO food_cache (fdc_id, name, serving_size, serving_unit, calories, protein, carbs, fat, fiber, cached_at)
VALUES ('170886', 'Yogurt, Greek, plain, nonfat', 100, 'g', 59, 10.2, 3.6, 0.4, 0, '2026-04-01T00:00:00.000Z');

INSERT OR IGNORE INTO food_cache (fdc_id, name, serving_size, serving_unit, calories, protein, carbs, fat, fiber, cached_at)
VALUES ('171241', 'Cheese, cheddar', 100, 'g', 403, 24.9, 1.3, 33.1, 0, '2026-04-01T00:00:00.000Z');

INSERT OR IGNORE INTO food_cache (fdc_id, name, serving_size, serving_unit, calories, protein, carbs, fat, fiber, cached_at)
VALUES ('170903', 'Cottage cheese, low fat, 2%', 100, 'g', 84, 11.8, 3.4, 2.3, 0, '2026-04-01T00:00:00.000Z');

INSERT OR IGNORE INTO food_cache (fdc_id, name, serving_size, serving_unit, calories, protein, carbs, fat, fiber, cached_at)
VALUES ('170857', 'Milk, skim (nonfat)', 100, 'g', 34, 3.4, 5.0, 0.1, 0, '2026-04-01T00:00:00.000Z');

-- ── Fats / Oils / Nuts ───────────────────────────────────────────────

INSERT OR IGNORE INTO food_cache (fdc_id, name, serving_size, serving_unit, calories, protein, carbs, fat, fiber, cached_at)
VALUES ('171413', 'Olive oil', 100, 'g', 884, 0, 0, 100, 0, '2026-04-01T00:00:00.000Z');

INSERT OR IGNORE INTO food_cache (fdc_id, name, serving_size, serving_unit, calories, protein, carbs, fat, fiber, cached_at)
VALUES ('172470', 'Peanut butter, smooth', 100, 'g', 588, 25.1, 19.6, 50.4, 6.0, '2026-04-01T00:00:00.000Z');

INSERT OR IGNORE INTO food_cache (fdc_id, name, serving_size, serving_unit, calories, protein, carbs, fat, fiber, cached_at)
VALUES ('170567', 'Almonds, raw', 100, 'g', 579, 21.2, 21.7, 49.9, 12.5, '2026-04-01T00:00:00.000Z');

INSERT OR IGNORE INTO food_cache (fdc_id, name, serving_size, serving_unit, calories, protein, carbs, fat, fiber, cached_at)
VALUES ('170187', 'Walnuts, raw', 100, 'g', 654, 15.2, 13.7, 65.2, 6.7, '2026-04-01T00:00:00.000Z');

INSERT OR IGNORE INTO food_cache (fdc_id, name, serving_size, serving_unit, calories, protein, carbs, fat, fiber, cached_at)
VALUES ('170178', 'Butter, salted', 100, 'g', 717, 0.9, 0.1, 81.1, 0, '2026-04-01T00:00:00.000Z');

INSERT OR IGNORE INTO food_cache (fdc_id, name, serving_size, serving_unit, calories, protein, carbs, fat, fiber, cached_at)
VALUES ('170562', 'Cashews, raw', 100, 'g', 553, 18.2, 30.2, 43.9, 3.3, '2026-04-01T00:00:00.000Z');

-- ── Other ────────────────────────────────────────────────────────────

INSERT OR IGNORE INTO food_cache (fdc_id, name, serving_size, serving_unit, calories, protein, carbs, fat, fiber, cached_at)
VALUES ('174270', 'Honey', 100, 'g', 304, 0.3, 82.4, 0, 0.2, '2026-04-01T00:00:00.000Z');

INSERT OR IGNORE INTO food_cache (fdc_id, name, serving_size, serving_unit, calories, protein, carbs, fat, fiber, cached_at)
VALUES ('168600', 'Lentils, cooked', 100, 'g', 116, 9.0, 20.1, 0.4, 7.9, '2026-04-01T00:00:00.000Z');

INSERT OR IGNORE INTO food_cache (fdc_id, name, serving_size, serving_unit, calories, protein, carbs, fat, fiber, cached_at)
VALUES ('175197', 'Chickpeas, canned, drained', 100, 'g', 139, 7.0, 22.5, 2.6, 6.0, '2026-04-01T00:00:00.000Z');

-- ── Track migration ──────────────────────────────────────────────────

INSERT OR IGNORE INTO schema_migrations (version, name) VALUES (2, '002_food_cache_seed');
