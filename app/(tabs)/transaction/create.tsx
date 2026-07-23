import { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  Alert,
  Pressable,
  Modal,
  ActivityIndicator,
  StyleSheet,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import StockScanner from '@/components/scanner/StockScanner'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import SearchDropdown from '@/components/ui/SearchDropdown'
import { useTransactionStore } from '@/stores/transactionStore'
import { useCompanyStore } from '@/stores/companyStore'
import { useBatchStore } from '@/stores/batchStore'
import { formatCurrency } from '@/utils/formatters'
import { colors, typography, AUTO_SUGGEST } from '@/constants'
import type { StockBatchWithDetails, SalesTransactionWithDetails } from '@/types'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface CartItem {
  batch: StockBatchWithDetails
  quantity_sold: number
  price_per_unit: number
  alt_price_id?: string
}

export default function CreateTransactionScreen() {
  const router = useRouter()
  const { batchCode, company } = useLocalSearchParams<{ batchCode?: string; company?: string }>()
  const transactionStore = useTransactionStore()
  const companyStore = useCompanyStore()
  const batchStore = useBatchStore()

  // Company
  const [companyName, setCompanyName] = useState(company ?? '')
  const insets = useSafeAreaInsets()
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  // Cart
  const [cart, setCart] = useState<CartItem[]>([])
  const [searchCode, setSearchCode] = useState('')
  const [notes, setNotes] = useState('')

  // Alternative price modal
  const [altPriceModal, setAltPriceModal] = useState(false)
  const [altPriceItem, setAltPriceItem] = useState<number | null>(null)
  const [altPrice, setAltPrice] = useState('')
  const [altReason, setAltReason] = useState('')
  const [altPermanent, setAltPermanent] = useState(true)

  // Scan modal
  const [showScanner, setShowScanner] = useState(false)

  // Handle scan result from inline scanner
  const handleTransactionScan = (code: string) => {
    setShowScanner(false)
    if (!companyName.trim()) {
      Alert.alert('Info', 'Belum pilih perusahaan, pilih terlebih dahulu!')
      return
    }
    loadAndAddBatch(code)
  }

  // If came from stock detail with batchCode, auto-add
  useEffect(() => {
    if (batchCode) { loadAndAddBatch(batchCode) }
  }, [batchCode])

  // Load companies from master data
  useEffect(() => { companyStore.fetchCompanies() }, [])

  // Company auto-suggest — merge master data + transaction history
  const handleCompanyChange = useCallback(
    async (text: string) => {
      setCompanyName(text)
      if (text.length >= AUTO_SUGGEST.MIN_CHARS) {
        const q = text.toLowerCase()
        // Master data companies
        const fromMaster = companyStore.companies
          .filter(c => c.company_name.toLowerCase().includes(q))
          .map(c => c.company_name)
        // Transaction history
        const fromHistory = await transactionStore.fetchCompanyNames(text)
        // Merge & dedupe
        const merged = [...new Set([...fromMaster, ...fromHistory])].slice(0, 10)
        setSuggestions(merged)
        setShowSuggestions(merged.length > 0)
      } else {
        setShowSuggestions(false)
      }
    },
    [transactionStore, companyStore.companies]
  )

  const selectCompany = (name: string) => {
    setCompanyName(name)
    setShowSuggestions(false)
  }

  // Add batch to cart
  async function loadAndAddBatch(code: string) {
    if (!code.trim()) return
    if (!companyName.trim()) {
      Alert.alert('Info', 'Belum pilih perusahaan, pilih terlebih dahulu!')
      return
    }

    // Check if already in cart
    if (cart.some((item) => item.batch.batch_code === code)) {
      Alert.alert('Info', `Batch ${code} sudah ada di daftar. Tambah qty +1.`)
      setCart((prev) =>
        prev.map((item) =>
          item.batch.batch_code === code
            ? { ...item, quantity_sold: Math.min(item.quantity_sold + 1, item.batch.current_qty) }
            : item
        )
      )
      setSearchCode('')
      return
    }

    try {
      const batch = await batchStore.findBatchByCode(code)
      if (!batch) {
        Alert.alert('Error', `Batch "${code}" tidak ditemukan`)
        return
      }

      // Validate status
      if (batch.status === 'DRAFT') {
        Alert.alert('Error', 'Batch belum diaktivasi')
        return
      }
      if (batch.status === 'ACTIVE') {
        Alert.alert('Error', 'Batch belum tersedia untuk dijual. Set Available terlebih dahulu')
        return
      }
      if (batch.status === 'AVAILABLE') {
        const variant = batch.variant
        const productName = variant?.product?.product_name ?? 'Produk'
        const skuFull = variant?.sku_full ?? ''
        const batchCode = batch.batch_code
        const company = companyName.trim()

        Alert.alert(
          'Reserved?',
          `Apakah ingin di reserved oleh ${company}?\n\n${productName}\n${skuFull}-${batchCode}`,
          [
            { text: 'TIDAK', style: 'cancel' },
            {
              text: 'YA',
              onPress: async () => {
                try {
                  await batchStore.updateBatchStatus(batch.batch_id, {
                    new_status: 'RESERVED',
                    company_name: company,
                  })
                  Alert.alert(
                    'Berhasil',
                    `Produk ${productName} dengan batch ${skuFull}-${batchCode} berhasil di RESERVED`,
                    [
                      {
                        text: 'OK',
                        onPress: () => {
                          // Reload batch dengan status baru
                          batchStore.findBatchByCode(code).then((updated) => {
                            if (updated) {
                              const effectivePrice =
                                (updated.variant?.product?.base_price ?? 0) +
                                (updated.variant?.price_modifier ?? 0)
                              setCart((prev) => [
                                ...prev,
                                {
                                  batch: updated,
                                  quantity_sold: 1,
                                  price_per_unit: effectivePrice,
                                },
                              ])
                              setSearchCode('')
                            }
                          })
                        },
                      },
                    ]
                  )
                } catch (err: any) {
                  Alert.alert('Error', err.message ?? 'Gagal reserved batch')
                }
              },
            },
          ]
        )
        return
      }
      if (batch.status === 'OBSOLETE') {
        Alert.alert('Error', 'Batch tidak layak pakai')
        return
      }
      if (batch.status === 'SOLD_OUT' || batch.current_qty <= 0) {
        Alert.alert('Error', 'Stok batch ini habis')
        return
      }

      const variant = batch.variant
      const effectivePrice = (variant?.product?.base_price ?? 0) + (variant?.price_modifier ?? 0)
      setCart((prev) => [
        ...prev,
        {
          batch,
          quantity_sold: 1,
          price_per_unit: effectivePrice,
        },
      ])
      setSearchCode('')
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Gagal menambah produk')
    }
  }

  function updateQty(index: number, delta: number) {
    setCart((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item
        const newQty = Math.max(1, Math.min(item.quantity_sold + delta, item.batch.current_qty))
        return { ...item, quantity_sold: newQty }
      })
    )
  }

  function removeItem(index: number) {
    setCart((prev) => prev.filter((_, i) => i !== index))
  }

  function openAltPriceModal(index: number) {
    const item = cart[index]
    setAltPriceItem(index)
    setAltPrice(String(item.price_per_unit))
    setAltReason('')
    setAltPermanent(true)
    setAltPriceModal(true)
  }

  function saveAltPrice() {
    if (altPriceItem === null) return
    const newPrice = parseFloat(altPrice)
    if (isNaN(newPrice) || newPrice < 0) {
      Alert.alert('Error', 'Harga tidak valid')
      return
    }
    setCart((prev) =>
      prev.map((item, i) =>
        i === altPriceItem ? { ...item, price_per_unit: newPrice } : item
      )
    )
    setAltPriceModal(false)
    setAltPriceItem(null)
  }

  // Totals
  const totalItems = cart.length
  const totalQty = cart.reduce((sum, item) => sum + item.quantity_sold, 0)
  const totalAmount = cart.reduce(
    (sum, item) => sum + item.quantity_sold * item.price_per_unit,
    0
  )

  // Save transaction
  async function handleSave() {
    if (!companyName.trim()) {
      Alert.alert('Error', 'Nama perusahaan WAJIB diisi')
      return
    }
    if (cart.length === 0) {
      Alert.alert('Error', 'Minimal 1 produk harus ditambahkan')
      return
    }

    try {
      const invoiceNumber = await transactionStore.createTransaction({
        company_name: companyName.trim(),
        items: cart.map((item) => ({
          batch_id: item.batch.batch_id,
          quantity_sold: item.quantity_sold,
          price_per_unit: item.price_per_unit,
          alt_price_id: item.alt_price_id,
        })),
        notes: notes || undefined,
      })

      Alert.alert(
        'Transaksi Berhasil',
        `Invoice #${invoiceNumber}\nTotal: ${formatCurrency(totalAmount)}`,
        [
          { text: 'OK', onPress: () => router.back() },
          {
            text: 'Lihat Transaksi',
            onPress: () => router.replace('/transaction'),
          },
        ]
      )
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Gagal menyimpan transaksi')
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]} keyboardShouldPersistTaps="handled">
      <Text style={styles.heading}>Buat Transaksi Baru</Text>

      {/* 1. Company Name */}
      <Card>
        <SearchDropdown
          label="Perusahaan (WAJIB)"
          placeholder="Ketik nama perusahaan (min 2 huruf)..."
          value={companyName}
          onSearch={handleCompanyChange}
          onSelect={(item) => selectCompany(item.label)}
          items={
            companyName.length >= AUTO_SUGGEST.MIN_CHARS
              ? [
                  ...suggestions.slice(0, AUTO_SUGGEST.MAX_RESULTS).map((name) => ({
                    id: name,
                    label: name,
                  })),
                  {
                    id: `__new__${companyName}`,
                    label: `Tambah "${companyName}" sebagai baru`,
                  },
                ]
              : []
          }
          emptyMessage="Ketik untuk mencari perusahaan..."
        />
      </Card>

      {/* 2. Add Products */}
      <Card>
        <Text style={styles.sectionTitle}>Tambah Produk</Text>
        <View style={styles.searchRow}>
          <View style={{ flex: 1 }}>
            <Input
              value={searchCode}
              onChangeText={setSearchCode}
              placeholder="Ketik kode batch atau scan QR..."
              autoCapitalize="characters"
            />
          </View>
          <Button
            title={searchCode.trim() ? '＋' : '🔍'}
            onPress={() => {
              if (!searchCode.trim()) {
                // Scan mode — buka scanner inline
                setShowScanner(true)
                return
              }
              if (!companyName.trim()) {
                Alert.alert('Info', 'Belum pilih perusahaan, pilih terlebih dahulu!')
                return
              }
              loadAndAddBatch(searchCode)
            }}
            size="lg"
          />
        </View>
      </Card>

      {/* 3. Cart Items */}
      {cart.map((item, index) => {
        const subtotal = item.quantity_sold * item.price_per_unit
        const effectivePrice = (item.batch.variant?.product?.base_price ?? 0) + (item.batch.variant?.price_modifier ?? 0)
        const isAltPrice = item.price_per_unit !== effectivePrice

        return (
          <Card key={item.batch.batch_id}>
            <View style={styles.cartHeader}>
              <Text style={styles.cartBatchCode}>{item.batch.batch_code}</Text>
              <Pressable onPress={() => removeItem(index)}>
                <Text style={styles.removeBtn}>🗑️</Text>
              </Pressable>
            </View>

            <Text style={styles.cartProductName}>
              {item.batch.variant?.product?.product_name ?? '—'}
              {item.batch.variant ? ` · ${item.batch.variant.sku_full}` : ''}
            </Text>

            <View style={styles.cartMeta}>
              <Text style={styles.cartMetaText}>
                Stok: {item.batch.current_qty} pcs
              </Text>
              {isAltPrice ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.cartPriceStrikethrough}>
                    {formatCurrency(effectivePrice)}
                  </Text>
                  <Text style={styles.cartPriceAlt}>
                    {formatCurrency(item.price_per_unit)}/pcs
                  </Text>
                </View>
              ) : (
                <Text style={styles.cartMetaText}>
                  Harga: {formatCurrency(item.price_per_unit)}/pcs
                </Text>
              )}
            </View>

            {/* Qty Controls */}
            <View style={styles.qtyRow}>
              <Button
                title="−"
                size="sm"
                variant="secondary"
                onPress={() => updateQty(index, -1)}
                disabled={item.quantity_sold <= 1}
              />
              <Text style={styles.qtyText}>{item.quantity_sold}</Text>
              <Button
                title="＋"
                size="sm"
                variant="secondary"
                onPress={() => updateQty(index, 1)}
                disabled={item.quantity_sold >= item.batch.current_qty}
              />
              <Button
                title="Max"
                size="sm"
                variant="ghost"
                onPress={() =>
                  setCart((prev) =>
                    prev.map((ci, i) =>
                      i === index ? { ...ci, quantity_sold: ci.batch.current_qty } : ci
                    )
                  )
                }
              />
              <Text style={styles.subtotal}>
                Subtotal: {formatCurrency(subtotal)}
              </Text>
            </View>

            {/* Alternative Price Button */}
            <Pressable
              style={styles.altPricePill}
              onPress={() => openAltPriceModal(index)}
            >
              <Text style={styles.altPricePillText}>
                {isAltPrice ? '✨ Harga Alt.' : '💸 Harga Alt.'}
              </Text>
            </Pressable>
          </Card>
        )
      })}

      {cart.length === 0 && (
        <Card>
          <Text style={styles.emptyText}>
            Belum ada produk. Ketik kode batch atau scan QR untuk menambah.
          </Text>
        </Card>
      )}

      {/* Dashed Add Product Button */}
      <Pressable
        style={styles.dashedAddBtn}
        onPress={() => {
          // Focus the search input - scroll to top of search section
        }}
      >
        <Text style={styles.dashedAddIcon}>🔍</Text>
        <Text style={styles.dashedAddText}>Scan / Tambah Produk</Text>
      </Pressable>

      {/* 4. Summary */}
      {cart.length > 0 && (
        <Card style={{ borderColor: colors.brand, borderWidth: 2 }}>
          <Text style={styles.sectionTitle}>Ringkasan</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Item</Text>
            <Text style={styles.summaryValue}>{totalItems} produk</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Qty</Text>
            <Text style={styles.summaryValue}>{totalQty} pcs</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Harga</Text>
            <Text style={styles.summaryTotal}>
              {formatCurrency(totalAmount)}
            </Text>
          </View>
          <Text style={styles.summaryHint}>
            ✅ Stok akan dikurangi otomatis setelah transaksi selesai
          </Text>
        </Card>
      )}

      {/* Notes */}
      <Input
        label="Catatan (Opsional)"
        value={notes}
        onChangeText={setNotes}
        placeholder="Catatan transaksi..."
        multiline
        numberOfLines={3}
      />

      {/* Save */}
      {cart.length > 0 && (
        <Button
          title={transactionStore.loading ? 'Menyimpan...' : `💾 Simpan Transaksi · ${formatCurrency(totalAmount)}`}
          onPress={handleSave}
          loading={transactionStore.loading}
          fullWidth
          size="lg"
          disabled={!companyName.trim()}
        />
      )}

      {/* Alternative Price Modal */}
      <Modal visible={altPriceModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>💸 Harga Alternatif</Text>

            {altPriceItem !== null && cart[altPriceItem] && (
              <View>
                <Text style={styles.modalContext}>
                  {cart[altPriceItem].batch.batch_code} · Base Price: {formatCurrency(cart[altPriceItem].batch.variant?.product?.base_price ?? 0)}
                </Text>
                {cart[altPriceItem].batch.variant && (
                  <View style={{ marginBottom: 12 }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: colors.muted, marginBottom: 4 }}>
                      ⚡ Pilih List Harga Modifier Varian:
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {/* Base price option */}
                      <Pressable
                        style={{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.surfaceCard, borderWidth: 1, borderColor: colors.hairline, borderRadius: 6 }}
                        onPress={() => setAltPrice((cart[altPriceItem].batch.variant?.product?.base_price ?? 0).toString())}
                      >
                        <Text style={{ fontSize: 12, color: colors.ink, fontWeight: '600' }}>
                          Base: {formatCurrency(cart[altPriceItem].batch.variant?.product?.base_price ?? 0)}
                        </Text>
                      </Pressable>

                      {/* Base + Variant Modifier option */}
                      <Pressable
                        style={{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.brand, borderRadius: 6 }}
                        onPress={() => {
                          const base = cart[altPriceItem].batch.variant?.product?.base_price ?? 0
                          const mod = cart[altPriceItem].batch.variant?.price_modifier ?? 0
                          setAltPrice((base + mod).toString())
                        }}
                      >
                        <Text style={{ fontSize: 12, color: '#FFF', fontWeight: '600' }}>
                          +Mod ({formatCurrency(cart[altPriceItem].batch.variant?.price_modifier ?? 0)}): {formatCurrency((cart[altPriceItem].batch.variant?.product?.base_price ?? 0) + (cart[altPriceItem].batch.variant?.price_modifier ?? 0))}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>
            )}

            <Input
              label="Harga Baru (Rp)"
              value={altPrice}
              onChangeText={setAltPrice}
              placeholder="50000"
              keyboardType="numeric"
            />

            <View style={{ height: 12 }} />

            <Input
              label="Alasan (Opsional)"
              value={altReason}
              onChangeText={setAltReason}
              placeholder="Volume besar, pelanggan tetap..."
            />

            <View style={{ height: 12 }} />

            {/* Toggle permanent vs sekali pakai */}
            <View style={styles.toggleRow}>
              <Button
                title="Permanen"
                size="sm"
                variant={altPermanent ? 'primary' : 'outline'}
                onPress={() => setAltPermanent(true)}
              />
              <Button
                title="Sekali Pakai"
                size="sm"
                variant={!altPermanent ? 'primary' : 'outline'}
                onPress={() => setAltPermanent(false)}
              />
            </View>

            <View style={{ height: 16 }} />

            <View style={styles.modalActions}>
              <Button
                title="Batal"
                variant="ghost"
                onPress={() => {
                  setAltPriceModal(false)
                  setAltPriceItem(null)
                }}
              />
              <Button title="Simpan Harga" onPress={saveAltPrice} />
            </View>
          </View>
        </View>
      </Modal>

      {/* Scanner Modal */}
      <Modal visible={showScanner} animationType="slide">
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <StockScanner
            style={{ flex: 1 }}
            onScanSuccess={handleTransactionScan}
            frameThreshold={2}
            lockDuration={1500}
          />
          <View style={{ position: 'absolute', top: 60, left: 20, right: 20 }}>
            <Button
              title="✕ Tutup Scanner"
              variant="secondary"
              size="sm"
              onPress={() => setShowScanner(false)}
            />
          </View>
        </View>
      </Modal>

      <View style={{ height: 60 }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: 16, gap: 12 },
  heading: { fontSize: 22, fontWeight: '700', color: colors.ink, marginBottom: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: colors.ink, marginBottom: 8 },
  companyRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  suggestionBox: {
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 10,
    marginTop: 8,
    overflow: 'hidden',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceCard,
    gap: 8,
  },
  suggestionNew: { borderTopWidth: 1, borderTopColor: colors.hairline },
  suggestionPressed: { backgroundColor: colors.surfaceCard },
  suggestionIcon: { fontSize: 14 },
  suggestionText: { fontSize: 14, color: colors.ink, flex: 1 },
  searchRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  emptyText: { fontSize: 14, color: colors.muted, textAlign: 'center', paddingVertical: 8 },
  cartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cartBatchCode: { fontSize: 16, fontWeight: '700', color: colors.ink, fontFamily: 'monospace' },
  removeBtn: { fontSize: 18 },
  cartProductName: { fontSize: 13, color: colors.muted, marginTop: 2 },
  cartMeta: { flexDirection: 'row', gap: 16, marginTop: 6 },
  cartMetaText: { fontSize: 12, color: colors.muted },
  cartPriceStrikethrough: { fontSize: 12, color: colors.mutedSoft, textDecorationLine: 'line-through' },
  cartPriceAlt: { fontSize: 12, color: colors.success, fontWeight: '600' },
  altPricePill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.brand,
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  altPricePillText: { fontSize: 11, color: colors.onPrimary, fontWeight: '600' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 6, flexWrap: 'wrap' },
  qtyText: { fontSize: 18, fontWeight: '700', color: colors.ink, minWidth: 32, textAlign: 'center' },
  subtotal: { fontSize: 13, fontWeight: '600', color: colors.brand, marginLeft: 'auto' },
  dashedAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: colors.brand,
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  dashedAddIcon: { fontSize: 16, color: colors.brand, fontWeight: '700' },
  dashedAddText: { fontSize: 13, color: colors.brand, fontWeight: '600' },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairlineSoft,
  },
  summaryLabel: { fontSize: 14, color: colors.muted },
  summaryValue: { fontSize: 14, color: colors.body, fontWeight: '500' },
  summaryTotal: { fontSize: 18, fontWeight: '800', color: colors.success },
  summaryHint: { fontSize: 12, color: colors.muted, marginTop: 8 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 },
  modal: {
    backgroundColor: colors.surfaceCard,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.ink, marginBottom: 8, textAlign: 'center' },
  modalContext: { fontSize: 13, color: colors.muted, marginBottom: 16, textAlign: 'center' },
  toggleRow: { flexDirection: 'row', gap: 8 },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
})
