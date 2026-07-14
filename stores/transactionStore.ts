import { create } from 'zustand'
import type { TransactionStore, SalesTransactionWithDetails, InvoiceGroup, CreateTransactionInput, TransactionFilterParams } from '@/types'
import { getQuery, getAuthUser } from '@/lib/dataRouter'

/**
 * Transaction store – manages sales transactions and company auto-suggest.
 * Routes to Supabase (premium) or SQLite (basic) via dataRouter.
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

      const transactions = (data as unknown as SalesTransactionWithDetails[]) ?? []
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

      const { error } = await getQuery('sales_transaction')
        .insert(rows)

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
      let q = getQuery('sales_transaction')
        .select('company_name')
        .order('company_name', { ascending: true })

      if (query) {
        q = q.ilike('company_name', `%${query}%`)
      }

      const { data, error } = await q

      if (error) throw error

      const names = [...new Set((data ?? []).map((d: any) => d.company_name))]
      set({ companyNames: names as string[] })
      return names as string[]
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
