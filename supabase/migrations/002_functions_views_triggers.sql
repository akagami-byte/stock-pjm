-- Upgrade Migration: Define missing tables, views, triggers, and functions matching REQUIREMENT_FINAL.md

-- Drop outdated components if they exist
DROP VIEW IF EXISTS dashboard_summary CASCADE;
DROP VIEW IF EXISTS reserved_batch CASCADE;
DROP VIEW IF EXISTS low_stock_batch CASCADE;
DROP VIEW IF EXISTS recent_activities CASCADE;

DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS stock_scan CASCADE;
DROP TABLE IF EXISTS companies CASCADE;
DROP TABLE IF EXISTS alternative_prices CASCADE;
DROP TABLE IF EXISTS stock_batch CASCADE;
DROP TABLE IF EXISTS batch_status_log CASCADE;
DROP TABLE IF EXISTS batch_scan_history CASCADE;
DROP TABLE IF EXISTS sales_transaction CASCADE;

-- ─── Tables ──────────────────────────────────────────────────────────────────

-- 1. stock_batch
CREATE TABLE stock_batch (
    batch_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id UUID NOT NULL REFERENCES product_variants(variant_id) ON DELETE RESTRICT,
    batch_code VARCHAR(20) NOT NULL UNIQUE,
    initial_qty INT NOT NULL CHECK (initial_qty > 0),
    current_qty INT NOT NULL CHECK (current_qty >= 0),
    status VARCHAR(20) DEFAULT 'DRAFT',
    production_date DATE NULL,
    entry_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    deleted_at TIMESTAMP NULL,
    restore_deadline TIMESTAMP NULL
);

-- Enable RLS on stock_batch
ALTER TABLE stock_batch ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read stock_batch" ON stock_batch FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert stock_batch" ON stock_batch FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update stock_batch" ON stock_batch FOR UPDATE TO authenticated USING (true);

-- 2. batch_status_log
CREATE TABLE batch_status_log (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES stock_batch(batch_id) ON DELETE CASCADE,
    old_status VARCHAR(20) NULL,
    new_status VARCHAR(20) NOT NULL,
    changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    note TEXT NULL
);

-- Enable RLS on batch_status_log
ALTER TABLE batch_status_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read batch_status_log" ON batch_status_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert batch_status_log" ON batch_status_log FOR INSERT TO authenticated WITH CHECK (true);

-- 3. batch_scan_history
CREATE TABLE batch_scan_history (
    scan_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES stock_batch(batch_id) ON DELETE CASCADE,
    scanned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    scan_type VARCHAR(20) NOT NULL,
    scan_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    location VARCHAR(255) NULL,
    notes TEXT NULL
);

-- Enable RLS on batch_scan_history
ALTER TABLE batch_scan_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read batch_scan_history" ON batch_scan_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert batch_scan_history" ON batch_scan_history FOR INSERT TO authenticated WITH CHECK (true);

-- 4. alternative_prices
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

-- Enable RLS on alternative_prices
ALTER TABLE alternative_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read alternative_prices" ON alternative_prices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert alternative_prices" ON alternative_prices FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update alternative_prices" ON alternative_prices FOR UPDATE TO authenticated USING (true);

-- 5. sales_transaction
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

-- Enable RLS on sales_transaction
ALTER TABLE sales_transaction ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read sales_transaction" ON sales_transaction FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert sales_transaction" ON sales_transaction FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update sales_transaction" ON sales_transaction FOR UPDATE TO authenticated USING (true);

-- ─── Functions ───────────────────────────────────────────────────────────────

-- Function: Generate next batch code (AA0001 -> ZZ9999)
CREATE OR REPLACE FUNCTION generate_next_batch_code()
RETURNS VARCHAR AS $$
DECLARE
    v_last_code VARCHAR;
    v_letters VARCHAR;
    v_numbers INT;
    v_next_letters VARCHAR;
    v_next_numbers INT;
    v_next_code VARCHAR;
BEGIN
    -- Get the last batch code alphabetically
    SELECT batch_code INTO v_last_code
    FROM stock_batch
    ORDER BY batch_code DESC
    LIMIT 1;

    -- If no batch exists, start with 'AA0001'
    IF v_last_code IS NULL THEN
        RETURN 'AA0001';
    END IF;

    -- Extract letters (first 2 chars) and numbers (last 4 chars)
    v_letters := substring(v_last_code from 1 for 2);
    v_numbers := cast(substring(v_last_code from 3 for 4) as integer);

    IF v_numbers < 9999 THEN
        v_next_letters := v_letters;
        v_next_numbers := v_numbers + 1;
    ELSE
        -- Increment letters: e.g. AA -> AB, AZ -> BA
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
                    -- Overflow ZZ9999
                    RAISE EXCEPTION 'Batch code limit ZZ9999 reached.';
                END IF;
            END IF;
            v_next_letters := let1 || let2;
        END;
    END IF;

    -- Format the next code: e.g. AA0001
    v_next_code := v_next_letters || lpad(v_next_numbers::text, 4, '0');
    RETURN v_next_code;
END;
$$ LANGUAGE plpgsql;

-- Function: Generate batches with master validation (RPC endpoint)
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
    v_batch_code VARCHAR;
    v_result JSONB;
    v_created_codes TEXT[] := '{}';
BEGIN
    -- VALIDASI: Cek apakah variant_id ada di master data
    SELECT EXISTS (
        SELECT 1 FROM product_variants 
        WHERE variant_id = p_variant_id AND is_active = true
    ) INTO v_variant_exists;
    
    IF NOT v_variant_exists THEN
        RAISE EXCEPTION 'Varian produk tidak ditemukan di Master Data. Silakan tambahkan produk terlebih dahulu.';
    END IF;
    
    -- Ambil nama produk untuk referensi
    SELECT p.product_name INTO v_product_name
    FROM product_variants pv
    JOIN products p ON pv.product_id = p.product_id
    WHERE pv.variant_id = p_variant_id;
    
    -- Generate batch codes
    FOR i IN 1..p_total_batches LOOP
        -- Auto-generate batch code
        v_batch_code := generate_next_batch_code();
        
        -- Insert batch
        INSERT INTO stock_batch (
            variant_id,
            batch_code,
            initial_qty,
            current_qty,
            status,
            created_by,
            entry_date
        ) VALUES (
            p_variant_id,
            v_batch_code,
            p_initial_qty,
            p_initial_qty,
            'DRAFT',
            p_created_by,
            CURRENT_TIMESTAMP
        );
        
        v_created_codes := array_append(v_created_codes, v_batch_code::text);
    END LOOP;
    
    -- Return result
    v_result := jsonb_build_object(
        'success', true,
        'message', 'Berhasil membuat ' || p_total_batches || ' batch untuk produk ' || v_product_name,
        'total_batches', p_total_batches,
        'batch_codes', to_jsonb(v_created_codes)
    );
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- ─── Triggers ────────────────────────────────────────────────────────────────

-- Trigger Function: Validate that variant_id exists and is active in master data
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

-- Trigger Function: Reduce stock remaining when sales is completed
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

-- Trigger Function: Revert stock remaining if completed sale is cancelled/returned
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

-- ─── Views ───────────────────────────────────────────────────────────────────

-- View: dashboard_summary
CREATE OR REPLACE VIEW dashboard_summary AS
SELECT 
    (SELECT COUNT(*) FROM stock_batch WHERE deleted_at IS NULL) AS total_batch,
    (SELECT COALESCE(SUM(current_qty), 0) FROM stock_batch WHERE status IN ('AVAILABLE', 'PARTIALLY_SOLD') AND deleted_at IS NULL) AS stock_tersedia,
    (SELECT COALESCE(SUM(quantity_sold), 0) FROM sales_transaction WHERE DATE(transaction_date) = CURRENT_DATE AND status = 'COMPLETED') AS terjual_hari_ini;

-- View: reserved_batch
CREATE OR REPLACE VIEW reserved_batch AS
SELECT 
    sb.batch_code,
    st.company_name,
    st.quantity_sold AS qty_dipesan,
    st.transaction_date,
    (st.transaction_date + INTERVAL '3 days') AS deadline
FROM stock_batch sb
JOIN sales_transaction st ON sb.batch_id = st.batch_id
WHERE sb.status = 'RESERVED' AND st.status = 'RESERVED' AND sb.deleted_at IS NULL
ORDER BY st.transaction_date ASC;

-- View: low_stock_batch
CREATE OR REPLACE VIEW low_stock_batch AS
SELECT 
    batch_id,
    batch_code,
    variant_id,
    current_qty,
    initial_qty,
    ROUND((current_qty::DECIMAL / initial_qty) * 100, 2) AS percentage,
    status
FROM stock_batch
WHERE current_qty > 0 
  AND (current_qty::DECIMAL / initial_qty) <= 0.05
  AND status IN ('AVAILABLE', 'PARTIALLY_SOLD')
  AND deleted_at IS NULL
ORDER BY (current_qty::DECIMAL / initial_qty) ASC;

-- View: recent_activities
CREATE OR REPLACE VIEW recent_activities AS
SELECT 
    'BATCH_CREATED' AS type,
    batch_code AS reference,
    created_by,
    entry_date AS occurred_at
FROM stock_batch
WHERE deleted_at IS NULL

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
FROM sales_transaction
WHERE status = 'COMPLETED'

ORDER BY occurred_at DESC
LIMIT 10;
