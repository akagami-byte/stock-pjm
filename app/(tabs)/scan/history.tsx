import { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from 'react-native'
import { useRouter } from 'expo-router'
import Button from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/utils/formatters'
import {
  colors,
  typography,
  radius,
  spacing,
} from '@/constants'
import type { BatchScanHistory, ScanType, StockBatch } from '@/types'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

/** Enriched scan item with batch_code from join */
interface ScanHistoryItem {
  scan_id: string
  batch_id: string
  scanned_by: string | null
  scan_type: ScanType
  scan_timestamp: string
  location: string | null
  notes: string | null
  batch_code: string | null
}

const SCAN_TYPE_OPTIONS: { value: ScanType | 'ALL'; label: string; icon: string }[] = [
  { value: 'ALL', label: 'Semua', icon: '📋' },
  { value: 'ACTIVATION', label: 'Aktivasi', icon: '✅' },
  { value: 'VIEW', label: 'Lihat', icon: '👁️' },
  { value: 'PICKING', label: 'Picking', icon: '📦' },
  { value: 'RETURN', label: 'Return', icon: '🔄' },
  { value: 'STOCK_OPNAME', label: 'Opname', icon: '📊' },
]

function getScanTypeLabel(type: ScanType): { icon: string; label: string } {
  const opt = SCAN_TYPE_OPTIONS.find((o) => o.value === type)
  return opt ?? { icon: '📋', label: type }
}

export default function ScanHistoryScreen() {
  const router = useRouter()

  const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>([])
  const insets = useSafeAreaInsets()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<ScanType | 'ALL'>('ALL')

  const fetchScanHistory = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      let query = supabase
        .from('batch_scan_history')
        .select('*')
        .order('scan_timestamp', { ascending: false })
        .limit(100)

      if (typeFilter !== 'ALL') {
        query = query.eq('scan_type', typeFilter)
      }

      const { data: scanData, error: scanError } = await query

      if (scanError) throw scanError

      const scans = scanData as unknown as BatchScanHistory[]

      if (scans.length === 0) {
        setScanHistory([])
        setLoading(false)
        return
      }

      // Fetch batch codes for all scans
      const batchIds = [...new Set(scans.map((s) => s.batch_id))]
      const { data: batchData, error: batchError } = await supabase
        .from('stock_batch')
        .select('batch_id, batch_code')
        .in('batch_id', batchIds)

      if (batchError) {
        console.warn('Failed to fetch batch codes:', batchError)
      }

      const batchMap = new Map<string, string>()
      if (batchData) {
        for (const b of batchData as unknown as Pick<StockBatch, 'batch_id' | 'batch_code'>[]) {
          batchMap.set(b.batch_id, b.batch_code)
        }
      }

      const enriched: ScanHistoryItem[] = scans.map((s) => ({
        ...s,
        batch_code: batchMap.get(s.batch_id) ?? null,
      }))

      setScanHistory(enriched)
    } catch (err: any) {
      setError(err.message ?? 'Gagal memuat riwayat scan')
    } finally {
      setLoading(false)
    }
  }, [typeFilter])

  useEffect(() => {
    fetchScanHistory()
  }, [fetchScanHistory])

  const handleItemPress = (item: ScanHistoryItem) => {
    if (item.batch_code) {
      router.push({
        pathname: '/scan/result',
        params: { code: item.batch_code },
      })
    } else {
      router.push({
        pathname: '/stock/[id]',
        params: { id: item.batch_id },
      })
    }
  }

  const renderItem = ({ item }: { item: ScanHistoryItem }) => {
    const typeInfo = getScanTypeLabel(item.scan_type)

    return (
      <Pressable
        style={({ pressed }) => [
          styles.scanItem,
          pressed && styles.scanItemPressed,
        ]}
        onPress={() => handleItemPress(item)}
      >
        <View style={styles.scanLeft}>
          <View style={styles.scanTypeIcon}>
            <Text style={styles.scanTypeEmoji}>{typeInfo.icon}</Text>
          </View>
          <View style={styles.scanInfo}>
            <Text style={styles.scanTypeLabel}>{typeInfo.label}</Text>
            <Text style={styles.scanBatchCode}>
              {item.batch_code ?? item.batch_id}
            </Text>
          </View>
        </View>
        <View style={styles.scanRight}>
          <Text style={styles.scanTimestamp}>
            {formatDate(item.scan_timestamp)}
          </Text>
          {item.location && (
            <Text style={styles.scanLocation}>{item.location}</Text>
          )}
        </View>
      </Pressable>
    )
  }

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>📋</Text>
      <Text style={styles.emptyTitle}>Belum Ada Riwayat Scan</Text>
      <Text style={styles.emptyHint}>
        {typeFilter === 'ALL'
          ? 'Riwayat scan akan muncul di sini setelah Anda melakukan scan barcode'
          : `Tidak ada scan dengan tipe "${getScanTypeLabel(typeFilter as ScanType).label}"`}
      </Text>
    </View>
  )

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      {/* AppBar-style header */}
      <View style={styles.appBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Kembali</Text>
        </Pressable>
        <Text style={styles.appBarTitle}>Riwayat Scan</Text>
        <View style={styles.backBtn} />
      </View>

      {/* Filter chips */}
      <FlatList
        horizontal
        data={SCAN_TYPE_OPTIONS}
        keyExtractor={(o) => o.value}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        renderItem={({ item }) => {
          const isActive = typeFilter === item.value
          return (
            <Pressable
              style={[
                styles.filterChip,
                isActive && styles.filterChipActive,
              ]}
              onPress={() => setTypeFilter(item.value)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  isActive && styles.filterChipTextActive,
                ]}
              >
                {item.icon} {item.label}
              </Text>
            </Pressable>
          )
        }}
      />

      {/* Content */}
      {loading && scanHistory.length === 0 ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.brand} size="large" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <Button
            title="Coba Lagi"
            variant="outline"
            onPress={fetchScanHistory}
          />
        </View>
      ) : (
        <FlatList
          data={scanHistory}
          keyExtractor={(item) => item.scan_id}
          renderItem={renderItem}
          contentContainerStyle={
            scanHistory.length === 0 ? styles.listEmpty : styles.list
          }
          ListEmptyComponent={renderEmpty}
          onRefresh={fetchScanHistory}
          refreshing={loading}
          ItemSeparatorComponent={() => <View style={{ height: 1 }} />}
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

  // Filter chips
  filterRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.canvas,
  },
  filterChipActive: {
    backgroundColor: colors.brand + '18',
    borderColor: colors.brand + '44',
  },
  filterChipText: {
    fontSize: typography.size.sm,
    fontFamily: typography.font.sansMedium,
    color: colors.muted,
  },
  filterChipTextActive: {
    color: colors.brand,
    fontFamily: typography.font.sansSemiBold,
  },

  // List
  list: {},
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

  // Scan item
  scanItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceCard,
  },
  scanItemPressed: { opacity: 0.7 },
  scanLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  scanTypeIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.canvas,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  scanTypeEmoji: { fontSize: 18 },
  scanInfo: { flex: 1 },
  scanTypeLabel: {
    fontSize: typography.size.sm,
    fontFamily: typography.font.sansSemiBold,
    color: colors.ink,
  },
  scanBatchCode: {
    fontSize: typography.size.sm,
    fontFamily: typography.font.mono,
    color: colors.muted,
    marginTop: 2,
  },
  scanRight: { alignItems: 'flex-end', marginLeft: spacing.sm },
  scanTimestamp: {
    fontSize: typography.size.xs,
    color: colors.mutedSoft,
  },
  scanLocation: {
    fontSize: typography.size.xs,
    color: colors.mutedSoft,
    marginTop: 2,
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
