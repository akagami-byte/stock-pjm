-- Migration: Create all tables for Bengkel Las Stock Management
-- Run this in Supabase Studio SQL Editor or via psql

-- ─── Enums ───────────────────────────────────────────────────────────────────
CREATE TYPE batch_status AS ENUM (
  'DRAFT', 'ACTIVE', 'AVAILABLE', 'RESERVED',
  'PARTIALLY_SOLD', 'SOLD_OUT', 'OBSOLETE',
  'COMPLETED', 'CANCELLED', 'RETURNED'
);

CREATE TYPE finishing AS ENUM ('C', 'P', 'S');

CREATE TYPE scan_type AS ENUM ('ACTIVATE', 'VERIFY', 'SALE', 'RETURN');

-- ─── Tables ──────────────────────────────────────────────────────────────────

-- Products
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Product variants
CREATE TABLE product_variants (
  variant_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  sku_full TEXT,
  finishing finishing,
  base_price NUMERIC(12,2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Companies
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  contact TEXT,
  address TEXT,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Stock batches
CREATE TABLE stock_batch (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_code TEXT NOT NULL UNIQUE,
  variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  finishing finishing,
  initial_qty INTEGER NOT NULL CHECK (initial_qty > 0),
  current_qty INTEGER NOT NULL CHECK (current_qty >= 0),
  status batch_status NOT NULL DEFAULT 'DRAFT',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Stock scans
CREATE TABLE stock_scan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES stock_batch(id) ON DELETE CASCADE,
  scan_type scan_type NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Transactions
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES stock_batch(id) ON DELETE RESTRICT,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  qty_sold INTEGER NOT NULL CHECK (qty_sold > 0),
  price NUMERIC(12,2) NOT NULL,
  total NUMERIC(12,2) GENERATED ALWAYS AS (qty_sold * price) STORED,
  invoice_no TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Alternative prices
CREATE TABLE alternative_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  price NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, company_id)
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX idx_products_code ON products(code);
CREATE INDEX idx_products_active ON products(is_active);
CREATE INDEX idx_variants_product ON product_variants(product_id);
CREATE INDEX idx_batch_code ON stock_batch(batch_code);
CREATE INDEX idx_batch_status ON stock_batch(status);
CREATE INDEX idx_batch_product ON stock_batch(product_id);
CREATE INDEX idx_scan_batch ON stock_scan(batch_id);
CREATE INDEX idx_transaction_batch ON transactions(batch_id);
CREATE INDEX idx_transaction_company ON transactions(company_id);
CREATE INDEX idx_altprice_product ON alternative_prices(product_id);
CREATE INDEX idx_altprice_company ON alternative_prices(company_id);

-- ─── Auto-update updated_at ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON companies FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_stock_batch_updated_at
  BEFORE UPDATE ON stock_batch FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Row Level Security ──────────────────────────────────────────────────────

-- Enable RLS on all tables
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_batch ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_scan ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE alternative_prices ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all tables
CREATE POLICY "Authenticated users can read products"
  ON products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read product_variants"
  ON product_variants FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read companies"
  ON companies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read stock_batch"
  ON stock_batch FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read stock_scan"
  ON stock_scan FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read transactions"
  ON transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read alternative_prices"
  ON alternative_prices FOR SELECT TO authenticated USING (true);

-- Authenticated users can insert/update
CREATE POLICY "Authenticated users can insert products"
  ON products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update products"
  ON products FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert product_variants"
  ON product_variants FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update product_variants"
  ON product_variants FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert companies"
  ON companies FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update companies"
  ON companies FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert stock_batch"
  ON stock_batch FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update stock_batch"
  ON stock_batch FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert stock_scan"
  ON stock_scan FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can insert transactions"
  ON transactions FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can insert alternative_prices"
  ON alternative_prices FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update alternative_prices"
  ON alternative_prices FOR UPDATE TO authenticated USING (true);

-- ─── Storage bucket for product images ───────────────────────────────────────
INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can read product images"
  ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'product-images');
CREATE POLICY "Authenticated users can upload product images"
  ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product-images');
