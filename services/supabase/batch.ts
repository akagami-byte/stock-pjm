import { getQuery, rpc, getAuthUser } from '@/lib/dataRouter'
import type { StockBatch, StockBatchWithDetails, CreateBatchInput, BatchScanHistory, CreateScanInput } from '@/types'

/**
 * Batch service — batch creation, lookup, status management.
 * Routes to Supabase (premium) or SQLite (basic) via dataRouter.
 */

/** Fetch all non-deleted batches with variant + product info. */
export async function fetchBatches(statusFilter?: string) {
  let query = getQuery('stock_batch')
    .select('*, variant:product_variants(*, product:products(*))')
    .is('deleted_at', null)
    .order('entry_date', { ascending: false })

  if (statusFilter) {
    query = query.eq('status', statusFilter)
  }

  const { data, error } = await query
  if (error) throw error
  return data as unknown as StockBatchWithDetails[]
}

/** Find a batch by its unique batch_code. */
export async function findBatchByCode(batchCode: string) {
  const { data, error } = await getQuery('stock_batch')
    .select('*, variant:product_variants(*, product:products(*))')
    .eq('batch_code', batchCode)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return data as unknown as StockBatchWithDetails
}

/** Create batches via RPC with Master Data validation. */
export async function createBatch(input: CreateBatchInput) {
  const { data: userData } = await getAuthUser()

  const { data, error } = await rpc('generate_batch', {
    p_variant_id: input.variant_id,
    p_initial_qty: input.initial_qty,
    p_total_batches: input.total_batches,
    p_created_by: userData.user?.id || null,
  })

  if (error) throw error
  return data
}

/** Update batch status. */
export async function updateBatchStatus(batchId: string, newStatus: string) {
  const { error } = await getQuery('stock_batch')
    .update({ status: newStatus } as any)
    .eq('batch_id', batchId)

  if (error) throw error
}

/** Record a scan event. */
export async function recordScan(input: CreateScanInput) {
  const { data: userData } = await getAuthUser()

  const { data, error } = await getQuery('batch_scan_history')
    .insert({
      batch_id: input.batch_id,
      scanned_by: userData.user?.id ?? null,
      scan_type: input.scan_type,
      location: input.location ?? null,
      notes: input.notes ?? null,
    } as any)
    .select()
    .single()

  if (error) throw error
  return data as BatchScanHistory
}

/** Fetch scan history for a batch. */
export async function fetchScanHistory(batchId: string) {
  const { data, error } = await getQuery('batch_scan_history')
    .select('*')
    .eq('batch_id', batchId)
    .order('scan_timestamp', { ascending: false })

  if (error) throw error
  return data as BatchScanHistory[]
}

/** Soft-delete a batch (move to trash). */
export async function softDeleteBatch(batchId: string) {
  const now = new Date()
  const deadline = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  const { error } = await getQuery('stock_batch')
    .update({
      deleted_at: now.toISOString(),
      restore_deadline: deadline.toISOString(),
    } as any)
    .eq('batch_id', batchId)

  if (error) throw error
}

/** Restore a batch from trash. */
export async function restoreBatch(batchId: string) {
  const { error } = await getQuery('stock_batch')
    .update({
      deleted_at: null,
      restore_deadline: null,
    } as any)
    .eq('batch_id', batchId)

  if (error) throw error
}

/** Fetch trashed batches. */
export async function fetchTrashedBatches() {
  const { data, error } = await getQuery('stock_batch')
    .select('*')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })

  if (error) throw error
  return data as StockBatch[]
}
