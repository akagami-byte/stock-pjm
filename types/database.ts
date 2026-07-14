// ─── Enums ───────────────────────────────────────────────────────────────────
export type BatchStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'AVAILABLE'
  | 'RESERVED'
  | 'PARTIALLY_SOLD'
  | 'SOLD_OUT'
  | 'OBSOLETE'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'RETURNED'

export type Finishing = 'C' | 'P' | 'S'

export type ScanType = 'ACTIVATE' | 'VERIFY' | 'SALE' | 'RETURN'

// ─── Tables ──────────────────────────────────────────────────────────────────
export interface Product {
  id: string
  code: string
  name: string
  price: number
  image_url: string | null
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ProductVariant {
  id: string
  product_id: string
  version: string
  sku: string | null
  finishing: Finishing | null
  price: number | null
  is_active: boolean
  created_at: string
}

export interface StockBatch {
  id: string
  batch_code: string
  variant_id: string | null
  product_id: string
  finishing: Finishing | null
  initial_qty: number
  current_qty: number
  status: BatchStatus
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  barcode_url?: string | null
}

export interface StockScan {
  id: string
  batch_id: string
  scan_type: ScanType
  user_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface Company {
  id: string
  name: string
  contact: string | null
  address: string | null
  phone: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Transaction {
  id: string
  batch_id: string
  company_id: string | null
  qty_sold: number
  price: number
  total: number
  invoice_no: string | null
  notes: string | null
  created_at: string
}

export interface AlternativePrice {
  id: string
  product_id: string
  company_id: string
  price: number
  created_at: string
}

// ─── Database wrapper ────────────────────────────────────────────────────────
export interface Database {
  public: {
    Tables: {
      products: { Row: Product; Insert: Omit<Product, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Product, 'id'>> }
      product_variants: { Row: ProductVariant; Insert: Omit<ProductVariant, 'id' | 'created_at'>; Update: Partial<Omit<ProductVariant, 'id'>> }
      stock_batch: { Row: StockBatch; Insert: Omit<StockBatch, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<StockBatch, 'id'>> }
      stock_scan: { Row: StockScan; Insert: Omit<StockScan, 'id' | 'created_at'>; Update: Partial<Omit<StockScan, 'id'>> }
      companies: { Row: Company; Insert: Omit<Company, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Company, 'id'>> }
      transactions: { Row: Transaction; Insert: Omit<Transaction, 'id' | 'created_at'>; Update: Partial<Omit<Transaction, 'id'>> }
      alternative_prices: { Row: AlternativePrice; Insert: Omit<AlternativePrice, 'id' | 'created_at'>; Update: Partial<Omit<AlternativePrice, 'id'>> }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      batch_status: BatchStatus
      finishing: Finishing
      scan_type: ScanType
    }
  }
}
