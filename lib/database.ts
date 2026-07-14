import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;

  db = await SQLite.openDatabaseAsync('pjm_stock.db');

  // WAL mode — better concurrent read/write
  await db.execAsync('PRAGMA journal_mode = WAL');

  // ─── Schema mirror (matches Supabase) ───────────────────────────────
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS product_types (
      type_id TEXT PRIMARY KEY,
      type_code TEXT NOT NULL UNIQUE,
      type_name TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS products (
      product_id TEXT PRIMARY KEY,
      type_id TEXT NOT NULL REFERENCES product_types(type_id),
      version TEXT NOT NULL,
      product_name TEXT NOT NULL,
      description TEXT,
      base_price REAL NOT NULL DEFAULT 0,
      image_url TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(type_id, version)
    );

    CREATE TABLE IF NOT EXISTS product_variants (
      variant_id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(product_id),
      finishing TEXT NOT NULL CHECK(finishing IN ('C','P','S')),
      sku_full TEXT NOT NULL UNIQUE,
      price_modifier REAL NOT NULL DEFAULT 0,
      description TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(product_id, finishing)
    );

    CREATE TABLE IF NOT EXISTS companies (
      company_id TEXT PRIMARY KEY,
      company_name TEXT NOT NULL UNIQUE,
      address TEXT,
      phone TEXT,
      image_url TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS stock_batch (
      batch_id TEXT PRIMARY KEY,
      variant_id TEXT NOT NULL REFERENCES product_variants(variant_id),
      batch_code TEXT NOT NULL,
      initial_qty INTEGER NOT NULL CHECK(initial_qty > 0),
      current_qty INTEGER NOT NULL CHECK(current_qty >= 0),
      status TEXT DEFAULT 'DRAFT',
      production_date TEXT,
      entry_date TEXT DEFAULT (datetime('now')),
      created_by TEXT,
      deleted_at TEXT,
      restore_deadline TEXT,
      barcode_url TEXT,
      UNIQUE(variant_id, batch_code)
    );

    CREATE TABLE IF NOT EXISTS batch_status_log (
      log_id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL REFERENCES stock_batch(batch_id),
      old_status TEXT,
      new_status TEXT NOT NULL,
      changed_by TEXT,
      changed_at TEXT DEFAULT (datetime('now')),
      note TEXT
    );

    CREATE TABLE IF NOT EXISTS batch_scan_history (
      scan_id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL REFERENCES stock_batch(batch_id),
      scanned_by TEXT,
      scan_type TEXT NOT NULL,
      scan_timestamp TEXT DEFAULT (datetime('now')),
      location TEXT,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS alternative_prices (
      alt_price_id TEXT PRIMARY KEY,
      variant_id TEXT NOT NULL REFERENCES product_variants(variant_id),
      company_name TEXT NOT NULL,
      proposed_price REAL NOT NULL CHECK(proposed_price >= 0),
      min_quantity INTEGER NOT NULL DEFAULT 1,
      reason TEXT,
      requested_by TEXT,
      requested_at TEXT DEFAULT (datetime('now')),
      valid_until TEXT
    );

    CREATE TABLE IF NOT EXISTS sales_transaction (
      sales_id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL REFERENCES stock_batch(batch_id),
      company_name TEXT NOT NULL,
      quantity_sold INTEGER NOT NULL CHECK(quantity_sold > 0),
      price_per_unit REAL NOT NULL CHECK(price_per_unit >= 0),
      alt_price_id TEXT REFERENCES alternative_prices(alt_price_id),
      total_amount REAL GENERATED ALWAYS AS (quantity_sold * price_per_unit) STORED,
      transaction_date TEXT DEFAULT (datetime('now')),
      invoice_number TEXT UNIQUE,
      status TEXT DEFAULT 'RESERVED',
      taken_date TEXT,
      created_by TEXT,
      notes TEXT
    );

    -- Sync metadata — last sync timestamp per table
    CREATE TABLE IF NOT EXISTS _sync_meta (
      table_name TEXT PRIMARY KEY,
      last_synced_at TEXT
    );

    -- Offline mutation queue (premium push to Supabase)
    CREATE TABLE IF NOT EXISTS _sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL,
      operation TEXT NOT NULL CHECK(operation IN ('INSERT','UPDATE','DELETE')),
      record_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      synced_at TEXT
    );
  `);

  // ─── Indexes ─────────────────────────────────────────────────────────
  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_local_product_types_code ON product_types(type_code);
    CREATE INDEX IF NOT EXISTS idx_local_products_type ON products(type_id);
    CREATE INDEX IF NOT EXISTS idx_local_variants_product ON product_variants(product_id);
    CREATE INDEX IF NOT EXISTS idx_local_batch_code ON stock_batch(batch_code);
    CREATE INDEX IF NOT EXISTS idx_local_batch_variant ON stock_batch(variant_id);
    CREATE INDEX IF NOT EXISTS idx_local_batch_status ON stock_batch(status);
    CREATE INDEX IF NOT EXISTS idx_local_companies_name ON companies(company_name);
    CREATE INDEX IF NOT EXISTS idx_local_transaction_batch ON sales_transaction(batch_id);
    CREATE INDEX IF NOT EXISTS idx_local_sync_queue_table ON _sync_queue(table_name, operation);
  `);

  return db;
}

// ─── Sync tables list ──────────────────────────────────────────────────
export const ALL_TABLES = [
  'product_types',
  'products',
  'product_variants',
  'companies',
  'stock_batch',
  'batch_status_log',
  'batch_scan_history',
  'alternative_prices',
  'sales_transaction',
] as const;

/** Reset database — for dev/debug only */
export async function resetDatabase() {
  const database = await getDatabase();
  for (const table of [...ALL_TABLES, '_sync_meta', '_sync_queue']) {
    await database.runAsync(`DELETE FROM ${table}`);
  }
}
