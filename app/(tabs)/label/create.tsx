import { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  Alert,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useRouter } from 'expo-router'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import SearchDropdown from '@/components/ui/SearchDropdown'
import { useProductStore } from '@/stores/productStore'
import { useBatchStore } from '@/stores/batchStore'
import { supabase } from '@/lib/supabase'
import { colors, FINISHING_OPTIONS, getFinishingLabel } from '@/constants'
import type { Product, ProductVariant, Finishing, ProductType } from '@/types'
import { formatCurrency } from '@/utils/formatters'
import {
  PAPER_SIZES,
  LABEL_SIZES,
  calculateLabelLayout,
  generateLabelHtml,
  type PaperSize,
  type LabelSize,
  type LayoutConfig,
  type BatchLabelItem,
} from '@/utils/labelPrinter'
import { savePdfToLocal } from '@/services/pdf/savePdf'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

type Step = 'type' | 'product' | 'variant' | 'quantity' | 'preview'

interface VariantDisplay {
  id: string
  label: string
  subtitle: string
  variant: ProductVariant
}

export default function CreateLabelScreen() {
  const router = useRouter()
  const productStore = useProductStore()
  const batchStore = useBatchStore()

  // Step tracking
  const [step, setStep] = useState<Step>('type')
  const insets = useSafeAreaInsets()

  // Form state
  const [selectedType, setSelectedType] = useState<ProductType | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null)
  const [qtyPerBatch, setQtyPerBatch] = useState('50')
  const [numBatches, setNumBatches] = useState('1')
  const [previewCodes, setPreviewCodes] = useState<string[]>([])

  // Print/preview state
  const [selectedPaper, setSelectedPaper] = useState<PaperSize>(PAPER_SIZES[0])
  const [selectedLabelSize, setSelectedLabelSize] = useState<LabelSize>(LABEL_SIZES[0])
  const [layoutConfig, setLayoutConfig] = useState<LayoutConfig | null>(null)
  const [printing, setPrinting] = useState(false)

  // Data
  const [typeItems, setTypeItems] = useState<{ id: string; label: string; subtitle?: string }[]>([])
  const [productItems, setProductItems] = useState<{ id: string; label: string; subtitle?: string; product: Product }[]>([])
  const [variantItems, setVariantItems] = useState<VariantDisplay[]>([])

  // Load product types on mount
  useEffect(() => {
    productStore.fetchProductTypes()
  }, [])

  // Build type dropdown items
  useEffect(() => {
    const items = productStore.productTypes.map((pt) => ({
      id: pt.type_id,
      label: `[${pt.type_code}] ${pt.type_name}`,
      subtitle: pt.type_code,
    }))
    setTypeItems(items)
  }, [productStore.productTypes])

  // When type selected, load products for that type
  const handleTypeSelect = useCallback(
    async (item: { id: string; label: string }) => {
      const type = productStore.productTypes.find((t) => t.type_id === item.id)
      if (!type) return
      setSelectedType(type)
      const products = await productStore.fetchProductsByType(item.id)
      const items = products.map((p: any) => ({
        id: p.product_id,
        label: p.product_name,
        subtitle: `Versi ${p.version} · ${formatCurrency(p.base_price)}/pcs`,
        product: p,
      }))
      setProductItems(items)
      setStep('product')
    },
    [productStore]
  )

  // When product selected, load its variants
  const handleProductSelect = useCallback(
    async (item: { id: string; label: string; product: Product }) => {
      setSelectedProduct(item.product)
      const variants = await productStore.fetchVariantsByProduct(item.id)
      const items: VariantDisplay[] = variants.map((v) => ({
        id: v.variant_id,
        label: `${getFinishingLabel(v.finishing)}`,
        subtitle: `SKU: ${v.sku_full} · Modifier: ${formatCurrency(v.price_modifier)}/pcs`,
        variant: v,
      }))
      setVariantItems(items)
      setStep('variant')
    },
    [productStore]
  )

  // When variant selected
  const handleVariantSelect = useCallback((item: VariantDisplay) => {
    setSelectedVariant(item.variant)
    setStep('quantity')
  }, [])

  // Generate preview batch codes (from DB, not fake)
  const handleGenerate = useCallback(async () => {
    const qty = parseInt(qtyPerBatch, 10)
    const num = parseInt(numBatches, 10)

    if (isNaN(qty) || qty < 1) {
      Alert.alert('Error', 'Jumlah unit per batch minimal 1')
      return
    }
    if (isNaN(num) || num < 1) {
      Alert.alert('Error', 'Jumlah batch minimal 1')
      return
    }

    if (!selectedVariant) return

    // Query last batch_code for this variant from Supabase
    let startCode = 'AA0001'
    try {
      const { data } = await supabase
        .from('stock_batch')
        .select('batch_code')
        .eq('variant_id', selectedVariant.variant_id)
        .order('batch_code', { ascending: false })
        .limit(1)

      if (data && data.length > 0) {
        // Increment dari last code agar generate NEXT code (bukan same code)
        startCode = incrementBatchCode(data[0].batch_code)
      }
    } catch (_) {
      // If error, fallback to AA0001
    }

    // Generate next N codes from startCode
    const codes: string[] = []
    let current = startCode
    for (let i = 0; i < num; i++) {
      codes.push(current)
      current = incrementBatchCode(current)
    }

    setPreviewCodes(codes)
    setStep('preview')
  }, [qtyPerBatch, numBatches, selectedVariant])

  // Save batches to Supabase
  const handleSave = useCallback(async () => {
    if (!selectedVariant) return

    try {
      const result = await batchStore.createBatch({
        variant_id: selectedVariant.variant_id,
        initial_qty: parseInt(qtyPerBatch, 10),
        total_batches: parseInt(numBatches, 10),
      })

      Alert.alert(
        'Berhasil',
        result.message,
        [
          {
            text: 'Buat Lagi',
            onPress: () => {
              setStep('type')
              setSelectedType(null)
              setSelectedProduct(null)
              setSelectedVariant(null)
              setQtyPerBatch('50')
              setNumBatches('1')
              setPreviewCodes([])
            },
          },
          {
            text: 'Lihat Daftar',
            onPress: () => router.back(),
          },
        ]
      )
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Gagal membuat batch')
    }
  }, [selectedVariant, qtyPerBatch, numBatches, batchStore, router])

  const totalUnits = (parseInt(qtyPerBatch, 10) || 0) * (parseInt(numBatches, 10) || 0)
  const effectivePrice = (selectedProduct?.base_price ?? 0) + (selectedVariant?.price_modifier ?? 0)

  // Recalculate layout when paper/label/preview changes
  useEffect(() => {
    if (previewCodes.length === 0) return
    const config = calculateLabelLayout(
      selectedPaper,
      selectedLabelSize,
      previewCodes.length,
    )
    setLayoutConfig(config)
  }, [selectedPaper, selectedLabelSize, previewCodes])

  // Build batch items for HTML generation
  const buildLabelItems = useCallback((): BatchLabelItem[] => {
    return previewCodes.map((code, i) => ({
      batchCode: code,
      batchIndex: i + 1,
      status: 'DRAFT',
      productName: selectedProduct?.product_name ?? '',
      sku: selectedVariant?.sku_full ?? '',
      barcodeUrl: '', // akan diisi setelah upload S3 — fallback teks
      qtyPerBatch: parseInt(qtyPerBatch, 10) || 0,
    }))
  }, [previewCodes, selectedProduct, selectedVariant, qtyPerBatch])

  // Handle cetak PDF
  const handlePrint = useCallback(async () => {
    if (!layoutConfig) return
    setPrinting(true)
    try {
      const items = buildLabelItems()
      const html = await generateLabelHtml(items, layoutConfig)
      await savePdfToLocal({
        defaultFileName: `Label_${previewCodes[0] ?? 'batch'}`,
        htmlContent: html,
        pageSize: selectedPaper.name as 'A4' | 'Letter' | 'A5',
      })
    } catch (err: any) {
      Alert.alert('Gagal Cetak', err.message ?? 'Tidak bisa membuat PDF')
    } finally {
      setPrinting(false)
    }
  }, [layoutConfig, buildLabelItems, previewCodes, selectedPaper])

  // Handle Buat & Simpan (save batch + print PDF)
  const handleSaveAndPrint = useCallback(async () => {
    if (!layoutConfig) return
    setPrinting(true)
    try {
      // 1. Simpan batch ke DB
      const result = await batchStore.createBatch({
        variant_id: selectedVariant!.variant_id,
        initial_qty: parseInt(qtyPerBatch, 10),
        total_batches: parseInt(numBatches, 10),
      })

      // 2. Generate & simpan PDF
      const items = buildLabelItems()
      const html = await generateLabelHtml(items, layoutConfig)
      await savePdfToLocal({
        defaultFileName: `Label_${previewCodes[0] ?? 'batch'}`,
        htmlContent: html,
        pageSize: selectedPaper.name as 'A4' | 'Letter' | 'A5',
      })

      // 3. Save to print history
      try {
        const historyRaw = await AsyncStorage.getItem('@pjm_print_history')
        const history: any[] = historyRaw ? JSON.parse(historyRaw) : []
        history.unshift({
          id: Date.now().toString(),
          fileName: `Label_${previewCodes[0] ?? 'batch'}.pdf`,
          createdAt: new Date().toISOString(),
          batchCount: previewCodes.length,
          batchCodes: previewCodes,
        })
        await AsyncStorage.setItem('@pjm_print_history', JSON.stringify(history.slice(0, 50)))
      } catch {} // silently fail if storage error

      Alert.alert(
        'Berhasil',
        result.message + '\nPDF telah disimpan.',
        [
          { text: 'Buat Lagi', onPress: () => {
            setStep('type')
            setSelectedType(null)
            setSelectedProduct(null)
            setSelectedVariant(null)
            setQtyPerBatch('50')
            setNumBatches('1')
            setPreviewCodes([])
          }},
          { text: 'Lihat Daftar', onPress: () => router.back() },
        ]
      )
    } catch (err: any) {
      Alert.alert('Gagal', err.message ?? 'Gagal menyimpan batch')
    } finally {
      setPrinting(false)
    }
  }, [layoutConfig, buildLabelItems, previewCodes, selectedPaper, selectedVariant, qtyPerBatch, numBatches, batchStore, router])

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}>
      <Text style={styles.heading}>Buat Label Baru</Text>

      {/* ── Step 1: Pilih Jenis Produk ── */}
      {step === 'type' && (
        <Card>
          <Text style={styles.stepLabel}>Langkah 1/5</Text>
          <Text style={styles.sectionTitle}>Pilih Jenis Produk</Text>
          <SearchDropdown
            label="Cari Jenis Produk"
            placeholder="Ketik kode atau nama jenis..."
            items={typeItems}
            loading={productStore.loading}
            emptyMessage={
              productStore.loading
                ? 'Memuat...'
                : 'Jenis produk tidak ditemukan. Tambah di Master Data terlebih dahulu'
            }
            onSelect={handleTypeSelect}
          />
          {productStore.error && (
            <Text style={styles.error}>{productStore.error}</Text>
          )}
        </Card>
      )}

      {/* ── Step 2: Pilih Produk ── */}
      {step === 'product' && selectedType && (
        <Card>
          <Text style={styles.stepLabel}>Langkah 2/5</Text>
          <Text style={styles.sectionTitle}>Pilih Produk</Text>
          <Text style={styles.context}>
            Jenis: <Text style={styles.contextBold}>[{selectedType.type_code}] {selectedType.type_name}</Text>
          </Text>

          {productItems.map((item) => (
            <Button
              key={item.id}
              title={`${item.label}\n${item.subtitle}`}
              variant="outline"
              fullWidth
              onPress={() => handleProductSelect(item)}
            />
          ))}

          {productItems.length === 0 && (
            <Text style={styles.empty}>
              Belum ada produk untuk jenis ini. Tambah produk di Master Data.
            </Text>
          )}

          <View style={{ height: 8 }} />
          <Button
            title="← Kembali"
            variant="ghost"
            size="sm"
            onPress={() => setStep('type')}
          />
        </Card>
      )}

      {/* ── Step 3: Pilih Varian/Finishing ── */}
      {step === 'variant' && selectedProduct && (
        <Card>
          <Text style={styles.stepLabel}>Langkah 3/5</Text>
          <Text style={styles.sectionTitle}>Pilih Finishing</Text>
          <Text style={styles.context}>
            [{selectedType?.type_code}] {selectedProduct.product_name}
          </Text>

          {variantItems.map((item) => (
            <Button
              key={item.id}
              title={`${item.label}\n${item.subtitle}`}
              variant="outline"
              fullWidth
              onPress={() => handleVariantSelect(item)}
            />
          ))}

          {variantItems.length === 0 && (
            <Text style={styles.empty}>
              Belum ada varian finishing untuk produk ini. Tambah varian di Master Data.
            </Text>
          )}

          <View style={{ height: 8 }} />
          <Button
            title="← Pilih Produk Lain"
            variant="ghost"
            size="sm"
            onPress={() => setStep('product')}
          />
        </Card>
      )}

      {/* ── Step 4: Input Quantity ── */}
      {step === 'quantity' && selectedVariant && selectedProduct && (
        <Card>
          <Text style={styles.stepLabel}>Langkah 4/5</Text>
          <Text style={styles.sectionTitle}>Jumlah Batch</Text>
          <Text style={styles.context}>
            [{selectedType?.type_code}] {selectedProduct.product_name} ·{' '}
            {getFinishingLabel(selectedVariant.finishing)}
          </Text>
          <Text style={styles.context}>
            SKU: {selectedVariant.sku_full} · Harga: {formatCurrency(effectivePrice)}/pcs
          </Text>

          <View style={{ height: 16 }} />

          <Input
            label="Jumlah Unit per Batch"
            value={qtyPerBatch}
            onChangeText={setQtyPerBatch}
            placeholder="Minimal 1"
            keyboardType="numeric"
            suffix="pcs"
          />

          <View style={{ height: 12 }} />

          <Input
            label="Jumlah Batch"
            value={numBatches}
            onChangeText={setNumBatches}
            placeholder="Berapa batch?"
            keyboardType="numeric"
            suffix="batch"
          />

          <Text style={styles.totalHint}>
            Total unit: {totalUnits} pcs
          </Text>

          <View style={{ height: 16 }} />

          <Button
            title="Generate & Preview"
            onPress={handleGenerate}
            fullWidth
            disabled={
              !qtyPerBatch ||
              !numBatches ||
              parseInt(qtyPerBatch, 10) < 1 ||
              parseInt(numBatches, 10) < 1
            }
          />

          <View style={{ height: 8 }} />
          <Button
            title="← Pilih Finishing Lain"
            variant="ghost"
            size="sm"
            onPress={() => setStep('variant')}
          />
        </Card>
      )}

      {/* ── Step 5: Preview + Print ── */}
      {step === 'preview' && selectedVariant && selectedProduct && (
        <Card>
          <Text style={styles.stepLabel}>Preview & Cetak</Text>
          <Text style={styles.sectionTitle}>
            {previewCodes.length} Batch Siap Dibuat
          </Text>

          {/* Batch list */}
          <Card style={{ backgroundColor: colors.canvas, marginTop: 12 }}>
            {previewCodes.map((code, i) => (
              <View key={code} style={styles.codeRow}>
                <Text style={styles.codeIndex}>{i + 1}.</Text>
                <Text style={styles.codeText}>{code}</Text>
                <View style={styles.codeBadge}>
                  <Text style={styles.codeBadgeText}>DRAFT</Text>
                </View>
              </View>
            ))}
          </Card>

          <Text style={styles.totalHint}>
            {previewCodes.length} batch × {qtyPerBatch} pcs = {totalUnits} pcs total
          </Text>

          {/* ── Paper & Label Picker ── */}
          <View style={{ height: 20 }} />
          <Text style={styles.sectionTitle}>Pengaturan Cetak</Text>

          <Text style={styles.pickerLabel}>Ukuran Kertas</Text>
          <View style={styles.chipRow}>
            {PAPER_SIZES.map((p) => (
              <TouchableOpacity
                key={p.name}
                style={[
                  styles.chip,
                  selectedPaper.name === p.name && styles.chipActive,
                ]}
                onPress={() => setSelectedPaper(p)}
              >
                <Text
                  style={[
                    styles.chipText,
                    selectedPaper.name === p.name && styles.chipTextActive,
                  ]}
                >
                  {p.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.pickerLabel}>Ukuran Label</Text>
          <View style={styles.chipRow}>
            {LABEL_SIZES.map((l) => (
              <TouchableOpacity
                key={l.name}
                style={[
                  styles.chip,
                  selectedLabelSize.name === l.name && styles.chipActive,
                ]}
                onPress={() => setSelectedLabelSize(l)}
              >
                <Text
                  style={[
                    styles.chipText,
                    selectedLabelSize.name === l.name && styles.chipTextActive,
                  ]}
                >
                  {l.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Estimation ── */}
          {layoutConfig && (
            <Card
              style={{
                backgroundColor: colors.surfaceSoft,
                marginTop: 16,
                borderLeftWidth: 3,
                borderLeftColor: colors.brand,
              }}
            >
              <Text style={styles.estimationTitle}>Estimasi Cetak</Text>
              <View style={styles.estimationRow}>
                <Text style={styles.estimationLabel}>Kertas</Text>
                <Text style={styles.estimationValue}>
                  {selectedPaper.label}
                </Text>
              </View>
              <View style={styles.estimationRow}>
                <Text style={styles.estimationLabel}>Label</Text>
                <Text style={styles.estimationValue}>
                  {selectedLabelSize.label}
                </Text>
              </View>
              <View style={styles.estimationRow}>
                <Text style={styles.estimationLabel}>Layout</Text>
                <Text style={styles.estimationValue}>
                  {layoutConfig.columns} kolom × {layoutConfig.rows} baris
                </Text>
              </View>
              <View style={styles.estimationRow}>
                <Text style={styles.estimationLabel}>Per Halaman</Text>
                <Text style={styles.estimationValue}>
                  {layoutConfig.labelsPerPage} label
                </Text>
              </View>
              <View style={[styles.estimationRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.estimationLabel}>Total Halaman</Text>
                <Text style={[styles.estimationValue, { fontWeight: '700', color: colors.brand }]}>
                  {layoutConfig.totalPages} halaman
                </Text>
              </View>
            </Card>
          )}

          {/* ── Actions ── */}
          <View style={{ height: 16 }} />

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Button
                title={batchStore.loading ? 'Menyimpan...' : 'Buat'}
                onPress={handleSave}
                fullWidth
                loading={batchStore.loading}
                disabled={batchStore.loading || printing}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                title={printing ? 'Menyimpan...' : 'Buat & Simpan'}
                onPress={handleSaveAndPrint}
                fullWidth
                variant="primary"
                loading={printing}
                disabled={batchStore.loading || printing}
              />
            </View>
          </View>

          <View style={{ height: 8 }} />
          <Button
            title="← Ubah Jumlah"
            variant="ghost"
            size="sm"
            onPress={() => setStep('quantity')}
          />
        </Card>
      )}
    </ScrollView>
  )
}

// ─── Helper: increment batch code (AA0001 → AA0002) ───
function incrementBatchCode(code: string): string {
  const letters = code.substring(0, 2)
  const numStr = code.substring(2)
  let num = parseInt(numStr, 10)

  if (num < 9999) {
    num++
    return letters + String(num).padStart(4, '0')
  }

  let let1 = letters.charCodeAt(0)
  let let2 = letters.charCodeAt(1)

  if (let2 < 90) {
    let2++
  } else {
    let2 = 65
    if (let1 < 90) {
      let1++
    } else {
      throw new Error('Batch code limit ZZ9999 reached')
    }
  }

  return String.fromCharCode(let1) + String.fromCharCode(let2) + '0001'
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: 16, paddingBottom: 40 },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 16,
  },
  stepLabel: {
    fontSize: 12,
    color: colors.brand,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.ink,
    marginBottom: 8,
  },
  context: {
    fontSize: 13,
    color: colors.muted,
    marginBottom: 4,
  },
  contextBold: { color: colors.body, fontWeight: '600' },
  error: {
    fontSize: 13,
    color: colors.error,
    marginTop: 8,
  },
  empty: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    paddingVertical: 12,
  },
  totalHint: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 12,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceCard,
    gap: 8,
  },
  codeIndex: {
    fontSize: 13,
    color: colors.muted,
    width: 28,
  },
  codeText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
    fontFamily: 'monospace',
    flex: 1,
  },
  codeBadge: {
    backgroundColor: '#FCD34D22',
    borderWidth: 1,
    borderColor: '#FCD34D44',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  codeBadgeText: {
    fontSize: 10,
    color: colors.warning,
    fontWeight: '700',
  },
  // ─── Print settings ───
  pickerLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.body,
    marginTop: 12,
    marginBottom: 6,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: colors.surfaceCard,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  chipActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.body,
  },
  chipTextActive: {
    color: colors.onPrimary,
  },
  estimationTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 8,
  },
  estimationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairlineSoft,
  },
  estimationLabel: {
    fontSize: 12,
    color: colors.muted,
  },
  estimationValue: {
    fontSize: 12,
    color: colors.body,
    fontWeight: '500',
  },
})
