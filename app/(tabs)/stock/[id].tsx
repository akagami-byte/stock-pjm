import { useEffect, useState, useRef } from 'react'
import {
  View,
  Text,
  ScrollView,
  Alert,
  Pressable,
  ActivityIndicator,
  TextInput,
  FlatList,
  StyleSheet,
} from 'react-native'
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import BarcodeVisual from '@/components/ui/BarcodeVisual'
import { useBatchStore } from '@/stores/batchStore'
import { formatDate, formatCurrency, formatDateTime } from '@/utils/formatters'
import { supabase } from '@/lib/supabase'
import { useCompanyStore } from '@/stores/companyStore'
import { generateLabelHtml, calculateLabelLayout, PAPER_SIZES, LABEL_SIZES, type BatchLabelItem } from '@/utils/labelPrinter'
import { savePdfToLocal } from '@/services/pdf/savePdf'
import {
  canTransitionStatus,
  getAllowedTransitions,
  getTransitionRequirements,
  getStatusColor,
  colors,
  spacing,
  radius,
  typography,
} from '@/constants'
import type { BatchStatus, BatchStatusLog } from '@/types'

function BadgePill({ status }: { status: BatchStatus }) {
  // Map status to pastel colors: orange (#fb923c), pink (#ec4899), violet (#8b5cf6), emerald (#34d399)
  let bgColor = '#e5e7eb'
  switch (status) {
    case 'DRAFT':
    case 'RESERVED':
      bgColor = '#fb923c'
      break
    case 'ACTIVE':
    case 'AVAILABLE':
      bgColor = '#34d399'
      break
    case 'PARTIALLY_SOLD':
    case 'SOLD_OUT':
      bgColor = '#ec4899'
      break
    case 'OBSOLETE':
    case 'ARCHIVED':
      bgColor = '#8b5cf6'
      break
  }

  return (
    <View
      style={{
        backgroundColor: bgColor,
        borderRadius: radius.pill,
        paddingHorizontal: 12,
        paddingVertical: 4,
        alignSelf: 'flex-start',
      }}
    >
      <Text
        style={{
          fontFamily: typography.font.sansMedium,
          fontSize: 13,
          fontWeight: '500',
          color: colors.ink,
        }}
      >
        {status}
      </Text>
    </View>
  )
}

// Transitions that should redirect to transaction page instead of just changing status
const REDIRECT_TO_TRANSACTION: BatchStatus[] = ['PARTIALLY_SOLD', 'SOLD_OUT']

export default function StockDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const batchStore = useBatchStore()
  const companyStore = useCompanyStore()
  const { selectedBatch, loading } = batchStore

  const [showStatusChange, setShowStatusChange] = useState(false)
  const [targetStatus, setTargetStatus] = useState<BatchStatus | null>(null)
  const [companyName, setCompanyName] = useState('')
  const [note, setNote] = useState('')
  const [changingStatus, setChangingStatus] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [statusLogs, setStatusLogs] = useState<BatchStatusLog[]>([])

  // Company search
  const [companySuggestions, setCompanySuggestions] = useState<string[]>([])
  const [companySearch, setCompanySearch] = useState('')
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false)
  // Reserved-company name (for RESERVED batches)
  const [reservedBy, setReservedBy] = useState<string | null>(null)
  // Associated company names from transactions
  const [associatedCompanies, setAssociatedCompanies] = useState<string[]>([])

  useEffect(() => {
    if (id) batchStore.fetchBatchById(id)
  }, [id])

  // Fetch companies on mount for dropdown
  useEffect(() => {
    companyStore.fetchCompanies()
  }, [])

  // Fetch associated company names for RESERVED, PARTIALLY_SOLD, SOLD_OUT batches
  useEffect(() => {
    const statusesToShow = ['RESERVED', 'PARTIALLY_SOLD', 'SOLD_OUT']
    if (selectedBatch && statusesToShow.includes(selectedBatch.status)) {
      supabase
        .from('sales_transaction')
        .select('company_name')
        .eq('batch_id', selectedBatch.batch_id)
        .then(({ data, error }) => {
          if (!error && data) {
            const comps = data
              .map((item: any) => item.company_name)
              .filter(Boolean)
            const uniqueComps = Array.from(new Set(comps))
            setAssociatedCompanies(uniqueComps)
            // fallback reservedBy for redirect parameters
            if (uniqueComps.length > 0) {
              setReservedBy(uniqueComps[0])
            } else {
              setReservedBy(null)
            }
          } else {
            setAssociatedCompanies([])
            setReservedBy(null)
          }
        })
    } else {
      setAssociatedCompanies([])
      setReservedBy(null)
    }
  }, [selectedBatch?.batch_id, selectedBatch?.status])

  // Fetch status history
  useEffect(() => {
    if (!id) return
    supabase
      .from('batch_status_log')
      .select('*')
      .eq('batch_id', id)
      .order('changed_at', { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) setStatusLogs(data as BatchStatusLog[])
      })
  }, [id])

  // Filter company suggestions as user types
  useEffect(() => {
    if (!companySearch.trim()) {
      setCompanySuggestions([])
      return
    }
    const q = companySearch.toLowerCase()
    const matches = companyStore.companies
      .filter((c) => c.company_name.toLowerCase().includes(q))
      .map((c) => c.company_name)
    setCompanySuggestions(matches.slice(0, 10))
  }, [companySearch, companyStore.companies])

  if (loading || !selectedBatch) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color="#3B82F6" size="large" />
      </View>
    )
  }

  const batch = selectedBatch
  const variant = batch.variant
  const product = variant?.product
  const productType = (product as any)?.type
  const color = getStatusColor(batch.status)
  const allowedTransitions = getAllowedTransitions(batch.status)
  const pct = ((batch.current_qty / batch.initial_qty) * 100).toFixed(1)
  const effectivePrice = (product?.base_price ?? 0) + (variant?.price_modifier ?? 0)
  const isLow = batch.current_qty / batch.initial_qty <= 0.05

  const handleStatusAction = (status: BatchStatus) => {
    // Redirect to transaction for PARTIALLY_SOLD / SOLD_OUT
    if (REDIRECT_TO_TRANSACTION.includes(status)) {
      router.push({
        pathname: '/transaction/create',
        params: {
          batchCode: batch.batch_code,
          company: reservedBy || companyName || undefined,
        },
      })
      return
    }

    setTargetStatus(status)
    setShowStatusChange(true)
    setCompanyName('')
    setCompanySearch('')
    setNote('')
  }

  const handleSubmitStatusChange = async () => {
    if (!targetStatus) return
    const req = getTransitionRequirements(batch.status, targetStatus)

    if (req?.requiresCompany && !companyName.trim()) {
      Alert.alert('Error', 'Nama perusahaan WAJIB diisi')
      return
    }
    if (req?.requiresNote && !note.trim()) {
      Alert.alert('Error', 'Alasan WAJIB diisi')
      return
    }

    setChangingStatus(true)
    try {
      await batchStore.updateBatchStatus(batch.batch_id, {
        new_status: targetStatus,
        company_name: companyName || undefined,
        note: note || undefined,
      })
      Alert.alert('Berhasil', `Status: ${batch.status} → ${targetStatus}`)
      setShowStatusChange(false)
      batchStore.fetchBatchById(batch.batch_id)
    } catch (err: any) {
      Alert.alert('Error', err.message)
    } finally {
      setChangingStatus(false)
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Product Details Section */}
        <View style={styles.headerSection}>
          <View style={styles.headerTopRow}>
            <Text style={styles.batchCodeText}>{batch.batch_code}</Text>
            <BadgePill status={batch.status} />
          </View>

          <Text style={styles.productTitle}>
            {product?.product_name ?? '—'}
          </Text>
          <Text style={styles.productSku}>
            {variant?.sku_full ?? '—'}
          </Text>

          <View style={styles.barcodeWrapper}>
            <BarcodeVisual code={batch.batch_code} height={50} />
          </View>

          {isLow && (
            <View style={styles.lowStockAlert}>
              <Text style={styles.lowStockText}>Stok menipis: {pct}% tersisa</Text>
            </View>
          )}

          {/* Technical Details directly below it */}
          <View style={styles.techDetails}>
            <View style={styles.techRow}>
              <Text style={styles.techLabel}>Jenis</Text>
              <Text style={styles.techValue}>
                [{productType?.type_code ?? '—'}] {productType?.type_name ?? '—'}
              </Text>
            </View>
            
            <View style={styles.techRow}>
              <Text style={styles.techLabel}>Versi</Text>
              <Text style={styles.techValue}>{product?.version ?? '—'}</Text>
            </View>

            <View style={styles.techRow}>
              <Text style={styles.techLabel}>Finishing</Text>
              <Text style={styles.techValue}>{variant?.finishing ?? '—'}</Text>
            </View>

            {associatedCompanies.length > 0 && (
              <View style={{ borderBottomWidth: 1, borderBottomColor: colors.hairlineSoft, paddingVertical: spacing.sm }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={styles.techLabel}>
                    {batch.status === 'RESERVED' ? 'Dipesan oleh' : 'Terjual ke'}
                  </Text>
                  <Text style={[styles.techValue, styles.reservedByText, { textAlign: 'right' }]}>
                    {associatedCompanies[0]}
                  </Text>
                </View>
                {associatedCompanies.slice(1).map((compName, idx) => (
                  <View key={idx} style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 }}>
                    <Text style={[styles.techValue, styles.reservedByText, { textAlign: 'right' }]}>
                      {compName}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.techRow}>
              <Text style={styles.techLabel}>Tanggal Masuk</Text>
              <Text style={styles.techValue}>{formatDate(batch.entry_date)}</Text>
            </View>

            {batch.production_date && (
              <View style={styles.techRow}>
                <Text style={styles.techLabel}>Tanggal Produksi</Text>
                <Text style={styles.techValue}>{formatDate(batch.production_date)}</Text>
              </View>
            )}

            {/* Harga Efektif - prominent using typography.title-sm */}
            <View style={[styles.techRow, styles.hargaRow]}>
              <Text style={styles.hargaLabel}>Harga Efektif</Text>
              <Text style={styles.hargaValue}>{formatCurrency(effectivePrice)}</Text>
            </View>
          </View>
        </View>

        {/* Stock Meter / Status Stok */}
        <Card style={styles.stockCard}>
          <Text style={styles.sectionTitle}>Status Stok</Text>
          <View style={styles.meterRow}>
            <View style={styles.meterBarBg}>
              <View
                style={[
                  styles.meterFill,
                  {
                    width: `${Math.min(100, parseFloat(pct))}%`,
                    backgroundColor:
                      parseFloat(pct) > 50
                        ? colors.success
                        : parseFloat(pct) > 20
                        ? colors.warning
                        : colors.error,
                  },
                ]}
              />
            </View>
            <Text style={styles.meterText}>{pct}%</Text>
          </View>

          <View style={styles.infoGrid}>
            <View style={styles.infoBlock}>
              <Text style={styles.infoBlockValue}>{batch.initial_qty}</Text>
              <Text style={styles.infoBlockLabel}>Stok Awal</Text>
            </View>
            <View style={styles.infoBlock}>
              <Text style={[styles.infoBlockValue, { color: colors.ink }]}>
                {batch.current_qty}
              </Text>
              <Text style={styles.infoBlockLabel}>Stok Saat Ini</Text>
            </View>
            <View style={styles.infoBlock}>
              <Text style={styles.infoBlockValue}>
                {batch.initial_qty - batch.current_qty}
              </Text>
              <Text style={styles.infoBlockLabel}>Terjual/Dipakai</Text>
            </View>
          </View>

          {effectivePrice > 0 && (
            <View style={styles.totalValueRow}>
              <Text style={styles.totalValueLabel}>Total Nilai</Text>
              <Text style={styles.totalValueAmount}>
                {formatCurrency(batch.current_qty * effectivePrice)}
              </Text>
            </View>
          )}
        </Card>

        {/* Histori Status */}
        {statusLogs.length > 0 && (
          <Card style={styles.historyCard}>
            <Text style={styles.sectionTitle}>Histori Status</Text>
            <View style={styles.timeline}>
              {statusLogs.map((log, i) => (
                <View key={log.log_id ?? i} style={styles.timelineItem}>
                  <View style={styles.timelineIndicators}>
                    <View style={styles.timelineDot} />
                    {i < statusLogs.length - 1 && <View style={styles.timelineLine} />}
                  </View>
                  <View style={styles.timelineContent}>
                    <Text style={styles.timelineDate}>{formatDateTime(log.changed_at)}</Text>
                    
                    <View style={styles.timelineTransitionRow}>
                      {log.old_status ? (
                        <>
                          <BadgePill status={log.old_status} />
                          <Text style={styles.transitionArrow}>→</Text>
                        </>
                      ) : (
                        <>
                          <View style={styles.newStatusPill}>
                            <Text style={styles.newStatusPillText}>BARU</Text>
                          </View>
                          <Text style={styles.transitionArrow}>→</Text>
                        </>
                      )}
                      <BadgePill status={log.new_status} />
                    </View>
                    
                    {log.note && (
                      <View style={styles.noteContainer}>
                        <Text style={styles.timelineNoteLabel}>Catatan</Text>
                        <Text style={styles.timelineNote}>{log.note}</Text>
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </View>
          </Card>
        )}

        {/* Actions Section ('Ubah Status') */}
        {allowedTransitions.length > 0 && (
          <Card style={styles.actionContainerCard}>
            <Text style={styles.statusActionTitle}>
              Ubah Status ({batch.status})
            </Text>
            <View style={styles.statusPillsGrid}>
              {allowedTransitions.map((status) => {
                const isRedirect = REDIRECT_TO_TRANSACTION.includes(status)
                const req = getTransitionRequirements(batch.status, status)
                return (
                  <Pressable
                    key={status}
                    style={({ pressed }) => [
                      styles.statusPillBtn,
                      pressed && styles.statusPillBtnPressed,
                    ]}
                    onPress={() => handleStatusAction(status)}
                  >
                    <Text style={styles.statusPillBtnText}>
                      {status}
                      {isRedirect ? ' →' : ''}
                      {req ? ' *' : ''}
                    </Text>
                    {isRedirect && (
                      <Text style={styles.statusPillBtnSubtitle}>Lanjut ke Transaksi</Text>
                    )}
                  </Pressable>
                )
              })}
            </View>
          </Card>
        )}

        {/* Status Change Form */}
        {showStatusChange && targetStatus && (
          <Card style={styles.formCard}>
            <Text style={styles.formTitle}>
              Konfirmasi: {batch.status} → {targetStatus}
            </Text>

            {(() => {
              const req = getTransitionRequirements(batch.status, targetStatus)
              return req ? <Text style={styles.reqHint}>{req.description}</Text> : null
            })()}

            {/* Company Search (autocomplete) */}
            {getTransitionRequirements(batch.status, targetStatus)?.requiresCompany && (
              <View style={{ marginBottom: spacing.xs }}>
                <Text style={styles.compLabel}>Nama Perusahaan (WAJIB)</Text>
                <TextInput
                  style={styles.compInput}
                  value={companySearch}
                  onChangeText={(t) => {
                    setCompanySearch(t)
                    setShowCompanyDropdown(true)
                    if (!t.trim()) setCompanyName('')
                  }}
                  onFocus={() => setShowCompanyDropdown(true)}
                  placeholder="Ketik nama perusahaan..."
                  placeholderTextColor={colors.mutedSoft}
                  autoCapitalize="words"
                />
                {showCompanyDropdown && companySuggestions.length > 0 && (
                  <View style={styles.dropdown}>
                    <FlatList
                      data={companySuggestions}
                      keyExtractor={(item) => item}
                      style={{ maxHeight: 160 }}
                      renderItem={({ item }) => (
                        <Pressable
                          style={styles.dropItem}
                          onPress={() => {
                            setCompanySearch(item)
                            setCompanyName(item)
                            setShowCompanyDropdown(false)
                          }}
                        >
                          <Text style={styles.dropItemText}>{item}</Text>
                        </Pressable>
                      )}
                    />
                    {!companyStore.companies.some((c) => c.company_name.toLowerCase() === companySearch.toLowerCase()) &&
                      companySearch.trim().length >= 2 && (
                        <Pressable
                          style={styles.dropNew}
                          onPress={() => {
                            setCompanyName(companySearch.trim())
                            setShowCompanyDropdown(false)
                          }}
                        >
                          <Text style={styles.dropNewText}>+ Buat baru: &ldquo;{companySearch.trim()}&rdquo;</Text>
                        </Pressable>
                      )}
                  </View>
                )}
                {companyName ? (
                  <Text style={styles.compSelected}>✓ Perusahaan terpilih: {companyName}</Text>
                ) : null}
              </View>
            )}

            <View style={{ height: spacing.xxs }} />

            <Input
              label="Catatan / Alasan"
              value={note}
              onChangeText={setNote}
              placeholder="Masukkan catatan alasan perubahan status..."
              multiline
              numberOfLines={2}
            />

            <View style={{ height: spacing.xs }} />

            <View style={styles.confirmActionRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.btnFormCancel,
                  pressed && { backgroundColor: colors.surfaceSoft }
                ]}
                onPress={() => setShowStatusChange(false)}
              >
                <Text style={styles.btnFormCancelText}>Batal</Text>
              </Pressable>
              
              <Pressable
                style={({ pressed }) => [
                  styles.btnFormConfirm,
                  pressed && { backgroundColor: colors.primaryActive }
                ]}
                onPress={handleSubmitStatusChange}
                disabled={changingStatus}
              >
                {changingStatus ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.btnFormConfirmText}>Konfirmasi</Text>
                )}
              </Pressable>
            </View>
          </Card>
        )}

        {/* Primary Actions */}
        <View style={styles.quickActions}>
          <Pressable
            style={({ pressed }) => [
              styles.btnPrimary,
              pressed && { backgroundColor: colors.primaryActive }
            ]}
            onPress={() =>
              router.push({
                pathname: '/transaction/create',
                params: {
                  batchCode: batch.batch_code,
                  company: reservedBy || undefined,
                },
              })
            }
          >
            <Text style={styles.btnPrimaryText}>Buat Transaksi</Text>
          </Pressable>
          
          <Pressable
            style={({ pressed }) => [
              { 
                backgroundColor: colors.surfaceCard,
                borderWidth: 1,
                borderColor: colors.hairline,
                borderRadius: radius.md,
                paddingVertical: 12,
                paddingHorizontal: 16,
                alignItems: 'center',
                marginTop: 8,
              },
              pressed && { backgroundColor: colors.surfaceSoft }
            ]}
            onPress={async () => {
              if (!batch) return
              setPrinting(true)
              try {
                const variant = batch.variant
                const product = variant?.product
                const items: BatchLabelItem[] = [{
                  batchCode: batch.batch_code, batchIndex: 1,
                  status: batch.status,
                  productName: product?.product_name ?? '',
                  sku: variant?.sku_full ?? '',
                  barcodeUrl: (batch as any).barcode_url ?? '',
                  qtyPerBatch: batch.initial_qty,
                }]
                const config = calculateLabelLayout(PAPER_SIZES[0], LABEL_SIZES[0], 1)
                const html = await generateLabelHtml(items, config)
                await savePdfToLocal({ defaultFileName: `Label_${batch.batch_code}`, htmlContent: html })
              } catch (err: any) {
                Alert.alert('Gagal Cetak', err.message ?? '')
              } finally { setPrinting(false) }
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.ink, textAlign: 'center' }}>🖨️ Cetak Ulang Label</Text>
          </Pressable>
          
          <Pressable
            style={({ pressed }) => [
              styles.btnSecondaryDanger,
              pressed && { backgroundColor: colors.surfaceSoft }
            ]}
            onPress={() => {
              Alert.alert('Pindah ke Trash', `Batch ${batch.batch_code} akan dipindahkan ke trash.`, [
                { text: 'Batal', style: 'cancel' },
                {
                  text: 'Pindahkan',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await batchStore.softDeleteBatch(batch.batch_id)
                      Alert.alert('Berhasil', 'Batch dipindahkan ke trash')
                      router.back()
                    } catch (err: any) {
                      Alert.alert('Error', err.message)
                    }
                  },
                },
              ])
            }}
          >
            <Text style={styles.btnSecondaryDangerText}>Pindah ke Trash</Text>
          </Pressable>
        </View>

        <View style={{ height: spacing.lg }} />
      </ScrollView>
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
  content: {
    padding: spacing.md,
    gap: spacing.md,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  headerSection: {
    backgroundColor: '#ffffff',
    paddingVertical: spacing.xs,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  batchCodeText: {
    fontFamily: typography.font.mono,
    fontSize: 14,
    color: colors.muted,
  },
  productTitle: {
    fontFamily: typography.font.sansSemiBold,
    fontSize: 24,
    color: colors.ink,
    fontWeight: '600',
    letterSpacing: -0.96, // 24 * -0.04
    lineHeight: 28,
  },
  productSku: {
    fontFamily: typography.font.sansSemiBold,
    fontSize: 16,
    color: colors.muted,
    fontWeight: '600',
    letterSpacing: -0.64, // 16 * -0.04
    marginTop: spacing.xxs,
    marginBottom: spacing.md,
  },
  barcodeWrapper: {
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  lowStockAlert: {
    backgroundColor: '#EF444415',
    borderRadius: radius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: '#EF444430',
    marginBottom: spacing.sm,
  },
  lowStockText: {
    fontFamily: typography.font.sansSemiBold,
    fontSize: 12,
    color: colors.error,
    fontWeight: '600',
    textAlign: 'center',
  },
  techDetails: {
    marginTop: spacing.xs,
  },
  techRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairlineSoft,
  },
  techLabel: {
    fontFamily: typography.font.sans,
    fontSize: 13,
    color: colors.muted,
  },
  techValue: {
    fontFamily: typography.font.sansMedium,
    fontSize: 13,
    color: colors.ink,
  },
  hargaRow: {
    borderBottomWidth: 0,
    backgroundColor: colors.surfaceSoft,
    padding: spacing.sm,
    borderRadius: radius.md,
    marginTop: spacing.sm,
  },
  hargaLabel: {
    fontFamily: typography.font.sansSemiBold,
    fontSize: 14,
    color: colors.muted,
  },
  hargaValue: {
    fontFamily: typography.font.sansBold,
    fontSize: 16,
    color: colors.ink,
    fontWeight: '600',
  },
  reservedByText: {
    color: colors.brand,
    fontWeight: '600',
  },
  stockCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  sectionTitle: {
    fontFamily: typography.font.sansSemiBold,
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  meterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  meterBarBg: {
    flex: 1,
    height: 10,
    backgroundColor: colors.canvas,
    borderRadius: 5,
    overflow: 'hidden',
  },
  meterFill: {
    height: '100%',
    borderRadius: 5,
  },
  meterText: {
    fontFamily: typography.font.sansBold,
    fontSize: 18,
    fontWeight: '600',
    color: colors.ink,
    minWidth: 50,
    textAlign: 'right',
  },
  infoGrid: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  infoBlock: {
    flex: 1,
    backgroundColor: colors.canvas,
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  infoBlockValue: {
    fontFamily: typography.font.sansBold,
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
  },
  infoBlockLabel: {
    fontFamily: typography.font.sans,
    fontSize: 10,
    color: colors.muted,
    marginTop: 2,
  },
  totalValueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  totalValueLabel: {
    fontFamily: typography.font.sans,
    fontSize: 14,
    color: colors.muted,
  },
  totalValueAmount: {
    fontFamily: typography.font.sansBold,
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
  },
  historyCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  timeline: {
    paddingLeft: spacing.xxs,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  timelineIndicators: {
    alignItems: 'center',
    marginRight: spacing.sm,
    width: 16,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.ink,
    marginTop: 8,
  },
  timelineLine: {
    position: 'absolute',
    left: 7.5,
    top: 16,
    width: 1,
    bottom: -16,
    backgroundColor: colors.hairline,
  },
  timelineContent: {
    flex: 1,
  },
  timelineDate: {
    fontFamily: typography.font.sans,
    fontSize: 11,
    color: colors.muted,
    marginBottom: spacing.xxs,
  },
  timelineTransitionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xxs,
  },
  transitionArrow: {
    fontFamily: typography.font.sans,
    fontSize: 14,
    color: colors.muted,
  },
  newStatusPill: {
    backgroundColor: colors.surfaceStrong,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  newStatusPillText: {
    fontFamily: typography.font.sansMedium,
    fontSize: 13,
    fontWeight: '500',
    color: colors.ink,
  },
  noteContainer: {
    marginTop: spacing.xxs,
    backgroundColor: '#ffffff',
    padding: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
  },
  timelineNoteLabel: {
    fontFamily: typography.font.sansMedium,
    fontSize: 11,
    color: colors.muted,
  },
  timelineNote: {
    fontFamily: typography.font.sans,
    fontSize: 12,
    color: colors.body,
    marginTop: 2,
  },
  actionContainerCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  statusActionTitle: {
    fontFamily: typography.font.sansSemiBold,
    fontSize: 14,
    color: colors.muted,
    marginBottom: spacing.sm,
  },
  statusPillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  statusPillBtn: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.hairline,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    minHeight: 44,
  },
  statusPillBtnPressed: {
    backgroundColor: colors.surfaceStrong,
  },
  statusPillBtnText: {
    fontFamily: typography.font.sansSemiBold,
    fontSize: 13,
    color: colors.ink,
    textAlign: 'center',
  },
  statusPillBtnSubtitle: {
    fontFamily: typography.font.sans,
    fontSize: 10,
    color: colors.muted,
    marginTop: 2,
  },
  formCard: {
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.lg,
    padding: spacing.md,
    backgroundColor: '#ffffff',
  },
  formTitle: {
    fontFamily: typography.font.sansSemiBold,
    fontSize: 15,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  reqHint: {
    fontFamily: typography.font.sans,
    fontSize: 12,
    color: colors.warning,
    marginBottom: spacing.sm,
  },
  compLabel: {
    fontFamily: typography.font.sansSemiBold,
    fontSize: 13,
    color: colors.body,
    marginBottom: 4,
  },
  compInput: {
    fontFamily: typography.font.sans,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    padding: 10,
    fontSize: 14,
    color: colors.ink,
  },
  dropdown: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    marginTop: 4,
    maxHeight: 160,
    overflow: 'hidden',
  },
  dropItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceSoft,
  },
  dropItemText: {
    fontFamily: typography.font.sans,
    fontSize: 13,
    color: colors.body,
  },
  dropNew: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.brand + '10',
  },
  dropNewText: {
    fontFamily: typography.font.sansSemiBold,
    fontSize: 13,
    color: colors.brand,
  },
  compSelected: {
    fontFamily: typography.font.sansMedium,
    fontSize: 12,
    color: colors.success,
    marginTop: 4,
  },
  confirmActionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  btnFormCancel: {
    flex: 1,
    height: 40,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: '#ffffff',
  },
  btnFormCancelText: {
    fontFamily: typography.font.sansMedium,
    fontSize: 14,
    color: colors.ink,
  },
  btnFormConfirm: {
    flex: 1,
    height: 40,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primary,
  },
  btnFormConfirmText: {
    fontFamily: typography.font.sansSemiBold,
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '600',
  },
  quickActions: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  btnPrimary: {
    backgroundColor: '#111111',
    height: 40,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  btnPrimaryText: {
    fontFamily: typography.font.sansSemiBold,
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '600',
  },
  btnSecondaryDanger: {
    backgroundColor: '#ffffff',
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  btnSecondaryDangerText: {
    fontFamily: typography.font.sansSemiBold,
    fontSize: 14,
    color: colors.error,
    fontWeight: '600',
  },
})
