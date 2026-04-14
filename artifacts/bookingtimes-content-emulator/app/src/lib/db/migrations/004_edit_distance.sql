-- 004_edit_distance.sql
-- WRK-BCE2-055: True Levenshtein edit distance tracking
-- Adds edit_distance column to page_versions so each version records how much
-- its text content differs from the previous version. Nullable because
-- pre-existing rows and first versions (no predecessor) won't have a value.

ALTER TABLE page_versions ADD COLUMN edit_distance INTEGER;
