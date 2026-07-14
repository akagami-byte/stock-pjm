import React, { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { useProductStore } from '@/stores/productStore'
import { useBatchStore } from '@/stores/batchStore'
import { useTransactionStore } from '@/stores/transactionStore'
import { colors, typography, radius, spacing, getFinishingLabel } from '@/constants'
import { formatDate, formatCurrency } from '@/utils/formatters'
import type { Product, ProductVariant, ProductType, StockBatchWithDetails } from '@/types'

type DetailTab = 'Produk' | 'Batch' | 'Transaksi'

export default function ProductTypeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const { productTypes, products, variants, fetchProductTypes, fetchProducts, fetchProductsByType, fetchVariantsByProduct, loading: productLoading } = useProductStore()
  const { batches, fetchBatches, loading: batchLoading } = useBatchStore()
  const { invoiceGroups, fetchTransactions, loading: txLoading } = useTransactionStore()

  const [activeTab, setActiveTab] = useState<DetailTab>('Produk')
  const [typeProducts, setTypeProducts] = useState<Product[]>([])
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null)
  const [productVariants, setProductVariants] = useState<Record<string, ProductVariant[]>>({})

  const productType = productTypes.find((pt) => pt.type_id === id)

  useEffect(() => {
    if (id) {
      fetchProductTypes()
      fetchProducts()
      fetchBatches()
      fetchTransactions()

      // Fetch products for this type
      fetchProductsByType(id).then((prods) => {
        setTypeProducts(prods)
      })
    }
  }, [id])

  // When a product is expanded, load its variants
  const toggleProduct = useCallback(async (productId: string) => {
    if (expandedProductId === productId) {
      setExpandedProductId(null)
      return
    }
    setExpandedProductId(productId)
    if (!productVariants[productId]) {
      const vars = await fetchVariantsByProduct(productId)
      setProductVariants((prev) => ({ ...prev, [productId]: vars }))
    }
  }, [expandedProductId, productVariants, fetchVariantsByProduct])

  const handleRefresh = useCallback(() => {
    fetchProductTypes()
    fetchProducts()
    fetchBatches()
    fetchTransactions()
    if (id) {
      fetchProductsByType(id).then(setTypeProducts)
    }
  }, [id])

  if (!productType && !productLoading) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Jenis produk tidak ditemukan</Text>
        <Button title="Kembali" variant="outline" onPress={() => router.back()} />
      </View>
    )
  }

  // Get batches related to this type
  const typeBatches = batches.filter(
    (b) => b.variant?.product?.type_id === id
  )

  const typeTransactions = invoiceGroups.filter((g) =>
    g.items.some((i) => (i.batch?.variant?.product as any)?.type_id === id)
  )

  // ── Tab content renders ──

  const renderProdukTab = () => {
    if (typeProducts.length === 0) {
      return (
        <View style={styles.emptyTab}>
          <Text style={styles.emptyText}>Belum ada produk untuk jenis ini</Text>
        </View>
      )
    }
    return (
      <View style={{ gap: spacing.xs }}>
        {typeProducts.map((product: any) => (
          <View key={product.product_id}>
            <Pressable
              style={({ pressed }) => [styles.productCard, pressed && styles.cardPressed]}
              onPress={() => toggleProduct(product.product_id)}
            >
              <View style={styles.productRow}>
                <View style={styles.productInfo}>
                  <Text style={styles.productName}>{product.product_name}</Text>
                  <Text style={styles.productDetail}>
                    Versi {product.version} · {formatCurrency(product.base_price)}/pcs
                  </Text>
                </View>
                <Text style={styles.expandIcon}>
                  {expandedProductId === product.product_id ? '▼' : '▶'}
                </Text>
              </View>
            </Pressable>

            {/* Variants */}
            {expandedProductId === product.product_id && (
              <View style={styles.variantsContainer}>
                {(productVariants[product.product_id] ?? []).map((v) => (
                  <View key={v.variant_id} style={styles.variantCard}>
                    <View style={styles.variantRow}>
                      <View style={styles.variantInfo}>
                        <Text style={styles.variantSku}>{v.sku_full}</Text>
                        <Text style={styles.variantDetail}>
                          {getFinishingLabel(v.finishing)} · Modifier: {formatCurrency(v.price_modifier)}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.statusDot,
                          { backgroundColor: v.is_active ? colors.success : colors.muted },
                        ]}
                      >
                        <Text style={styles.statusDotText}>
                          {v.is_active ? 'Aktif' : 'Nonaktif'}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
                {(productVariants[product.product_id] ?? []).length === 0 && (
                  <Text style={styles.emptyVariant}>Belum ada varian</Text>
                )}
              </View>
            )}
          </View>
        ))}
      </View>
    )
  }

  const renderBatchTab = () => {
    if (typeBatches.length === 0) {
      return (
        <View style={styles.emptyTab}>
          <Text style={styles.emptyText}>Belum ada batch</Text>
        </View>
      )
    }
    return (
      <FlatList
        data={typeBatches}
        keyExtractor={(b) => b.batch_id}
        scrollEnabled={false}
        ItemSeparatorComponent={() => <View style={{ height: spacing.xs }} />}
        renderItem={({ item }: { item: StockBatchWithDetails }) => (
          <Pressable
            style={({ pressed }) => [styles.batchCard, pressed && styles.cardPressed]}
            onPress={() => router.push({ pathname: '/stock/[id]', params: { id: item.batch_id } })}
          >
            <View style={styles.batchRow}>
              <Text style={styles.batchCode}>{item.batch_code}</Text>
              <Badge status={item.status} size="sm" />
            </View>
            <View style={styles.batchRow}>
              <Text style={styles.batchQty}>
                {item.variant?.sku_full} · Stok: {item.current_qty} / {item.initial_qty} pcs
              </Text>
              <Text style={styles.batchDate}>{formatDate(item.entry_date)}</Text>
            </View>
          </Pressable>
        )}
      />
    )
  }

  const renderTransaksiTab = () => {
    if (typeTransactions.length === 0) {
      return (
        <View style={styles.emptyTab}>
          <Text style={styles.emptyText}>Belum ada transaksi</Text>
        </View>
      )
    }
    return (
      <FlatList
        data={typeTransactions}
        keyExtractor={(g) => g.invoice_number}
        scrollEnabled={false}
        ItemSeparatorComponent={() => <View style={{ height: spacing.xs }} />}
        renderItem={({ item }) => (
          <View style={styles.txCard}>
            <View style={styles.batchRow}>
              <Text style={styles.txInvoice}>{item.invoice_number}</Text>
              <Text style={styles.txTotal}>{formatCurrency(item.total_amount)}</Text>
            </View>
            <View style={styles.batchRow}>
              <Text style={styles.txCompany}>{item.company_name}</Text>
              <Text style={styles.txDate}>{formatDate(item.transaction_date)}</Text>
            </View>
          </View>
        )}
      />
    )
  }

  const tabContent: Record<DetailTab, () => React.ReactNode> = {
    Produk: renderProdukTab,
    Batch: renderBatchTab,
    Transaksi: renderTransaksiTab,
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header back */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Kembali</Text>
        </Pressable>
      </View>

      <FlatList
        data={[]}
        renderItem={() => null}
        ListHeaderComponent={
          <View>
            {/* Type icon placeholder */}
            <View style={styles.imageBox}>
              <Text style={styles.imageIcon}>📦</Text>
            </View>

            {/* Type info */}
            <View style={styles.infoSection}>
              <Text style={styles.typeName}>{productType?.type_name ?? '—'}</Text>
              <View style={styles.codeRow}>
                <Text style={styles.typeCode}>{productType?.type_code ?? '—'}</Text>
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor: productType?.is_active ? colors.success : colors.muted,
                    },
                  ]}
                >
                  <Text style={styles.statusDotText}>
                    {productType?.is_active ? 'Aktif' : 'Nonaktif'}
                  </Text>
                </View>
              </View>
              <Text style={styles.typeDesc}>
                {typeProducts.length} produk terdaftar
              </Text>
            </View>

            {/* Tab bar */}
            <View style={styles.tabBar}>
              {(['Produk', 'Batch', 'Transaksi'] as DetailTab[]).map((tab) => (
                <Pressable
                  key={tab}
                  style={[styles.tab, activeTab === tab && styles.tabActive]}
                  onPress={() => setActiveTab(tab)}
                >
                  <Text
                    style={[
                      styles.tabText,
                      activeTab === tab && styles.tabTextActive,
                    ]}
                  >
                    {tab}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Tab content */}
            <View style={styles.tabContent}>
              {tabContent[activeTab]()}
            </View>
          </View>
        }
        contentContainerStyle={styles.listContent}
        onRefresh={handleRefresh}
        refreshing={productLoading || batchLoading || txLoading}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  listContent: { paddingBottom: spacing.xxl },
  header: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  backBtn: { alignSelf: 'flex-start', marginBottom: spacing.xxs },
  backText: {
    fontSize: typography.size.base,
    color: colors.brand,
    fontWeight: typography.weight.medium,
  },
  imageBox: {
    height: 200,
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    marginHorizontal: spacing.md,
    marginTop: spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageIcon: { fontSize: 48 },
  infoSection: { paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: spacing.xxs },
  typeName: {
    fontSize: typography.size['2xl'],
    fontWeight: typography.weight.bold,
    color: colors.ink,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xxs,
  },
  typeCode: {
    fontSize: typography.size.md,
    fontFamily: typography.font.mono,
    color: colors.muted,
  },
  typeDesc: {
    fontSize: typography.size.base,
    color: colors.body,
    marginTop: spacing.xxs,
  },
  statusDot: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.xs,
    alignSelf: 'flex-start',
  },
  statusDotText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.onPrimary,
  },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    marginTop: spacing.lg,
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.md,
    padding: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.xs,
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  tabActive: { backgroundColor: colors.canvas },
  tabText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.muted,
  },
  tabTextActive: {
    color: colors.ink,
    fontWeight: typography.weight.semibold,
  },
  tabContent: { paddingHorizontal: spacing.md, paddingTop: spacing.md },
  emptyTab: { paddingVertical: spacing.xl, alignItems: 'center' },
  emptyText: { fontSize: typography.size.base, color: colors.muted },
  productCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.md,
  },
  productRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  productInfo: { flex: 1 },
  productName: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.ink,
  },
  productDetail: { fontSize: typography.size.sm, color: colors.muted, marginTop: 2 },
  expandIcon: { fontSize: 12, color: colors.muted },
  variantsContainer: {
    paddingLeft: spacing.md,
    paddingTop: spacing.xxs,
    gap: spacing.xxs,
  },
  variantCard: {
    backgroundColor: colors.canvas,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.sm,
  },
  variantRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  variantInfo: { flex: 1 },
  variantSku: {
    fontSize: typography.size.base,
    fontFamily: typography.font.mono,
    color: colors.ink,
    fontWeight: typography.weight.semibold,
  },
  variantDetail: { fontSize: typography.size.sm, color: colors.muted, marginTop: 2 },
  emptyVariant: {
    fontSize: typography.size.sm,
    color: colors.mutedSoft,
    paddingVertical: spacing.xs,
    textAlign: 'center',
  },
  cardPressed: { opacity: 0.8 },
  batchCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.md,
    gap: spacing.xxs,
  },
  batchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  batchCode: {
    fontSize: typography.size.base,
    fontFamily: typography.font.mono,
    fontWeight: typography.weight.semibold,
    color: colors.ink,
  },
  batchQty: { fontSize: typography.size.sm, color: colors.body },
  batchDate: { fontSize: typography.size.xs, color: colors.mutedSoft },
  txCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.md,
    gap: spacing.xxs,
  },
  txInvoice: {
    fontSize: typography.size.base,
    fontFamily: typography.font.mono,
    fontWeight: typography.weight.semibold,
    color: colors.ink,
  },
  txTotal: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.success,
  },
  txCompany: { fontSize: typography.size.sm, color: colors.body },
  txDate: { fontSize: typography.size.xs, color: colors.mutedSoft },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg, gap: spacing.xs },
  errorText: { fontSize: typography.size.base, color: colors.error, textAlign: 'center' },
})
