-- 0003_add_content_wrapper.sql
-- Add content_wrapper column to css_catalogues table.
-- Stores the discovered DOM wrapper structure (JSON) around the main content area.

ALTER TABLE css_catalogues ADD COLUMN content_wrapper TEXT;
