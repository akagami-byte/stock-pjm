import { useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Image,
  Pressable,
} from 'react-native'
import { Icon } from '@/components/ui/Icon'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import BarcodeVisual from '@/components/ui/BarcodeVisual'
import { useBatchStore } from '@/stores/batchStore'
import { formatDate, formatCurrency } from '@/utils/formatters'
import { getStatusColor, getTransitionRequirements, getAllowedTransitions, getFinishingLabel, canTransitionStatus, colors } from '@/constants'
import { generateLabelHtml, calculateLabelLayout, PAPER_SIZES, LABEL_SIZES, type BatchLabelItem } from '@/utils/labelPrinter'
import { savePdfToLocal } from '@/services/pdf/savePdf'
import type { BatchStatus, StockBatchWithDetails } from '@/types'

export default function LabelDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const batchStore = useBatchStore()

  const [batch, setBatch] = useState<StockBatchWithDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showStatusChange, setShowStatusChange] = useState(false)
  const [targetStatus, setTargetStatus] = useState<BatchStatus | null>(null)
  const [companyName, setCompanyName] = useState('')
  const [note, setNote] = useState('')
  const [changingStatus, setChangingStatus] = useState(false)
  const [printing, setPrinting] = useState(false)

  useEffect(() => {
    if (id) {
      loadBatch(id)
    }
  }, [id])

  async function loadBatch(batchId: string) {
    setLoading(true)
    setError(null)
    try {
      const res = await batchStore.fetchBatchById(batchId)
      setBatch(res)
    } catch (err: any) {
      setError(err.message ?? 'Gagal memuat detail batch')
    } finally {
      setLoading(false)
    }
  }

  // Subscribe to store for realtime updates
  useEffect(() => {
    const unsub = useBatchStore.subscribe((state) => {
      if (state.selectedBatch && batch && state.selectedBatch.batch_id === batch.batch_id) {
        setBatch({ ...state.selectedBatch })
      }
    })
    return unsub
  }, [batch?.batch_id])

  const handleDelete = () => {
    if (!batch) return
    Alert.alert('Pindah ke Trash?', 'Batch akan dipindah ke trash dan bisa direstore dalam 30 hari.', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Pindah', style: 'destructive',
        onPress: async () => {
          try {
            await batchStore.softDeleteBatch(batch.batch_id)
            Alert.alert('Berhasil', 'Batch dipindahkan ke trash')
            router.back()
          } catch (err: any) { Alert.alert('Error', err.message) }
        },
      },
    ])
  }

  const handleStatusAction = (status: BatchStatus) => {
    if (!batch) return

    // Status yang butuh halaman transaksi
    if (status === 'RESERVED' || status === 'SOLD_OUT') {
      router.push({
        pathname: '/transaction/create',
        params: {
          batchId: batch.batch_id,
          batchCode: batch.batch_code,
          sku: batch.variant?.sku_full ?? '',
          initialStatus: batch.status,
          targetStatus: status,
        },
      })
      return
    }

    setTargetStatus(status)
    setCompanyName('')
    setNote('')
    setShowStatusChange(true)
  }

  const handleSubmitStatusChange = async () => {
    if (!batch || !targetStatus) return
    const req = getTransitionRequirements(batch.status, targetStatus)
    if (req?.requiresCompany && !companyName.trim()) {
      Alert.alert('Error', 'Nama perusahaan wajib diisi')
      return
    }
    if (req?.requiresNote && !note.trim()) {
      Alert.alert('Error', 'Catatan wajib diisi')
      return
    }

    setChangingStatus(true)
    try {
      const oldStatus = batch.status
      await batchStore.updateBatchStatus(batch.batch_id, { new_status: targetStatus, company_name: companyName || undefined, note: note || undefined })
      Alert.alert('Berhasil', `Status: ${oldStatus} → ${targetStatus}`)
      
      const updatedBatch = { ...batch, status: targetStatus }
      setBatch(updatedBatch)
      batchStore.setSelectedBatch(updatedBatch)

      setShowStatusChange(false)
      setTargetStatus(null)
    } catch (err: any) {
      Alert.alert('Error', err.message)
    } finally { setChangingStatus(false) }
  }

  // Cetak ulang label tunggal
  const handleReprint = async () => {
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

  if (loading && !batch) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color="#3B82F6" size="large" />
      </View>
    )
  }

  if (error || !batch) {
    return (
      <View style={styles.loader}>
        <Text style={styles.errorText}>{error ?? 'Batch tidak ditemukan'}</Text>
        <Button title="← Kembali" variant="ghost" onPress={() => router.back()} />
      </View>
    )
  }

  const variant = batch.variant
  const product = variant?.product
  const productType = product?.type
  const color = getStatusColor(batch.status)
  const allowedTransitions = getAllowedTransitions(batch.status)
  const isInTrash = !!batch.deleted_at
  const effectivePrice = (product?.base_price ?? 0) + (variant?.price_modifier ?? 0)

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            if (router.canGoBack()) {
              router.back()
            } else {
              router.replace('/label')
            }
          }}
          style={styles.backBtn}
        >
          <Icon name="arrow-left" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.heading}>Detail Label</Text>
        <View style={{ width: 30 }} />
      </View>

      <Card>
        <View style={styles.batchHeader}>
          <Text style={styles.batchCode}>{batch.batch_code}</Text>
          <Badge status={batch.status} />
        </View>
        {isInTrash && (
          <Text style={styles.trashWarning}>
            Batch ini di trash. Restore deadline: {formatDate(batch.restore_deadline ?? '')}
          </Text>
        )}
      </Card>

      {/* Product Info */}
      <Card>
        <Text style={styles.sectionTitle}>Informasi Produk</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Jenis</Text>
          <Text style={styles.infoValue}>[{productType?.type_code ?? '—'}] {productType?.type_name ?? '—'}</Text>
        </View>
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
          <Text style={styles.infoValue}>{product?.version ?? '—'} · {getFinishingLabel(variant?.finishing)}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Harga Efektif</Text>
          <Text style={styles.infoValue}>{formatCurrency(effectivePrice)}</Text>
        </View>
      </Card>

      {/* Stock Info */}
      <Card>
        <Text style={styles.sectionTitle}>Stok</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Stok Awal</Text>
          <Text style={styles.infoValue}>{batch.initial_qty}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Stok Saat Ini</Text>
          <Text style={[styles.infoValue, styles.stockBold]}>{batch.current_qty}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Tanggal Masuk</Text>
          <Text style={styles.infoValue}>{formatDate(batch.entry_date)}</Text>
        </View>
        {batch.production_date && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Tanggal Produksi</Text>
            <Text style={styles.infoValue}>{formatDate(batch.production_date)}</Text>
          </View>
        )}
      </Card>

      {/* Barcode Preview */}
      <Card>
        <Text style={styles.sectionTitle}>Barcode</Text>
        <BarcodeVisual code={batch.batch_code} height={60} />
        <Text style={styles.barcodeCode}>{batch.batch_code}</Text>
        {batch.barcode_url ? (
          <Image source={{ uri: batch.barcode_url }} style={styles.barcodeImage} resizeMode="contain" />
        ) : (
          <Text style={styles.barcodeHint}>Belum ada gambar barcode terupload</Text>
        )}
      </Card>

      {/* Reprint */}
      <Button
        title="Unduh Label"
        variant="outline"
        fullWidth
        loading={printing}
        onPress={handleReprint}
      />

      {/* Status Transition */}
      {!isInTrash && allowedTransitions.length > 0 && (
        <Card>
          <Text style={styles.sectionTitle}>Ubah Status</Text>
          <Text style={styles.sectionHint}>
            Status saat ini: {color.icon} {color.label}
          </Text>
          <View style={styles.transitionButtons}>
            {allowedTransitions.map((status) => {
              const sc = getStatusColor(status)
              return (
                <Button
                  key={status}
                  title={`${sc.icon} ${sc.label}`}
                  variant="outline"
                  size="sm"
                  onPress={() => handleStatusAction(status)}
                />
              )
            })}
          </View>
        </Card>
      )}

      {showStatusChange && targetStatus && (
        <Card style={{ borderColor: colors.brand, borderWidth: 2 }}>
          <Text style={styles.sectionTitle}>
            Konfirmasi: {batch.status} → {targetStatus}
          </Text>
          {(() => {
            const req = getTransitionRequirements(batch.status, targetStatus)
            return req ? <Text style={styles.sectionHint}>{req.description}</Text> : null
          })()}
          {getTransitionRequirements(batch.status, targetStatus)?.requiresCompany && (
            <Input label="Nama Perusahaan (WAJIB)" value={companyName} onChangeText={setCompanyName} placeholder="PT ..." />
          )}
          <Input label="Catatan" value={note} onChangeText={setNote} placeholder="Catatan opsional..." multiline numberOfLines={3} />
          <View style={{ height: 12 }} />
          <View style={styles.actionRow}>
            <Button title="Batal" variant="ghost" onPress={() => setShowStatusChange(false)} />
            <Button title={changingStatus ? 'Menyimpan...' : 'Konfirmasi'} onPress={handleSubmitStatusChange} loading={changingStatus} />
          </View>
        </Card>
      )}

      {!isInTrash && (
        <Button title="Pindah ke Trash" variant="danger" fullWidth onPress={handleDelete} />
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: 16, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', paddingBottom: 8 },
  backBtn: { padding: 4 },
  heading: { flex: 1, fontSize: 20, fontWeight: '700', color: colors.ink, textAlign: 'center' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.canvas, gap: 12 },
  errorText: { fontSize: 15, color: colors.error, textAlign: 'center' },
  batchHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  batchCode: { fontSize: 20, fontWeight: '700', color: colors.ink, fontFamily: 'monospace' },
  trashWarning: { fontSize: 12, color: colors.error, marginTop: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: colors.ink, marginBottom: 8 },
  sectionHint: { fontSize: 13, color: colors.muted, marginBottom: 8 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#0F172A' },
  infoLabel: { fontSize: 13, color: colors.muted },
  infoValue: { fontSize: 13, color: colors.body, fontWeight: '500' },
  stockBold: { fontSize: 16, fontWeight: '700', color: colors.ink },
  transitionButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  barcodeCode: { fontSize: 14, fontFamily: 'monospace', fontWeight: '700', color: colors.ink, textAlign: 'center', marginTop: 8 },
  barcodeImage: { width: '100%', height: 120, marginTop: 8, borderRadius: 8 },
  barcodeHint: { fontSize: 12, color: colors.muted, textAlign: 'center', marginTop: 4 },
})
