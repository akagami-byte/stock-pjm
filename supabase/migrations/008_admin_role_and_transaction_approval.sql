-- Migration 008: Role Admin + Workflow Approval Transaksi
--
-- Alur approval:
--   1. Admin submit transaksi  → status PENDING_APPROVAL (INSERT, stok TIDAK berkurang)
--   2. Owner "Terima"          → status ACCEPTED (UPDATE, stok berkurang via trigger)
--   3. Owner "Tolak"           → status REJECTED (UPDATE, stok tetap aman)
--   4. Owner buat langsung     → status COMPLETED (INSERT, stok berkurang)
--
-- RLS: role admin dianggap premium (masuk is_premium_user() di migration 005),
-- jadi policy RLS yang ada sudah memberi admin akses penuh menyamai owner.
-- WAJIB: email admin ditambahkan ke whitelist is_premium_user() migration 005.

BEGIN;

-- ─── 1. Trigger: kurangi stok saat transaksi menjadi final ────────────────
-- Deduct berlaku untuk:
--   - INSERT status COMPLETED            (owner buat langsung)
--   - UPDATE PENDING_APPROVAL → ACCEPTED (owner menyetujui ajuan admin)
--   - UPDATE RESERVED → COMPLETED        (pesanan diambil)
CREATE OR REPLACE FUNCTION update_stock_after_sales()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.status = 'COMPLETED' THEN
        -- deduct di bawah
    ELSIF TG_OP = 'UPDATE' AND OLD.status = 'PENDING_APPROVAL' AND NEW.status = 'ACCEPTED' THEN
        -- deduct di bawah
    ELSIF TG_OP = 'UPDATE' AND OLD.status = 'RESERVED' AND NEW.status = 'COMPLETED' THEN
        -- deduct di bawah
    ELSE
        RETURN NEW;
    END IF;

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

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger agar juga menangkap UPDATE (approval)
DROP TRIGGER IF EXISTS trigger_update_stock_after_sales ON sales_transaction;

CREATE TRIGGER trigger_update_stock_after_sales
AFTER INSERT OR UPDATE ON sales_transaction
FOR EACH ROW
EXECUTE FUNCTION update_stock_after_sales();

-- ─── 2. Trigger: kembalikan stok saat transaksi final dibatalkan/diretur ──
CREATE OR REPLACE FUNCTION rollback_stock_after_cancel()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IN ('COMPLETED', 'ACCEPTED') AND NEW.status IN ('CANCELLED', 'RETURNED') THEN
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

-- ─── 3. RLS ────────────────────────────────────────────────────────────────
-- Admin = premium → policy is_premium_user() (migration 005) sudah mencakup.
-- Tidak ada policy baru yang diperlukan.
-- CATATAN: pastikan email admin ada di daftar is_premium_user() migration 005,
-- kalau tidak admin tidak bisa baca/tulis cloud (fallback ke SQLite lokal).

COMMIT;
