import { useEffect, useState, useCallback } from 'react'
import { View, Text, ScrollView, Alert, StyleSheet, TouchableOpacity } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { useBatchStore } from '@/stores/batchStore'
import { generateLabelHtml, calculateLabelLayout, PAPER_SIZES, LABEL_SIZES, type LayoutConfig, type BatchLabelItem, type PaperSize, type LabelSize } from '@/utils/labelPrinter'
import { savePdfToLocal } from '@/services/pdf/savePdf'
import { colors, radius } from '@/constants'
import type { PrintRecord } from './index'

const PRINT_HISTORY_KEY = '@pjm_print_history'

export default function PrintPreviewScreen() {
  const { batchIds } = useLocalSearchParams<{ batchIds: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const batchStore = useBatchStore()

  const [items, setItems] = useState<BatchLabelItem[]>([])
  const [loading, setLoading] = useState(true)
  const [printing, setPrinting] = useState(false)
  const [selectedPaper, setSelectedPaper] = useState<PaperSize>(PAPER_SIZES[0])
  const [selectedLabelSize, setSelectedLabelSize] = useState<LabelSize>(LABEL_SIZES[0])
  const [layoutConfig, setLayoutConfig] = useState<LayoutConfig | null>(null)

  const codes: string[] = batchIds ? JSON.parse(batchIds) : []

  useEffect(() => {
    loadBatches()
  }, [batchIds])

  useEffect(() => {
    if (items.length > 0) {
      setLayoutConfig(calculateLabelLayout(selectedPaper, selectedLabelSize, items.length))
    }
  }, [selectedPaper, selectedLabelSize, items])

  async function loadBatches() {
    setLoading(true)
    const results: BatchLabelItem[] = []
    for (const code of codes) {
      try {
        const batch = await batchStore.findBatchByCode(code)
        if (batch) {
          const v = batch.variant
          const p = v?.product
          results.push({
            batchCode: batch.batch_code, batchIndex: results.length + 1,
            status: batch.status,
            productName: p?.product_name ?? '',
            sku: v?.sku_full ?? '',
            barcodeUrl: (batch as any).barcode_url ?? '',
            qtyPerBatch: batch.initial_qty,
          })
        }
      } catch {}
    }
    setItems(results)
    setLoading(false)
  }

  async function handleSave(record: boolean = false) {
    if (!layoutConfig) return
    setPrinting(true)
    try {
      const html = await generateLabelHtml(items, layoutConfig)
      const fileName = `Label_${codes[0] ?? 'batch'}`
      await savePdfToLocal({ defaultFileName: fileName, htmlContent: html, pageSize: selectedPaper.name as any })

      if (record) {
        const history: PrintRecord[] = JSON.parse(
          (await AsyncStorage.getItem(PRINT_HISTORY_KEY)) || '[]'
        )
        history.unshift({
          id: Date.now().toString(),
          fileName: `${fileName}.pdf`,
          createdAt: new Date().toISOString(),
          batchCount: items.length,
          batchCodes: codes,
        })
        await AsyncStorage.setItem(PRINT_HISTORY_KEY, JSON.stringify(history.slice(0, 50)))
      }
    } catch (err: any) {
      Alert.alert('Gagal', err.message ?? '')
    } finally { setPrinting(false) }
  }

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 12, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: colors.muted }}>Memuat batch...</Text>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}>
      <Text style={styles.heading}>Cetak Massal</Text>
      <Text style={styles.subtitle}>{items.length} batch siap dicetak</Text>

      {/* Pengaturan Cetak */}
      <Card>
        <Text style={styles.sectionTitle}>Ukuran Kertas</Text>
        <View style={styles.chipRow}>
          {PAPER_SIZES.map((p) => (
            <TouchableOpacity key={p.name} style={[styles.chip, selectedPaper.name === p.name && styles.chipActive]}
              onPress={() => setSelectedPaper(p)}>
              <Text style={[styles.chipText, selectedPaper.name === p.name && styles.chipTextActive]}>{p.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Ukuran Label</Text>
        <View style={styles.chipRow}>
          {LABEL_SIZES.map((l) => (
            <TouchableOpacity key={l.name} style={[styles.chip, selectedLabelSize.name === l.name && styles.chipActive]}
              onPress={() => setSelectedLabelSize(l)}>
              <Text style={[styles.chipText, selectedLabelSize.name === l.name && styles.chipTextActive]}>{l.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {layoutConfig && (
          <Card style={{ backgroundColor: colors.surfaceSoft, marginTop: 16, borderLeftWidth: 3, borderLeftColor: colors.brand }}>
            <Text style={styles.estTitle}>Estimasi</Text>
            <Text style={styles.estText}>Layout: {layoutConfig.columns}×{layoutConfig.rows} · {layoutConfig.labelsPerPage}/halaman</Text>
            <Text style={styles.estText}>Total: {layoutConfig.totalPages} halaman</Text>
          </Card>
        )}
      </Card>

      {/* Batch codes quick view */}
      <Card>
        <Text style={styles.sectionTitle}>Batch ({codes.length})</Text>
        <Text style={{ fontSize: 12, color: colors.muted, fontFamily: 'monospace' }}>
          {codes.join(', ')}
        </Text>
      </Card>

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
        <View style={{ flex: 1 }}>
          <Button title="🖨️ Cetak" onPress={() => handleSave(false)} fullWidth loading={printing} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="💾 Cetak & Simpan" onPress={() => handleSave(true)} fullWidth variant="primary" loading={printing} />
        </View>
      </View>

      <View style={{ height: 8 }} />
      <Button title="← Kembali" variant="ghost" onPress={() => router.back()} />
      <View style={{ height: 40 }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: 16 },
  heading: { fontSize: 22, fontWeight: '700', color: colors.ink },
  subtitle: { fontSize: 14, color: colors.muted, marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: colors.body, marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: colors.surfaceCard, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: colors.hairline },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.body },
  chipTextActive: { color: colors.onPrimary },
  estTitle: { fontSize: 13, fontWeight: '700', color: colors.ink, marginBottom: 4 },
  estText: { fontSize: 12, color: colors.muted },
})
