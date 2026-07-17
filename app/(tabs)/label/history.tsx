import { useEffect, useState } from 'react'
import { View, Text, FlatList, Pressable, Alert, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useBatchStore } from '@/stores/batchStore'
import { generateLabelHtml, calculateLabelLayout, PAPER_SIZES, LABEL_SIZES, type BatchLabelItem } from '@/utils/labelPrinter'
import { savePdfToLocal } from '@/services/pdf/savePdf'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import * as FileSystem from 'expo-file-system/legacy'
import { Icon } from '@/components/ui/Icon'
import { colors, radius } from '@/constants'
import type { PrintRecord } from './index'

const PRINT_HISTORY_KEY = '@pjm_print_history'

export default function PrintHistoryScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const batchStore = useBatchStore()
  const [records, setRecords] = useState<PrintRecord[]>([])
  const [savingId, setSavingId] = useState<string | null>(null)

  useEffect(() => {
    AsyncStorage.getItem(PRINT_HISTORY_KEY).then((raw) => {
      if (raw) setRecords(JSON.parse(raw))
    })
  }, [])

  async function handleSave(record: PrintRecord) {
    setSavingId(record.id)
    try {
      const items = await fetchItems(record.batchCodes)
      if (items.length === 0) { Alert.alert('Error', 'Data batch tidak ditemukan'); return }
      const config = calculateLabelLayout(PAPER_SIZES[0], LABEL_SIZES[0], items.length)
      const html = await generateLabelHtml(items, config)
      await savePdfToLocal({ defaultFileName: record.fileName.replace('.pdf', ''), htmlContent: html })
    } catch (err: any) { Alert.alert('Gagal', err.message ?? '') }
    finally { setSavingId(null) }
  }

  async function handleShare(record: PrintRecord) {
    setSavingId(record.id)
    try {
      const items = await fetchItems(record.batchCodes)
      if (items.length === 0) { Alert.alert('Error', 'Data batch tidak ditemukan'); return }
      const config = calculateLabelLayout(PAPER_SIZES[0], LABEL_SIZES[0], items.length)
      const html = await generateLabelHtml(items, config)
      const { uri } = await Print.printToFileAsync({ html, width: 595, height: 842 })
      const destPath = `${FileSystem.cacheDirectory}${record.fileName}`
      await FileSystem.copyAsync({ from: uri, to: destPath })
      await FileSystem.deleteAsync(uri, { idempotent: true })
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(destPath, { mimeType: 'application/pdf', dialogTitle: record.fileName, UTI: 'com.adobe.pdf' })
      }
    } catch (err: any) { Alert.alert('Gagal', err.message ?? '') }
    finally { setSavingId(null) }
  }

  async function fetchItems(codes: string[]): Promise<BatchLabelItem[]> {
    const items: BatchLabelItem[] = []
    for (const code of codes) {
      try {
        const batch = await batchStore.findBatchByCode(code)
        if (batch) {
          const v = batch.variant; const p = v?.product
          items.push({ batchCode: batch.batch_code, batchIndex: items.length + 1, status: batch.status, productName: p?.product_name ?? '', sku: v?.sku_full ?? '', barcodeUrl: (batch as any).barcode_url ?? '', qtyPerBatch: batch.initial_qty })
        }
      } catch {}
    }
    return items
  }

  async function handleDelete(id: string) {
    Alert.alert('Hapus Riwayat?', '', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus', style: 'destructive',
        onPress: async () => {
          const updated = records.filter(r => r.id !== id)
          setRecords(updated)
          await AsyncStorage.setItem(PRINT_HISTORY_KEY, JSON.stringify(updated))
        },
      },
    ])
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} style={{ padding: 4 }}>
          <Icon name="arrow-left" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.heading}>Histori Cetak</Text>
        <View style={{ width: 30 }} />
      </View>

      {records.length === 0 ? (
        <View style={styles.empty}>
          <Icon name="document" size={48} color={colors.mutedSoft} />
          <Text style={styles.emptyText}>Belum ada riwayat cetak</Text>
          <Text style={styles.emptyHint}>Gunakan &ldquo;Cetak & Simpan&rdquo; saat mencetak label</Text>
        </View>
      ) : (
        <FlatList
          data={records}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.cardIcon}>
                  <Icon name="pdf-file" size={28} color={colors.error} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fileName} numberOfLines={1}>{item.fileName}</Text>
                  <Text style={styles.fileMeta}>{item.batchCount} batch · {formatDate(item.createdAt)}</Text>
                  <Text style={styles.fileCodes} numberOfLines={1}>{item.batchCodes.join(', ')}</Text>
                </View>
              </View>
              <View style={styles.cardActions}>
                <Pressable style={styles.actionBtn} onPress={() => handleSave(item)} disabled={savingId === item.id}>
                  <Icon name="save" size={18} color={savingId === item.id ? colors.muted : colors.brand} />
                  <Text style={[styles.actionText, savingId === item.id && { color: colors.muted }]}>
                    {savingId === item.id ? '...' : 'Simpan'}
                  </Text>
                </Pressable>
                <Pressable style={styles.actionBtn} onPress={() => handleShare(item)} disabled={savingId === item.id}>
                  <Icon name="share" size={18} color={savingId === item.id ? colors.muted : colors.brand} />
                  <Text style={[styles.actionText, savingId === item.id && { color: colors.muted }]}>
                    {savingId === item.id ? '...' : 'Share'}
                  </Text>
                </Pressable>
                <Pressable style={styles.actionBtn} onPress={() => handleDelete(item.id)}>
                  <Icon name="trash" size={18} color={colors.error} />
                  <Text style={[styles.actionText, { color: colors.error }]}>Hapus</Text>
                </Pressable>
              </View>
            </View>
          )}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8 },
  heading: { flex: 1, fontSize: 20, fontWeight: '700', color: colors.ink, textAlign: 'center' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 8 },
  emptyText: { fontSize: 15, fontWeight: '600', color: colors.muted },
  emptyHint: { fontSize: 13, color: colors.mutedSoft },
  card: { backgroundColor: colors.surfaceCard, borderRadius: radius.lg, padding: 14, marginBottom: 10 },
  cardTop: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  cardIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: '#fef2f2', justifyContent: 'center', alignItems: 'center' },
  fileName: { fontSize: 14, fontWeight: '600', color: colors.ink },
  fileMeta: { fontSize: 11, color: colors.muted, marginTop: 2 },
  fileCodes: { fontSize: 10, color: colors.mutedSoft, fontFamily: 'monospace', marginTop: 2 },
  cardActions: { flexDirection: 'row', gap: 16, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.hairlineSoft },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: { fontSize: 12, fontWeight: '500', color: colors.brand },
})
