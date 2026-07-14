import { useEffect, useMemo, useState, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  Pressable,
  TextInput,
  ActivityIndicator,
  StyleSheet,
} from 'react-native'
import { useRouter } from 'expo-router'
import Button from '@/components/ui/Button'
import { useTransactionStore } from '@/stores/transactionStore'
import { colors, typography, radius, spacing } from '@/constants'
import { formatDate, formatCurrency, formatNumber } from '@/utils/formatters'
import type { InvoiceGroup } from '@/types'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface CompanySummary {
  companyName: string
  totalTransaksi: number
  totalPembelian: number
  totalRevenue: number
  lastPurchaseDate: string
}

export default function CompanyListScreen() {
  const router = useRouter()
  const { invoiceGroups, loading, error, fetchTransactions } = useTransactionStore()
  const [search, setSearch] = useState('')
  const insets = useSafeAreaInsets()

  useEffect(() => {
    fetchTransactions()
  }, [])

  // Derive company summaries from invoice groups
  const companies = useMemo<CompanySummary[]>(() => {
    const map = new Map<string, InvoiceGroup[]>()

    for (const g of invoiceGroups) {
      const key = g.company_name.toLowerCase().trim()
      if (!key) continue
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(g)
    }

    const result: CompanySummary[] = []

    for (const [, groups] of map) {
      const displayName = groups[0].company_name
      const totalTransaksi = groups.length
      const totalPembelian = groups.reduce((sum, g) => sum + g.total_quantity, 0)
      const totalRevenue = groups.reduce((sum, g) => sum + g.total_amount, 0)
      const lastPurchaseDate = groups.reduce((latest, g) =>
        !latest || g.transaction_date > latest ? g.transaction_date : latest,
        '' as string
      )

      result.push({
        companyName: displayName,
        totalTransaksi,
        totalPembelian,
        totalRevenue,
        lastPurchaseDate,
      })
    }

    return result.sort((a, b) => b.totalRevenue - a.totalRevenue)
  }, [invoiceGroups])

  const filtered = useMemo(() => {
    if (!search.trim()) return companies
    const q = search.toLowerCase()
    return companies.filter((c) => c.companyName.toLowerCase().includes(q))
  }, [companies, search])

  const handleRefresh = useCallback(() => {
    fetchTransactions()
  }, [fetchTransactions])

  const navigateToDetail = (companyName: string) => {
    router.push(`/transaction/company/${encodeURIComponent(companyName)}`)
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Kembali</Text>
        </Pressable>
        <View style={styles.headerRow}>
          <Text style={styles.heading}>Perusahaan</Text>
          <Text style={styles.headerCount}>{companies.length} perusahaan</Text>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="🔍 Cari perusahaan..."
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

      {/* Content */}
      {loading && invoiceGroups.length === 0 ? (
        <ActivityIndicator color={colors.ink} size="large" style={styles.loader} />
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <Button title="Coba Lagi" variant="outline" onPress={handleRefresh} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>
            {search ? 'Tidak ada perusahaan yang cocok' : 'Belum ada data perusahaan'}
          </Text>
          {!search && (
            <Text style={styles.emptyHint}>
              Data perusahaan muncul setelah ada transaksi penjualan
            </Text>
          )}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.companyName}
          renderItem={({ item }: { item: CompanySummary }) => (
            <Pressable
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              onPress={() => navigateToDetail(item.companyName)}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.companyName} numberOfLines={1}>
                  {item.companyName}
                </Text>
                <Text style={styles.detailLink}>Lihat Detail →</Text>
              </View>

              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{formatNumber(item.totalTransaksi)}</Text>
                  <Text style={styles.statLabel}>Transaksi</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{formatNumber(item.totalPembelian)}</Text>
                  <Text style={styles.statLabel}>Pembelian (pcs)</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: colors.success }]}>
                    {formatCurrency(item.totalRevenue)}
                  </Text>
                  <Text style={styles.statLabel}>Revenue</Text>
                </View>
              </View>

              <View style={styles.cardFooter}>
                <Text style={styles.footerLabel}>Pembelian Terakhir</Text>
                <Text style={styles.footerValue}>
                  {item.lastPurchaseDate ? formatDate(item.lastPurchaseDate) : '—'}
                </Text>
              </View>
            </Pressable>
          )}
          contentContainerStyle={styles.listContent}
          onRefresh={handleRefresh}
          refreshing={loading}
          ItemSeparatorComponent={() => <View style={{ height: spacing.xs }} />}
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
  emptyHint: {
    fontSize: typography.size.sm,
    color: colors.mutedSoft,
    textAlign: 'center',
    marginTop: spacing.xxs,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxl,
  },
  card: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardPressed: {
    opacity: 0.85,
    backgroundColor: colors.surfaceStrong,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  companyName: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.ink,
    flex: 1,
  },
  detailLink: {
    fontSize: typography.size.sm,
    color: colors.brand,
    fontWeight: typography.weight.semibold,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  statItem: {
    flex: 1,
  },
  statValue: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.ink,
  },
  statLabel: {
    fontSize: typography.size.xs,
    color: colors.muted,
    textTransform: 'uppercase',
    fontWeight: typography.weight.medium,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.xxs,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  footerLabel: {
    fontSize: typography.size.xs,
    color: colors.muted,
  },
  footerValue: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    color: colors.body,
  },
})
