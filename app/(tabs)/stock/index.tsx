import { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  Pressable,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  Platform,
  ScrollView,
  Modal,
} from 'react-native'
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useFocusEffect } from 'expo-router'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { useBatchStore } from '@/stores/batchStore'
import { useCompanyStore } from '@/stores/companyStore'
import { formatDate } from '@/utils/formatters'
import { ALL_BATCH_STATUSES, getStatusColor, getFinishingLabel, colors, typography, spacing, radius } from '@/constants'
import type { BatchStatus } from '@/types'

// Stock: exclude DRAFT & ACTIVE (those belong to Label tab)
const STOCK_STATUSES: BatchStatus[] = ALL_BATCH_STATUSES.filter(
  (s) => s !== 'DRAFT' && s !== 'ACTIVE'
)

const STATUS_FILTERS: (BatchStatus | 'ALL')[] = [
  'ALL',
  ...STOCK_STATUSES,
]

function BadgePill({ status }: { status: BatchStatus }) {
  let bgColor = '#e5e7eb'
  let textColor: string = colors.ink
  switch (status) {
    case 'AVAILABLE':
      bgColor = '#10b981' // colors.success
      textColor = '#ffffff'
      break
    case 'RESERVED':
      bgColor = '#fb923c' // orange
      textColor = '#ffffff'
      break
    case 'PARTIALLY_SOLD':
    case 'SOLD_OUT':
      bgColor = '#ec4899' // pink
      textColor = '#ffffff'
      break
    case 'OBSOLETE':
    case 'ARCHIVED':
      bgColor = '#8b5cf6' // violet
      textColor = '#ffffff'
      break
  }

  return (
    <View
      style={{
        backgroundColor: bgColor,
        borderRadius: radius.pill,
        paddingHorizontal: 8,
        paddingVertical: 2,
        alignSelf: 'flex-start',
      }}
    >
      <Text
        style={{
          fontFamily: typography.font.sansMedium,
          fontSize: 11,
          fontWeight: '500',
          color: textColor,
        }}
      >
        {status}
      </Text>
    </View>
  )
}

export default function StockListScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { batches, totalCount, loading, error, fetchBatches } = useBatchStore()
  const companyStore = useCompanyStore()

  const [statusFilter, setStatusFilter] = useState<BatchStatus | 'ALL'>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 20

  // Filter Bottom Sheet Modal States
  const [showFilterModal, setShowFilterModal] = useState(false)
  const [tempSearch, setTempSearch] = useState('')
  const [tempStatus, setTempStatus] = useState<BatchStatus | 'ALL'>('ALL')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [tempCompany, setTempCompany] = useState('')

  const [selectedStartDate, setSelectedStartDate] = useState('')
  const [selectedEndDate, setSelectedEndDate] = useState('')
  const [selectedCompany, setSelectedCompany] = useState('')

  useEffect(() => {
    companyStore.fetchCompanies()
  }, [])

  useFocusEffect(
    useCallback(() => {
      setPage(0)
      fetchBatches({
        status: statusFilter === 'ALL' ? STOCK_STATUSES : statusFilter,
        limit: PAGE_SIZE,
        offset: 0,
      })
    }, [statusFilter, fetchBatches])
  )

  const handleRefresh = useCallback(() => {
    setPage(0)
    fetchBatches({
      status: statusFilter === 'ALL' ? STOCK_STATUSES : statusFilter,
      limit: PAGE_SIZE,
      offset: 0,
    })
  }, [statusFilter, fetchBatches])

  const handleLoadMore = useCallback(() => {
    const nextPage = page + 1
    const offset = nextPage * PAGE_SIZE
    fetchBatches({
      status: statusFilter === 'ALL' ? STOCK_STATUSES : statusFilter,
      limit: PAGE_SIZE,
      offset,
    })
    setPage(nextPage)
  }, [page, statusFilter, fetchBatches])

  const hasMore = batches.length < totalCount

  const handleApplyFilters = () => {
    setSearchQuery(tempSearch)
    setStatusFilter(tempStatus)
    setSelectedStartDate(startDate)
    setSelectedEndDate(endDate)
    setSelectedCompany(tempCompany)
    setShowFilterModal(false)
  }

  const handleResetFilters = () => {
    setTempSearch('')
    setTempStatus('ALL')
    setStartDate('')
    setEndDate('')
    setTempCompany('')

    setSearchQuery('')
    setStatusFilter('ALL')
    setSelectedStartDate('')
    setSelectedEndDate('')
    setSelectedCompany('')
    setShowFilterModal(false)
  }

  const isFilterActive =
    statusFilter !== 'ALL' ||
    searchQuery !== '' ||
    selectedStartDate !== '' ||
    selectedEndDate !== '' ||
    selectedCompany !== ''

  const filteredBatches = batches.filter((b) => {
    // 1. Keyword search (batch code, product name, sku)
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      const searchMatch =
        b.batch_code.toLowerCase().includes(q) ||
        b.variant?.product?.product_name?.toLowerCase().includes(q) ||
        b.variant?.sku_full?.toLowerCase().includes(q) ||
        b.variant?.product?.type?.type_code?.toLowerCase().includes(q)
      if (!searchMatch) return false
    }

    // 2. Start Date Period Check
    if (selectedStartDate) {
      const bd = new Date(b.entry_date)
      const sd = new Date(selectedStartDate)
      if (!isNaN(sd.getTime()) && bd < sd) return false
    }

    // 3. End Date Period Check
    if (selectedEndDate) {
      const bd = new Date(b.entry_date)
      const ed = new Date(selectedEndDate)
      if (!isNaN(ed.getTime())) {
        ed.setHours(23, 59, 59, 999)
        if (bd > ed) return false
      }
    }

    // 4. Company Name Check (if filter applied and status fits)
    if (selectedCompany && ['RESERVED', 'PARTIALLY_SOLD', 'SOLD_OUT'].includes(b.status)) {
      const hasCompany = b.sales_transaction?.some((t: any) =>
        t.company_name?.toLowerCase().includes(selectedCompany.toLowerCase())
      )
      if (!hasCompany) return false
    }

    return true
  })

  const renderItem = ({ item }: { item: any }) => {
    const pct = ((item.current_qty / item.initial_qty) * 100).toFixed(1)

    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        onPress={() => router.push({ pathname: '/stock/[id]', params: { id: item.batch_id } })}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          {/* Left Column: Product Info */}
          <View style={{ flex: 1, paddingRight: spacing.sm, gap: 2 }}>
            <Text style={styles.productName} numberOfLines={1}>
              {item.variant?.product?.product_name ?? '—'}
            </Text>
            {item.variant && (
              <Text style={styles.skuLine}>
                {getFinishingLabel(item.variant.finishing)}
              </Text>
            )}
            <Text style={styles.skuLine}>
              {item.variant?.sku_full ?? '—'}
            </Text>
          </View>

          {/* Right Column: Batch info, Status badge, and optionally Client/Company */}
          <View style={{ alignItems: 'flex-end', justifyContent: 'flex-start', gap: 4 }}>
            <Text style={styles.batchCode}>{item.batch_code}</Text>
            <BadgePill status={item.status} />
            {/* If status is RESERVED/PARTIALLY_SOLD/SOLD_OUT, render the company name */}
            {(item.status === 'RESERVED' || item.status === 'PARTIALLY_SOLD' || item.status === 'SOLD_OUT') &&
              item.sales_transaction && item.sales_transaction.length > 0 && (
                <Text style={{ fontFamily: typography.font.sans, fontSize: 13, color: colors.ink, marginTop: 4, textAlign: 'right' }}>
                  {item.status === 'RESERVED'
                    ? `Dipesan oleh ${Array.from(new Set(item.sales_transaction.map((t: any) => t.company_name).filter(Boolean))).join(', ')}`
                    : `Terjual ke ${Array.from(new Set(item.sales_transaction.map((t: any) => t.company_name).filter(Boolean))).join(', ')}`}
                </Text>
              )}
          </View>
        </View>

        <View style={styles.stockBar}>
          <View style={styles.stockBarBg}>
            <View
              style={[
                styles.stockBarFill,
                {
                  width: `${Math.min(100, parseFloat(pct))}%`,
                  backgroundColor:
                    item.status === 'AVAILABLE'
                      ? '#10b981'
                      : item.status === 'RESERVED'
                      ? '#fb923c'
                      : '#9ca3af',
                },
              ]}
            />
          </View>
          <Text style={styles.stockText}>
            Stok {item.current_qty}/{item.initial_qty} pcs ({pct}%)
          </Text>
        </View>

        <Text style={styles.date}>{formatDate(item.entry_date)}</Text>
      </Pressable>
    )
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Search & Filter Row */}
      <View style={{ flexDirection: 'row', paddingHorizontal: spacing.md, paddingVertical: spacing.xs, gap: spacing.xs, backgroundColor: '#ffffff', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={(t) => {
              setSearchQuery(t)
              setTempSearch(t)
            }}
            placeholder="Cari batch, SKU, atau produk..."
            placeholderTextColor="#9ca3af"
          />
        </View>
        <Pressable
          style={{
            backgroundColor: isFilterActive ? colors.brand : colors.surfaceSoft,
            borderRadius: radius.md,
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderWidth: 1,
            borderColor: isFilterActive ? colors.brand : colors.hairline,
            justifyContent: 'center',
            alignItems: 'center',
          }}
          onPress={() => {
            setTempSearch(searchQuery)
            setTempStatus(statusFilter)
            setShowFilterModal(true)
          }}
        >
          <Text style={{ fontFamily: typography.font.sansSemiBold, fontSize: 13, color: isFilterActive ? '#ffffff' : colors.ink }}>
            {isFilterActive ? 'Filter Aktif' : '⚙️ Filter'}
          </Text>
        </Pressable>
      </View>

      <Modal
        visible={showFilterModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
          onPress={() => setShowFilterModal(false)}
        >
          <Pressable
            style={{
              backgroundColor: '#ffffff',
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: spacing.md,
              maxHeight: '85%',
            }}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
              <Text style={{ fontFamily: typography.font.sansSemiBold, fontSize: 18, fontWeight: '600', color: colors.ink }}>
                Filter Stok
              </Text>
              <Pressable onPress={() => setShowFilterModal(false)}>
                <Text style={{ fontSize: 18, color: colors.muted }}>✕</Text>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Keyword Field */}
              <View style={{ marginBottom: spacing.sm }}>
                <Text style={{ fontFamily: typography.font.sansMedium, fontSize: 13, color: colors.muted, marginBottom: 6 }}>
                  Kata Kunci (Keyword)
                </Text>
                <TextInput
                  style={styles.searchInput}
                  value={tempSearch}
                  onChangeText={setTempSearch}
                  placeholder="Cari nama produk, SKU, batch..."
                  placeholderTextColor="#9ca3af"
                />
              </View>

              {/* Periode Field */}
              <View style={{ marginBottom: spacing.sm }}>
                <Text style={{ fontFamily: typography.font.sansMedium, fontSize: 13, color: colors.muted, marginBottom: 6 }}>
                  Periode Masuk
                </Text>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <TextInput
                      style={styles.searchInput}
                      value={startDate}
                      onChangeText={setStartDate}
                      placeholder="Mulai (YYYY-MM-DD)"
                      placeholderTextColor="#9ca3af"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <TextInput
                      style={styles.searchInput}
                      value={endDate}
                      onChangeText={setEndDate}
                      placeholder="Selesai (YYYY-MM-DD)"
                      placeholderTextColor="#9ca3af"
                    />
                  </View>
                </View>
              </View>

              {/* Status Selector Dropdown */}
              <View style={{ marginBottom: spacing.sm }}>
                <Text style={{ fontFamily: typography.font.sansMedium, fontSize: 13, color: colors.muted, marginBottom: 6 }}>
                  Status
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs, paddingVertical: 4 }}>
                  {STATUS_FILTERS.map((s) => {
                    const isSel = tempStatus === s
                    return (
                      <Pressable
                        key={s}
                        style={{
                          backgroundColor: isSel ? colors.brand : colors.surfaceSoft,
                          borderRadius: radius.pill,
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderWidth: 1,
                          borderColor: isSel ? colors.brand : colors.hairline,
                        }}
                        onPress={() => {
                          setTempStatus(s)
                          if (!['RESERVED', 'PARTIALLY_SOLD', 'SOLD_OUT'].includes(s)) {
                            setTempCompany('')
                          }
                        }}
                      >
                        <Text style={{ fontFamily: typography.font.sansMedium, fontSize: 12, color: isSel ? '#ffffff' : colors.ink }}>
                          {s === 'ALL' ? 'Semua' : s}
                        </Text>
                      </Pressable>
                    )
                  })}
                </ScrollView>
              </View>

              {/* Company (PT) Dropdown / Autocomplete: Trigger only for RESERVED, PARTIALLY_SOLD, SOLD_OUT */}
              {['RESERVED', 'PARTIALLY_SOLD', 'SOLD_OUT'].includes(tempStatus) && (
                <View style={{ marginBottom: spacing.md }}>
                  <Text style={{ fontFamily: typography.font.sansMedium, fontSize: 13, color: colors.muted, marginBottom: 6 }}>
                    Pilih Perusahaan (PT)
                  </Text>
                  
                  <View style={{ borderWidth: 1, borderColor: colors.hairline, borderRadius: radius.md, backgroundColor: '#ffffff', overflow: 'hidden' }}>
                    <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled>
                      <Pressable
                        style={{
                          padding: spacing.sm,
                          borderBottomWidth: 1,
                          borderBottomColor: colors.hairlineSoft,
                          backgroundColor: tempCompany === '' ? colors.surfaceSoft : '#ffffff',
                        }}
                        onPress={() => setTempCompany('')}
                      >
                        <Text style={{ fontFamily: typography.font.sans, fontSize: 13, color: colors.ink }}>
                          Semua Perusahaan
                        </Text>
                      </Pressable>
                      {companyStore.companies.map((comp) => {
                        const isSel = tempCompany === comp.company_name
                        return (
                          <Pressable
                            key={comp.company_id}
                            style={{
                              padding: spacing.sm,
                              borderBottomWidth: 1,
                              borderBottomColor: colors.hairlineSoft,
                              backgroundColor: isSel ? colors.surfaceSoft : '#ffffff',
                            }}
                            onPress={() => setTempCompany(comp.company_name)}
                          >
                            <Text style={{ fontFamily: typography.font.sans, fontSize: 13, color: colors.ink }}>
                              {comp.company_name}
                            </Text>
                          </Pressable>
                        )
                      })}
                    </ScrollView>
                  </View>
                </View>
              )}

              {/* Modal Buttons */}
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, paddingBottom: 24 }}>
                <Pressable
                  style={{
                    flex: 1,
                    backgroundColor: colors.surfaceSoft,
                    borderRadius: radius.md,
                    paddingVertical: 12,
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: colors.hairline,
                  }}
                  onPress={handleResetFilters}
                >
                  <Text style={{ fontFamily: typography.font.sansSemiBold, fontSize: 14, color: colors.ink }}>
                    Reset
                  </Text>
                </Pressable>

                <Pressable
                  style={{
                    flex: 1,
                    backgroundColor: colors.brand,
                    borderRadius: radius.md,
                    paddingVertical: 12,
                    alignItems: 'center',
                  }}
                  onPress={handleApplyFilters}
                >
                  <Text style={{ fontFamily: typography.font.sansSemiBold, fontSize: 14, color: '#ffffff' }}>
                    Terapkan
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* List */}
      {loading && batches.length === 0 ? (
        <ActivityIndicator color={colors.brand} size="large" style={styles.loader} />
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <Button title="Coba Lagi" variant="outline" onPress={handleRefresh} />
        </View>
      ) : filteredBatches.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>Tidak ada batch</Text>
          <Text style={styles.emptyHint}>
            {statusFilter === 'ALL'
              ? 'Belum ada batch tersedia'
              : `Tidak ada batch dengan status "${statusFilter}"`}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredBatches}
          keyExtractor={(item) => item.batch_id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          onRefresh={handleRefresh}
          refreshing={loading}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListFooterComponent={() => (
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Menampilkan {filteredBatches.length} dari {totalCount} batch
              </Text>
              {hasMore && (
                <Button
                  title="Muat Lebih Banyak"
                  variant="outline"
                  size="sm"
                  onPress={handleLoadMore}
                  loading={loading}
                />
              )}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  searchBar: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: '#ffffff',
  },
  searchInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    height: 40,
    paddingHorizontal: spacing.sm,
    fontSize: 14,
    color: colors.ink,
    fontFamily: typography.font.sans,
  },
  filterWrapper: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: colors.hairlineSoft,
  },
  navPillGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.pill,
    padding: 4,
    gap: spacing.xxs,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: 'transparent',
  },
  filterChipActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  filterChipText: {
    fontFamily: typography.font.sansMedium,
    fontSize: 13,
    color: colors.muted,
  },
  filterChipTextActive: {
    fontFamily: typography.font.sansSemiBold,
    color: colors.ink,
    fontWeight: '600',
  },
  list: {
    padding: spacing.md,
    paddingTop: spacing.xs,
  },
  loader: {
    marginTop: 60,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 8,
  },
  errorText: {
    fontSize: 14,
    color: colors.error,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: colors.muted,
  },
  emptyHint: {
    fontSize: 13,
    color: colors.muted,
  },
  card: {
    backgroundColor: colors.surfaceCard, // #f5f5f5
    borderRadius: radius.lg, // 12px
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.md,
  },
  cardPressed: {
    opacity: 0.85,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  batchCode: {
    fontFamily: typography.font.sansSemiBold,
    fontSize: 16,
    fontWeight: '600',
    color: colors.ink,
  },
  cardBody: {
    gap: spacing.xxs,
  },
  productName: {
    fontFamily: typography.font.sansSemiBold,
    fontSize: 16,
    fontWeight: '600',
    color: colors.ink,
  },
  skuLine: {
    fontFamily: typography.font.sans,
    fontSize: 13,
    color: colors.muted,
  },
  stockBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  stockBarBg: {
    flex: 1,
    height: 4, // thin and minimal
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    overflow: 'hidden',
  },
  stockBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  stockText: {
    fontFamily: typography.font.sans,
    fontSize: 12,
    color: colors.body,
  },
  date: {
    fontFamily: typography.font.sans,
    fontSize: 11,
    color: colors.mutedSoft,
    marginTop: spacing.xxs,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  footerText: {
    fontSize: 12,
    color: colors.muted,
  },
})
