import { getQuery, getAuthUser } from '@/lib/dataRouter'
import type { SalesTransaction, SalesTransactionWithDetails, CreateTransactionInput } from '@/types'

/**
 * Transaction service – sales transaction operations.
 * Routes to Supabase (premium) or SQLite (basic) via dataRouter.
 */

/** Fetch all transactions with joined data. */
export async function fetchTransactions() {
  const { data, error } = await getQuery('sales_transaction')
    .select('*, batch:stock_batch(*, variant:product_variants(*, product:products(*)))')
    .order('transaction_date', { ascending: false })

  if (error) throw error
  return data as unknown as SalesTransactionWithDetails[]
}

/** Create a multi-product transaction. */
export async function createTransaction(input: CreateTransactionInput, invoiceNumber: string) {
  const { data: userData } = await getAuthUser()

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

  const { data, error } = await getQuery('sales_transaction')
    .insert(rows)
    .select()

  if (error) throw error
  return data as SalesTransaction[]
}

/** Fetch distinct company names for auto-suggest. */
export async function fetchCompanyNames(query?: string) {
  let q = getQuery('sales_transaction')
    .select('company_name')

  if (query) {
    q = q.ilike('company_name', `%${query}%`)
  }

  const { data, error } = await q

  if (error) throw error
  return [...new Set((data ?? []).map((d: any) => d.company_name))]
}

/** Cancel a transaction. */
export async function cancelTransaction(salesId: string) {
  const { error } = await getQuery('sales_transaction')
    .update({ status: 'CANCELLED' })
    .eq('sales_id', salesId)

  if (error) throw error
}

/** Return a transaction. */
export async function returnTransaction(salesId: string) {
  const { error } = await getQuery('sales_transaction')
    .update({ status: 'RETURNED' })
    .eq('sales_id', salesId)

  if (error) throw error
}
