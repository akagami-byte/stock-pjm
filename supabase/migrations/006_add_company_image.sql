-- Migration 006: Add company image URL
-- Tambah kolom image_url di tabel companies

ALTER TABLE companies ADD COLUMN IF NOT EXISTS image_url TEXT;
