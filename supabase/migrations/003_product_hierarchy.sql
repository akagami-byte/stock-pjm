-- Migration 003: Restructure 3-level product hierarchy
-- product_types → products (version) → product_variants (finishing)
-- WARNING: This drops and recreates tables. All data will be lost.

BEGIN;

-- ═══════════════════════════════════════════════════════════════
-- 1. DROP existing objects (reverse order of dependencies)
-- ═══════════════════════════════════════════════════════════════

DROP VIEW IF EXISTS dashboard_summary CASCADE;
DROP VIEW IF EXISTS reserved_batch CASCADE;
DROP VIEW IF EXISTS low_stock_batch CASCADE;
DROP VIEW IF EXISTS recent_activities CASCADE;

DROP TABLE IF EXISTS sales_transaction CASCADE;
DROP TABLE IF EXISTS batch_scan_history CASCADE;
DROP TABLE IF EXISTS batch_status_log CASCADE;
DROP TABLE IF EXISTS alternative_prices CASCADE;
DROP TABLE IF EXISTS stock_batch CASCADE;
DROP TABLE IF EXISTS product_variants CASCADE;
DROP TABLE IF EXISTS products CASCADE;

DROP FUNCTION IF EXISTS generate_next_batch_code CASCADE;
DROP FUNCTION IF EXISTS generate_batch CASCADE;
DROP FUNCTION IF EXISTS validate_batch_variant CASCADE;
DROP FUNCTION IF EXISTS update_stock_after_sales CASCADE;
DROP FUNCTION IF EXISTS rollback_stock_after_cancel CASCADE;

-- ═══════════════════════════════════════════════════════════════
-- 2. NEW: product_types (JENIS PRODUK)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE product_types (
    type_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type_code VARCHAR(3) NOT NULL UNIQUE,          -- "HGP", "HBS"
    type_name VARCHAR(255) NOT NULL,                -- "Hollow Gate Pillar"
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════
-- 3. RESTRUCTURE: products (now = NAMA PRODUK detail + version)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE products (
    product_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type_id UUID NOT NULL REFERENCES product_types(type_id) ON DELETE RESTRICT,
    version VARCHAR(10) NOT NULL,                   -- "01", "02", "03"
    product_name VARCHAR(255) NOT NULL,              -- "Hollow Gate Pillar 20cm"
    description TEXT,
    base_price NUMERIC(12,2) NOT NULL DEFAULT 0,    -- moved from variants
    image_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(type_id, version)                         -- HGP-01 unique
);

-- ═══════════════════════════════════════════════════════════════
-- 4. RESTRUCTURE: product_variants (finishing only, version moved up)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE product_variants (
    variant_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
    finishing finishing NOT NULL,                    -- C, P, S
    sku_full VARCHAR(50) NOT NULL UNIQUE,            -- "HGP-01-C"
    price_modifier NUMERIC(12,2) NOT NULL DEFAULT 0, -- additional price per finishing
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(product_id, finishing)                    -- only one C/P/S per product
);

-- ═══════════════════════════════════════════════════════════════
-- 5. RESTRUCTURE: stock_batch (batch_code UNIQUE per variant)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE stock_batch (
    batch_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id UUID NOT NULL REFERENCES product_variants(variant_id) ON DELETE RESTRICT,
    batch_code VARCHAR(20) NOT NULL,
    initial_qty INT NOT NULL CHECK (initial_qty > 0),
    current_qty INT NOT NULL CHECK (current_qty >= 0),
    status VARCHAR(20) DEFAULT 'DRAFT',
    production_date DATE NULL,
    entry_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    deleted_at TIMESTAMP NULL,
    restore_deadline TIMESTAMP NULL,
    UNIQUE(variant_id, batch_code)                   -- ← KEY CHANGE: per variant, not global
);

-- ═══════════════════════════════════════════════════════════════
-- 6. batch_status_log (unchanged logic, new FKs)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE batch_status_log (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES stock_batch(batch_id) ON DELETE CASCADE,
    old_status VARCHAR(20) NULL,
    new_status VARCHAR(20) NOT NULL,
    changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    note TEXT NULL
);

-- ═══════════════════════════════════════════════════════════════
-- 7. batch_scan_history
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE batch_scan_history (
    scan_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES stock_batch(batch_id) ON DELETE CASCADE,
    scanned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    scan_type VARCHAR(20) NOT NULL,
    scan_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    location VARCHAR(255) NULL,
    notes TEXT NULL
);

-- ═══════════════════════════════════════════════════════════════
-- 8. alternative_prices (now references variant)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE alternative_prices (
    alt_price_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id UUID NOT NULL REFERENCES product_variants(variant_id) ON DELETE CASCADE,
    company_name VARCHAR(255) NOT NULL,
    proposed_price DECIMAL(15,2) NOT NULL CHECK (proposed_price >= 0),
    min_quantity INT NOT NULL DEFAULT 1,
    reason TEXT NULL,
    requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    valid_until DATE NULL
);

-- ═══════════════════════════════════════════════════════════════
-- 9. sales_transaction
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE sales_transaction (
    sales_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES stock_batch(batch_id) ON DELETE RESTRICT,
    company_name VARCHAR(255) NOT NULL,
    quantity_sold INT NOT NULL CHECK (quantity_sold > 0),
    price_per_unit DECIMAL(15,2) NOT NULL CHECK (price_per_unit >= 0),
    alt_price_id UUID NULL REFERENCES alternative_prices(alt_price_id) ON DELETE SET NULL,
    total_amount DECIMAL(15,2) GENERATED ALWAYS AS (quantity_sold * price_per_unit) STORED,
    transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    invoice_number VARCHAR(50) UNIQUE,
    status VARCHAR(20) DEFAULT 'RESERVED',
    taken_date TIMESTAMP NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    notes TEXT NULL
);

-- ═══════════════════════════════════════════════════════════════
-- 10. FUNCTIONS
-- ═══════════════════════════════════════════════════════════════

-- Generate next batch code PER VARIANT (restarts at AA0001 per variant)
CREATE OR REPLACE FUNCTION generate_next_batch_code(p_variant_id UUID)
RETURNS VARCHAR AS $$
DECLARE
    v_last_code VARCHAR;
    v_letters VARCHAR;
    v_numbers INT;
    v_next_letters VARCHAR;
    v_next_numbers INT;
    v_next_code VARCHAR;
BEGIN
    SELECT batch_code INTO v_last_code
    FROM stock_batch
    WHERE variant_id = p_variant_id       -- ← FILTER per variant
    ORDER BY batch_code DESC
    LIMIT 1;

    IF v_last_code IS NULL THEN
        RETURN 'AA0001';
    END IF;

    v_letters := substring(v_last_code from 1 for 2);
    v_numbers := cast(substring(v_last_code from 3 for 4) as integer);

    IF v_numbers < 9999 THEN
        v_next_letters := v_letters;
        v_next_numbers := v_numbers + 1;
    ELSE
        v_next_numbers := 1;
        DECLARE
            let1 CHAR;
            let2 CHAR;
        BEGIN
            let1 := substring(v_letters from 1 for 1);
            let2 := substring(v_letters from 2 for 1);
            
            IF let2 < 'Z' THEN
                let2 := chr(ascii(let2) + 1);
            ELSE
                let2 := 'A';
                IF let1 < 'Z' THEN
                    let1 := chr(ascii(let1) + 1);
                ELSE
                    RAISE EXCEPTION 'Batch code limit ZZ9999 reached.';
                END IF;
            END IF;
            v_next_letters := let1 || let2;
        END;
    END IF;

    v_next_code := v_next_letters || lpad(v_next_numbers::text, 4, '0');
    RETURN v_next_code;
END;
$$ LANGUAGE plpgsql;

-- Generate batches RPC
CREATE OR REPLACE FUNCTION generate_batch(
    p_variant_id UUID,
    p_initial_qty INT,
    p_total_batches INT,
    p_created_by UUID
)
RETURNS JSONB AS $$
DECLARE
    v_variant_exists BOOLEAN;
    v_product_name TEXT;
    v_type_name TEXT;
    v_batch_code VARCHAR;
    v_result JSONB;
    v_created_codes TEXT[] := '{}';
BEGIN
    -- Validate variant exists
    SELECT EXISTS (
        SELECT 1 FROM product_variants 
        WHERE variant_id = p_variant_id AND is_active = true
    ) INTO v_variant_exists;
    
    IF NOT v_variant_exists THEN
        RAISE EXCEPTION 'Varian produk tidak ditemukan di Master Data.';
    END IF;
    
    -- Get display info
    SELECT p.product_name, pt.type_name INTO v_product_name, v_type_name
    FROM product_variants pv
    JOIN products p ON pv.product_id = p.product_id
    JOIN product_types pt ON p.type_id = pt.type_id
    WHERE pv.variant_id = p_variant_id;
    
    -- Generate batches
    FOR i IN 1..p_total_batches LOOP
        v_batch_code := generate_next_batch_code(p_variant_id);  -- ← per variant
        
        INSERT INTO stock_batch (
            variant_id, batch_code, initial_qty, current_qty,
            status, created_by, entry_date
        ) VALUES (
            p_variant_id, v_batch_code, p_initial_qty, p_initial_qty,
            'DRAFT', p_created_by, CURRENT_TIMESTAMP
        );
        
        v_created_codes := array_append(v_created_codes, v_batch_code::text);
    END LOOP;
    
    v_result := jsonb_build_object(
        'success', true,
        'message', 'Berhasil membuat ' || p_total_batches || ' batch untuk ' || v_type_name || ' ' || v_product_name,
        'total_batches', p_total_batches,
        'batch_codes', to_jsonb(v_created_codes)
    );
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════
-- 11. TRIGGERS
-- ═══════════════════════════════════════════════════════════════

-- Validate variant_id on batch insert
CREATE OR REPLACE FUNCTION validate_batch_variant()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM product_variants 
        WHERE variant_id = NEW.variant_id AND is_active = true
    ) THEN
        RAISE EXCEPTION 'Varian produk tidak ditemukan di Master Data.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_batch_variant
BEFORE INSERT ON stock_batch
FOR EACH ROW
EXECUTE FUNCTION validate_batch_variant();

-- Update stock after sale
CREATE OR REPLACE FUNCTION update_stock_after_sales()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'COMPLETED' THEN
        UPDATE stock_batch 
        SET current_qty = current_qty - NEW.quantity_sold
        WHERE batch_id = NEW.batch_id;
        
        UPDATE stock_batch 
        SET status = 
            CASE 
                WHEN current_qty <= 0 THEN 'SOLD_OUT'
                WHEN current_qty < initial_qty THEN 'PARTIALLY_SOLD'
                ELSE status
            END
        WHERE batch_id = NEW.batch_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_stock_after_sales
AFTER INSERT ON sales_transaction
FOR EACH ROW
EXECUTE FUNCTION update_stock_after_sales();

-- Rollback stock after cancel
CREATE OR REPLACE FUNCTION rollback_stock_after_cancel()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status = 'COMPLETED' AND NEW.status IN ('CANCELLED', 'RETURNED') THEN
        UPDATE stock_batch 
        SET current_qty = current_qty + OLD.quantity_sold
        WHERE batch_id = OLD.batch_id;
        
        UPDATE stock_batch 
        SET status = 
            CASE 
                WHEN current_qty >= initial_qty THEN 'AVAILABLE'
                WHEN current_qty > 0 THEN 'PARTIALLY_SOLD'
                ELSE status
            END
        WHERE batch_id = OLD.batch_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_rollback_stock_after_cancel
AFTER UPDATE ON sales_transaction
FOR EACH ROW
EXECUTE FUNCTION rollback_stock_after_cancel();

-- ═══════════════════════════════════════════════════════════════
-- 12. INDEXES
-- ═══════════════════════════════════════════════════════════════

CREATE INDEX idx_product_types_code ON product_types(type_code);
CREATE INDEX idx_product_types_active ON product_types(is_active);
CREATE INDEX idx_products_type ON products(type_id);
CREATE INDEX idx_products_active ON products(is_active);
CREATE INDEX idx_variants_product ON product_variants(product_id);
CREATE INDEX idx_variants_active ON product_variants(is_active);
CREATE INDEX idx_batch_code ON stock_batch(batch_code);
CREATE INDEX idx_batch_variant ON stock_batch(variant_id);
CREATE INDEX idx_batch_status ON stock_batch(status);
CREATE INDEX idx_scan_batch ON batch_scan_history(batch_id);
CREATE INDEX idx_status_log_batch ON batch_status_log(batch_id);
CREATE INDEX idx_transaction_batch ON sales_transaction(batch_id);
CREATE INDEX idx_altprice_variant ON alternative_prices(variant_id);

-- ═══════════════════════════════════════════════════════════════
-- 13. RLS
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE product_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_batch ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_status_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_scan_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE alternative_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_transaction ENABLE ROW LEVEL SECURITY;

-- Product types
CREATE POLICY "Auth users read product_types" ON product_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users insert product_types" ON product_types FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users update product_types" ON product_types FOR UPDATE TO authenticated USING (true);

-- Products
CREATE POLICY "Auth users read products" ON products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users insert products" ON products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users update products" ON products FOR UPDATE TO authenticated USING (true);

-- Product variants
CREATE POLICY "Auth users read variants" ON product_variants FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users insert variants" ON product_variants FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users update variants" ON product_variants FOR UPDATE TO authenticated USING (true);

-- Stock batch
CREATE POLICY "Auth users read stock_batch" ON stock_batch FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users insert stock_batch" ON stock_batch FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users update stock_batch" ON stock_batch FOR UPDATE TO authenticated USING (true);

-- Status log
CREATE POLICY "Auth users read status_log" ON batch_status_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users insert status_log" ON batch_status_log FOR INSERT TO authenticated WITH CHECK (true);

-- Scan history
CREATE POLICY "Auth users read scan_history" ON batch_scan_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users insert scan_history" ON batch_scan_history FOR INSERT TO authenticated WITH CHECK (true);

-- Alt prices
CREATE POLICY "Auth users read alt_prices" ON alternative_prices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users insert alt_prices" ON alternative_prices FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users update alt_prices" ON alternative_prices FOR UPDATE TO authenticated USING (true);

-- Sales
CREATE POLICY "Auth users read sales" ON sales_transaction FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users insert sales" ON sales_transaction FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users update sales" ON sales_transaction FOR UPDATE TO authenticated USING (true);

-- ═══════════════════════════════════════════════════════════════
-- 14. VIEWS
-- ═══════════════════════════════════════════════════════════════

-- Dashboard summary
CREATE OR REPLACE VIEW dashboard_summary AS
SELECT 
    (SELECT COUNT(*) FROM stock_batch WHERE deleted_at IS NULL) AS total_batch,
    (SELECT COALESCE(SUM(current_qty), 0) FROM stock_batch 
     WHERE status IN ('AVAILABLE', 'PARTIALLY_SOLD') AND deleted_at IS NULL) AS stock_tersedia,
    (SELECT COALESCE(SUM(quantity_sold), 0) FROM sales_transaction 
     WHERE DATE(transaction_date) = CURRENT_DATE AND status = 'COMPLETED') AS terjual_hari_ini;

-- Reserved batch
CREATE OR REPLACE VIEW reserved_batch AS
SELECT 
    sb.batch_code,
    pv.sku_full,
    st.company_name,
    st.quantity_sold AS qty_dipesan,
    st.transaction_date,
    (st.transaction_date + INTERVAL '3 days') AS deadline
FROM stock_batch sb
JOIN sales_transaction st ON sb.batch_id = st.batch_id
JOIN product_variants pv ON sb.variant_id = pv.variant_id
WHERE sb.status = 'RESERVED' AND st.status = 'RESERVED' AND sb.deleted_at IS NULL
ORDER BY st.transaction_date ASC;

-- Low stock
CREATE OR REPLACE VIEW low_stock_batch AS
SELECT 
    batch_id, batch_code, variant_id,
    current_qty, initial_qty,
    ROUND((current_qty::DECIMAL / initial_qty) * 100, 2) AS percentage,
    status
FROM stock_batch
WHERE current_qty > 0 
  AND (current_qty::DECIMAL / initial_qty) <= 0.05
  AND status IN ('AVAILABLE', 'PARTIALLY_SOLD')
  AND deleted_at IS NULL
ORDER BY (current_qty::DECIMAL / initial_qty) ASC;

-- Recent activities
CREATE OR REPLACE VIEW recent_activities AS
SELECT 
    'BATCH_CREATED' AS type,
    batch_code AS reference,
    created_by,
    entry_date AS occurred_at
FROM stock_batch WHERE deleted_at IS NULL
UNION ALL
SELECT 
    'BATCH_ACTIVATED' AS type,
    sb.batch_code AS reference,
    bsl.changed_by,
    bsl.changed_at AS occurred_at
FROM batch_status_log bsl
JOIN stock_batch sb ON bsl.batch_id = sb.batch_id
WHERE bsl.new_status = 'ACTIVE' AND bsl.old_status = 'DRAFT'
UNION ALL
SELECT 
    'TRANSACTION' AS type,
    invoice_number AS reference,
    created_by,
    transaction_date AS occurred_at
FROM sales_transaction WHERE status = 'COMPLETED'
ORDER BY occurred_at DESC LIMIT 10;

COMMIT;
