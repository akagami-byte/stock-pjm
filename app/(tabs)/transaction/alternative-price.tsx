import { useEffect, useMemo, useState, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native'
import { useRouter } from 'expo-router'
import Button from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'
import { useTransactionStore } from '@/stores/transactionStore'
import { colors, typography, radius, spacing } from '@/constants'
import { formatDate, formatCurrency, formatNumber } from '@/utils/formatters'
import type { AlternativePrice, ProductVariant, Product } from '@/types'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface AltPriceWithDetails extends AlternativePrice {
  variant?: (ProductVariant & { product?: Product }) | null
}

interface GroupedByCompany {
  companyName: string
  items: AltPriceWithDetails[]
}

export default function AlternativePriceScreen() {
  const router = useRouter()
  const { fetchTransactions } = useTransactionStore()

  const [altPrices, setAltPrices] = useState<AltPriceWithDetails[]>([])
  const insets = useSafeAreaInsets()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [companyFilter, setCompanyFilter] = useState('')
  const [productFilter, setProductFilter] = useState('')

  // Fetch alternative prices with variant and product joins
  const fetchAltPrices = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('alternative_prices')
        .select(
          'alt_price_id, variant_id, company_name, proposed_price, min_quantity, reason, requested_by, requested_at, valid_until, variant:product_variants(variant_id, finishing, sku_full, price_modifier, is_active, product:products(product_id, product_name, version, base_price, type:product_types(type_id, type_code, type_name)))'
        )
        .order('company_name', { ascending: true })

      if (err) throw err

      const prices = (data ?? []).map((row: any) => ({
        alt_price_id: row.alt_price_id,
        variant_id: row.variant_id,
        company_name: row.company_name,
        proposed_price: row.proposed_price ?? 0,
        min_quantity: row.min_quantity ?? 1,
        reason: row.reason ?? null,
        requested_by: row.requested_by ?? null,
        requested_at: row.requested_at ?? '',
        valid_until: row.valid_until ?? null,
        variant: row.variant
          ? {
              variant_id: row.variant.variant_id,
              finishing: row.variant.finishing,
              sku_full: row.variant.sku_full,
              price_modifier: row.variant.price_modifier ?? 0,
              is_active: row.variant.is_active,
              product: row.variant.product || null,
            }
          : null,
      })) as AltPriceWithDetails[]

      setAltPrices(prices)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat data alternative price')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAltPrices()
  }, [fetchAltPrices])

  // Unique company names for dropdown
  const companyNames = useMemo(() => {
    const names = [...new Set(altPrices.map((p) => p.company_name))]
    return names.sort()
  }, [altPrices])

  // Unique product names for dropdown
  const productNames = useMemo(() => {
    const names = [...new Set(
      altPrices
        .map((p) => p.variant?.product?.product_name)
        .filter(Boolean) as string[]
    )]
    return names.sort()
  }, [altPrices])

  // Filter and group
  const grouped = useMemo<GroupedByCompany[]>(() => {
    let filtered = altPrices

    // Search by company or product
    if (search.trim()) {
      const q = search.toLowerCase()
      filtered = filtered.filter(
        (p) =>
          p.company_name.toLowerCase().includes(q) ||
          p.variant?.product?.product_name?.toLowerCase().includes(q) ||
          p.variant?.sku_full?.toLowerCase().includes(q)
      )
    }

    if (companyFilter) {
      filtered = filtered.filter((p) =>
        p.company_name.toLowerCase().includes(companyFilter.toLowerCase())
      )
    }

    if (productFilter) {
      filtered = filtered.filter(
        (p) =>
          p.variant?.product?.product_name
            ?.toLowerCase()
            .includes(productFilter.toLowerCase())
      )
    }

    // Group by company
    const map = new Map<string, AltPriceWithDetails[]>()
    for (const item of filtered) {
      const key = item.company_name.toLowerCase().trim()
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(item)
    }

    return Array.from(map.entries()).map(([, items]) => ({
      companyName: items[0].company_name,
      items,
    }))
  }, [altPrices, search, companyFilter, productFilter])

  // Summary
  const summary = useMemo(() => {
    const companies = [...new Set(altPrices.map((p) => p.company_name))]
    const companyCounts: Record<string, number> = {}
    altPrices.forEach((p) => {
      companyCounts[p.company_name] = (companyCounts[p.company_name] || 0) + 1
    })

    const mostCommon =
      Object.entries(companyCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'

    return {
      total: altPrices.length,
      totalCompanies: companies.length,
      mostCommonCompany: mostCommon,
    }
  }, [altPrices])

  // Action handlers
  const handleEdit = (item: AltPriceWithDetails) => {
    Alert.alert(
      'Edit Harga Alternatif',
      `Edit harga untuk ${item.variant?.product?.product_name ?? item.variant?.sku_full ?? '—'} - ${item.company_name}`,
      [{ text: 'OK' }]
    )
  }

  const handleDelete = (item: AltPriceWithDetails) => {
    Alert.alert(
      'Hapus Harga Alternatif',
      `Hapus harga alternatif untuk ${item.company_name}?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error: err } = await supabase
                .from('alternative_prices')
                .delete()
                .eq('alt_price_id', item.alt_price_id)

              if (err) throw err
              setAltPrices((prev) =>
                prev.filter((p) => p.alt_price_id !== item.alt_price_id)
              )
              Alert.alert('Berhasil', 'Harga alternatif dihapus')
            } catch (e: any) {
              Alert.alert('Error', e.message)
            }
          },
        },
      ]
    )
  }

  const handleLihatTransaksi = (item: AltPriceWithDetails) => {
    router.push({
      pathname: '/transaction',
      params: {},
    })
    // In a full implementation, we'd filter by company
    fetchTransactions({ company_name: item.company_name })
  }

  const isExpired = (validUntil: string | null): boolean => {
    if (!validUntil) return false
    return new Date(validUntil) < new Date()
  }

  const isActive = (item: AltPriceWithDetails): boolean => {
    return !isExpired(item.valid_until) && (item.variant?.is_active ?? true)
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Kembali</Text>
        </Pressable>
        <View style={styles.headerRow}>
          <Text style={styles.heading}>Harga Alternatif</Text>
          <Text style={styles.headerCount}>
            {summary.total} harga · {summary.totalCompanies} perusahaan
          </Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="🔍 Cari perusahaan atau produk..."
          placeholderTextColor={colors.mutedSoft}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')} style={styles.clearBtn}>
            <Text style={styles.clearText}>✕</Text>
          </Pressable>
        )}
      </View>

      {/* Company & Product filter dropdowns */}
      <View style={styles.dropdownRow}>
        <View style={styles.dropdownWrap}>
          <TextInput
            style={styles.dropdownInput}
            placeholder="Filter perusahaan..."
            placeholderTextColor={colors.mutedSoft}
            value={companyFilter}
            onChangeText={setCompanyFilter}
          />
        </View>
        <View style={styles.dropdownWrap}>
          <TextInput
            style={styles.dropdownInput}
            placeholder="Filter produk..."
            placeholderTextColor={colors.mutedSoft}
            value={productFilter}
            onChangeText={setProductFilter}
          />
        </View>
      </View>

      {/* Summary cards */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{formatNumber(summary.total)}</Text>
          <Text style={styles.summaryLabel}>Total Harga Alt</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{formatNumber(summary.totalCompanies)}</Text>
          <Text style={styles.summaryLabel}>Perusahaan</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text
            style={[styles.summaryValue, { fontSize: typography.size.base }]}
            numberOfLines={1}
          >
            {summary.mostCommonCompany}
          </Text>
          <Text style={styles.summaryLabel}>Paling Banyak</Text>
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <ActivityIndicator color={colors.ink} size="large" style={styles.loader} />
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <Button title="Coba Lagi" variant="outline" onPress={fetchAltPrices} />
        </View>
      ) : grouped.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>
            {search || companyFilter || productFilter
              ? 'Tidak ada hasil yang cocok'
              : 'Belum ada harga alternatif'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={grouped}
          keyExtractor={(g) => g.companyName}
          renderItem={({ item: group }: { item: GroupedByCompany }) => (
            <View style={styles.companyGroup}>
              {/* Company header */}
              <View style={styles.companyHeader}>
                <Text style={styles.companyName}>{group.companyName}</Text>
                <Text style={styles.companyItemCount}>
                  {group.items.length} produk
                </Text>
              </View>

              {/* Product cards */}
              {group.items.map((item) => {
                const active = isActive(item)
                const expired = isExpired(item.valid_until)
                const productName =
                  item.variant?.product?.product_name ?? '—'
                const skuFull = item.variant?.sku_full ?? '—'

                return (
                  <View key={item.alt_price_id} style={styles.priceCard}>
                    <View style={styles.priceCardHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.productName} numberOfLines={1}>
                          {productName}
                        </Text>
                        <Text style={styles.skuText}>{skuFull}</Text>
                      </View>
                      <View
                        style={[
                          styles.activeBadge,
                          active
                            ? {
                                backgroundColor: colors.success + '22',
                                borderColor: colors.success + '44',
                              }
                            : {
                                backgroundColor: colors.error + '22',
                                borderColor: colors.error + '44',
                              },
                        ]}
                      >
                        <Text
                          style={[
                            styles.activeText,
                            { color: active ? colors.success : colors.error },
                          ]}
                        >
                          {expired ? 'Kadaluarsa' : active ? 'Aktif' : 'Tidak Aktif'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.priceInfo}>
                      <View style={styles.priceField}>
                        <Text style={styles.fieldLabel}>Harga</Text>
                        <Text style={styles.fieldValue}>
                          {formatCurrency(item.proposed_price)}
                        </Text>
                      </View>
                      <View style={styles.priceField}>
                        <Text style={styles.fieldLabel}>Min Qty</Text>
                        <Text style={styles.fieldValue}>
                          {formatNumber(item.min_quantity)} pcs
                        </Text>
                      </View>
                      <View style={styles.priceField}>
                        <Text style={styles.fieldLabel}>Berlaku Sampai</Text>
                        <Text
                          style={[
                            styles.fieldValue,
                            expired && { color: colors.error },
                          ]}
                        >
                          {item.valid_until
                            ? formatDate(item.valid_until)
                            : 'Selamanya'}
                        </Text>
                      </View>
                    </View>

                    {item.reason && (
                      <View style={styles.reasonRow}>
                        <Text style={styles.reasonLabel}>Alasan:</Text>
                        <Text style={styles.reasonText}>{item.reason}</Text>
                      </View>
                    )}

                    {item.variant && (
                      <View style={styles.priceComparison}>
                        <Text style={styles.comparisonText}>
                          Harga normal: {formatCurrency((item.variant.product?.base_price ?? 0) + (item.variant.price_modifier ?? 0))}{' '}
                          {((item.variant.product?.base_price ?? 0) + (item.variant.price_modifier ?? 0)) > item.proposed_price
                            ? `(diskon ${formatCurrency(((item.variant.product?.base_price ?? 0) + (item.variant.price_modifier ?? 0)) - item.proposed_price)})`
                            : ((item.variant.product?.base_price ?? 0) + (item.variant.price_modifier ?? 0)) < item.proposed_price
                            ? `(lebih mahal ${formatCurrency(item.proposed_price - ((item.variant.product?.base_price ?? 0) + (item.variant.price_modifier ?? 0)))})`
                            : '(sama)'}
                        </Text>
                      </View>
                    )}

                    {/* Action buttons */}
                    <View style={styles.actionRow}>
                      <Button
                        title="Edit"
                        variant="ghost"
                        size="sm"
                        onPress={() => handleEdit(item)}
                      />
                      <Button
                        title="Hapus"
                        variant="danger"
                        size="sm"
                        onPress={() => handleDelete(item)}
                      />
                      <Button
                        title="Lihat Transaksi"
                        variant="ghost"
                        size="sm"
                        onPress={() => handleLihatTransaksi(item)}
                      />
                    </View>
                  </View>
                )
              })}
            </View>
          )}
          contentContainerStyle={styles.listContent}
          onRefresh={fetchAltPrices}
          refreshing={loading}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  backBtn: {
    alignSelf: 'flex-start',
    marginBottom: spacing.xxs,
  },
  backText: {
    fontSize: typography.size.base,
    color: colors.brand,
    fontWeight: typography.weight.medium,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  heading: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.ink,
  },
  headerCount: {
    fontSize: typography.size.sm,
    color: colors.muted,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.sm,
    fontSize: typography.size.base,
    color: colors.ink,
  },
  clearBtn: {
    padding: spacing.xxs,
  },
  clearText: {
    fontSize: typography.size.md,
    color: colors.muted,
  },
  dropdownRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  dropdownWrap: {
    flex: 1,
  },
  dropdownInput: {
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontSize: typography.size.sm,
    color: colors.ink,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.sm,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.ink,
  },
  summaryLabel: {
    fontSize: typography.size.xs,
    color: colors.muted,
    textTransform: 'uppercase',
    fontWeight: typography.weight.medium,
    marginTop: 2,
  },
  loader: {
    marginTop: spacing.xxl,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.xs,
  },
  errorText: {
    fontSize: typography.size.base,
    color: colors.error,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: typography.size.md,
    color: colors.muted,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxl,
  },
  companyGroup: {
    gap: spacing.xs,
  },
  companyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xxs,
  },
  companyName: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.ink,
  },
  companyItemCount: {
    fontSize: typography.size.xs,
    color: colors.muted,
  },
  priceCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.md,
    gap: spacing.sm,
  },
  priceCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  productName: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    color: colors.ink,
  },
  skuText: {
    fontSize: typography.size.xs,
    fontFamily: typography.font.mono,
    color: colors.muted,
    marginTop: 1,
  },
  activeBadge: {
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  activeText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
  },
  priceInfo: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  priceField: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: typography.size.xs,
    color: colors.muted,
    textTransform: 'uppercase',
    fontWeight: typography.weight.medium,
    marginBottom: 2,
  },
  fieldValue: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    color: colors.ink,
  },
  reasonRow: {
    flexDirection: 'row',
    gap: spacing.xxs,
    paddingTop: spacing.xxs,
    borderTopWidth: 1,
    borderTopColor: colors.hairlineSoft,
  },
  reasonLabel: {
    fontSize: typography.size.xs,
    color: colors.muted,
    fontWeight: typography.weight.medium,
  },
  reasonText: {
    fontSize: typography.size.xs,
    color: colors.body,
    flex: 1,
  },
  priceComparison: {
    backgroundColor: colors.surfaceStrong,
    borderRadius: radius.sm,
    padding: spacing.xs,
  },
  comparisonText: {
    fontSize: typography.size.xs,
    color: colors.muted,
    fontWeight: typography.weight.medium,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.xxs,
    paddingTop: spacing.xxs,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
})
