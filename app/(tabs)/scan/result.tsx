import { useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Image,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import BarcodeVisual from '@/components/ui/BarcodeVisual'
import { useBatchStore } from '@/stores/batchStore'
import { formatDate, formatCurrency } from '@/utils/formatters'
import { getStatusColor, colors, getAllowedTransitions, STATUS_COLORS } from '@/constants'
import { generateLabelHtml, calculateLabelLayout, PAPER_SIZES, LABEL_SIZES, type BatchLabelItem } from '@/utils/labelPrinter'
import { savePdfToLocal } from '@/services/pdf/savePdf'
import type { StockBatchWithDetails, BatchStatus } from '@/types'

const TRANSITION_LABELS: Record<BatchStatus, string> = {
  DRAFT: 'Aktivasi',
  ACTIVE: 'Tandai Tersedia',
  AVAILABLE: 'Tersedia',
  RESERVED: 'Dipesan',
  PARTIALLY_SOLD: 'Terjual Sebagian',
  SOLD_OUT: 'Habis Terjual',
  OBSOLETE: 'Obsolete',
  ARCHIVED: 'Arsip',
}

export default function ScanResultScreen() {
  const { code } = useLocalSearchParams<{ code: string }>()
  const router = useRouter()
  const batchStore = useBatchStore()

  const [batch, setBatch] = useState<StockBatchWithDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [activating, setActivating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [printing, setPrinting] = useState(false)
  const insets = useSafeAreaInsets()

  async function handleTransition(targetStatus: BatchStatus) {
    if (!batch) return
    const oldStatus = batch.status
    setActivating(true)
    try {
      await batchStore.updateBatchStatus(batch.batch_id, { new_status: targetStatus })
      await loadBatch(batch.batch_code)
      Alert.alert('Berhasil', `Status: ${oldStatus} → ${targetStatus}`)
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Gagal mengubah status')
    } finally {
      setActivating(false)
    }
  }

  function handleTransitionWithTransaction(targetStatus: BatchStatus) {
    if (!batch) return
    router.push({
      pathname: '/transaction/create',
      params: {
        batchId: batch.batch_id,
        batchCode: batch.batch_code,
        sku: batch.variant?.sku_full ?? '',
        initialStatus: batch.status,
        targetStatus,
      },
    })
  }

  async function handleReprint() {
    if (!batch) return
    const variant = batch.variant
    const product = variant?.product
    setPrinting(true)
    try {
      const items: BatchLabelItem[] = [{
        batchCode: batch.batch_code,
        batchIndex: 1,
        status: batch.status,
        productName: product?.product_name ?? '',
        sku: variant?.sku_full ?? '',
        barcodeUrl: batch.barcode_url ?? '',
        qtyPerBatch: batch.initial_qty,
      }]
      const config = calculateLabelLayout(PAPER_SIZES[0], LABEL_SIZES[0], 1)
      const html = await generateLabelHtml(items, config)
      await savePdfToLocal({
        defaultFileName: `Label_${batch.batch_code}`,
        htmlContent: html,
      })
    } catch (err: any) {
      Alert.alert('Gagal Cetak', err.message ?? 'Tidak bisa membuat PDF')
    } finally { setPrinting(false) }
  }

  useEffect(() => {
    if (!code) {
      setError('Kode batch tidak ditemukan')
      setLoading(false)
      return
    }
    loadBatch(code)
  }, [code])

  async function loadBatch(searchCode: string) {
    setLoading(true)
    setError(null)
    try {
      const result = await batchStore.findBatchByCode(searchCode)
      if (!result) {
        setError(`Batch "${searchCode}" tidak ditemukan`)
      } else {
        setBatch(result)
        batchStore.setSelectedBatch(result) // sync ke store agar realtime update
      }
    } catch (err: any) {
      setError(err.message ?? 'Gagal memuat batch')
    } finally {
      setLoading(false)
    }
  }

  // Subscribe to store's selectedBatch for realtime updates
  useEffect(() => {
    const unsub = useBatchStore.subscribe((state) => {
      if (state.selectedBatch && batch && state.selectedBatch.batch_id === batch.batch_id) {
        // Realtime update: refresh local state
        setBatch({ ...state.selectedBatch })
      }
    })
    return unsub
  }, [batch?.batch_id])

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color="#3B82F6" size="large" />
        <Text style={styles.loaderText}>Mencari batch...</Text>
      </View>
    )
  }

  if (error || !batch) {
    return (
      <View style={styles.loader}>
        <Text style={styles.errorText}>{error ?? 'Batch tidak ditemukan'}</Text>
        <Button title="Scan Ulang" onPress={() => router.back()} />
        <Button
          title="Input Manual"
          variant="outline"
          onPress={() => router.back()}
        />
      </View>
    )
  }

  const color = getStatusColor(batch.status)
  const variant = batch.variant
  const product = variant?.product
  const allowedTransitions = getAllowedTransitions(batch.status)

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}>
      {/* Status Banner */}
      <Card
        style={{
          borderColor: color.background + '44',
          backgroundColor: color.background + '11',
        }}
      >
        <View style={styles.statusHeader}>
          <Text style={styles.statusIcon}>{color.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.statusTitle}>Batch {batch.batch_code}</Text>
            <Text style={styles.statusCode}>SKU: {variant?.sku_full ?? '—'}</Text>
          </View>
          <Badge status={batch.status} />
        </View>
      </Card>

      {/* Batch Info */}
      <Card>
        <Text style={styles.sectionTitle}>Detail Batch</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Produk</Text>
          <Text style={styles.infoValue}>{product?.product_name ?? '—'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>SKU</Text>
          <Text style={styles.infoValue}>{variant?.sku_full ?? '—'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Versi · Finishing</Text>
          <Text style={styles.infoValue}>
            {product?.version ?? '—'} · {variant?.finishing ?? '—'}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Stok</Text>
          <Text style={styles.infoValue}>
            {batch.current_qty} / {batch.initial_qty} pcs
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Harga</Text>
          <Text style={styles.infoValue}>{formatCurrency((product?.base_price ?? 0) + (variant?.price_modifier ?? 0))}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Tanggal Masuk</Text>
          <Text style={styles.infoValue}>{formatDate(batch.entry_date)}</Text>
        </View>
      </Card>

      {/* Barcode Preview */}
      <Card>
        <Text style={styles.sectionTitle}>Barcode</Text>
        <BarcodeVisual code={batch.batch_code} height={50} />
        <Text style={styles.barcodeCode}>{batch.batch_code}</Text>
        {batch.barcode_url ? (
          <Image source={{ uri: batch.barcode_url }} style={styles.barcodeImage} resizeMode="contain" />
        ) : (
          <Text style={styles.barcodeHint}>Belum ada gambar barcode</Text>
        )}
      </Card>

      {/* Dynamic Transition Buttons */}
      <View style={styles.actions}>
        {allowedTransitions.map((target) => {
          const targetColor = STATUS_COLORS[target]
          const label = TRANSITION_LABELS[target] || target
          const isTransaction = target === 'RESERVED' || target === 'SOLD_OUT'

          return (
            <Button
              key={target}
              title={`${targetColor.icon} ${batch.status} → ${target} (${label})`}
              onPress={() =>
                isTransaction
                  ? handleTransitionWithTransaction(target)
                  : handleTransition(target)
              }
              loading={activating}
              fullWidth
              disabled={activating}
            />
          )
        })}

        {allowedTransitions.length === 0 && (
          <Text style={styles.noTransition}>
            Tidak ada transisi tersedia untuk status {batch.status}
          </Text>
        )}

        <View style={{ height: 8 }} />

        <Button
          title="Simpan Ulang Label"
          variant="outline"
          fullWidth
          loading={printing}
          onPress={handleReprint}
        />

        <Button
          title="Detail Lable"
          variant="outline"
          fullWidth
          onPress={() =>
            router.push({ pathname: '/label/[id]', params: { id: batch.batch_id } })
          }
        />

        <Button
          title="Scan ulang"
          variant="ghost"
          fullWidth
          onPress={() => router.back()}
        />
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: 16, gap: 12 },
  loader: {
    flex: 1,
    backgroundColor: colors.canvas,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 12,
  },
  loaderText: { fontSize: 14, color: colors.muted },
  errorIcon: { fontSize: 48, marginBottom: 8 },
  errorText: { fontSize: 15, color: colors.error, textAlign: 'center' },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusIcon: { fontSize: 32 },
  statusTitle: { fontSize: 16, fontWeight: '700', color: colors.ink },
  statusCode: { fontSize: 13, color: colors.muted, fontFamily: 'monospace', marginTop: 2 },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: colors.ink, marginBottom: 8 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#0F172A',
  },
  infoLabel: { fontSize: 13, color: colors.muted },
  infoValue: { fontSize: 13, color: colors.body, fontWeight: '500' },
  actions: { gap: 8 },
  noTransition: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    paddingVertical: 12,
  },
  barcodeCode: { fontSize: 14, fontFamily: 'monospace', fontWeight: '700', color: colors.ink, textAlign: 'center', marginTop: 8 },
  barcodeImage: { width: '100%', height: 100, marginTop: 8, borderRadius: 8 },
  barcodeHint: { fontSize: 12, color: colors.muted, textAlign: 'center', marginTop: 4 },
})
