import { useEffect, useMemo, useState } from 'react'
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
import { useLocalSearchParams, useRouter } from 'expo-router'
import Button from '@/components/ui/Button'
import { useTransactionStore } from '@/stores/transactionStore'
import { colors, typography, radius, spacing, TRANSACTION_STATUS_COLORS } from '@/constants'
import { formatDate, formatCurrency, formatNumber } from '@/utils/formatters'
import type { InvoiceGroup, TransactionStatus } from '@/types'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const STATUS_FILTER_OPTIONS: (TransactionStatus | 'ALL')[] = [
  'ALL',
  'COMPLETED',
  'RESERVED',
  'CANCELLED',
  'RETURNED',
]

export default function CompanyDetailScreen() {
  const { name } = useLocalSearchParams<{ name: string }>()
  const router = useRouter()
  const companyName = decodeURIComponent(name ?? '')

  const { invoiceGroups, loading, error, fetchTransactions } = useTransactionStore()

  // Filter state
  const [statusFilter, setStatusFilter] = useState<TransactionStatus | 'ALL'>('ALL')
  const insets = useSafeAreaInsets()
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => {
    if (companyName) {
      fetchTransactions({ company_name: companyName })
    }
  }, [companyName])

  // ── Computed stats ──
  const companyStats = useMemo(() => {
    const filtered = invoiceGroups.filter(
      (g) => g.company_name.toLowerCase() === companyName.toLowerCase()
    )
    if (filtered.length === 0) return null

    const totalTransaksi = filtered.length
    const totalQty = filtered.reduce((sum, g) => sum + g.total_quantity, 0)
    const totalRevenue = filtered.reduce((sum, g) => sum + g.total_amount, 0)
    const avgPerTrans = totalTransaksi > 0 ? totalRevenue / totalTransaksi : 0
    const pelangganSejak = filtered.reduce((earliest, g) => {
      if (!earliest || g.transaction_date < earliest) return g.transaction_date
      return earliest
    }, '' as string)

    // Product favorites
    const productCounts: Record<string, { name: string; count: number }> = {}
    filtered.forEach((g) => {
      g.items.forEach((item) => {
        const pname = item.batch?.variant?.product?.product_name ?? 'Unknown'
        if (!productCounts[pname]) productCounts[pname] = { name: pname, count: 0 }
        productCounts[pname].count += item.quantity_sold
      })
    })
    const sortedProducts = Object.values(productCounts).sort((a, b) => b.count - a.count)
    const produkFavorit = sortedProducts.slice(0, 3)

    // Top month
    const monthCounts: Record<string, { label: string; count: number; revenue: number }> = {}
    filtered.forEach((g) => {
      const d = new Date(g.transaction_date)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
      if (!monthCounts[key]) monthCounts[key] = { label, count: 0, revenue: 0 }
      monthCounts[key].count += g.total_quantity
      monthCounts[key].revenue += g.total_amount
    })
    const months = Object.entries(monthCounts).sort((a, b) => a[0].localeCompare(b[0]))
    const maxCount = Math.max(...months.map(([, m]) => m.count), 1)

    const bulanTerbanyak = months.reduce(
      (top, [, m]) => (m.count > (top?.count ?? 0) ? m : top),
      null as { label: string; count: number; revenue: number } | null
    )

    return {
      totalTransaksi,
      totalQty,
      totalRevenue,
      avgPerTrans,
      pelangganSejak,
      produkFavorit,
      bulanTerbanyak,
      months,
      maxCount,
    }
  }, [invoiceGroups, companyName])

  // ── Filtered transactions for the list ──
  const filteredTransactions = useMemo(() => {
    let filtered = invoiceGroups.filter(
      (g) => g.company_name.toLowerCase() === companyName.toLowerCase()
    )

    if (statusFilter !== 'ALL') {
      filtered = filtered.filter((g) => g.status === statusFilter)
    }
    if (dateFrom) {
      filtered = filtered.filter((g) => g.transaction_date >= dateFrom)
    }
    if (dateTo) {
      filtered = filtered.filter((g) => g.transaction_date <= dateTo + 'T23:59:59')
    }

    return filtered
  }, [invoiceGroups, companyName, statusFilter, dateFrom, dateTo])

  // ── Export stubs ──
  const handleExportPDF = () => {
    Alert.alert('Ekspor PDF', 'Fitur ekspor PDF akan segera tersedia.')
  }

  const handleExportExcel = () => {
    Alert.alert('Ekspor Excel', 'Fitur ekspor Excel akan segera tersedia.')
  }

  if (!companyName) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Perusahaan tidak ditemukan</Text>
        <Button title="Kembali" variant="outline" onPress={() => router.back()} />
      </View>
    )
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <FlatList
        data={filteredTransactions}
        keyExtractor={(g) => g.invoice_number}
        renderItem={({ item }: { item: InvoiceGroup }) => {
          const statusColor = TRANSACTION_STATUS_COLORS[item.status] ?? {
            background: colors.muted,
            text: colors.onPrimary,
            label: item.status,
          }
          return (
            <View style={styles.txCard}>
              <View style={styles.txHeader}>
                <Text style={styles.txInvoice}>{item.invoice_number}</Text>
                <View
                  style={[
                    styles.txStatus,
                    {
                      backgroundColor: statusColor.background + '22',
                      borderColor: statusColor.background + '44',
                    },
                  ]}
                >
                  <Text style={[styles.txStatusText, { color: statusColor.background }]}>
                    {statusColor.label ?? item.status}
                  </Text>
                </View>
              </View>
              <View style={styles.txRow}>
                <Text style={styles.txLabel}>Qty</Text>
                <Text style={styles.txValue}>{item.total_quantity} pcs</Text>
              </View>
              <View style={styles.txRow}>
                <Text style={styles.txLabel}>Total</Text>
                <Text style={styles.txTotal}>{formatCurrency(item.total_amount)}</Text>
              </View>
              <View style={styles.txRow}>
                <Text style={styles.txLabel}>Tanggal</Text>
                <Text style={styles.txValue}>{formatDate(item.transaction_date)}</Text>
              </View>
            </View>
          )
        }}
        ItemSeparatorComponent={() => <View style={{ height: spacing.xs }} />}
        ListHeaderComponent={
          <View>
            {/* Header */}
            <View style={styles.header}>
              <Pressable onPress={() => router.back()} style={styles.backBtn}>
                <Text style={styles.backText}>← Kembali</Text>
              </Pressable>
              <Text style={styles.heading}>{companyName}</Text>
              <Text style={styles.subheading}>Detail transaksi & statistik</Text>
            </View>

            {loading && invoiceGroups.length === 0 ? (
              <ActivityIndicator color={colors.ink} size="large" style={styles.loader} />
            ) : error ? (
              <View style={styles.center}>
                <Text style={styles.errorText}>{error}</Text>
                <Button
                  title="Coba Lagi"
                  variant="outline"
                  onPress={() => fetchTransactions({ company_name: companyName })}
                />
              </View>
            ) : !companyStats || companyStats.totalTransaksi === 0 ? (
              <View style={styles.center}>
                <Text style={styles.emptyText}>Belum ada transaksi</Text>
              </View>
            ) : (
              <View>
                {/* Stats cards */}
                <View style={styles.statsGrid}>
                  <View style={styles.statCard}>
                    <Text style={styles.statValue}>
                      {formatNumber(companyStats.totalTransaksi)}
                    </Text>
                    <Text style={styles.statLabel}>Total Transaksi</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statValue}>
                      {formatNumber(companyStats.totalQty)}
                    </Text>
                    <Text style={styles.statLabel}>Total Pembelian</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statValue}>
                      {formatCurrency(companyStats.totalRevenue)}
                    </Text>
                    <Text style={styles.statLabel}>Total Revenue</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statValue}>
                      {formatCurrency(companyStats.avgPerTrans)}
                    </Text>
                    <Text style={styles.statLabel}>Rata-rata/Trans</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statValue}>
                      {companyStats.pelangganSejak
                        ? formatDate(companyStats.pelangganSejak)
                        : '—'}
                    </Text>
                    <Text style={styles.statLabel}>Pelanggan Sejak</Text>
                  </View>
                </View>

                {/* Statistik Section */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Statistik</Text>

                  {/* Produk Favorit */}
                  {companyStats.produkFavorit.length > 0 && (
                    <View style={styles.statSection}>
                      <Text style={styles.statSectionLabel}>Produk Favorit</Text>
                      {companyStats.produkFavorit.map((p, i) => (
                        <View key={p.name} style={styles.statRow}>
                          <Text style={styles.statRowLabel} numberOfLines={1}>
                            {i + 1}. {p.name}
                          </Text>
                          <Text style={styles.statRowValue}>{p.count} pcs</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Bulan Terbanyak */}
                  {companyStats.bulanTerbanyak && (
                    <View style={styles.statSection}>
                      <Text style={styles.statSectionLabel}>Bulan Terbanyak</Text>
                      <Text style={styles.statDetail}>
                        {companyStats.bulanTerbanyak.label} ·{' '}
                        {companyStats.bulanTerbanyak.count} pcs ·{' '}
                        {formatCurrency(companyStats.bulanTerbanyak.revenue)}
                      </Text>
                    </View>
                  )}

                  {/* Rata-rata & Harga Rata-rata */}
                  <View style={styles.statRow}>
                    <Text style={styles.statSectionLabel}>Rata-rata Pembelian</Text>
                    <Text style={styles.statRowValue}>
                      {formatNumber(
                        Math.round(
                          companyStats.totalQty / companyStats.totalTransaksi
                        )
                      )}{' '}
                      pcs/trans
                    </Text>
                  </View>
                  <View style={styles.statRow}>
                    <Text style={styles.statSectionLabel}>Harga Rata-rata</Text>
                    <Text style={styles.statRowValue}>
                      {formatCurrency(
                        Math.round(
                          companyStats.totalRevenue / (companyStats.totalQty || 1)
                        )
                      )}{' '}
                      /pcs
                    </Text>
                  </View>

                  {/* Trend per bulan bar chart */}
                  <Text style={styles.statSectionLabel}>Trend Pembelian per Bulan</Text>
                  <View style={styles.chartContainer}>
                    {companyStats.months.map(([key, m]) => {
                      const barHeight = Math.max(4, (m.count / companyStats.maxCount) * 100)
                      return (
                        <View key={key} style={styles.barCol}>
                          <Text style={styles.barValue}>{m.count}</Text>
                          <View style={styles.barTrack}>
                            <View
                              style={[
                                styles.barFill,
                                { height: `${barHeight}%` },
                              ]}
                            />
                          </View>
                          <Text style={styles.barLabel} numberOfLines={1}>
                            {key.slice(5)}
                          </Text>
                        </View>
                      )
                    })}
                  </View>
                </View>

                {/* Filter Bar untuk Riwayat Transaksi */}
                <View style={styles.filterSection}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Riwayat Transaksi</Text>
                    <Text style={styles.sectionCount}>
                      {filteredTransactions.length} transaksi
                    </Text>
                  </View>

                  {/* Status filter chips */}
                  <View style={styles.filterChips}>
                    {STATUS_FILTER_OPTIONS.map((status) => {
                      const isActive = statusFilter === status
                      const statusColor =
                        status === 'ALL'
                          ? null
                          : TRANSACTION_STATUS_COLORS[status]
                      return (
                        <Pressable
                          key={status}
                          style={[
                            styles.filterChip,
                            isActive && {
                              backgroundColor:
                                (statusColor?.background ?? colors.ink) + '22',
                              borderColor:
                                statusColor?.background ?? colors.ink,
                            },
                          ]}
                          onPress={() => setStatusFilter(status)}
                        >
                          <Text
                            style={[
                              styles.filterChipText,
                              isActive && {
                                color:
                                  statusColor?.background ?? colors.ink,
                                fontWeight: typography.weight.bold,
                              },
                            ]}
                          >
                            {status === 'ALL' ? 'Semua' : statusColor?.label ?? status}
                          </Text>
                        </Pressable>
                      )
                    })}
                  </View>

                  {/* Date filter */}
                  <View style={styles.dateFilterRow}>
                    <View style={styles.dateInputWrap}>
                      <Text style={styles.dateLabel}>Dari</Text>
                      <TextInput
                        style={styles.dateInput}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor={colors.mutedSoft}
                        value={dateFrom}
                        onChangeText={setDateFrom}
                      />
                    </View>
                    <View style={styles.dateInputWrap}>
                      <Text style={styles.dateLabel}>Sampai</Text>
                      <TextInput
                        style={styles.dateInput}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor={colors.mutedSoft}
                        value={dateTo}
                        onChangeText={setDateTo}
                      />
                    </View>
                    {(dateFrom || dateTo || statusFilter !== 'ALL') && (
                      <Pressable
                        style={styles.clearFilterBtn}
                        onPress={() => {
                          setStatusFilter('ALL')
                          setDateFrom('')
                          setDateTo('')
                        }}
                      >
                        <Text style={styles.clearFilterText}>Reset</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              </View>
            )}
          </View>
        }
        ListFooterComponent={
          companyStats && companyStats.totalTransaksi > 0 ? (
            <View style={styles.exportSection}>
              <Text style={styles.exportLabel}>Ekspor Data</Text>
              <View style={styles.exportButtons}>
                <Button
                  title="📄 Ekspor PDF"
                  variant="outline"
                  size="sm"
                  onPress={handleExportPDF}
                />
                <Button
                  title="📊 Ekspor Excel"
                  variant="outline"
                  size="sm"
                  onPress={handleExportExcel}
                />
              </View>
            </View>
          ) : null
        }
        contentContainerStyle={styles.listContent}
        onRefresh={() => fetchTransactions({ company_name: companyName })}
        refreshing={loading}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  listContent: { paddingBottom: spacing.xxl },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    marginBottom: spacing.md,
  },
  backBtn: { alignSelf: 'flex-start', marginBottom: spacing.xs },
  backText: {
    fontSize: typography.size.base,
    color: colors.brand,
    fontWeight: typography.weight.medium,
  },
  heading: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.ink,
  },
  subheading: {
    fontSize: typography.size.sm,
    color: colors.muted,
    marginTop: spacing.xxs,
  },
  loader: { marginTop: spacing.xxl },
  center: {
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.xs,
  },
  errorText: {
    fontSize: typography.size.base,
    color: colors.error,
    textAlign: 'center',
  },
  emptyText: { fontSize: typography.size.md, color: colors.muted },
  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.md,
    gap: spacing.xxs,
  },
  statValue: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.ink,
  },
  statLabel: {
    fontSize: typography.size.xs,
    color: colors.muted,
    textTransform: 'uppercase',
    fontWeight: typography.weight.medium,
  },
  // Section
  section: { paddingHorizontal: spacing.md, marginTop: spacing.lg, gap: spacing.md },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  sectionTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.ink,
  },
  sectionCount: { fontSize: typography.size.sm, color: colors.muted },
  statSection: { gap: spacing.xxs, marginBottom: spacing.sm },
  statSectionLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.muted,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xxs,
  },
  statRowLabel: {
    fontSize: typography.size.base,
    color: colors.body,
    flex: 1,
  },
  statRowValue: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    color: colors.ink,
  },
  statDetail: {
    fontSize: typography.size.base,
    color: colors.body,
  },
  // Bar chart
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    height: 140,
    paddingTop: spacing.md,
    gap: spacing.xxs,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  barValue: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.muted,
  },
  barTrack: {
    flex: 1,
    width: '100%',
    backgroundColor: colors.surfaceStrong,
    borderRadius: 4,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    backgroundColor: colors.brand,
    borderRadius: 4,
    minHeight: 4,
  },
  barLabel: {
    fontSize: typography.size.xs,
    color: colors.mutedSoft,
    width: '100%',
    textAlign: 'center',
  },
  // Filter section
  filterSection: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  filterChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xxs,
  },
  filterChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surfaceCard,
  },
  filterChipText: {
    fontSize: typography.size.xs,
    color: colors.muted,
    fontWeight: typography.weight.medium,
  },
  dateFilterRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'flex-end',
  },
  dateInputWrap: {
    flex: 1,
    gap: 2,
  },
  dateLabel: {
    fontSize: typography.size.xs,
    color: colors.muted,
    fontWeight: typography.weight.medium,
  },
  dateInput: {
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    fontSize: typography.size.sm,
    color: colors.ink,
  },
  clearFilterBtn: {
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.xs,
  },
  clearFilterText: {
    fontSize: typography.size.sm,
    color: colors.brand,
    fontWeight: typography.weight.medium,
  },
  // Transaction cards
  txCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.md,
    gap: spacing.xxs,
    marginHorizontal: spacing.md,
  },
  txHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xxs,
  },
  txInvoice: {
    fontSize: typography.size.base,
    fontFamily: typography.font.mono,
    fontWeight: typography.weight.semibold,
    color: colors.ink,
  },
  txStatus: {
    borderRadius: radius.xs,
    borderWidth: 1,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  txStatusText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
  },
  txRow: { flexDirection: 'row', justifyContent: 'space-between' },
  txLabel: { fontSize: typography.size.sm, color: colors.muted },
  txValue: {
    fontSize: typography.size.sm,
    color: colors.body,
    fontWeight: typography.weight.medium,
  },
  txTotal: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.success,
  },
  // Export section
  exportSection: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.xs,
    alignItems: 'center',
  },
  exportLabel: {
    fontSize: typography.size.sm,
    color: colors.muted,
    fontWeight: typography.weight.medium,
  },
  exportButtons: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
})
