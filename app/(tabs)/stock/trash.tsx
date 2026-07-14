import { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  Pressable,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import Button from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'
import { useBatchStore } from '@/stores/batchStore'
import { formatDate } from '@/utils/formatters'
import {
  colors,
  typography,
  radius,
  spacing,
  TRASH_DEADLINE_DAYS,
} from '@/constants'
import type { StockBatchWithDetails } from '@/types'

interface TrashBatchItem extends StockBatchWithDetails {
  restore_deadline: string | null
  deleted_at: string | null
}

export default function TrashScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const batchStore = useBatchStore()

  const [trashItems, setTrashItems] = useState<TrashBatchItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchTrashItems = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: fetchError } = await supabase
        .from('stock_batch')
        .select('*, variant:product_variants(*, product:products(*))')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false })

      if (fetchError) throw fetchError

      setTrashItems((data as unknown as TrashBatchItem[]) ?? [])
    } catch (err: any) {
      setError(err.message ?? 'Gagal memuat data trash')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTrashItems()
  }, [fetchTrashItems])

  const handleRestore = async (batchId: string) => {
    Alert.alert('Pulihkan Batch', 'Batch akan dikembalikan ke daftar aktif.', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Pulihkan',
        onPress: async () => {
          setRestoringId(batchId)
          try {
            await batchStore.restoreBatch(batchId)
            // Remove from local list
            setTrashItems((prev) => prev.filter((b) => b.batch_id !== batchId))
            Alert.alert('Berhasil', 'Batch berhasil dipulihkan')
          } catch (err: any) {
            Alert.alert('Error', err.message)
          } finally {
            setRestoringId(null)
          }
        },
      },
    ])
  }

  const handlePermanentDelete = async (batchId: string, batchCode: string) => {
    Alert.alert(
      'Hapus Permanen',
      `Batch "${batchCode}" akan dihapus permanen. Tindakan ini TIDAK DAPAT dibatalkan.\n\nLanjutkan?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus Permanen',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(batchId)
            try {
              const { error: delError } = await supabase
                .from('stock_batch')
                .delete()
                .eq('batch_id', batchId)

              if (delError) throw delError

              setTrashItems((prev) => prev.filter((b) => b.batch_id !== batchId))
              Alert.alert('Berhasil', 'Batch dihapus permanen')
            } catch (err: any) {
              Alert.alert('Error', err.message)
            } finally {
              setDeletingId(null)
            }
          },
        },
      ],
    )
  }

  const getDaysUntilDeadline = (deadline: string | null): {
    days: number
    label: string
    urgent: boolean
  } => {
    if (!deadline) return { days: TRASH_DEADLINE_DAYS, label: '—', urgent: false }
    const now = new Date()
    const deadlineDate = new Date(deadline)
    const diffMs = deadlineDate.getTime() - now.getTime()
    const days = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))

    if (days <= 0) {
      return { days: 0, label: 'Kadaluarsa', urgent: true }
    }
    if (days === 1) {
      return { days, label: '1 hari tersisa', urgent: true }
    }
    return { days, label: `${days} hari tersisa`, urgent: days <= 3 }
  }

  const renderItem = ({ item }: { item: TrashBatchItem }) => {
    const variant = item.variant
    const product = variant?.product
    const deadline = getDaysUntilDeadline(item.restore_deadline)
    const isBusy = restoringId === item.batch_id || deletingId === item.batch_id

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.batchCode}>{item.batch_code}</Text>
            <Text style={styles.productName} numberOfLines={1}>
              {product?.product_name ?? '—'}
              {variant ? ` · ${variant.sku_full}` : ''}
            </Text>
          </View>
          <View
            style={[
              styles.daysBadge,
              deadline.urgent && styles.daysBadgeUrgent,
            ]}
          >
            <Text
              style={[
                styles.daysText,
                deadline.urgent && styles.daysTextUrgent,
              ]}
            >
              {deadline.label}
            </Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.deletedInfo}>
            Dihapus: {formatDate(item.deleted_at ?? '')}
          </Text>
          <View style={styles.cardActions}>
            <Button
              title="↩️ Pulihkan"
              variant="secondary"
              size="sm"
              onPress={() => handleRestore(item.batch_id)}
              loading={restoringId === item.batch_id}
              disabled={isBusy}
            />
            <Button
              title="🗑️ Hapus"
              variant="danger"
              size="sm"
              onPress={() =>
                handlePermanentDelete(item.batch_id, item.batch_code)
              }
              loading={deletingId === item.batch_id}
              disabled={isBusy}
            />
          </View>
        </View>
      </View>
    )
  }

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>🗑️</Text>
      <Text style={styles.emptyTitle}>Trash Kosong</Text>
      <Text style={styles.emptyHint}>
        Batch yang dihapus akan muncul di sini selama {TRASH_DEADLINE_DAYS} hari
        sebelum dihapus permanen
      </Text>
    </View>
  )

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* AppBar-style header */}
      <View style={styles.appBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Kembali</Text>
        </Pressable>
        <Text style={styles.appBarTitle}>Trash ({trashItems.length})</Text>
        <View style={styles.backBtn} />
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.brand} size="large" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <Button title="Coba Lagi" variant="outline" onPress={fetchTrashItems} />
        </View>
      ) : (
        <FlatList
          data={trashItems}
          keyExtractor={(item) => item.batch_id}
          renderItem={renderItem}
          contentContainerStyle={
            trashItems.length === 0
              ? styles.listEmpty
              : styles.list
          }
          ListEmptyComponent={renderEmpty}
          onRefresh={fetchTrashItems}
          refreshing={loading}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },

  // AppBar
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.canvas,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  backBtn: {
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.xs,
    minWidth: 80,
  },
  backBtnText: {
    fontSize: typography.size.base,
    fontFamily: typography.font.sansSemiBold,
    color: colors.brand,
  },
  appBarTitle: {
    fontSize: typography.size.lg,
    fontFamily: typography.font.sansSemiBold,
    color: colors.ink,
  },

  // List
  list: { padding: spacing.md },
  listEmpty: { flexGrow: 1 },

  // Loader & error
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  errorText: {
    fontSize: typography.size.base,
    color: colors.error,
    textAlign: 'center',
  },

  // Card
  card: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  batchCode: {
    fontSize: typography.size.md,
    fontFamily: typography.font.mono,
    color: colors.ink,
    fontWeight: '700',
  },
  productName: {
    fontSize: typography.size.sm,
    color: colors.muted,
    marginTop: 2,
  },
  daysBadge: {
    backgroundColor: colors.mutedSoft + '33',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  daysBadgeUrgent: {
    backgroundColor: colors.error + '22',
  },
  daysText: {
    fontSize: typography.size.xs,
    fontFamily: typography.font.sansSemiBold,
    color: colors.muted,
  },
  daysTextUrgent: {
    color: colors.error,
  },

  // Card footer
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.hairlineSoft,
    gap: spacing.sm,
  },
  deletedInfo: {
    fontSize: typography.size.xs,
    color: colors.mutedSoft,
    flex: 1,
  },
  cardActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.xs,
  },
  emptyIcon: { fontSize: 48 },
  emptyTitle: {
    fontSize: typography.size.md,
    fontFamily: typography.font.sansSemiBold,
    color: colors.ink,
    marginTop: spacing.xs,
  },
  emptyHint: {
    fontSize: typography.size.sm,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
})
