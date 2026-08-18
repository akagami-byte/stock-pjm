import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  View, Text, FlatList, ScrollView, Alert, ActivityIndicator, StyleSheet, Image, Pressable, Modal, TextInput,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { Icon } from '@/components/ui/Icon'
import { useCompanyStore } from '@/stores/companyStore'
import { useBatchStore } from '@/stores/batchStore'
import { useTransactionStore } from '@/stores/transactionStore'
import { uploadBarcodePresigned } from '@/services/s3/uploadBarcodePresigned'
import { formatDate, formatCurrency } from '@/utils/formatters'
import { colors, radius, spacing, typography } from '@/constants'
import type { Company, StockBatchWithDetails, SalesTransactionWithDetails } from '@/types'
import * as ImagePicker from 'expo-image-picker'


export default function CompanyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const companyStore = useCompanyStore()
  const { transactions, fetchTransactions } = useTransactionStore()

  const [company, setCompany] = useState<Company | null>(null)
  const [reservedBatches, setReservedBatches] = useState<StockBatchWithDetails[]>([])
  const [companyTransactions, setCompanyTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'info' | 'batch' | 'transaksi'>('info')
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null)

  // Edit Company State
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [addressInput, setAddressInput] = useState('')
  const [phoneInput, setPhoneInput] = useState('')
  const [imageUrlInput, setImageUrlInput] = useState('')
  const [companyImageUri, setCompanyImageUri] = useState<string | null>(null)
  const [uploadingCompanyImage, setUploadingCompanyImage] = useState(false)

  useEffect(() => {
    if (id) loadCompany(id)
    fetchTransactions()
  }, [id])

  // Transaksi penjualan khusus perusahaan ini (company_name free-text)
  const companyTx = useMemo(
    () => transactions.filter((t) => t.company_name === company?.company_name),
    [transactions, company]
  )

  // Agregasi per nama barang
  const soldItems = useMemo(() => {
    const map = new Map<string, SalesTransactionWithDetails[]>()
    for (const t of companyTx) {
      const name = t.batch?.variant?.product?.product_name ?? `Batch ${t.batch?.batch_code ?? '—'}`
      if (!map.has(name)) map.set(name, [])
      map.get(name)!.push(t)
    }
    return Array.from(map.entries()).map(([productName, items]) => ({
      productName,
      items,
      totalQty: items.reduce((sum, i) => sum + i.quantity_sold, 0),
      lastPrice: items[0]?.price_per_unit ?? 0,
    }))
  }, [companyTx])

  async function loadCompany(companyId: string) {
    setLoading(true)
    try {
      let c = companyStore.companies.find(c => c.company_id === companyId)
      if (!c) {
        await companyStore.fetchCompanies()
        c = companyStore.companies.find(c => c.company_id === companyId)
      }
      setCompany(c || null)
      if (c) {
        setAddressInput(c.address ?? '')
        setPhoneInput(c.phone ?? '')
        setImageUrlInput(c.image_url ?? '')
      }
    } catch {} finally { setLoading(false) }
  }

  const pickCompanyImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      Alert.alert('Izin Diperlukan', 'Akses galeri diperlukan untuk upload gambar')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    })

    if (!result.canceled && result.assets.length > 0) {
      setCompanyImageUri(result.assets[0].uri)
    }
  }

  const handleSaveCompany = async () => {
    if (!company) return
    setUploadingCompanyImage(true)
    try {
      let finalImageUrl: string | undefined = imageUrlInput.trim() || undefined

      if (companyImageUri) {
        try {
          const res = await uploadBarcodePresigned(
            companyImageUri,
            `company_${company.company_id}`,
            'companies/'
          )
          finalImageUrl = res.publicUrl
        } catch (err: any) {
          Alert.alert('Upload Gagal', err.message ?? 'Gagal upload gambar ke S3')
          setUploadingCompanyImage(false)
          return
        }
      }

      await companyStore.updateCompany(company.company_id, {
        address: addressInput.trim() || undefined,
        phone: phoneInput.trim() || undefined,
        image_url: finalImageUrl,
      })
      const updated = {
        ...company,
        address: addressInput.trim() || null,
        phone: phoneInput.trim() || null,
        image_url: finalImageUrl || null,
      }
      setCompany(updated)
      setImageUrlInput(finalImageUrl || '')
      setEditModalVisible(false)
      setCompanyImageUri(null)
      Alert.alert('Sukses', 'Data perusahaan berhasil diperbarui')
    } catch (e: any) {
      Alert.alert('Error', e?.message || String(e) || 'Gagal memperbarui perusahaan')
    } finally {
      setUploadingCompanyImage(false)
    }
  }

  const handleDeleteCompany = () => {
    if (!company) return
    Alert.alert('Hapus Perusahaan', 'Yakin hapus perusahaan', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          try {
            await companyStore.deleteCompany(company.company_id)
            Alert.alert('Sukses', 'Perusahaan berhasil dihapus')
            router.back()
          } catch (e: any) {
            Alert.alert('Error', e?.message ?? 'Gagal menghapus perusahaan')
          }
        },
      },
    ])
  }

  if (loading) return <View style={[styles.ctr, { paddingTop: insets.top }]}><ActivityIndicator color={colors.brand} /></View>
  if (!company) return (
    <View style={[styles.ctr, { paddingTop: insets.top }]}>
      <Text style={{ color: colors.error }}>Perusahaan tidak ditemukan</Text>
      <Button title="← Kembali" variant="ghost" onPress={() => router.back()} />
    </View>
  )

  return (
    <View style={[styles.ctr, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={{ padding: 4 }}>
          <Icon name="arrow-left" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.title}>{company.company_name}</Text>
        <Pressable
          style={styles.editBtn}
          onPress={() => setEditModalVisible(true)}
        >
          <Text style={styles.editBtnText}>✏️ Edit</Text>
        </Pressable>
        <Pressable
          style={[styles.editBtn, styles.deleteBtn]}
          onPress={handleDeleteCompany}
        >
          <Text style={[styles.editBtnText, { color: colors.error }]}>🗑</Text>
        </Pressable>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(['info','batch','transaksi'] as const).map(t => (
          <Pressable key={t} style={[styles.tab, tab===t&&styles.tabActive]} onPress={()=>setTab(t)}>
            <Text style={[styles.tabText, tab===t&&styles.tabTextActive]}>
              {t==='info'?'Info':t==='batch'?'Reserved':'Barang Terjual'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Tab Content */}
      {tab === 'info' && (
        <ScrollView contentContainerStyle={styles.content}>
          {company.image_url ? (
            <Image source={{ uri: company.image_url }} style={styles.img} />
          ) : (
            <View style={styles.imgPlaceholder}><Icon name="building" size={48} color={colors.mutedSoft} /></View>
          )}
          <Card>
            <View style={styles.row}><Text style={styles.lbl}>Nama</Text><Text style={styles.valDisabled}>{company.company_name} (Permanent)</Text></View>
            <View style={styles.row}><Text style={styles.lbl}>Alamat</Text><Text style={styles.val}>{company.address || '—'}</Text></View>
            <View style={styles.row}><Text style={styles.lbl}>Telepon</Text><Text style={styles.val}>{company.phone || '—'}</Text></View>
            <View style={styles.row}><Text style={styles.lbl}>Status</Text><Badge status={company.is_active ? 'ACTIVE' : 'ARCHIVED'} /></View>
          </Card>
        </ScrollView>
      )}

      {tab === 'batch' && (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={{ color: colors.muted, textAlign: 'center', padding: 24 }}>
            Fitur batch reserved akan tersedia setelah integrasi data reserved.
          </Text>
        </ScrollView>
      )}

      {tab === 'transaksi' && (
        <ScrollView contentContainerStyle={styles.content}>
          {soldItems.length === 0 ? (
            <Text style={{ color: colors.muted, textAlign: 'center', padding: 24 }}>
              Belum ada barang terjual untuk perusahaan ini.
            </Text>
          ) : (
            soldItems.map((item) => (
              <View key={item.productName} style={styles.soldCard}>
                <Pressable
                  onPress={() => setExpandedProduct(expandedProduct === item.productName ? null : item.productName)}
                >
                  <View style={styles.row}>
                    <Text style={styles.soldName} numberOfLines={1}>
                      {item.productName}
                    </Text>
                    <Text style={styles.soldPrice}>{formatCurrency(item.lastPrice)}</Text>
                  </View>
                  <Text style={styles.soldQty}>
                    Total {item.totalQty} pcs · {item.items.length} transaksi{' '}
                    {expandedProduct === item.productName ? '▼' : '▶'}
                  </Text>
                </Pressable>

                {expandedProduct === item.productName && (
                  <View style={styles.soldTxList}>
                    {item.items.map((t) => (
                      <Pressable
                        key={t.sales_id}
                        style={styles.soldTxRow}
                        onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: t.sales_id } })}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.soldTxInvoice}>{t.invoice_number ?? '—'}</Text>
                          <Text style={styles.soldTxDate}>{formatDate(t.transaction_date)}</Text>
                        </View>
                        <Text style={styles.soldTxQty}>{t.quantity_sold} pcs</Text>
                        <Text style={styles.soldTxPrice}>{formatCurrency(t.price_per_unit)}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* Modal Edit Company */}
      <Modal visible={editModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Data Perusahaan</Text>
            
            <Text style={styles.fieldLabel}>Nama Perusahaan (Tidak dapat diubah)</Text>
            <TextInput
              style={[styles.modalInput, styles.inputDisabled]}
              value={company.company_name}
              editable={false}
            />

            <Text style={styles.fieldLabel}>Alamat</Text>
            <TextInput
              style={styles.modalInput}
              value={addressInput}
              onChangeText={setAddressInput}
              placeholder="Alamat perusahaan..."
              placeholderTextColor={colors.mutedSoft}
            />

            <Text style={styles.fieldLabel}>Telepon</Text>
            <TextInput
              style={styles.modalInput}
              value={phoneInput}
              onChangeText={setPhoneInput}
              keyboardType="phone-pad"
              placeholder="Nomor telepon..."
              placeholderTextColor={colors.mutedSoft}
            />

            <Text style={styles.fieldLabel}>Gambar / Logo Perusahaan</Text>
            <Pressable
              style={{
                height: 120,
                backgroundColor: colors.surfaceCard,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: colors.hairline,
                borderStyle: 'dashed',
                justifyContent: 'center',
                alignItems: 'center',
                overflow: 'hidden',
                marginVertical: spacing.xs,
              }}
              onPress={pickCompanyImage}
            >
              {companyImageUri ? (
                <Image source={{ uri: companyImageUri }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
              ) : imageUrlInput ? (
                <Image source={{ uri: imageUrlInput }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
              ) : (
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 24, marginBottom: 4 }}>🏢</Text>
                  <Text style={{ fontSize: typography.size.sm, color: colors.muted }}>Ketuk untuk pilih logo dari galeri</Text>
                </View>
              )}
            </Pressable>

            {(companyImageUri || imageUrlInput) ? (
              <Button
                title="🔄 Ganti Gambar"
                variant="ghost"
                size="sm"
                onPress={pickCompanyImage}
              />
            ) : null}

            <View style={styles.modalActions}>
              <Button title="Batal" variant="ghost" onPress={() => { setEditModalVisible(false); setCompanyImageUri(null); }} />
              <Button
                title={uploadingCompanyImage ? "Uploading..." : "Simpan"}
                onPress={handleSaveCompany}
                loading={uploadingCompanyImage}
                disabled={uploadingCompanyImage}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  ctr: { flex: 1, backgroundColor: colors.canvas },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  title: { flex: 1, fontSize: 18, fontWeight: '700', color: colors.ink },
  editBtn: { backgroundColor: colors.surfaceCard, borderWidth: 1, borderColor: colors.hairline, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.sm },
  editBtnText: { fontSize: 13, fontWeight: '600', color: colors.ink },
  tabs: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 8 },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: colors.ink },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.muted },
  tabTextActive: { color: colors.ink },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  img: { width: '100%', height: 200, borderRadius: radius.lg, backgroundColor: colors.surfaceCard, resizeMode: 'cover' },
  imgPlaceholder: { width: '100%', height: 160, borderRadius: radius.lg, backgroundColor: colors.surfaceCard, justifyContent: 'center', alignItems: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.hairlineSoft },
  lbl: { fontSize: 13, color: colors.muted },
  val: { fontSize: 13, color: colors.body, fontWeight: '500' },
  valDisabled: { fontSize: 13, color: colors.muted, fontWeight: '500' },
  deleteBtn: { borderColor: colors.error + '55' },
  soldCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.md,
    gap: spacing.xxs,
  },
  soldName: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.ink },
  soldPrice: { fontSize: 14, fontWeight: '700', color: colors.success, fontFamily: typography.font.mono },
  soldQty: { fontSize: 12, color: colors.muted, marginTop: 2 },
  soldTxList: { marginTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.hairlineSoft, paddingTop: spacing.xs, gap: spacing.xxs },
  soldTxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  soldTxInvoice: { fontSize: 13, fontFamily: typography.font.mono, fontWeight: '600', color: colors.ink },
  soldTxDate: { fontSize: 11, color: colors.mutedSoft, marginTop: 2 },
  soldTxQty: { fontSize: 12, color: colors.body, fontWeight: '600' },
  soldTxPrice: { fontSize: 12, color: colors.success, fontWeight: '700', fontFamily: typography.font.mono },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: spacing.md },
  modalCard: { width: '100%', backgroundColor: colors.canvas, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.xs },
  modalTitle: { fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.ink, marginBottom: spacing.xs },
  fieldLabel: { fontSize: typography.size.sm, fontWeight: typography.weight.medium, color: colors.body, marginTop: 4 },
  modalInput: { backgroundColor: colors.surfaceCard, borderWidth: 1, borderColor: colors.hairline, borderRadius: radius.md, padding: spacing.sm, fontSize: typography.size.base, color: colors.ink, marginBottom: spacing.xs },
  inputDisabled: { backgroundColor: colors.surfaceSoft, color: colors.muted },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.sm },
})
