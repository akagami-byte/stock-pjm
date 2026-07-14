import { useEffect, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, typography } from '@/constants'
import { useRouter } from 'expo-router'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { useDashboardStore } from '@/stores/dashboardStore'
import { useProductStore } from '@/stores/productStore'
import { formatDate, formatCurrency } from '@/utils/formatters'

export default function DashboardScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const {
    summary,
    reservedBatches,
    lowStockBatches,
    trashBatches,
    recentActivities,
    loading,
    fetchDashboardData,
  } = useDashboardStore()
  const { productTypes, fetchProductTypes, fetchProducts } = useProductStore()

  useEffect(() => {
    fetchDashboardData()
    fetchProductTypes()
    fetchProducts()
  }, [])

  const onRefresh = useCallback(() => {
    fetchDashboardData()
  }, [fetchDashboardData])

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor="#3B82F6" />}
    >
      {/* Header with subtitle */}
      <View style={styles.headerBlock}>
        <Text style={styles.subtitle}>Bengkel Las Maju</Text>
        <Text style={styles.heading}>Stock Dashboard</Text>
      </View>

      {/* Summary Cards */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { borderColor: colors.brand }]}>
          <Text style={styles.summaryValue}>{summary?.total_batch ?? '—'}</Text>
          <Text style={styles.summaryLabel}>Total Batch</Text>
        </View>
        <View style={[styles.summaryCard, { borderColor: colors.success }]}>
          <Text style={[styles.summaryValue, { color: colors.success }]}>
            {summary?.stock_tersedia?.toLocaleString('id-ID') ?? '—'}
          </Text>
          <Text style={styles.summaryLabel}>Stok Tersedia</Text>
        </View>
        <View style={[styles.summaryCard, { borderColor: colors.orange }]}>
          <Text style={[styles.summaryValue, { color: colors.orange }]}>
            {summary?.terjual_hari_ini ?? '—'}
          </Text>
          <Text style={styles.summaryLabel}>Terjual Hari Ini</Text>
        </View>
      </View>

      {/* Quick Actions */}
      <Card>
        <Text style={styles.sectionTitle}>🚀 Quick Actions</Text>
        <View style={styles.quickActions}>
          <Pressable
            style={({ pressed }) => [styles.quickBtn, pressed && styles.quickBtnPressed]}
            onPress={() => router.push('/master')}
          >
            <Text style={styles.quickIcon}>📋</Text>
            <Text style={styles.quickLabel}>Master Data</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.quickBtn, pressed && styles.quickBtnPressed]}
            onPress={() => router.push('/label/create')}
          >
            <Text style={styles.quickIcon}>🏷️</Text>
            <Text style={styles.quickLabel}>Buat Label</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.quickBtn, pressed && styles.quickBtnPressed]}
            onPress={() => router.push('/scan')}
          >
            <Text style={styles.quickIcon}>📷</Text>
            <Text style={styles.quickLabel}>Scan QR</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.quickBtn, pressed && styles.quickBtnPressed]}
            onPress={() => router.push('/transaction/create')}
          >
            <Text style={styles.quickIcon}>💰</Text>
            <Text style={styles.quickLabel}>Buat Transaksi</Text>
          </Pressable>
        </View>
      </Card>

      {/* Master Data Section */}
      {productTypes.length > 0 && (
        <Card>
          <Text style={styles.sectionTitle}>📦 Master Data</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.masterScroll}>
            {productTypes.slice(0, 8).map((pt) => (
              <Pressable
                key={pt.type_id}
                style={styles.masterCard}
                onPress={() => router.push({ pathname: '/master/[id]', params: { id: pt.type_id } })}
              >
                <View style={styles.masterIconWrap}>
                  <Text style={styles.masterIcon}>📦</Text>
                </View>
                <Text style={styles.masterName} numberOfLines={2}>{pt.type_name}</Text>
                <Text style={styles.masterCode}>{pt.type_code}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </Card>
      )}

      {/* Reserved Batches */}
      {reservedBatches.length > 0 && (
        <Card>
          <Text style={styles.sectionTitle}>
            📌 Batch RESERVED ({reservedBatches.length})
          </Text>
          {reservedBatches.slice(0, 5).map((item) => (
            <View key={item.batch_code} style={styles.listRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.listCode}>{item.batch_code}</Text>
                <Text style={styles.listSub}>
                  {item.company_name} · {item.qty_dipesan} pcs
                </Text>
              </View>
              <Text style={styles.deadline}>⏳ {formatDate(item.deadline)}</Text>
            </View>
          ))}
          <Button
            title="Lihat Semua →"
            variant="ghost"
            size="sm"
            onPress={() => router.push('/stock')}
          />
        </Card>
      )}

      {/* Low Stock Alerts */}
      {lowStockBatches.length > 0 && (
        <Card>
          <Text style={styles.sectionTitle}>
            ⚠️ Stok Menipis (≤5%) — {lowStockBatches.length}
          </Text>
          {lowStockBatches.slice(0, 5).map((item) => (
            <Pressable
              key={item.batch_id}
              style={({ pressed }) => [styles.listRow, pressed && styles.pressedRow]}
              onPress={() =>
                router.push({ pathname: '/stock/[id]', params: { id: item.batch_id } })
              }
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.listCode}>{item.batch_code}</Text>
                <Text style={styles.listSub}>
                  {item.current_qty} pcs tersisa
                </Text>
              </View>
              <Text style={styles.lowPct}>⚠️ {item.percentage.toFixed(1)}%</Text>
            </Pressable>
          ))}
          <Button
            title="Lihat Semua →"
            variant="ghost"
            size="sm"
            onPress={() => router.push('/stock')}
          />
        </Card>
      )}

      {/* Recent Activity */}
      {recentActivities.length > 0 && (
        <Card>
          <Text style={styles.sectionTitle}>🔄 Aktivitas Terbaru</Text>
          {recentActivities.slice(0, 10).map((item, i) => {
            const activityCfg = {
              BATCH_CREATED:  { icon: '🏷️', bg: colors.orange, label: 'Batch Dibuat' },
              BATCH_ACTIVATED:{ icon: '📷', bg: colors.brand, label: 'Batch Diaktivasi' },
              STATUS_CHANGED: { icon: '🔄', bg: colors.warning, label: 'Status Diubah' },
              TRANSACTION:    { icon: '💰', bg: colors.success, label: 'Transaksi' },
            }[item.type] ?? { icon: '📋', bg: colors.muted, label: item.type }
            return (
              <View key={i} style={styles.listRow}>
                <View style={[styles.activityCircle, { backgroundColor: activityCfg.bg }]}>
                  <Text style={styles.activityCircleIcon}>{activityCfg.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.listCode}>{item.reference}</Text>
                  <Text style={styles.listSub}>{activityCfg.label}</Text>
                </View>
              </View>
            )
          })}
        </Card>
      )}

      {/* Trash Items */}
      {trashBatches.length > 0 && (
        <Card>
          <Text style={styles.sectionTitle}>
            🗑️ Trash ({trashBatches.length})
          </Text>
          {trashBatches.slice(0, 5).map((item) => (
            <View key={item.batch_id} style={styles.listRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.listCode}>{item.batch_code}</Text>
                <Text style={styles.listSub}>
                  Status: {item.status} · Qty: {item.current_qty}/{item.initial_qty}
                </Text>
              </View>
            </View>
          ))}
        </Card>
      )}

      {loading && !summary && (
        <ActivityIndicator color="#3B82F6" size="large" style={{ marginTop: 60 }} />
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: 16, gap: 12 },
  headerBlock: { marginBottom: 4 },
  subtitle: { fontSize: 13, color: colors.muted, fontFamily: typography.font.sansMedium },
  heading: { fontSize: 24, fontWeight: '700', color: colors.ink, fontFamily: typography.font.sansBold },
  summaryRow: { flexDirection: 'row', gap: 8 },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.surfaceCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: 14,
    alignItems: 'center',
  },
  summaryValue: { fontSize: 22, fontWeight: '800', color: colors.ink },
  summaryLabel: { fontSize: 10, color: colors.muted, marginTop: 4, textAlign: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: colors.ink, marginBottom: 10 },
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickBtn: {
    width: '47%',
    backgroundColor: colors.canvas,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.surfaceCard,
    padding: 14,
    alignItems: 'center',
    gap: 4,
  },
  quickBtnPressed: { backgroundColor: colors.surfaceCard },
  quickIcon: { fontSize: 24 },
  quickLabel: { fontSize: 12, color: colors.body, fontWeight: '600' },
  masterScroll: { marginTop: 4 },
  masterCard: {
    width: 100,
    backgroundColor: colors.canvas,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: 10,
    marginRight: 10,
    alignItems: 'center',
    gap: 4,
  },
  masterIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  masterIcon: { fontSize: 20 },
  masterName: { fontSize: 11, color: colors.ink, fontWeight: '600', textAlign: 'center' },
  masterCode: { fontSize: 10, color: colors.muted, fontFamily: 'monospace' },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#0F172A',
    gap: 8,
  },
  pressedRow: { backgroundColor: colors.canvas, borderRadius: 8, marginHorizontal: -8, paddingHorizontal: 8 },
  listCode: { fontSize: 13, fontWeight: '600', color: colors.ink, fontFamily: 'monospace' },
  listSub: { fontSize: 11, color: colors.muted, marginTop: 1 },
  deadline: { fontSize: 11, color: colors.warning },
  lowPct: { fontSize: 12, color: '#EF4444', fontWeight: '700' },
  activityCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityCircleIcon: { fontSize: 12 },
})
