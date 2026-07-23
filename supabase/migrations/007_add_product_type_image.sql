-- Migration 007: Add product type image URL
-- Tambah kolom image_url di tabel product_types

ALTER TABLE product_types ADD COLUMN IF NOT EXISTS image_url TEXT;
