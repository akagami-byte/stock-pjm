import { useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Image,
  Pressable,
  Modal,
  TextInput,
  Alert,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { supabase } from '@/lib/supabase'
import { useProductStore } from '@/stores/productStore'
import { formatCurrency } from '@/utils/formatters'
import { colors, radius, spacing, typography, getFinishingLabel } from '@/constants'
import type { Product, ProductVariant } from '@/types'

interface AltPriceRow {
  alt_price_id: string
  variant_id: string
  company_name: string
  proposed_price: number
  min_quantity: number
  reason: string | null
  valid_until: string | null
  variant?: { finishing: string; sku_full: string } | null
}

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const { products, fetchProducts, fetchVariantsByProduct, updateProduct, loading } = useProductStore()

  const [variants, setVariants] = useState<ProductVariant[]>([])
  const [altPrices, setAltPrices] = useState<AltPriceRow[]>([])
  const [altLoading, setAltLoading] = useState(false)
  const [basePriceInput, setBasePriceInput] = useState('')
  const [editBasePriceVisible, setEditBasePriceVisible] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  // Produk dari store (fetchProducts menyertakan join type)
  const product = (products as (Product & { type?: any })[]).find((p) => p.product_id === id)

  // Load varian + harga khusus saat produk tersedia
  useEffect(() => {
    if (!product?.product_id) return
    let cancelled = false

    const loadVariantsAndPrices = async () => {
      const vars = await fetchVariantsByProduct(product.product_id)
      if (cancelled) return
      setVariants(vars)

      if (vars.length === 0) {
        setAltPrices([])
        return
      }

      setAltLoading(true)
      try {
        const { data } = await supabase
          .from('alternative_prices')
          .select(
            'alt_price_id, variant_id, company_name, proposed_price, min_quantity, reason, valid_until, variant:product_variants(finishing, sku_full)'
          )
          .in(
            'variant_id',
            vars.map((v) => v.variant_id)
          )
          .order('company_name', { ascending: true })
        if (cancelled) return
        setAltPrices((data ?? []) as unknown as AltPriceRow[])
      } catch {
        if (!cancelled) setAltPrices([])
      } finally {
        if (!cancelled) setAltLoading(false)
      }
    }

    loadVariantsAndPrices()
    return () => {
      cancelled = true
    }
  }, [product?.product_id, fetchVariantsByProduct])

  if (loading && !product) {
    return (
      <View style={[styles.ctr, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.xl }} />
      </View>
    )
  }

  if (!product) {
    return (
      <View style={[styles.ctr, { paddingTop: insets.top }]}>
        <Text style={{ color: colors.error }}>Produk tidak ditemukan</Text>
        <Button title="← Kembali" variant="ghost" onPress={() => router.back()} />
      </View>
    )
  }

  const productType = product.type
  const productCode = `${productType?.type_code ?? '??'}-${product.version}`
  const productImage = product.image_url || productType?.image_url

  const openEditBasePrice = () => {
    setBasePriceInput(String(product.base_price ?? 0))
    setEditBasePriceVisible(true)
  }

  const handleSaveBasePrice = async () => {
    const num = parseFloat(basePriceInput)
    if (isNaN(num) || num < 0) {
      Alert.alert('Error', 'Harga awal harus angka valid (≥ 0)')
      return
    }
    setSaving(true)
    try {
      await updateProduct(product.product_id, { base_price: num })
      setEditBasePriceVisible(false)
      Alert.alert('Sukses', 'Harga awal berhasil diperbarui')
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Gagal memperbarui harga awal')
    } finally {
      setSaving(false)
    }
  }

  return (
    <View style={[styles.ctr, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={{ padding: 4 }}>
          <Icon name="arrow-left" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          Detail Produk
        </Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* 1. Informasi Utama Produk */}
        {productImage ? (
          <Image source={{ uri: productImage }} style={styles.img} />
        ) : (
          <View style={styles.imgPlaceholder}>
            <Text style={{ fontSize: 48 }}>📦</Text>
          </View>
        )}

        <Card>
          <Text style={styles.productName}>{product.product_name}</Text>
          <View style={styles.codeRow}>
            <Text style={styles.productCode}>{productCode}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.lbl}>Harga Awal</Text>
            <Text style={styles.basePrice}>{formatCurrency(product.base_price ?? 0)}/pcs</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.lbl}>Deskripsi</Text>
            <Text style={styles.desc}>{product.description || '—'}</Text>
          </View>
        </Card>

        {/* 2. Edit Harga Awal */}
        <Button title="✏️ Edit Harga Awal" variant="outline" fullWidth onPress={openEditBasePrice} />

        {/* 3. Varian & Modifier Harga */}
        <Text style={styles.sectionTitle}>Varian & Modifier Harga</Text>
        <Card>
          {variants.length === 0 ? (
            <Text style={styles.emptyText}>Belum ada varian finishing untuk produk ini</Text>
          ) : (
            variants.map((v) => (
              <View key={v.variant_id} style={styles.variantRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.variantSku}>{v.sku_full}</Text>
                  <Text style={styles.variantDetail}>
                    {getFinishingLabel(v.finishing)}
                    {v.is_active ? '' : ' · Nonaktif'}
                  </Text>
                </View>
                <Text style={styles.variantModifier}>+ {formatCurrency(v.price_modifier)}</Text>
              </View>
            ))
          )}
        </Card>

        {/* 4. Harga Modifier & Perusahaan (harga khusus) */}
        <Text style={styles.sectionTitle}>Harga Khusus Perusahaan</Text>
        <Card>
          {altLoading ? (
            <ActivityIndicator color={colors.brand} />
          ) : altPrices.length === 0 ? (
            <Text style={styles.emptyText}>Belum ada harga khusus untuk varian produk ini</Text>
          ) : (
            altPrices.map((ap) => (
              <View key={ap.alt_price_id} style={styles.altRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.altCompany}>{ap.company_name}</Text>
                  <Text style={styles.altDetail}>
                    {ap.variant ? `${getFinishingLabel(ap.variant.finishing as any)} · ${ap.variant.sku_full}` : 'Varian'}{' '}
                    · Min {ap.min_quantity} pcs
                  </Text>
                  {ap.reason ? <Text style={styles.altReason}>📝 {ap.reason}</Text> : null}
                </View>
                <Text style={styles.altPrice}>{formatCurrency(ap.proposed_price)}</Text>
              </View>
            ))
          )}
        </Card>

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Modal Edit Harga Awal */}
      <Modal visible={editBasePriceVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Harga Awal</Text>
            <Text style={styles.modalHint}>{product.product_name} · {productCode}</Text>

            <Text style={styles.fieldLabel}>Harga Awal (Rp)</Text>
            <TextInput
              style={styles.modalInput}
              value={basePriceInput}
              onChangeText={setBasePriceInput}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={colors.mutedSoft}
            />

            <View style={styles.modalActions}>
              <Button title="Batal" variant="ghost" onPress={() => setEditBasePriceVisible(false)} />
              <Button title="Simpan" onPress={handleSaveBasePrice} loading={saving} disabled={saving} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  ctr: { flex: 1, backgroundColor: colors.canvas },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  title: { flex: 1, fontSize: 18, fontWeight: '700', color: colors.ink },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  img: {
    width: '100%',
    height: 200,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceCard,
    resizeMode: 'cover',
  },
  imgPlaceholder: {
    width: '100%',
    height: 160,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceCard,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productName: { fontSize: 20, fontWeight: '800', color: colors.ink },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 2, marginBottom: 8 },
  productCode: {
    fontSize: typography.size.md,
    fontFamily: typography.font.mono,
    color: colors.muted,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.hairlineSoft },
  lbl: { fontSize: 13, color: colors.muted },
  basePrice: { fontSize: 15, fontWeight: '700', color: colors.success, fontFamily: typography.font.mono },
  desc: { fontSize: 13, color: colors.body, fontWeight: '500', flexShrink: 1, textAlign: 'right', maxWidth: '60%' },
  sectionTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.ink,
    marginTop: 4,
  },
  emptyText: { fontSize: typography.size.sm, color: colors.mutedSoft, textAlign: 'center', paddingVertical: 8 },
  variantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairlineSoft,
  },
  variantSku: { fontSize: 14, fontFamily: typography.font.mono, fontWeight: '600', color: colors.ink },
  variantDetail: { fontSize: 12, color: colors.muted, marginTop: 2 },
  variantModifier: { fontSize: 13, fontWeight: '700', color: colors.brand, fontFamily: typography.font.mono },
  altRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairlineSoft,
    gap: spacing.sm,
  },
  altCompany: { fontSize: 14, fontWeight: '600', color: colors.ink },
  altDetail: { fontSize: 12, color: colors.muted, marginTop: 2 },
  altReason: { fontSize: 11, color: colors.mutedSoft, marginTop: 2 },
  altPrice: { fontSize: 13, fontWeight: '700', color: colors.success, fontFamily: typography.font.mono },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: spacing.md },
  modalCard: { width: '100%', backgroundColor: colors.canvas, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.xs },
  modalTitle: { fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.ink, marginBottom: spacing.xs },
  modalHint: { fontSize: 13, color: colors.muted, marginBottom: 8 },
  fieldLabel: { fontSize: typography.size.sm, fontWeight: typography.weight.medium, color: colors.body, marginTop: 4 },
  modalInput: { backgroundColor: colors.surfaceCard, borderWidth: 1, borderColor: colors.hairline, borderRadius: radius.md, padding: spacing.sm, fontSize: typography.size.base, color: colors.ink, marginBottom: spacing.xs },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.sm },
})
