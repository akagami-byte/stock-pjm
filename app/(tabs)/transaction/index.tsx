import { useEffect, useCallback, useMemo, useState } from 'react'
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  TextInput,
  StyleSheet,
  ScrollView,
} from 'react-native'
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import Button from '@/components/ui/Button'
import { useTransactionStore } from '@/stores/transactionStore'
import { useAuthStore } from '@/stores/authStore'
import { formatDate, formatCurrency } from '@/utils/formatters'
import { colors, typography, radius, spacing, TRANSACTION_STATUS_COLORS } from '@/constants'

import type { TransactionStatus, InvoiceGroup } from '@/types'

type StatusFilter = 'Semua' | TransactionStatus

export default function TransactionListScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const role = useAuthStore((s) => s.user?.role ?? 'staff')
  const { invoiceGroups, loading, error, fetchTransactions, companyNames, fetchCompanyNames } =
    useTransactionStore()

  useEffect(() => {
    if (role === 'staff') {
      router.replace('/label')
      return
    }
    fetchTransactions()
    fetchCompanyNames()
  }, [role])

  // Filter state
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('Semua')
  const [companyFilter, setCompanyFilter] = useState('Semua')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showStatusDropdown, setShowStatusDropdown] = useState(false)
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false)

  // Apply client-side filters (store already handles server-side date/status)
  const filteredGroups = useMemo(() => {
    let result = [...invoiceGroups]

    if (statusFilter !== 'Semua') {
      result = result.filter((g) => g.status === statusFilter)
    }
    if (companyFilter !== 'Semua') {
      result = result.filter(
        (g) => g.company_name.toLowerCase() === companyFilter.toLowerCase()
      )
    }
    if (dateFrom) {
      result = result.filter((g) => g.transaction_date >= dateFrom)
    }
    if (dateTo) {
      result = result.filter((g) => g.transaction_date <= dateTo + 'T23:59:59')
    }

    return result
  }, [invoiceGroups, statusFilter, companyFilter, dateFrom, dateTo])

  const uniqueCompanies = useMemo(() => {
    const set = new Set(invoiceGroups.map((g) => g.company_name))
    return Array.from(set).sort()
  }, [invoiceGroups])

  const statusOptions: StatusFilter[] = [
    'Semua',
    'RESERVED',
    'COMPLETED',
    'CANCELLED',
    'RETURNED',
  ]

  const handleRefresh = useCallback(() => {
    fetchTransactions({ date_from: dateFrom || undefined, date_to: dateTo || undefined })
  }, [fetchTransactions, dateFrom, dateTo])

  const handleCetakInvoice = (group: InvoiceGroup) => {
    // TODO: Actual PDF generation
    console.log('Cetak invoice:', group.invoice_number)
  }

  const renderItem = ({ item }: { item: InvoiceGroup }) => {
    const statusColor = TRANSACTION_STATUS_COLORS[item.status] ?? {
      background: '#6B7280',
      text: '#FFFFFF',
      label: item.status,
    }

    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        onPress={() =>
          router.push({
            pathname: '/transaction/[id]',
            params: { id: item.items[0]?.sales_id },
          })
        }
      >
        <View style={styles.cardHeader}>
          <Text style={styles.invoiceNumber}>{item.invoice_number}</Text>
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

        <View style={styles.cardBody}>
          <View style={styles.row}>
            <Text style={styles.label}>Perusahaan</Text>
            <Text style={styles.value}>{item.company_name}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Item</Text>
            <Text style={styles.value}>
              {item.total_quantity} pcs · {item.items.length} produk
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Total</Text>
            <Text style={styles.total}>{formatCurrency(item.total_amount)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Tanggal</Text>
            <Text style={styles.value}>{formatDate(item.transaction_date)}</Text>
          </View>
        </View>

        {/* Cetak Invoice button */}
        <View style={styles.cardActions}>
          <Pressable
            style={styles.cetakInvoiceBtn}
            onPress={(e) => {
              e.stopPropagation?.()
              handleCetakInvoice(item)
            }}
          >
            <Text style={styles.cetakInvoiceText}>📄 Cetak Invoice</Text>
          </Pressable>
        </View>
      </Pressable>
    )
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header with nav buttons */}
      <View style={[styles.header, { paddingTop: spacing.sm }]}>
        <Text style={styles.heading}>Transaksi</Text>
        <View style={styles.navButtons}>
          <Button
            title="🏢"
            size="sm"
            variant="ghost"
            onPress={() => router.push('/transaction/company')}
          />
          <Button
            title="📊"
            size="sm"
            variant="ghost"
            onPress={() => router.push('/transaction/report')}
          />
          <Button
            title="＋"
            size="sm"
            variant="primary"
            onPress={() => router.push('/transaction/create')}
          />
          <Button
            title="📋"
            size="sm"
            variant="ghost"
            onPress={() => {}}
          />
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filterContainer}>
        {/* Date filters row */}
        <View style={styles.dateRow}>
          <View style={styles.dateInputWrap}>
            <Text style={styles.filterLabel}>Dari</Text>
            <TextInput
              style={styles.dateInput}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.mutedSoft}
              value={dateFrom}
              onChangeText={setDateFrom}
              maxLength={10}
            />
          </View>
          <View style={styles.dateInputWrap}>
            <Text style={styles.filterLabel}>Sampai</Text>
            <TextInput
              style={styles.dateInput}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.mutedSoft}
              value={dateTo}
              onChangeText={setDateTo}
              maxLength={10}
            />
          </View>
        </View>

        {/* Status & Company dropdown row */}
        <View style={styles.filterRow}>
          {/* Status Dropdown */}
          <View style={styles.dropdownWrap}>
            <Pressable
              style={styles.dropdown}
              onPress={() => {
                setShowStatusDropdown(!showStatusDropdown)
                setShowCompanyDropdown(false)
              }}
            >
              <Text style={styles.dropdownText}>
                {statusFilter === 'Semua' ? 'Semua Status' : statusFilter}
              </Text>
              <Text style={styles.dropdownArrow}>▼</Text>
            </Pressable>
            {showStatusDropdown && (
              <View style={styles.dropdownMenu}>
                <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                  {statusOptions.map((opt) => (
                    <Pressable
                      key={opt}
                      style={[
                        styles.dropdownItem,
                        statusFilter === opt && styles.dropdownItemActive,
                      ]}
                      onPress={() => {
                        setStatusFilter(opt)
                        setShowStatusDropdown(false)
                      }}
                    >
                      <Text
                        style={[
                          styles.dropdownItemText,
                          statusFilter === opt && styles.dropdownItemTextActive,
                        ]}
                      >
                        {opt === 'Semua' ? 'Semua' : opt}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Company Dropdown */}
          <View style={styles.dropdownWrap}>
            <Pressable
              style={styles.dropdown}
              onPress={() => {
                setShowCompanyDropdown(!showCompanyDropdown)
                setShowStatusDropdown(false)
              }}
            >
              <Text style={styles.dropdownText} numberOfLines={1}>
                {companyFilter === 'Semua' ? 'Semua Perusahaan' : companyFilter}
              </Text>
              <Text style={styles.dropdownArrow}>▼</Text>
            </Pressable>
            {showCompanyDropdown && (
              <View style={styles.dropdownMenu}>
                <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                  <Pressable
                    style={[
                      styles.dropdownItem,
                      companyFilter === 'Semua' && styles.dropdownItemActive,
                    ]}
                    onPress={() => {
                      setCompanyFilter('Semua')
                      setShowCompanyDropdown(false)
                    }}
                  >
                    <Text
                      style={[
                        styles.dropdownItemText,
                        companyFilter === 'Semua' && styles.dropdownItemTextActive,
                      ]}
                    >
                      Semua
                    </Text>
                  </Pressable>
                  {uniqueCompanies.map((name) => (
                    <Pressable
                      key={name}
                      style={[
                        styles.dropdownItem,
                        companyFilter === name && styles.dropdownItemActive,
                      ]}
                      onPress={() => {
                        setCompanyFilter(name)
                        setShowCompanyDropdown(false)
                      }}
                    >
                      <Text
                        style={[
                          styles.dropdownItemText,
                          companyFilter === name && styles.dropdownItemTextActive,
                        ]}
                        numberOfLines={1}
                      >
                        {name}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Content */}
      {loading && invoiceGroups.length === 0 ? (
        <ActivityIndicator color="#3B82F6" size="large" style={styles.loader} />
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <Button title="Coba Lagi" variant="outline" onPress={handleRefresh} />
        </View>
      ) : filteredGroups.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>
            {invoiceGroups.length === 0
              ? 'Belum ada transaksi'
              : 'Tidak ada transaksi yang cocok dengan filter'}
          </Text>
          {invoiceGroups.length === 0 && (
            <Text style={styles.emptyHint}>Buat transaksi penjualan pertama Anda</Text>
          )}
          <Button
            title="+ Buat Transaksi"
            onPress={() => router.push('/transaction/create')}
          />
        </View>
      ) : (
        <FlatList<InvoiceGroup>
          data={filteredGroups}
          keyExtractor={(item) => item.invoice_number}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          onRefresh={handleRefresh}
          refreshing={loading}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListFooterComponent={
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Menampilkan {filteredGroups.length} dari {invoiceGroups.length} transaksi
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  container: { flex: 1, backgroundColor: colors.canvas },
  // ── Header ──
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  heading: { fontSize: typography.size.xl, fontWeight: typography.weight.bold, color: colors.ink },
  navButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  // ── Filters ──
  filterContainer: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  dateRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  dateInputWrap: {
    flex: 1,
  },
  filterLabel: {
    fontSize: typography.size.xs,
    color: colors.muted,
    fontWeight: typography.weight.medium,
    marginBottom: 2,
  },
  dateInput: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs + 2,
    fontSize: typography.size.sm,
    color: colors.ink,
    fontFamily: typography.font.mono,
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  dropdownWrap: {
    flex: 1,
    position: 'relative',
    zIndex: 10,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs + 2,
  },
  dropdownText: {
    fontSize: typography.size.sm,
    color: colors.ink,
    flex: 1,
    fontFamily: typography.font.mono,
  },
  dropdownArrow: {
    fontSize: typography.size.xs,
    color: colors.muted,
    marginLeft: spacing.xxs,
  },
  dropdownMenu: {
    position: 'absolute',
    top: 36,
    left: 0,
    right: 0,
    backgroundColor: colors.canvas,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.hairline,
    zIndex: 999,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  dropdownItem: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairlineSoft,
  },
  dropdownItemActive: {
    backgroundColor: colors.primary + '11',
  },
  dropdownItemText: {
    fontSize: typography.size.sm,
    color: colors.body,
  },
  dropdownItemTextActive: {
    color: colors.primary,
    fontWeight: typography.weight.semibold,
  },
  // ── List ──
  list: { padding: spacing.md, paddingTop: spacing.xs },
  loader: { marginTop: 60 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 8 },
  errorText: { fontSize: 14, color: colors.error, textAlign: 'center' },
  emptyText: { fontSize: 16, color: colors.muted },
  emptyHint: { fontSize: 13, color: colors.muted, marginBottom: 12 },
  // ── Cards ──
  card: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    overflow: 'hidden',
  },
  cardPressed: { opacity: 0.8 },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  invoiceNumber: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.ink,
    fontFamily: typography.font.mono,
  },
  statusBadge: {
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
  },
  statusText: { fontSize: 11, fontWeight: typography.weight.semibold },
  cardBody: { padding: spacing.md, gap: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { fontSize: 13, color: colors.muted },
  value: { fontSize: 13, color: colors.body, fontWeight: typography.weight.medium },
  total: { fontSize: 15, fontWeight: typography.weight.bold, color: colors.success },
  // ── Card Actions ──
  cardActions: {
    borderTopWidth: 1,
    borderTopColor: colors.hairlineSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  cetakInvoiceBtn: {
    alignSelf: 'flex-start',
    backgroundColor: colors.brand + '15',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs + 2,
  },
  cetakInvoiceText: {
    fontSize: typography.size.sm,
    color: colors.brand,
    fontWeight: typography.weight.semibold,
  },
  // ── Footer ──
  footer: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  footerText: {
    fontSize: typography.size.sm,
    color: colors.muted,
  },
})
