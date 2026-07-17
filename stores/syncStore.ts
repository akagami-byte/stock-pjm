import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { getDatabase, ALL_TABLES } from '@/lib/database'
import { useAuthStore } from '@/stores/authStore'
import type { SyncStore, SyncQueueItem } from '@/types'

/**
 * Sync engine — 2-way sync between SQLite and Supabase.
 * Premium users: push local queue → Supabase, pull Supabase → SQLite.
 * Basic users: sync is no-op (offline-only).
 */

export const useSyncStore = create<SyncStore>((set, get) => ({
  // ─── State ──────────────────────────────────────────────
  isOnline: true,
  pendingCount: 0,
  isSyncing: false,
  lastSyncAt: null,
  error: null,

  // ─── Actions ────────────────────────────────────────────
  setOnline: (isOnline: boolean) => set({ isOnline }),

  /** Queue a mutation for sync to Supabase. Basic users: SQLite-only, skip queue. */
  addToQueue: async (item: SyncQueueItem) => {
    const isPremium = useAuthStore.getState().user?.is_premium ?? false
    if (!isPremium) return // Basic user: no sync needed

    const db = await getDatabase()
    await db.runAsync(
      `INSERT INTO _sync_queue (table_name, operation, record_id, payload)
       VALUES (?, ?, ?, ?)`,
      item.table_name,
      item.operation,
      item.record_id,
      JSON.stringify(item.payload)
    )
    set((s) => ({ pendingCount: s.pendingCount + 1 }))
  },

  /** Push all pending mutations to Supabase. Premium only. */
  processQueue: async () => {
    const isPremium = useAuthStore.getState().user?.is_premium ?? false
    if (!isPremium || get().isSyncing || !get().isOnline) return

    set({ isSyncing: true, error: null })
    try {
      const db = await getDatabase()
      const queue = await db.getAllAsync<{ id: number; table_name: string; operation: string; record_id: string; payload: string }>(
        "SELECT * FROM _sync_queue WHERE synced_at IS NULL ORDER BY id ASC"
      )

      for (const item of queue) {
        const payload = JSON.parse(item.payload)
        const table = item.table_name

        try {
          if (item.operation === 'INSERT' || item.operation === 'UPDATE') {
            const { error } = await supabase.from(table).upsert(payload)
            if (error) throw error
          } else if (item.operation === 'DELETE') {
            // Soft delete: set deleted_at
            const { error } = await supabase
              .from(table)
              .update({ deleted_at: new Date().toISOString() })
              .eq('id', item.record_id)
            if (error) throw error
          }

          await db.runAsync(
            "UPDATE _sync_queue SET synced_at = datetime('now') WHERE id = ?",
            item.id
          )
        } catch (err) {
          console.warn(`Sync failed for queue item ${item.id}:`, err)
          // Continue with next item
        }
      }

      await get().refreshPendingCount()
      set({ isSyncing: false, lastSyncAt: new Date().toISOString() })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sync gagal'
      set({ isSyncing: false, error: message })
    }
  },

  /** Pull latest data from Supabase into SQLite. Premium only. */
  pullData: async () => {
    const isPremium = useAuthStore.getState().user?.is_premium ?? false
    if (!isPremium || !get().isOnline) return

    try {
      const db = await getDatabase()

      for (const table of ALL_TABLES) {
        // Get last sync timestamp for this table
        const meta = await db.getFirstAsync<{ last_synced_at: string }>(
          "SELECT last_synced_at FROM _sync_meta WHERE table_name = ?", table
        )
        const since = meta?.last_synced_at || '1970-01-01T00:00:00Z'

        // Pull rows updated since last sync
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .gt('updated_at', since)
          .limit(500)

        if (error) {
          console.warn(`Pull failed for ${table}:`, error)
          continue
        }

        if (data && data.length > 0) {
          for (const row of data) {
            const keys = Object.keys(row)
            const placeholders = keys.map(() => '?').join(', ')
            await db.runAsync(
              `INSERT OR REPLACE INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`,
              keys.map((k) => row[k])
            )
          }
        }

        // Update sync timestamp
        await db.runAsync(
          "INSERT OR REPLACE INTO _sync_meta (table_name, last_synced_at) VALUES (?, datetime('now'))",
          table
        )
      }
    } catch (error) {
      console.warn('Pull data failed:', error)
    }
  },

  /** Full sync cycle: push → pull. Premium only. */
  fullSync: async () => {
    const isPremium = useAuthStore.getState().user?.is_premium ?? false
    if (!isPremium) return

    await get().processQueue()
    await get().pullData()
  },

  refreshPendingCount: async () => {
    try {
      const db = await getDatabase()
      const result = await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) as count FROM _sync_queue WHERE synced_at IS NULL"
      )
      set({ pendingCount: result?.count ?? 0 })
    } catch {
      set({ pendingCount: 0 })
    }
  },

  clearError: () => set({ error: null }),
}))
