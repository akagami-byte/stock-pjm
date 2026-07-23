import { useEffect, useCallback, useState, useRef } from 'react'
import {
  View, Text, FlatList, Pressable, TextInput, ActivityIndicator, StyleSheet, Alert,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter, useFocusEffect } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { useBatchStore } from '@/stores/batchStore'
import { useAuthStore } from '@/stores/authStore'
import { formatDate } from '@/utils/formatters'
import { colors, typography, radius, ALL_BATCH_STATUSES, getStatusColor, FINISHING_OPTIONS, getFinishingLabel } from '@/constants'
import type { BatchStatus, Finishing, StockBatchWithDetails } from '@/types'

const PRINT_HISTORY_KEY = '@pjm_print_history'

export interface PrintRecord {
  id: string
  fileName: string
  createdAt: string
  batchCount: number
  batchCodes: string[]
}

export default function LabelListScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const role = useAuthStore((s) => s.user?.role ?? 'staff')
  const { batches, loading, error, fetchBatches } = useBatchStore()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<BatchStatus | 'ALL'>('ALL')
  const [finishingFilter, setFinishingFilter] = useState<Finishing | 'ALL'>('ALL')
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest')

  // Multi-select state
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const LABEL_STATUSES: readonly BatchStatus[] = ['DRAFT', 'ACTIVE'] as const

  useFocusEffect(
    useCallback(() => {
      fetchBatches({ status: ['DRAFT', 'ACTIVE'] as any, limit: 50, offset: 0 })
    }, [fetchBatches])
  )

  const toggleSelect = (batchId: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(batchId)) next.delete(batchId)
      else next.add(batchId)
      if (next.size === 0) setSelectMode(false)
      return next
    })
  }

  const handleLongPress = (batchId: string) => {
    setSelectMode(true)
    setSelected((prev) => {
      const next = new Set(prev)
      next.add(batchId)
      return next
    })
  }

  const handlePressIn = (batchId: string) => {
    longPressTimer.current = setTimeout(() => handleLongPress(batchId), 600)
  }

  const handlePressOut = () => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null }
  }

  const handlePrint = () => {
    const codes = batches
      .filter(b => selected.has(b.batch_id))
      .map(b => b.variant?.sku_full ? `${b.variant.sku_full}-${b.batch_code}` : b.batch_code)
    if (codes.length === 0) return
    router.push({
      pathname: '/label/print-preview',
      params: { batchIds: JSON.stringify(codes) },
    })
    setSelectMode(false); setSelected(new Set())
  }

  const filtered = batches
    .filter((b) => {
      if (search) {
        const q = search.toLowerCase()
        if (!b.batch_code.toLowerCase().includes(q) &&
            !b.variant?.product?.product_name?.toLowerCase().includes(q) &&
            !b.variant?.sku_full?.toLowerCase().includes(q) &&
            !b.variant?.product?.type?.type_code?.toLowerCase().includes(q)) return false
      }
      if (statusFilter !== 'ALL' && b.status !== statusFilter) return false
      if (b.status !== 'DRAFT' && b.status !== 'ACTIVE') return false
      if (finishingFilter !== 'ALL' && b.variant?.finishing !== finishingFilter) return false
      return true
    })
    .sort((a, b) => sortBy === 'newest'
      ? new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime()
      : new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime())

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.heading}>Daftar Label</Text>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          {role === 'staff' && (
            <Pressable onPress={() => router.push('/settings')} style={styles.iconBtn}>
              <Icon name="settings" size={22} color={colors.body} />
            </Pressable>
          )}
          <Pressable onPress={() => router.push('/label/history')} style={styles.iconBtn}>
            <Icon name="history" size={22} color={colors.body} />
          </Pressable>
          <Button title="+ Buat Label" size="sm" onPress={() => router.push('/label/create')} />
        </View>
      </View>

      {selectMode && (
        <View style={styles.selectBar}>
          <Text style={styles.selectCount}>{selected.size} dipilih</Text>
          <View style={{ flex: 1 }} />
          <Pressable onPress={() => { setSelectMode(false); setSelected(new Set()) }} style={styles.cancelBtn}>
            <Icon name="cross" size={18} color={colors.muted} />
          </Pressable>
          <Button title="Cetak" size="sm" onPress={handlePrint} />
        </View>
      )}

      <TextInput style={styles.searchInput} value={search} onChangeText={setSearch}
        placeholder="Cari batch, SKU, atau produk..." placeholderTextColor={colors.mutedSoft} />

      <View style={styles.filterRow}>
        {(['ALL', ...LABEL_STATUSES] as const).map((s) => (
          <Pressable key={s} style={[styles.filterChip, statusFilter === s && styles.filterChipActive]}
            onPress={() => setStatusFilter(s as any)}>
            <Text style={[styles.filterText, statusFilter === s && { color: s === 'ALL' ? colors.brand : getStatusColor(s as BatchStatus).background }]}>
              {s === 'ALL' ? 'Semua' : getStatusColor(s as BatchStatus).label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 4 }}>
        <Pressable style={[styles.filterChip, finishingFilter !== 'ALL' && styles.filterChipActive]}
          onPress={() => setFinishingFilter(finishingFilter === 'ALL' ? 'C' : finishingFilter === 'C' ? 'P' : finishingFilter === 'P' ? 'S' : 'ALL')}>
          <Text style={styles.filterText}>{finishingFilter === 'ALL' ? 'Finishing' : finishingFilter}</Text>
        </Pressable>
        <Pressable style={[styles.filterChip, styles.filterChipActive]}
          onPress={() => setSortBy(sortBy === 'newest' ? 'oldest' : 'newest')}>
          <Text style={styles.filterText}>{sortBy === 'newest' ? '↓ Terbaru' : '↑ Terlama'}</Text>
        </Pressable>
      </View>

      {loading && <ActivityIndicator size="large" color={colors.brand} style={{ marginTop: 32 }} />}
      {error && <Text style={styles.errorText}>{error}</Text>}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.batch_id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
        renderItem={({ item }) => {
          const isSel = selected.has(item.batch_id)
          const variant = item.variant
          const product = variant?.product
          const type = product?.type
          const color = getStatusColor(item.status)
          return (
            <Pressable
              style={[styles.card, isSel && styles.cardSelected]}
              onPress={() => selectMode ? toggleSelect(item.batch_id) : router.push({ pathname: '/label/[id]', params: { id: item.batch_id } })}
              onPressIn={() => handlePressIn(item.batch_id)}
              onPressOut={handlePressOut}
              onLongPress={() => {}} // handled by timer
            >
              <View style={styles.cardRow}>
                {selectMode && (
                  <View style={[styles.checkbox, isSel && styles.checkboxChecked]}>
                    {isSel && <Icon name="check" size={12} color="#fff" />}
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.code}>{item.batch_code}</Text>
                  <Text style={styles.product} numberOfLines={1}>
                    [{type?.type_code ?? '—'}] {product?.product_name ?? '—'}
                  </Text>
                  <Text style={styles.meta}>
                    SKU: {variant?.sku_full ?? '—'} · Finishing: {getFinishingLabel(variant?.finishing)} · {formatDate(item.entry_date)}
                  </Text>
                </View>
                <Badge status={item.status} />
              </View>
            </Pressable>
          )
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8 },
  heading: { fontSize: 22, fontWeight: '700', color: colors.ink },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceCard, justifyContent: 'center', alignItems: 'center' },
  selectBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: colors.surfaceSoft, gap: 8 },
  selectCount: { fontSize: 13, fontWeight: '600', color: colors.brand },
  cancelBtn: { padding: 4 },
  searchInput: { marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.surfaceCard, borderRadius: radius.md, fontSize: 13, color: colors.ink, fontFamily: typography.font.sans },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 4 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.surfaceCard },
  filterChipActive: { backgroundColor: colors.ink + '15' },
  filterText: { fontSize: 12, fontWeight: '500', color: colors.muted },
  errorText: { fontSize: 13, color: colors.error, textAlign: 'center', padding: 24 },
  card: { backgroundColor: colors.surfaceCard, borderRadius: radius.lg, padding: 12, marginBottom: 8 },
  cardSelected: { borderColor: colors.brand, borderWidth: 2 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: { width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: colors.hairline, justifyContent: 'center', alignItems: 'center' },
  checkboxChecked: { backgroundColor: colors.brand, borderColor: colors.brand },
  code: { fontSize: 16, fontWeight: '700', color: colors.ink, fontFamily: typography.font.mono },
  product: { fontSize: 13, color: colors.body, marginTop: 2 },
  meta: { fontSize: 11, color: colors.muted, marginTop: 2 },
})
