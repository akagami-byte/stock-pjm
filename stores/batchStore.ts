import { create } from 'zustand'
import type { BatchStore, StockBatchWithDetails, CreateBatchInput, CreateBatchResponse, UpdateBatchStatusInput, BatchFilterParams, BatchStatus } from '@/types'
import { getQuery, rpc, getAuthUser } from '@/lib/dataRouter'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { canTransitionStatus } from '@/constants'
import { getDatabase } from '@/lib/database'

export function calculateNextStatus(
  currentQty: number,
  initialQty: number,
  currentStatus: BatchStatus
): BatchStatus {
  if (currentQty <= 0) return 'SOLD_OUT'
  if (currentQty < initialQty && currentQty > 0) return 'PARTIALLY_SOLD'
  if (currentQty === initialQty && currentStatus === 'RESERVED') return 'AVAILABLE'
  return currentStatus
}

interface LocalBatchFilterParams extends BatchFilterParams {
  batch_id?: string;
  batch_code?: string;
}

/**
 * Helper untuk mengambil data batch di SQLite Lokal dengan LEFT JOIN standar.
 * Menggantikan method .in(), .ilike(), dan relational string Supabase.
 */
async function fetchLocalBatchesWithJoin(filters?: LocalBatchFilterParams): Promise<{ batches: StockBatchWithDetails[], totalCount: number }> {
  const db = await getDatabase();

  let sql = `
    SELECT 
      sb.*,
      pv.variant_id AS pv_variant_id,
      pv.sku_full AS pv_sku_full,
      pv.finishing AS pv_finishing,
      pv.price_modifier AS pv_price_modifier,
      p.product_id AS p_product_id,
      p.product_name AS p_product_name,
      p.version AS p_version,
      p.base_price AS p_base_price,
      pt.type_id AS pt_type_id,
      pt.type_name AS pt_type_name,
      pt.type_code AS pt_type_code
    FROM stock_batch sb
    LEFT JOIN product_variants pv ON sb.variant_id = pv.variant_id
    LEFT JOIN products p ON pv.product_id = p.product_id
    LEFT JOIN product_types pt ON p.type_id = pt.type_id
    WHERE sb.deleted_at IS NULL
  `;

  const params: any[] = [];

  // Pengganti method .in() dan .eq() untuk status
  if (filters?.status && (filters.status as any) !== 'ALL') {
    if (Array.isArray(filters.status)) {
      if (filters.status.length > 0) {
        const placeholders = filters.status.map(() => '?').join(', ');
        sql += ` AND sb.status IN (${placeholders})`;
        params.push(...filters.status);
      }
    } else {
      sql += ` AND sb.status = ?`;
      params.push(filters.status as string);
    }
  }

  // Pengganti method .ilike() untuk search batch_code
  if (filters?.search) {
    sql += ` AND sb.batch_code LIKE ?`;
    params.push(`%${filters.search}%`);
  }

  if (filters?.variant_id) {
    sql += ` AND sb.variant_id = ?`;
    params.push(filters.variant_id);
  }

  if (filters?.batch_id) {
    sql += ` AND sb.batch_id = ?`;
    params.push(filters.batch_id);
  }

  if (filters?.batch_code) {
    sql += ` AND sb.batch_code = ?`;
    params.push(filters.batch_code);
  }

  sql += ` ORDER BY sb.entry_date DESC`;

  // Pengganti method .range() / .limit() untuk pagination
  if (filters?.limit) {
    sql += ` LIMIT ?`;
    params.push(filters.limit);
    if (filters?.offset) {
      sql += ` OFFSET ?`;
      params.push(filters.offset);
    }
  }

  const rawData = await db.getAllAsync<any>(sql, params);

  // Mapping hasil FLAT SQL ke NESTED OBJECT agar UI Stok & Label tidak crash
  const batches = rawData.map(row => ({
    ...row,
    status: row.status,
    variant: row.pv_variant_id ? {
      variant_id: row.pv_variant_id,
      sku_full: row.pv_sku_full,
      finishing: row.pv_finishing,
      price_modifier: row.pv_price_modifier,
      product: row.p_product_id ? {
        product_id: row.p_product_id,
        product_name: row.p_product_name,
        version: row.p_version,
        base_price: row.p_base_price,
        type: {
          type_id: row.pt_type_id,
          type_name: row.pt_type_name || '',
          type_code: row.pt_type_code || ''
        }
      } : null
    } : null,
    sales_transaction: [] // Array kosong aman sebagai fallback
  })) as StockBatchWithDetails[];

  // Hitung totalCount untuk pagination di lokal
  let countSql = `SELECT COUNT(*) as cnt FROM stock_batch sb WHERE sb.deleted_at IS NULL`;
  const countParams: any[] = [];
  
  if (filters?.status && (filters.status as any) !== 'ALL') {
    if (Array.isArray(filters.status)) {
      if (filters.status.length > 0) {
        const placeholders = filters.status.map(() => '?').join(', ');
        countSql += ` AND sb.status IN (${placeholders})`;
        countParams.push(...filters.status);
      }
    } else {
      countSql += ` AND sb.status = ?`;
      countParams.push(filters.status as string);
    }
  }
  if (filters?.search) {
    countSql += ` AND sb.batch_code LIKE ?`;
    countParams.push(`%${filters.search}%`);
  }
  if (filters?.variant_id) {
    countSql += ` AND sb.variant_id = ?`;
    countParams.push(filters.variant_id);
  }

  const countResult = await db.getFirstAsync<{ cnt: number }>(countSql, countParams);
  const totalCount = countResult?.cnt ?? batches.length;

  return { batches, totalCount };
}

/**
 * Batch / Label store – manages batch creation, lookup, and status updates.
 * Enforces the state machine for status transitions.
 * Realtime subscription only active for premium users.
 */
export const useBatchStore = create<BatchStore>((set, get) => ({
  // ─── State ──────────────────────────────────────────────
  batches: [],
  totalCount: 0,
  selectedBatch: null,
  loading: false,
  error: null,

  // ─── Realtime Subscription (premium only) ───────────────
  _realtimeChannel: null as any,

  subscribeToRealtime: () => {
    if (!useAuthStore.getState().user?.is_premium) return

    const existing = (get() as any)._realtimeChannel
    if (existing) return

    const channel = supabase
      .channel('batch-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'stock_batch' },
        (payload: any) => {
          const changedBatch = payload.new as StockBatchWithDetails
          const eventType = payload.eventType

          set((state) => {
            const updatedSelected =
              state.selectedBatch?.batch_id === changedBatch?.batch_id
                ? { ...state.selectedBatch, ...changedBatch }
                : state.selectedBatch

            const updatedBatches = state.batches.map((b) =>
              b.batch_id === changedBatch?.batch_id
                ? { ...b, ...changedBatch }
                : b
            )

            if (eventType === 'INSERT' && !state.batches.find(
              (b) => b.batch_id === changedBatch?.batch_id
            )) {
              return {
                batches: [changedBatch, ...state.batches],
                selectedBatch: updatedSelected,
              }
            }

            if (eventType === 'DELETE' || changedBatch?.deleted_at) {
              return {
                batches: updatedBatches.filter(
                  (b) => b.batch_id !== changedBatch?.batch_id
                ),
                selectedBatch:
                  updatedSelected?.batch_id === changedBatch?.batch_id
                    ? null
                    : updatedSelected,
              }
            }

            return { batches: updatedBatches, selectedBatch: updatedSelected }
          })
        }
      )
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          console.log('Realtime: subscribed to stock_batch changes')
        }
      })

    ;(get() as any)._realtimeChannel = channel
  },

  unsubscribeFromRealtime: () => {
    const channel = (get() as any)._realtimeChannel
    if (channel) {
      supabase.removeChannel(channel)
      ;(get() as any)._realtimeChannel = null
    }
  },

  // ─── Actions ────────────────────────────────────────────
  fetchBatches: async (filters?: BatchFilterParams) => {
    set({ loading: true, error: null })
    try {
      const isPremium = useAuthStore.getState().user?.is_premium;

      if (isPremium) {
        // --- 1. JALUR SUPABASE CLOUD (PREMIUM) ---
        let query = getQuery('stock_batch')
          .select('*, variant:product_variants(*, product:products(*, type:product_types(*))), sales_transaction:sales_transaction(company_name, status)', { count: 'exact' })
          .is('deleted_at', null)
          .order('entry_date', { ascending: false })

        if (filters?.status && (filters.status as any) !== 'ALL') {
          if (Array.isArray(filters.status)) {
            query = query.in('status', filters.status)
          } else {
            query = query.eq('status', filters.status as string)
          }
        }

        if (filters?.search) {
          query = query.ilike('batch_code', `%${filters.search}%`)
        }

        if (filters?.variant_id) {
          query = query.eq('variant_id', filters.variant_id)
        }

        if (filters?.limit) {
          query = query.limit(filters.limit)
        }

        if (filters?.offset) {
          query = query.range(filters.offset, filters.offset + (filters.limit ?? 50) - 1)
        }

        const { data, error, count } = await query

        if (error) throw error
        set({ batches: (data as unknown as StockBatchWithDetails[]) ?? [], totalCount: count ?? 0, loading: false })
      } else {
        // --- 2. JALUR SQLITE LOKAL (NON-PREMIUM) ---
        const { batches, totalCount } = await fetchLocalBatchesWithJoin(filters);
        set({ batches, totalCount, loading: false });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal memuat batch'
      set({ error: message, loading: false })
    }
  },

  createBatch: async (input: CreateBatchInput) => {
    set({ loading: true, error: null })
    try {
      const { data: userData } = await getAuthUser()

      const { data, error } = await rpc('generate_batch', {
        p_variant_id: input.variant_id,
        p_initial_qty: input.initial_qty,
        p_total_batches: input.total_batches,
        p_created_by: userData.user?.id || null,
      })

      if (error) throw error

      const result = data as unknown as CreateBatchResponse

      await get().fetchBatches()

      set({ loading: false })
      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal membuat batch'
      set({ error: message, loading: false })
      throw error
    }
  },

  fetchBatchById: async (batchId: string) => {
    try {
      const isPremium = useAuthStore.getState().user?.is_premium;

      if (isPremium) {
        const { data, error } = await getQuery('stock_batch')
          .select('*, variant:product_variants(*, product:products(*, type:product_types(*)))')
          .eq('batch_id', batchId)
          .single()

        if (error) throw error
        const batch = data as unknown as StockBatchWithDetails
        set({ selectedBatch: batch })
        return batch
      } else {
        const { batches } = await fetchLocalBatchesWithJoin({ batch_id: batchId });
        if (!batches || batches.length === 0) throw new Error('Batch tidak ditemukan');
        const batch = batches[0];
        set({ selectedBatch: batch });
        return batch;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Batch tidak ditemukan'
      set({ error: message })
      throw error
    }
  },

  findBatchByCode: async (batchCode: string) => {
    try {
      const parts = batchCode.includes('-') ? batchCode.split('-') : null
      const actualBatchCode = parts ? parts.pop()! : batchCode
      const skuPrefix = parts ? parts.join('-') : null

      const isPremium = useAuthStore.getState().user?.is_premium;
      let data: any[] = [];

      if (isPremium) {
        const res = await getQuery('stock_batch')
          .select('*, variant:product_variants(*, product:products(*, type:product_types(*)))')
          .eq('batch_code', actualBatchCode);
        if (res.error) throw res.error;
        data = res.data ?? [];
      } else {
        const res = await fetchLocalBatchesWithJoin({ batch_code: actualBatchCode });
        data = res.batches;
      }

      if (!data || data.length === 0) return null

      if (skuPrefix) {
        const match = data.find((row: any) => row.variant?.sku_full === skuPrefix)
        return (match as unknown as StockBatchWithDetails) ?? null
      }

      return (data[0] as unknown as StockBatchWithDetails)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal mencari batch'
      set({ error: message })
      return null
    }
  },

  updateBatchStatus: async (batchId: string, input: UpdateBatchStatusInput) => {
    set({ loading: true, error: null })
    try {
      const batch = get().selectedBatch ?? (await get().fetchBatchById(batchId))
      
      if (!canTransitionStatus(batch.status, input.new_status)) {
        throw new Error(
          `Tidak bisa mengubah status dari ${batch.status} ke ${input.new_status}`
        )
      }

      if (input.new_status === 'RESERVED' && !input.company_name) {
        throw new Error('Nama perusahaan WAJIB diisi untuk status RESERVED')
      }

      const { data: userData } = await getAuthUser()

      const { error: updateError } = await getQuery('stock_batch')
        .update({ status: input.new_status })
        .eq('batch_id', batchId)

      if (updateError) throw updateError

      const { error: logError } = await getQuery('batch_status_log')
        .insert({
          batch_id: batchId,
          old_status: batch.status,
          new_status: input.new_status,
          changed_by: userData.user?.id ?? null,
          note: input.note ?? null,
        })

      if (logError) console.warn('Failed to insert status log:', logError)

      await get().fetchBatchById(batchId)
      set({ loading: false })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal mengupdate status'
      set({ error: message, loading: false })
      throw error
    }
  },

  softDeleteBatch: async (batchId: string) => {
    set({ loading: true, error: null })
    try {
      const now = new Date()
      const deadline = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

      const { error } = await getQuery('stock_batch')
        .update({
          deleted_at: now.toISOString(),
          restore_deadline: deadline.toISOString(),
        })
        .eq('batch_id', batchId)

      if (error) throw error

      set((s) => ({
        batches: s.batches.filter((b) => b.batch_id !== batchId),
        loading: false,
      }))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal menghapus batch'
      set({ error: message, loading: false })
      throw error
    }
  },

  restoreBatch: async (batchId: string) => {
    set({ loading: true, error: null })
    try {
      const { error } = await getQuery('stock_batch')
        .update({
          deleted_at: null,
          restore_deadline: null,
        })
        .eq('batch_id', batchId)

      if (error) throw error

      await get().fetchBatches()
      set({ loading: false })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal memulihkan batch'
      set({ error: message, loading: false })
      throw error
    }
  },

  setSelectedBatch: (batch) => set({ selectedBatch: batch }),
  clearError: () => set({ error: null }),
}))