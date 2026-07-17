import { useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  FlatList,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { useBatchStore } from '@/stores/batchStore'
import { useCompanyStore } from '@/stores/companyStore'
import { supabase } from '@/lib/supabase'
import {
  colors,
  typography,
  radius,
  spacing,
  getAllowedTransitions,
  getTransitionRequirements,
  getStatusColor,
} from '@/constants'
import type { BatchStatus } from '@/types'

const REDIRECT_TO_TRANSACTION: BatchStatus[] = ['PARTIALLY_SOLD', 'SOLD_OUT']

export default function StatusChangeScreen() {
  const { batch_id, target_status } = useLocalSearchParams<{
    batch_id: string
    target_status?: string
  }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const batchStore = useBatchStore()
  const companyStore = useCompanyStore()
  const { selectedBatch, loading } = batchStore

  const [targetStatus, setTargetStatus] = useState<BatchStatus | null>(
    (target_status as BatchStatus) ?? null,
  )
  const [companyName, setCompanyName] = useState('')
  const [note, setNote] = useState('')
  const [changingStatus, setChangingStatus] = useState(false)

  // Company search
  const [companySuggestions, setCompanySuggestions] = useState<string[]>([])
  const [companySearch, setCompanySearch] = useState('')
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false)

  useEffect(() => {
    if (batch_id) batchStore.fetchBatchById(batch_id)
  }, [batch_id])

  useEffect(() => {
    if (target_status) setTargetStatus(target_status as BatchStatus)
  }, [target_status])

  // Fetch companies from master data
  useEffect(() => {
    companyStore.fetchCompanies()
  }, [])

  // Filter company suggestions
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
        <ActivityIndicator color={colors.brand} size="large" />
      </View>
    )
  }

  const batch = selectedBatch
  const variant = batch.variant
  const product = variant?.product
  const effectivePrice = (product?.base_price ?? 0) + (variant?.price_modifier ?? 0)
  const currentColor = getStatusColor(batch.status)
  const allowedTransitions = getAllowedTransitions(batch.status)

  const handleSelectTarget = (status: BatchStatus) => {
    // Redirect to transaction for PARTIALLY_SOLD / SOLD_OUT
    if (REDIRECT_TO_TRANSACTION.includes(status)) {
      router.push({
        pathname: '/transaction/create',
        params: {
          batchCode: batch.batch_code,
        },
      })
      return
    }

    setTargetStatus(status)
    setCompanyName('')
    setCompanySearch('')
    setNote('')
  }

  const handleSubmit = async () => {
    if (!targetStatus) {
      Alert.alert('Error', 'Pilih status tujuan terlebih dahulu')
      return
    }

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
      Alert.alert('Berhasil', `Status berhasil diubah: ${batch.status} → ${targetStatus}`, [
        { text: 'OK', onPress: () => router.back() },
      ])
    } catch (err: any) {
      Alert.alert('Error', err.message)
    } finally {
      setChangingStatus(false)
    }
  }

  const currentReq = targetStatus ? getTransitionRequirements(batch.status, targetStatus) : null
  const targetColor = targetStatus ? getStatusColor(targetStatus) : null

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.appBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Kembali</Text>
        </Pressable>
        <Text style={styles.appBarTitle}>Ubah Status</Text>
        <View style={styles.backBtn} />
      </View>

      {/* Current Status */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Status Saat Ini</Text>
        <View style={styles.statusRow}>
          <Badge status={batch.status} />
          <Text style={styles.batchCode}>{batch.batch_code}</Text>
        </View>
        <Text style={styles.productName} numberOfLines={2}>
          {product?.product_name ?? '—'}
          {variant ? ` · ${variant.sku_full}` : ''}
        </Text>
        <Text style={styles.stockInfo}>
          Stok: {batch.current_qty} / {batch.initial_qty} pcs
        </Text>
      </View>

      {/* Target Status */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Pilih Status Tujuan</Text>
        {allowedTransitions.length === 0 ? (
          <Text style={styles.noTransition}>
            Tidak ada perubahan status yang diizinkan dari status {currentColor.label}
          </Text>
        ) : (
          <View style={styles.transitionGrid}>
            {allowedTransitions.map((status) => {
              const sc = getStatusColor(status)
              const req = getTransitionRequirements(batch.status, status)
              const isSelected = targetStatus === status
              const isRedirect = REDIRECT_TO_TRANSACTION.includes(status)
              return (
                <Pressable
                  key={status}
                  style={[
                    styles.transitionChip,
                    isSelected && {
                      backgroundColor: sc.background + '22',
                      borderColor: sc.background,
                      borderWidth: 2,
                    },
                  ]}
                  onPress={() => handleSelectTarget(status)}
                >
                  <Text
                    style={[
                      styles.transitionChipText,
                      isSelected && { color: sc.background, fontWeight: '700' },
                    ]}
                  >
                    {sc.icon} {sc.label}{isRedirect ? ' →' : ''}{req ? ' *' : ''}
                  </Text>
                  <Text style={styles.transitionHint}>
                    {isRedirect ? '→ Transaksi' : req?.description ?? ''}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        )}
      </View>

      {/* Change Form */}
      {targetStatus && !REDIRECT_TO_TRANSACTION.includes(targetStatus) && (
        <View style={[styles.card, styles.formCard]}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>
              {currentColor.icon} {currentColor.label} → {targetColor?.icon} {targetColor?.label}
            </Text>
          </View>

          {currentReq?.description && (
            <View style={styles.reqBox}>
              <Text style={styles.reqText}>⚠️ {currentReq.description}</Text>
            </View>
          )}

          {/* Company Search (autocomplete) */}
          {currentReq?.requiresCompany && (
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Nama Perusahaan (WAJIB)</Text>
              <TextInput
                style={styles.input}
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
                <Text style={styles.compSelected}>✅ {companyName}</Text>
              ) : null}
            </View>
          )}

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>
              Catatan{currentReq?.requiresNote ? ' (WAJIB)' : ' (opsional)'}
            </Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={note}
              onChangeText={setNote}
              placeholder={
                currentReq?.requiresNote ? 'Alasan perubahan status...' : 'Opsional...'
              }
              placeholderTextColor={colors.mutedSoft}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.actionRow}>
            <Button title="Batal" variant="outline" size="md" onPress={() => setTargetStatus(null)} />
            <Button
              title="Konfirmasi Perubahan"
              variant="primary"
              size="md"
              onPress={handleSubmit}
              loading={changingStatus}
              disabled={changingStatus}
            />
          </View>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: spacing.md, gap: 12 },
  loader: { flex: 1, backgroundColor: colors.canvas, justifyContent: 'center', alignItems: 'center' },
  appBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacing.sm, marginBottom: spacing.xs,
  },
  backBtn: { paddingVertical: spacing.xxs, paddingHorizontal: spacing.xs, minWidth: 80 },
  backBtnText: { fontSize: typography.size.base, fontFamily: typography.font.sansSemiBold, color: colors.brand },
  appBarTitle: { fontSize: typography.size.lg, fontFamily: typography.font.sansSemiBold, color: colors.ink, textAlign: 'center' },
  card: {
    backgroundColor: colors.surfaceCard, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.hairline, padding: spacing.md,
  },
  sectionTitle: { fontSize: typography.size.base, fontFamily: typography.font.sansSemiBold, color: colors.ink, marginBottom: spacing.xs },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xxs },
  batchCode: { fontSize: typography.size.md, fontFamily: typography.font.mono, color: colors.ink, fontWeight: '700' },
  productName: { fontSize: typography.size.sm, color: colors.muted, marginTop: 2 },
  stockInfo: { fontSize: typography.size.sm, color: colors.muted, marginTop: 4 },
  noTransition: { fontSize: typography.size.base, color: colors.muted, textAlign: 'center', paddingVertical: spacing.md },
  transitionGrid: { gap: spacing.xs },
  transitionChip: {
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.hairline,
    backgroundColor: colors.canvas,
  },
  transitionChipText: { fontSize: typography.size.base, fontFamily: typography.font.sansSemiBold, color: colors.ink },
  transitionHint: { fontSize: typography.size.xs, color: colors.warning, marginTop: 4 },
  formCard: { borderColor: colors.brand, borderWidth: 2 },
  formHeader: {
    marginBottom: spacing.sm, paddingBottom: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.hairline,
  },
  formTitle: { fontSize: typography.size.md, fontFamily: typography.font.sansSemiBold, color: colors.ink },
  reqBox: {
    backgroundColor: colors.warning + '18', borderRadius: radius.sm,
    padding: spacing.sm, marginBottom: spacing.sm,
    borderWidth: 1, borderColor: colors.warning + '44',
  },
  reqText: { fontSize: typography.size.sm, color: colors.warning, fontFamily: typography.font.sansMedium },
  fieldGroup: { marginBottom: spacing.sm },
  label: { fontSize: typography.size.sm, fontFamily: typography.font.sansSemiBold, color: colors.body, marginBottom: spacing.xxs },
  input: {
    backgroundColor: colors.canvas, borderWidth: 1, borderColor: colors.hairline,
    borderRadius: radius.md, padding: spacing.sm, fontSize: typography.size.base, color: colors.ink,
  },
  textArea: { minHeight: 100, textAlignVertical: 'top', paddingTop: spacing.sm },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  // Company dropdown
  dropdown: {
    backgroundColor: colors.canvas, borderWidth: 1, borderColor: colors.hairline,
    borderRadius: 8, marginTop: 4, overflow: 'hidden',
  },
  dropItem: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.surfaceCard },
  dropItemText: { fontSize: 13, color: colors.body },
  dropNew: { paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.brand + '12' },
  dropNewText: { fontSize: 13, color: colors.brand, fontWeight: '600' },
  compSelected: { fontSize: 12, color: colors.success, marginTop: 4 },
})
