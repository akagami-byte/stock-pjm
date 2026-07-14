import { useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Pressable,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { useTransactionStore } from '@/stores/transactionStore'
import { formatDate, formatCurrency } from '@/utils/formatters'
import { colors, typography, radius, spacing, TRANSACTION_STATUS_COLORS } from '@/constants'
import type { InvoiceGroup } from '@/types'

export default function TransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const transactionStore = useTransactionStore()
  const { invoiceGroups, loading } = transactionStore

  const [group, setGroup] = useState<InvoiceGroup | null>(null)

  useEffect(() => {
    transactionStore.fetchTransactions()
  }, [])

  useEffect(() => {
    if (invoiceGroups.length > 0 && id) {
      const found = invoiceGroups.find((g) =>
        g.items.some((item) => item.sales_id === id)
      )
      if (found) setGroup(found)
    }
  }, [invoiceGroups, id])

  if (loading || !group) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color="#3B82F6" size="large" />
      </View>
    )
  }

  const statusColor = TRANSACTION_STATUS_COLORS[group.status] ?? {
    background: '#6B7280',
    text: '#FFFFFF',
    label: group.status,
  }
  const isCompleted = group.status === 'COMPLETED'

  const handleCetakInvoice = () => {
    // TODO: implement PDF invoice generation
    Alert.alert('Cetak Invoice', 'Fungsi cetak invoice akan segera tersedia.')
  }

  const handleCancel = () => {
    if (!isCompleted) {
      Alert.alert('Info', 'Hanya transaksi COMPLETED yang dapat dibatalkan.')
      return
    }
    const firstItem = group.items[0]
    Alert.alert(
      'Batalkan Transaksi',
      `Invoice ${group.invoice_number} akan dibatalkan. Stok akan dikembalikan.`,
      [
        { text: 'Tidak', style: 'cancel' },
        {
          text: 'Batalkan',
          style: 'destructive',
          onPress: async () => {
            try {
              await transactionStore.cancelTransaction(firstItem.sales_id)
              Alert.alert('Berhasil', 'Transaksi dibatalkan')
              router.back()
            } catch (err: any) {
              Alert.alert('Error', err.message)
            }
          },
        },
      ]
    )
  }

  const handleReturn = () => {
    if (!isCompleted) {
      Alert.alert('Info', 'Hanya transaksi COMPLETED yang dapat diretur.')
      return
    }
    const firstItem = group.items[0]
    Alert.alert('Retur Transaksi', 'Stok akan ditambah kembali.', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Retur',
        style: 'destructive',
        onPress: async () => {
          try {
            await transactionStore.returnTransaction(firstItem.sales_id)
            Alert.alert('Berhasil', 'Transaksi diretur')
            router.back()
          } catch (err: any) {
            Alert.alert('Error', err.message)
          }
        },
      },
    ])
  }

  // Get notes from first item
  const notes = group.items[0]?.notes

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}>
      {/* Invoice Header */}
      <Card
        style={{
          borderColor: statusColor.background + '44',
          backgroundColor: statusColor.background + '11',
        }}
      >
        <View style={styles.invoiceHeader}>
          <Text style={styles.invoiceLabel}>INVOICE</Text>
          <Text style={styles.invoiceNumber}>{group.invoice_number}</Text>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: statusColor.background + '22',
                borderColor: statusColor.background + '44',
              },
            ]}
          >
            <Text style={[styles.statusText, { color: statusColor.background }]}>
              {statusColor.label}
            </Text>
          </View>
        </View>
      </Card>

      {/* Company Info */}
      <Card>
        <Text style={styles.sectionTitle}>Informasi Perusahaan</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Nama</Text>
          <Text style={styles.infoValue}>{group.company_name}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Tanggal</Text>
          <Text style={styles.infoValue}>{formatDate(group.transaction_date)}</Text>
        </View>
      </Card>

      {/* Items TABLE format */}
      <Card>
        <Text style={styles.sectionTitle}>Detail Item ({group.items.length} produk)</Text>

        {/* Table Header */}
        <View style={styles.tableHeader}>
          <Text style={[styles.thCell, styles.thNum]}>#</Text>
          <Text style={[styles.thCell, styles.thProduk]}>Produk</Text>
          <Text style={[styles.thCell, styles.thBatch]}>Batch</Text>
          <Text style={[styles.thCell, styles.thQty]}>Qty</Text>
          <Text style={[styles.thCell, styles.thHarga]}>Harga</Text>
          <Text style={[styles.thCell, styles.thSubtotal]}>Subtotal</Text>
        </View>

        {/* Table Rows */}
        {group.items.map((item, i) => {
          const effectivePrice = (item.batch?.variant?.product?.base_price ?? 0) + (item.batch?.variant?.price_modifier ?? 0)
          const isAltPrice =
            item.alternative_price ||
            (effectivePrice > 0 &&
              item.price_per_unit !== effectivePrice)

          return (
            <View key={item.sales_id} style={styles.tableRow}>
              <Text style={[styles.tdCell, styles.tdNum, { fontFamily: typography.font.mono }]}>
                {i + 1}
              </Text>
              <Text style={[styles.tdCell, styles.tdProduk]} numberOfLines={2}>
                {item.batch?.variant?.product?.product_name ?? '—'}
              </Text>
              <Text style={[styles.tdCell, styles.tdBatch, { fontFamily: typography.font.mono }]}>
                {item.batch?.batch_code ?? '—'}
              </Text>
              <Text style={[styles.tdCell, styles.tdQty]}>
                {item.quantity_sold}
              </Text>
              <Text style={[styles.tdCell, styles.tdHarga]}>
                {isAltPrice ? '✨ ' : ''}
                {formatCurrency(item.price_per_unit)}
              </Text>
              <Text style={[styles.tdCell, styles.tdSubtotal]}>
                {formatCurrency(item.total_amount)}
              </Text>
            </View>
          )
        })}

        {/* Table Footer */}
        <View style={styles.tableFooter}>
          <View style={{ flex: 1 }}>
            <Text style={styles.tableFooterLabel}>
              Total Qty: {group.total_quantity} pcs
            </Text>
          </View>
          <Text style={styles.tableFooterTotal}>
            Total: {formatCurrency(group.total_amount)}
          </Text>
        </View>
      </Card>

      {/* Notes Section */}
      <Card>
        <Text style={styles.sectionTitle}>📝 Catatan</Text>
        {notes ? (
          <Text style={styles.notesText}>{notes}</Text>
        ) : (
          <Text style={styles.notesEmpty}>Tidak ada catatan</Text>
        )}
      </Card>

      {/* Summary */}
      <Card style={{ borderColor: colors.success, borderWidth: 2 }}>
        <Text style={styles.sectionTitle}>Ringkasan Pembayaran</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total Qty</Text>
          <Text style={styles.summaryValue}>{group.total_quantity} pcs</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total Pembayaran</Text>
          <Text style={styles.grandTotal}>{formatCurrency(group.total_amount)}</Text>
        </View>
      </Card>

      {/* Actions — always visible */}
      <View style={styles.actions}>
        <Button
          title="📄 Cetak Invoice"
          variant="primary"
          fullWidth
          onPress={handleCetakInvoice}
        />
        <Button
          title="❌ Batalkan"
          variant={isCompleted ? 'danger' : 'secondary'}
          fullWidth
          onPress={handleCancel}
          disabled={!isCompleted}
        />
        <Button
          title="🔄 Retur"
          variant={isCompleted ? 'danger' : 'secondary'}
          fullWidth
          onPress={handleReturn}
          disabled={!isCompleted}
        />
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: spacing.md, gap: spacing.sm },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.canvas,
  },
  // ── Invoice Header ──
  invoiceHeader: { alignItems: 'center', gap: 6 },
  invoiceLabel: {
    fontSize: typography.size.sm,
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  invoiceNumber: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.ink,
    fontFamily: typography.font.mono,
  },
  statusBadge: {
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    marginTop: 4,
  },
  statusText: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold },
  // ── Company Info ──
  sectionTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  infoLabel: { fontSize: typography.size.base, color: colors.muted },
  infoValue: {
    fontSize: typography.size.base,
    color: colors.body,
    fontWeight: typography.weight.medium,
  },
  // ── TABLE ──
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xxs,
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.xs,
    marginBottom: spacing.xxs,
  },
  thCell: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.muted,
    textTransform: 'uppercase',
  },
  thNum: { width: 24, textAlign: 'center' },
  thProduk: { flex: 2 },
  thBatch: { flex: 1.5, fontFamily: typography.font.mono },
  thQty: { width: 36, textAlign: 'center' },
  thHarga: { width: 72, textAlign: 'right' },
  thSubtotal: { flex: 1, textAlign: 'right' },
  // --- Rows ---
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairlineSoft,
  },
  tdCell: {
    fontSize: typography.size.sm,
    color: colors.body,
  },
  tdNum: { width: 24, textAlign: 'center', color: colors.muted },
  tdProduk: { flex: 2, fontWeight: typography.weight.medium, color: colors.ink },
  tdBatch: { flex: 1.5, color: colors.muted },
  tdQty: { width: 36, textAlign: 'center', fontWeight: typography.weight.semibold },
  tdHarga: { width: 72, textAlign: 'right', fontFamily: typography.font.mono },
  tdSubtotal: {
    flex: 1,
    textAlign: 'right',
    fontWeight: typography.weight.semibold,
    color: colors.ink,
    fontFamily: typography.font.mono,
  },
  // --- Footer ---
  tableFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 2,
    borderTopColor: colors.hairline,
  },
  tableFooterLabel: {
    fontSize: typography.size.sm,
    color: colors.muted,
    fontWeight: typography.weight.medium,
  },
  tableFooterTotal: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.success,
  },
  // ── Notes ──
  notesText: {
    fontSize: typography.size.base,
    color: colors.body,
    lineHeight: 20,
  },
  notesEmpty: {
    fontSize: typography.size.base,
    color: colors.mutedSoft,
    fontStyle: 'italic',
  },
  // ── Summary ──
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  summaryLabel: { fontSize: typography.size.base, color: colors.muted },
  summaryValue: {
    fontSize: typography.size.base,
    color: colors.body,
    fontWeight: typography.weight.semibold,
  },
  grandTotal: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.success,
  },
  // ── Actions ──
  actions: { gap: spacing.xs },
})
