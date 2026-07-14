import { getQuery } from '@/lib/dataRouter'
import type { DashboardSummary, ReservedBatchView, LowStockBatchView, RecentActivity, StockBatch } from '@/types'

/**
 * Dashboard service – fetches view data for dashboard widgets.
 * Routes to Supabase (premium) or SQLite (basic) via dataRouter.
 */

/** Fetch the dashboard summary (total batch, stock available, sold today). */
export async function fetchDashboardSummary(): Promise<DashboardSummary | null> {
  const { data, error } = await getQuery('dashboard_summary')
    .select('*')
    .single()

  if (error) return null
  return data as unknown as DashboardSummary
}

/** Fetch reserved batches for the dashboard widget. */
export async function fetchReservedBatches(limit = 5): Promise<ReservedBatchView[]> {
  const { data, error } = await getQuery('reserved_batch')
    .select('*')
    .limit(limit)

  if (error) return []
  return data as unknown as ReservedBatchView[]
}

/** Fetch low stock batches (≤ 5% remaining). */
export async function fetchLowStockBatches(limit = 5): Promise<LowStockBatchView[]> {
  const { data, error } = await getQuery('low_stock_batch')
    .select('*')
    .limit(limit)

  if (error) return []
  return data as unknown as LowStockBatchView[]
}

/** Fetch trashed batches for dashboard widget. */
export async function fetchTrashBatches(limit = 5): Promise<StockBatch[]> {
  const { data, error } = await getQuery('stock_batch')
    .select('*')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })
    .limit(limit)

  if (error) return []
  return data as unknown as StockBatch[]
}

/** Fetch recent activities. */
export async function fetchRecentActivities(limit = 10): Promise<RecentActivity[]> {
  const { data, error } = await getQuery('recent_activities')
    .select('*')
    .limit(limit)

  if (error) return []
  return data as unknown as RecentActivity[]
}
