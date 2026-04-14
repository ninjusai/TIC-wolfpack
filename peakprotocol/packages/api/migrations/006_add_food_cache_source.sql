-- Phase 6: Add source column to food_cache table (DEC-phase6-005)
ALTER TABLE food_cache ADD COLUMN source TEXT DEFAULT 'usda';
