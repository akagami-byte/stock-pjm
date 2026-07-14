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
import { useRouter } from 'expo-router'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { useBatchStore } from '@/stores/batchStore'
import { colors, typography, radius, spacing } from '@/constants'
import { formatDate } from '@/utils/formatters'
import {
  generateLabelHtml,
  calculateLabelLayout,
  PAPER_SIZES,
  LABEL_SIZES,
  type BatchLabelItem,
  type PaperSize,
  type LabelSize,
} from '@/utils/labelPrinter'
import { savePdfToLocal } from '@/services/pdf/savePdf'
import type { StockBatchWithDetails } from '@/types'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function CetakMassalScreen() {
  const router = useRouter()
  const { batches, loading, error, fetchBatches } = useBatchStore()

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const insets = useSafeAreaInsets()
  const [printing, setPrinting] = useState(false)
  const [selectedPaper, setSelectedPaper] = useState<PaperSize>(PAPER_SIZES[0])
  const [selectedLabelSize, setSelectedLabelSize] = useState<LabelSize>(LABEL_SIZES[0])

  useEffect(() => {
    fetchBatches()
  }, [])

  const handleRefresh = useCallback(() => {
    fetchBatches()
  }, [fetchBatches])

  const toggleSelectAll = () => {
    if (selected.size === batches.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(batches.map((b) => b.batch_id)))
    }
  }

  const toggleItem = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleCetakLabel = async () => {
    if (selected.size === 0) {
      Alert.alert('Info', 'Pilih minimal satu batch untuk dicetak')
      return
    }

    setPrinting(true)
    try {
      const selectedBatches = batches.filter((b) => selected.has(b.batch_id))

      // Build BatchLabelItem[] dengan SKU LENGKAP (sku-batchCode)
      const items: BatchLabelItem[] = selectedBatches.map((b, i) => ({
        batchCode: b.batch_code,
        batchIndex: i + 1,
        status: b.status,
        productName: b.variant?.product?.product_name ?? '—',
        sku: b.variant?.sku_full ?? '—',
        barcodeUrl: b.barcode_url ?? '',
        qtyPerBatch: b.initial_qty,
      }))

      const config = calculateLabelLayout(selectedPaper, selectedLabelSize, items.length)
      const html = await generateLabelHtml(items, config)

      await savePdfToLocal({
        defaultFileName: `Label_Massal_${selectedBatches[0]?.batch_code ?? 'batch'}`,
        htmlContent: html,
        pageSize: selectedPaper.name as 'A4' | 'Letter' | 'A5',
      })

      Alert.alert('Berhasil', `${items.length} label berhasil dicetak ke PDF`)
    } catch (e: any) {
      Alert.alert('Gagal', e?.message ?? 'Gagal mencetak label')
    } finally {
      setPrinting(false)
    }
  }

  const renderItem = ({ item }: { item: StockBatchWithDetails }) => {
    const isSelected = selected.has(item.batch_id)
    return (
      <Pressable
        style={[styles.itemCard, isSelected && styles.itemCardSelected]}
        onPress={() => toggleItem(item.batch_id)}
      >
        {/* Checkbox */}
        <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
          {isSelected && <Text style={styles.checkmark}>✓</Text>}
        </View>

        {/* Info */}
        <View style={styles.itemInfo}>
          <Text style={styles.itemCode}>{item.batch_code}</Text>
          <Text style={styles.itemProduct} numberOfLines={1}>
            {item.variant?.product?.product_name ?? '—'}
            {item.variant ? ` · ${item.variant.sku_full}` : ''}
          </Text>
          <Text style={styles.itemQty}>
            Stok: {item.current_qty} / {item.initial_qty} pcs
          </Text>
        </View>

        {/* Status */}
        <Badge status={item.status} size="sm" />
      </Pressable>
    )
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Kembali</Text>
        </Pressable>
        <Text style={styles.heading}>Cetak Massal</Text>
        <Text style={styles.subheading}>Pilih batch untuk dicetak label barcode</Text>
      </View>

      {/* Action bar */}
      <View style={styles.actionBar}>
        <Pressable style={styles.selectAllRow} onPress={toggleSelectAll}>
          <View
            style={[
              styles.checkbox,
              selected.size === batches.length && batches.length > 0 && styles.checkboxChecked,
            ]}
          >
            {selected.size === batches.length && batches.length > 0 && (
              <Text style={styles.checkmark}>✓</Text>
            )}
          </View>
          <Text style={styles.selectAllText}>Pilih Semua</Text>
        </Pressable>

        <Text style={styles.selectedCount}>
          {selected.size} dari {batches.length} terpilih
        </Text>
      </View>

      {/* Size picker */}
      <View style={styles.sizePicker}>
        <Text style={styles.sizeLabel}>Kertas:</Text>
        <View style={styles.chipRow}>
          {PAPER_SIZES.map((p) => (
            <Pressable
              key={p.name}
              style={[styles.chip, selectedPaper.name === p.name && styles.chipActive]}
              onPress={() => setSelectedPaper(p)}
            >
              <Text style={[styles.chipText, selectedPaper.name === p.name && styles.chipTextActive]}>
                {p.name}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={[styles.sizeLabel, { marginTop: 8 }]}>Ukuran Label:</Text>
        <View style={styles.chipRow}>
          {LABEL_SIZES.map((l) => (
            <Pressable
              key={l.name}
              style={[styles.chip, selectedLabelSize.name === l.name && styles.chipActive]}
              onPress={() => setSelectedLabelSize(l)}
            >
              <Text style={[styles.chipText, selectedLabelSize.name === l.name && styles.chipTextActive]}>
                {l.name}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* List */}
      {loading && batches.length === 0 ? (
        <ActivityIndicator color={colors.ink} size="large" style={styles.loader} />
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <Button title="Coba Lagi" variant="outline" onPress={handleRefresh} />
        </View>
      ) : batches.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>Belum ada batch</Text>
          <Text style={styles.emptyHint}>Batch akan muncul setelah dibuat melalui menu Label</Text>
        </View>
      ) : (
        <FlatList
          data={batches}
          keyExtractor={(item) => item.batch_id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          onRefresh={handleRefresh}
          refreshing={loading}
          ItemSeparatorComponent={() => <View style={{ height: spacing.xs }} />}
        />
      )}

      {/* Bottom action */}
      {selected.size > 0 && (
        <View style={styles.bottomBar}>
          <View style={styles.bottomInfo}>
            <Text style={styles.bottomLabel}>{selected.size} batch terpilih</Text>
          </View>
          <Button
            title={printing ? 'Mencetak...' : 'Cetak Label'}
            variant="primary"
            onPress={handleCetakLabel}
            loading={printing}
            disabled={printing}
            fullWidth
          />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  header: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, marginBottom: spacing.xs },
  backBtn: { alignSelf: 'flex-start', marginBottom: spacing.xs },
  backText: {
    fontSize: typography.size.base,
    color: colors.brand,
    fontWeight: typography.weight.medium,
  },
  heading: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.ink,
  },
  subheading: {
    fontSize: typography.size.sm,
    color: colors.muted,
    marginTop: spacing.xxs,
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  selectAllRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  selectAllText: {
    fontSize: typography.size.base,
    color: colors.ink,
    fontWeight: typography.weight.medium,
  },
  selectedCount: {
    fontSize: typography.size.sm,
    color: colors.muted,
    fontWeight: typography.weight.semibold,
  },
  loader: { marginTop: spacing.xxl },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg, gap: spacing.xs },
  errorText: { fontSize: typography.size.base, color: colors.error, textAlign: 'center' },
  emptyText: { fontSize: typography.size.md, color: colors.muted },
  emptyHint: { fontSize: typography.size.sm, color: colors.muted },
  list: { padding: spacing.md, paddingTop: spacing.xs },
  // Item card
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.canvas,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.md,
    gap: spacing.sm,
  },
  itemCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '06',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radius.xs,
    borderWidth: 2,
    borderColor: colors.hairline,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkmark: {
    color: colors.onPrimary,
    fontSize: 14,
    fontWeight: typography.weight.bold,
  },
  itemInfo: { flex: 1, gap: 2 },
  itemCode: {
    fontSize: typography.size.base,
    fontFamily: typography.font.mono,
    fontWeight: typography.weight.semibold,
    color: colors.ink,
  },
  itemProduct: {
    fontSize: typography.size.sm,
    color: colors.body,
  },
  itemQty: {
    fontSize: typography.size.xs,
    color: colors.mutedSoft,
  },
  // Bottom bar
  bottomBar: {
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    padding: spacing.md,
    backgroundColor: colors.canvas,
    gap: spacing.sm,
  },
  bottomInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bottomLabel: {
    fontSize: typography.size.sm,
    color: colors.muted,
    fontWeight: typography.weight.medium,
  },
  // Size picker
  sizePicker: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  sizeLabel: {
    fontSize: typography.size.xs,
    color: colors.muted,
    fontWeight: typography.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  chipRow: { flexDirection: 'row', gap: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.canvas,
  },
  chipActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  chipText: {
    fontSize: typography.size.sm,
    color: colors.body,
    fontWeight: typography.weight.medium,
  },
  chipTextActive: { color: colors.onPrimary },
})
