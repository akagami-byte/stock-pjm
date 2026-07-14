import { create } from 'zustand'
import type { DashboardStore, DashboardSummary, ReservedBatchView, LowStockBatchView, RecentActivity, StockBatch } from '@/types'
import { getQuery } from '@/lib/dataRouter'

/**
 * Dashboard store – fetches summary data, reserved batches,
 * low stock alerts, trash items, and recent activities.
 * Routes to Supabase (premium) or SQLite (basic) via dataRouter.
 */
export const useDashboardStore = create<DashboardStore>((set) => ({
  // ─── State ──────────────────────────────────────────────
  summary: null,
  reservedBatches: [],
  lowStockBatches: [],
  trashBatches: [],
  recentActivities: [],
  loading: false,
  error: null,

  // ─── Actions ────────────────────────────────────────────
  fetchDashboardData: async () => {
    set({ loading: true, error: null })
    try {
      // Fetch all dashboard data in parallel
      const [summaryRes, reservedRes, lowStockRes, trashRes, activitiesRes] =
        await Promise.all([
          getQuery('dashboard_summary').select('*').single(),
          getQuery('reserved_batch').select('*').limit(5),
          getQuery('low_stock_batch').select('*').limit(5),
          getQuery('stock_batch')
            .select('*')
            .not('deleted_at', 'is', null)
            .order('deleted_at', { ascending: false })
            .limit(5),
          getQuery('recent_activities').select('*').limit(10),
        ])

      set({
        summary: (summaryRes.data as unknown as DashboardSummary) ?? null,
        reservedBatches: (reservedRes.data as unknown as ReservedBatchView[]) ?? [],
        lowStockBatches: (lowStockRes.data as unknown as LowStockBatchView[]) ?? [],
        trashBatches: (trashRes.data as unknown as StockBatch[]) ?? [],
        recentActivities: (activitiesRes.data as unknown as RecentActivity[]) ?? [],
        loading: false,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal memuat dashboard'
      set({ error: message, loading: false })
    }
  },

  refreshSummary: async () => {
    try {
      const { data } = await getQuery('dashboard_summary')
        .select('*')
        .single()

      set({ summary: (data as unknown as DashboardSummary) ?? null })
    } catch (error) {
      // Silent fail for refresh
    }
  },

  clearError: () => set({ error: null }),
}))
