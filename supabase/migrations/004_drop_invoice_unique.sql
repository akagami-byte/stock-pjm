-- Migration: Hapus UNIQUE constraint dari invoice_number
-- Multiple item dalam 1 transaksi pakai invoice_number yang sama
-- UNIQUE constraint mencegah hal ini — sudah di-drop di production

ALTER TABLE sales_transaction DROP CONSTRAINT IF EXISTS sales_transaction_invoice_number_key;
