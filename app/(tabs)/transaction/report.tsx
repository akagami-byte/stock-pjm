import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View, Text, ScrollView, Dimensions, ActivityIndicator, StyleSheet,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LineChart, BarChart } from 'react-native-chart-kit'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { useTransactionStore } from '@/stores/transactionStore'
import { formatCurrency } from '@/utils/formatters'
import { colors, typography, radius } from '@/constants'
import type { SalesTransactionWithDetails } from '@/types'

const screenW = Dimensions.get('window').width - 40

export default function ReportScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { transactions, loading, fetchTransactions } = useTransactionStore()

  useEffect(() => { fetchTransactions() }, [])

  // ─── Computed data ───
  const salesData = useMemo(() => {
    const completed = transactions.filter((t) => t.status === 'COMPLETED')
    const monthlyMap: Record<string, { revenue: number; qty: number }> = {}

    completed.forEach((t) => {
      const m = new Date(t.transaction_date).toLocaleString('id-ID', { month: 'short' })
      if (!monthlyMap[m]) monthlyMap[m] = { revenue: 0, qty: 0 }
      monthlyMap[m].revenue += t.total_amount ?? 0
      monthlyMap[m].qty += t.quantity_sold
    })

    return Object.entries(monthlyMap)
      .map(([month, v]) => ({ month, revenue: v.revenue, qty: v.qty }))
  }, [transactions])

  const topProducts = useMemo(() => {
    const completed = transactions.filter((t) => t.status === 'COMPLETED')
    const map: Record<string, { name: string; revenue: number }> = {}
    completed.forEach((t) => {
      const code = t.batch?.variant?.product?.product_name ?? '—'
      if (!map[code]) map[code] = { name: code, revenue: 0 }
      map[code].revenue += t.total_amount ?? 0
    })
    return Object.values(map)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
  }, [transactions])

  const topCompanies = useMemo(() => {
    const completed = transactions.filter((t) => t.status === 'COMPLETED')
    const map: Record<string, { name: string; revenue: number }> = {}
    completed.forEach((t) => {
      const name = t.company_name
      if (!map[name]) map[name] = { name, revenue: 0 }
      map[name].revenue += t.total_amount ?? 0
    })
    return Object.values(map)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
  }, [transactions])

  const totalQty = useMemo(
    () => transactions.filter((t) => t.status === 'COMPLETED').reduce((s, t) => s + t.quantity_sold, 0),
    [transactions],
  )
  const totalRevenue = useMemo(
    () => transactions.filter((t) => t.status === 'COMPLETED').reduce((s, t) => s + (t.total_amount ?? 0), 0),
    [transactions],
  )

  const chartConfig = {
    backgroundColor: colors.canvas,
    backgroundGradientFrom: colors.canvas,
    backgroundGradientTo: colors.canvas,
    decimalCount: 0,
    color: (opacity = 1) => `rgba(17, 17, 17, ${opacity})`,
    labelColor: () => colors.muted,
    propsForDots: { r: '3', strokeWidth: '2', stroke: colors.ink },
    propsForLabels: { fontSize: 10 },
  }

  if (loading && transactions.length === 0) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={colors.ink} size="large" />
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.heading}>Laporan Penjualan</Text>
        <Button title="←" variant="ghost" size="sm" onPress={() => router.back()} />
      </View>

      {/* Summary */}
      <Card>
        <Text style={styles.chartTitle}>Ringkasan</Text>
        <View style={styles.summaryGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{transactions.filter(t => t.status === 'COMPLETED').length}</Text>
            <Text style={styles.statLabel}>Total Transaksi</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{totalQty}</Text>
            <Text style={styles.statLabel}>Total Qty (pcs)</Text>
          </View>
        </View>
        <View style={[styles.statBox, { marginTop: 8 }]}>
          <Text style={[styles.statValue, { color: colors.success }]}>{formatCurrency(totalRevenue)}</Text>
          <Text style={styles.statLabel}>Total Revenue</Text>
        </View>
      </Card>

      {/* Sales Trend Line Chart */}
      {salesData.length >= 2 && (
        <Card>
          <Text style={styles.chartTitle}>Tren Penjualan (Revenue)</Text>
          <LineChart
            data={{
              labels: salesData.map((d) => d.month),
              datasets: [{ data: salesData.map((d) => d.revenue) }],
            }}
            width={screenW - 32}
            height={170}
            chartConfig={chartConfig}
            bezier
            style={{ borderRadius: radius.md }}
          />
        </Card>
      )}

      {/* Top Products Bar Chart */}
      {topProducts.length > 0 && (
        <Card>
          <Text style={styles.chartTitle}>Produk Terlaris</Text>
          <BarChart
            data={{
              labels: topProducts.map((p) => p.name.length > 10 ? p.name.slice(0, 10) + '…' : p.name),
              datasets: [{ data: topProducts.map((p) => p.revenue) }],
            }}
            width={screenW - 32}
            height={160}
            chartConfig={chartConfig}
            style={{ borderRadius: radius.md }}
            fromZero
            showValuesOnTopOfBars
            yAxisLabel=""
            yAxisSuffix=""
          />
        </Card>
      )}

      {/* Top Companies Bar Chart */}
      {topCompanies.length > 0 && (
        <Card>
          <Text style={styles.chartTitle}>Perusahaan Top</Text>
          <BarChart
            data={{
              labels: topCompanies.map((c) => c.name.length > 10 ? c.name.slice(0, 10) + '…' : c.name),
              datasets: [{ data: topCompanies.map((c) => c.revenue) }],
            }}
            width={screenW - 32}
            height={180}
            chartConfig={chartConfig}
            style={{ borderRadius: radius.md }}
            fromZero
            showValuesOnTopOfBars
            yAxisLabel=""
            yAxisSuffix=""
          />
        </Card>
      )}

      {/* Detail Table */}
      <Card>
        <Text style={styles.chartTitle}>Transaksi Terbaru</Text>
        {transactions.filter(t => t.status === 'COMPLETED').slice(0, 10).map((t, i) => (
          <View key={t.sales_id} style={[styles.tableRow, i > 0 && styles.tableBorder]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.tableCode}>{t.invoice_number ?? '—'}</Text>
              <Text style={styles.tableSub}>{t.company_name}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.tableQty}>{t.quantity_sold} pcs</Text>
              <Text style={styles.tableAmount}>{formatCurrency(t.total_amount ?? 0)}</Text>
            </View>
          </View>
        ))}
        {transactions.filter(t => t.status === 'COMPLETED').length === 0 && (
          <Text style={styles.empty}>Belum ada transaksi</Text>
        )}
      </Card>

      {transactions.length === 0 && !loading && (
        <View style={styles.emptyWrap}>
          <Text style={styles.empty}>Belum ada data transaksi</Text>
          <Text style={styles.emptyHint}>Laporan akan muncul setelah ada transaksi COMPLETED</Text>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: 16, gap: 12 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.canvas },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heading: { fontSize: 22, fontWeight: '700', color: colors.ink },
  chartTitle: {
    fontSize: 13, fontWeight: '600', color: colors.muted,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10,
  },
  summaryGrid: { flexDirection: 'row', gap: 8 },
  statBox: {
    flex: 1, backgroundColor: colors.canvas, borderRadius: radius.md,
    padding: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.hairline,
  },
  statValue: { fontSize: 18, fontWeight: '700', color: colors.ink },
  statLabel: { fontSize: 10, color: colors.muted, marginTop: 2 },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  tableBorder: { borderTopWidth: 1, borderTopColor: colors.hairline },
  tableCode: { fontSize: 12, fontWeight: '600', color: colors.ink, fontFamily: 'JetBrainsMono-Regular' },
  tableSub: { fontSize: 11, color: colors.muted, marginTop: 1 },
  tableQty: { fontSize: 11, color: colors.muted },
  tableAmount: { fontSize: 13, fontWeight: '700', color: colors.ink },
  empty: { fontSize: 13, color: colors.muted, textAlign: 'center', paddingVertical: 16 },
  emptyHint: { fontSize: 12, color: colors.mutedSoft, textAlign: 'center' },
  emptyWrap: { alignItems: 'center', paddingVertical: 40, gap: 4 },
})
