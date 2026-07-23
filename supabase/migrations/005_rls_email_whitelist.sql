-- Migration 005: Replace open RLS with email whitelist
-- Only premium/internal users can read/write Supabase.
-- External users: RLS returns empty → app falls back to SQLite.

BEGIN;

-- ─── Helper function: check if user is premium ─────────────────────────
CREATE OR REPLACE FUNCTION is_premium_user()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN auth.email() IN (
    'rehanforic@gmail.com',
    'handivanda@protonmail.com',
    'hanvankernel@gmail.com'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════════════════════
-- DROP all existing policies (old names from migration 003/004)
-- ═══════════════════════════════════════════════════════════════════════

-- product_types
DROP POLICY IF EXISTS "Auth users read product_types" ON product_types;
DROP POLICY IF EXISTS "Auth users insert product_types" ON product_types;
DROP POLICY IF EXISTS "Auth users update product_types" ON product_types;
DROP POLICY IF EXISTS "Premium read product_types" ON product_types;
DROP POLICY IF EXISTS "Premium insert product_types" ON product_types;
DROP POLICY IF EXISTS "Premium update product_types" ON product_types;

-- products
DROP POLICY IF EXISTS "Auth users read products" ON products;
DROP POLICY IF EXISTS "Auth users insert products" ON products;
DROP POLICY IF EXISTS "Auth users update products" ON products;
DROP POLICY IF EXISTS "Premium read products" ON products;
DROP POLICY IF EXISTS "Premium insert products" ON products;
DROP POLICY IF EXISTS "Premium update products" ON products;

-- product_variants
DROP POLICY IF EXISTS "Auth users read variants" ON product_variants;
DROP POLICY IF EXISTS "Auth users insert variants" ON product_variants;
DROP POLICY IF EXISTS "Auth users update variants" ON product_variants;
DROP POLICY IF EXISTS "Premium read variants" ON product_variants;
DROP POLICY IF EXISTS "Premium insert variants" ON product_variants;
DROP POLICY IF EXISTS "Premium update variants" ON product_variants;

-- stock_batch
DROP POLICY IF EXISTS "Auth users read stock_batch" ON stock_batch;
DROP POLICY IF EXISTS "Auth users insert stock_batch" ON stock_batch;
DROP POLICY IF EXISTS "Auth users update stock_batch" ON stock_batch;
DROP POLICY IF EXISTS "Premium read stock_batch" ON stock_batch;
DROP POLICY IF EXISTS "Premium insert stock_batch" ON stock_batch;
DROP POLICY IF EXISTS "Premium update stock_batch" ON stock_batch;

-- batch_status_log
DROP POLICY IF EXISTS "Auth users read status_log" ON batch_status_log;
DROP POLICY IF EXISTS "Auth users insert status_log" ON batch_status_log;
DROP POLICY IF EXISTS "Premium read status_log" ON batch_status_log;
DROP POLICY IF EXISTS "Premium insert status_log" ON batch_status_log;

-- batch_scan_history
DROP POLICY IF EXISTS "Auth users read scan_history" ON batch_scan_history;
DROP POLICY IF EXISTS "Auth users insert scan_history" ON batch_scan_history;
DROP POLICY IF EXISTS "Premium read scan_history" ON batch_scan_history;
DROP POLICY IF EXISTS "Premium insert scan_history" ON batch_scan_history;

-- alternative_prices
DROP POLICY IF EXISTS "Auth users read alt_prices" ON alternative_prices;
DROP POLICY IF EXISTS "Auth users insert alt_prices" ON alternative_prices;
DROP POLICY IF EXISTS "Auth users update alt_prices" ON alternative_prices;
DROP POLICY IF EXISTS "Premium read alt_prices" ON alternative_prices;
DROP POLICY IF EXISTS "Premium insert alt_prices" ON alternative_prices;
DROP POLICY IF EXISTS "Premium update alt_prices" ON alternative_prices;

-- sales_transaction
DROP POLICY IF EXISTS "Auth users read sales" ON sales_transaction;
DROP POLICY IF EXISTS "Auth users insert sales" ON sales_transaction;
DROP POLICY IF EXISTS "Auth users update sales" ON sales_transaction;
DROP POLICY IF EXISTS "Premium read sales" ON sales_transaction;
DROP POLICY IF EXISTS "Premium insert sales" ON sales_transaction;
DROP POLICY IF EXISTS "Premium update sales" ON sales_transaction;

-- companies (from migration 004)
DROP POLICY IF EXISTS "Auth users read companies" ON companies;
DROP POLICY IF EXISTS "Auth users insert companies" ON companies;
DROP POLICY IF EXISTS "Auth users update companies" ON companies;
DROP POLICY IF EXISTS "Premium read companies" ON companies;
DROP POLICY IF EXISTS "Premium insert companies" ON companies;
DROP POLICY IF EXISTS "Premium update companies" ON companies;

-- ═══════════════════════════════════════════════════════════════════════
-- CREATE new policies — all gated by is_premium_user()
-- ═══════════════════════════════════════════════════════════════════════

-- product_types
CREATE POLICY "Premium read product_types"
  ON product_types FOR SELECT TO authenticated
  USING (is_premium_user());
CREATE POLICY "Premium insert product_types"
  ON product_types FOR INSERT TO authenticated
  WITH CHECK (is_premium_user());
CREATE POLICY "Premium update product_types"
  ON product_types FOR UPDATE TO authenticated
  USING (is_premium_user());

-- products
CREATE POLICY "Premium read products"
  ON products FOR SELECT TO authenticated
  USING (is_premium_user());
CREATE POLICY "Premium insert products"
  ON products FOR INSERT TO authenticated
  WITH CHECK (is_premium_user());
CREATE POLICY "Premium update products"
  ON products FOR UPDATE TO authenticated
  USING (is_premium_user());

-- product_variants
CREATE POLICY "Premium read variants"
  ON product_variants FOR SELECT TO authenticated
  USING (is_premium_user());
CREATE POLICY "Premium insert variants"
  ON product_variants FOR INSERT TO authenticated
  WITH CHECK (is_premium_user());
CREATE POLICY "Premium update variants"
  ON product_variants FOR UPDATE TO authenticated
  USING (is_premium_user());

-- stock_batch
CREATE POLICY "Premium read stock_batch"
  ON stock_batch FOR SELECT TO authenticated
  USING (is_premium_user());
CREATE POLICY "Premium insert stock_batch"
  ON stock_batch FOR INSERT TO authenticated
  WITH CHECK (is_premium_user());
CREATE POLICY "Premium update stock_batch"
  ON stock_batch FOR UPDATE TO authenticated
  USING (is_premium_user());

-- batch_status_log
CREATE POLICY "Premium read status_log"
  ON batch_status_log FOR SELECT TO authenticated
  USING (is_premium_user());
CREATE POLICY "Premium insert status_log"
  ON batch_status_log FOR INSERT TO authenticated
  WITH CHECK (is_premium_user());

-- batch_scan_history
CREATE POLICY "Premium read scan_history"
  ON batch_scan_history FOR SELECT TO authenticated
  USING (is_premium_user());
CREATE POLICY "Premium insert scan_history"
  ON batch_scan_history FOR INSERT TO authenticated
  WITH CHECK (is_premium_user());

-- alternative_prices
CREATE POLICY "Premium read alt_prices"
  ON alternative_prices FOR SELECT TO authenticated
  USING (is_premium_user());
CREATE POLICY "Premium insert alt_prices"
  ON alternative_prices FOR INSERT TO authenticated
  WITH CHECK (is_premium_user());
CREATE POLICY "Premium update alt_prices"
  ON alternative_prices FOR UPDATE TO authenticated
  USING (is_premium_user());

-- sales_transaction
CREATE POLICY "Premium read sales"
  ON sales_transaction FOR SELECT TO authenticated
  USING (is_premium_user());
CREATE POLICY "Premium insert sales"
  ON sales_transaction FOR INSERT TO authenticated
  WITH CHECK (is_premium_user());
CREATE POLICY "Premium update sales"
  ON sales_transaction FOR UPDATE TO authenticated
  USING (is_premium_user());

-- companies
CREATE POLICY "Premium read companies"
  ON companies FOR SELECT TO authenticated
  USING (is_premium_user());
CREATE POLICY "Premium insert companies"
  ON companies FOR INSERT TO authenticated
  WITH CHECK (is_premium_user());
CREATE POLICY "Premium update companies"
  ON companies FOR UPDATE TO authenticated
  USING (is_premium_user());

COMMIT;
