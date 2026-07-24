import { create } from 'zustand'
import type { TransactionStore, SalesTransactionWithDetails, InvoiceGroup, CreateTransactionInput, TransactionFilterParams } from '@/types'
import { getQuery, getAuthUser } from '@/lib/dataRouter'
import { useAuthStore } from '@/stores/authStore'
import { getDatabase } from '@/lib/database'

/**
 * Helper untuk mengambil data transaksi di SQLite Lokal dengan LEFT JOIN
 * dan mengubah datanya kembali ke format Nested Object agar UI tidak error.
 */
async function fetchLocalTransactionsWithJoin(filters?: TransactionFilterParams): Promise<SalesTransactionWithDetails[]> {
  const db = await getDatabase();
  
  // Query SQL dengan penempatan alias kolom yang 100% sesuai skema lokal
  let sql = `
    SELECT 
      t.*,
      sb.batch_id AS sb_batch_id,
      sb.batch_code AS sb_batch_code,
      sb.initial_qty AS sb_initial_qty,
      sb.current_qty AS sb_current_qty,
      sb.status AS sb_status,
      pv.variant_id AS pv_variant_id,
      pv.sku_full AS pv_sku_full,
      pv.finishing AS pv_finishing,
      pv.price_modifier AS pv_price_modifier,
      p.product_id AS p_product_id,
      p.product_name AS p_product_name,
      p.version AS p_version,
      p.base_price AS p_base_price,
      pt.type_name AS pt_type_name,
      pt.type_code AS pt_type_code
    FROM sales_transaction t
    LEFT JOIN stock_batch sb ON t.batch_id = sb.batch_id
    LEFT JOIN product_variants pv ON sb.variant_id = pv.variant_id
    LEFT JOIN products p ON pv.product_id = p.product_id
    LEFT JOIN product_types pt ON p.type_id = pt.type_id
    WHERE 1=1
  `;

  const params: any[] = [];

  if (filters?.status) {
    sql += ` AND t.status = ?`;
    params.push(filters.status);
  }
  if (filters?.company_name) {
    sql += ` AND t.company_name LIKE ?`;
    params.push(`%${filters.company_name}%`);
  }
  if (filters?.date_from) {
    sql += ` AND t.transaction_date >= ?`;
    params.push(filters.date_from);
  }
  if (filters?.date_to) {
    sql += ` AND t.transaction_date <= ?`;
    params.push(filters.date_to);
  }

  sql += ` ORDER BY t.transaction_date DESC`;

  if (filters?.limit) {
    sql += ` LIMIT ?`;
    params.push(filters.limit);
  }

  const rawData = await db.getAllAsync<any>(sql, params);

  // Mapping hasil JOIN SQL ke dalam bentuk Nested Object asli
  return rawData.map(row => ({
    ...row,
    status: row.status,
    batch: row.sb_batch_id ? {
      batch_id: row.sb_batch_id,
      batch_code: row.sb_batch_code,
      initial_qty: row.sb_initial_qty,
      current_qty: row.sb_current_qty,
      status: row.sb_status,
      variant: row.pv_variant_id ? {
        variant_id: row.pv_variant_id,
        sku_full: row.pv_sku_full,
        finishing: row.pv_finishing,        // <-- Ambil asli dari product_variants
        version: row.p_version,             // <-- Ambil asli dari products
        base_price: row.p_base_price,       // <-- Ambil asli dari products
        price_modifier: row.pv_price_modifier,
        product: row.p_product_id ? {
          product_id: row.p_product_id,
          product_name: row.p_product_name,
          version: row.p_version,           // <-- Dipetakan juga ke object product
          base_price: row.p_base_price,     // <-- Dipetakan juga ke object product
          type: { 
            type_name: row.pt_type_name || '',
            type_code: row.pt_type_code || '' 
          }
        } : null
      } : null
    } : null
  })) as SalesTransactionWithDetails[];
}

/**
 * Transaction store – manages sales transactions and company auto-suggest.
 * Hybrid: Supabase (premium) vs SQLite (non-premium/basic).
 */
export const useTransactionStore = create<TransactionStore>((set, get) => ({
  // ─── State ──────────────────────────────────────────────
  transactions: [],
  invoiceGroups: [],
  selectedTransaction: null,
  companyNames: [],
  loading: false,
  error: null,

  // ─── Actions ────────────────────────────────────────────
  fetchTransactions: async (filters?: TransactionFilterParams) => {
    set({ loading: true, error: null })
    try {
      const isPremium = useAuthStore.getState().user?.is_premium;
      let transactions: SalesTransactionWithDetails[] = [];

      if (isPremium) {
        // --- 1. JALUR SUPABASE CLOUD (PREMIUM USER) ---
        let query = getQuery('sales_transaction')
          .select('*, batch:stock_batch(*, variant:product_variants(*, product:products(*, type:product_types(*))))')
          .order('transaction_date', { ascending: false })

        if (filters?.status) query = query.eq('status', filters.status)
        if (filters?.company_name) query = query.ilike('company_name', `%${filters.company_name}%`)
        if (filters?.date_from) query = query.gte('transaction_date', filters.date_from)
        if (filters?.date_to) query = query.lte('transaction_date', filters.date_to)
        if (filters?.limit) query = query.limit(filters.limit)

        const { data, error } = await query
        if (error) throw error
        transactions = (data as unknown as SalesTransactionWithDetails[]) ?? []
      } else {
        // --- 2. JALUR SQLITE LOKAL (NON-PREMIUM USER) ---
        transactions = await fetchLocalTransactionsWithJoin(filters);
      }

      const groups = groupByInvoice(transactions)
      set({ transactions, invoiceGroups: groups, loading: false })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal memuat transaksi'
      set({ error: message, loading: false })
    }
  },

  createTransaction: async (input: CreateTransactionInput) => {
    set({ loading: true, error: null })
    try {
      const { data: userData } = await getAuthUser()
      const invoiceNumber = generateInvoiceNumber()

      const rows = input.items.map((item) => ({
        batch_id: item.batch_id,
        company_name: input.company_name,
        quantity_sold: item.quantity_sold,
        price_per_unit: item.price_per_unit,
        alt_price_id: item.alt_price_id ?? null,
        invoice_number: invoiceNumber,
        status: 'COMPLETED' as const,
        created_by: userData.user?.id ?? null,
        notes: input.notes ?? null,
      }))

      // getQuery insert aman di kedua mode karena berupa CRUD sederhana (tanpa join select)
      const { error } = await getQuery('sales_transaction').insert(rows)
      if (error) throw error

      await get().fetchTransactions()
      set({ loading: false })
      return invoiceNumber
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal membuat transaksi'
      set({ error: message, loading: false })
      throw error
    }
  },

  cancelTransaction: async (salesId: string) => {
    set({ loading: true, error: null })
    try {
      const { error } = await getQuery('sales_transaction')
        .update({ status: 'CANCELLED' })
        .eq('sales_id', salesId)

      if (error) throw error
      await get().fetchTransactions()
      set({ loading: false })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal membatalkan transaksi'
      set({ error: message, loading: false })
      throw error
    }
  },

  returnTransaction: async (salesId: string) => {
    set({ loading: true, error: null })
    try {
      const { error } = await getQuery('sales_transaction')
        .update({ status: 'RETURNED' })
        .eq('sales_id', salesId)

      if (error) throw error
      await get().fetchTransactions()
      set({ loading: false })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal meretur transaksi'
      set({ error: message, loading: false })
      throw error
    }
  },

  fetchCompanyNames: async (query?: string) => {
    try {
      const isPremium = useAuthStore.getState().user?.is_premium;
      let names: string[] = [];

      if (isPremium) {
        let q = getQuery('sales_transaction')
          .select('company_name')
          .order('company_name', { ascending: true })

        if (query) q = q.ilike('company_name', `%${query}%`)
        const { data, error } = await q
        if (error) throw error
        names = [...new Set((data ?? []).map((d: any) => d.company_name))] as string[];
      } else {
        // Mode SQLite: Gunakan LIKE murni karena SQLite tidak mendukung syntax .ilike() Supabase
        const db = await getDatabase();
        let sql = `SELECT DISTINCT company_name FROM sales_transaction WHERE company_name IS NOT NULL`;
        const params: any[] = [];
        if (query) {
          sql += ` AND company_name LIKE ?`;
          params.push(`%${query}%`);
        }
        sql += ` ORDER BY company_name ASC`;
        const data = await db.getAllAsync<{ company_name: string }>(sql, params);
        names = data.map(d => d.company_name);
      }

      set({ companyNames: names })
      return names
    } catch (error) {
      return []
    }
  },

  setSelectedTransaction: (group) => set({ selectedTransaction: group }),
  clearError: () => set({ error: null }),
}))

// ─── Helpers ─────────────────────────────────────────────

function groupByInvoice(transactions: SalesTransactionWithDetails[]): InvoiceGroup[] {
  const map = new Map<string, SalesTransactionWithDetails[]>()

  for (const t of transactions) {
    const key = t.invoice_number ?? t.sales_id
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(t)
  }

  return Array.from(map.entries()).map(([invoiceNumber, items]) => ({
    invoice_number: invoiceNumber,
    company_name: items[0].company_name,
    status: items[0].status,
    transaction_date: items[0].transaction_date,
    items,
    total_amount: items.reduce((sum, i) => sum + (i.total_amount ?? 0), 0),
    total_quantity: items.reduce((sum, i) => sum + i.quantity_sold, 0),
  }))
}

function generateInvoiceNumber(): string {
  const now = new Date()
  const yy = String(now.getFullYear()).slice(-2)
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const rand = String(Math.floor(Math.random() * 10000)).padStart(4, '0')
  return `INV-${yy}${mm}${dd}-${rand}`
}