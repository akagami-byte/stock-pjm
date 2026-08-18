import { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  Pressable,
  TextInput,
  ActivityIndicator,
  Image,
  Alert,
  Modal,
  StyleSheet,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useCameraPermissions } from 'expo-camera'
import Button from '@/components/ui/Button'
import StockScanner from '@/components/scanner/StockScanner'
import { useProductStore } from '@/stores/productStore'
import { useCompanyStore } from '@/stores/companyStore'
import { colors, typography, radius, spacing } from '@/constants'
import type { ProductType, Company } from '@/types'

type MasterTab = 'produk' | 'perusahaan'

// QR produk: EAS-00-C-AA0001 → type_code=EAS, version=00
const PRODUCT_SKU_REGEX = /^([A-Z0-9]{1,8})-(\d{1,2})-[A-Z]-[A-Z]{2}\d{4}$/

export default function MasterScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { productTypes, products, loading, error, fetchProductTypes, fetchProducts } = useProductStore()
  const companyStore = useCompanyStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [tab, setTab] = useState<MasterTab>('produk')

  // QR scanner modal
  const [scanModalVisible, setScanModalVisible] = useState(false)
  const [permission, requestPermission] = useCameraPermissions()

  useEffect(() => {
    fetchProductTypes()
    fetchProducts()
  }, [])

  const handleRefresh = useCallback(() => {
    fetchProductTypes()
    fetchProducts()
  }, [fetchProductTypes, fetchProducts])

  // QR scan → parse kode produk (type_code-version) → buka detail produk
  const handleScanSuccess = useCallback(
    (code: string) => {
      const match = code.match(PRODUCT_SKU_REGEX)
      if (!match) {
        Alert.alert('Kode Tidak Valid', `"${code}" bukan kode produk. Format: TIPE-VERSI-FINISHING-BATCH (contoh EAS-00-C-AA0001)`)
        return
      }
      const typeCode = match[1]
      const version = match[2]
      const found = (products as any[]).find(
        (p) => p.type?.type_code === typeCode && p.version === version
      )
      if (!found) {
        Alert.alert('Produk Tidak Ditemukan', `Produk ${typeCode}-${version} tidak ada di master data`)
        return
      }
      setScanModalVisible(false)
      router.push({ pathname: '/master/product/[id]', params: { id: found.product_id } })
    },
    [products, router]
  )

  const openScanner = () => {
    if (!permission?.granted) {
      requestPermission().then((res) => {
        if (res.granted) setScanModalVisible(true)
        else Alert.alert('Izin Diperlukan', 'Akses kamera diperlukan untuk scan QR')
      })
      return
    }
    setScanModalVisible(true)
  }

  // Hapus perusahaan (soft delete) dengan konfirmasi
  const handleDeleteCompany = (item: Company) => {
    Alert.alert('Hapus Perusahaan', 'Yakin hapus perusahaan', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          try {
            await companyStore.deleteCompany(item.company_id)
            Alert.alert('Sukses', 'Perusahaan berhasil dihapus')
          } catch (e: any) {
            Alert.alert('Error', e?.message ?? 'Gagal menghapus perusahaan')
          }
        },
      },
    ])
  }

  // Count products per type
  const getProductCount = (typeId: string) => {
    return products.filter((p: any) => p.type_id === typeId).length
  }

  const filteredTypes = searchQuery
    ? productTypes.filter(
        (pt) =>
          pt.type_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          pt.type_code.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : productTypes

  const renderItem = ({ item }: { item: ProductType }) => (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => router.push({ pathname: '/master/[id]', params: { id: item.type_id } })}
    >
      <View style={styles.cardIcon}>
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.cardIconImage} />
        ) : (
          <Text style={styles.cardIconText}>📦</Text>
        )}
      </View>

      <View style={styles.cardContent}>
        <Text style={styles.typeName} numberOfLines={1}>
          {item.type_name}
        </Text>
        <Text style={styles.typeCode} numberOfLines={1}>
          {item.type_code}
        </Text>
        <Text style={styles.typeDesc}>
          {getProductCount(item.type_id)} produk
        </Text>
      </View>

      <View style={styles.cardChevron}>
        <Text style={styles.chevronText}>›</Text>
      </View>
    </Pressable>
  )

  // Companies list renderer
  const filteredCompanies = searchQuery
    ? companyStore.companies.filter(
        (c) => c.company_name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : companyStore.companies

  useEffect(() => {
    if (tab === 'perusahaan') {
      companyStore.fetchCompanies()
    }
  }, [tab])

  const renderCompanyItem = ({ item }: { item: Company }) => (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => router.push({ pathname: '/master/company/[id]', params: { id: item.company_id } })}
    >
      <View style={styles.cardIcon}>
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.cardIconImage} />
        ) : (
          <Text style={styles.cardIconText}>🏢</Text>
        )}
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.typeName} numberOfLines={1}>
          {item.company_name}
        </Text>
        {item.address && (
          <Text style={styles.typeDesc} numberOfLines={1}>
            📍 {item.address}
          </Text>
        )}
      </View>
      <Pressable
        style={({ pressed }) => [styles.deleteBtn, pressed && styles.deleteBtnPressed]}
        onPress={(e) => {
          e.stopPropagation()
          handleDeleteCompany(item)
        }}
      >
        <Text style={styles.deleteBtnText}>🗑</Text>
      </Pressable>
    </Pressable>
  )

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Tab Switcher */}
      <View style={styles.tabBar}>
        <Pressable
          style={[styles.tab, tab === 'produk' && styles.tabActive]}
          onPress={() => { setTab('produk'); setSearchQuery('') }}
        >
          <Text style={[styles.tabText, tab === 'produk' && styles.tabTextActive]}>📦 Produk</Text>
        </Pressable>
        <Pressable
          style={[styles.tab, tab === 'perusahaan' && styles.tabActive]}
          onPress={() => { setTab('perusahaan'); setSearchQuery('') }}
        >
          <Text style={[styles.tabText, tab === 'perusahaan' && styles.tabTextActive]}>🏢 Perusahaan</Text>
        </Pressable>
      </View>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.heading}>
          {tab === 'produk' ? 'Master Data' : 'Perusahaan'}
        </Text>
        <Text style={styles.subheading}>
          {tab === 'produk' 
            ? `${productTypes.length} jenis produk`
            : `${companyStore.companies.length} perusahaan`}
        </Text>
      </View>

      {/* Search bar + Scan QR */}
      <View style={styles.searchRow}>
        <TextInput
          style={[styles.searchInput, { flex: 1 }]}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={tab === 'produk' ? 'Cari jenis produk atau kode...' : 'Cari perusahaan...'}
          placeholderTextColor={colors.mutedSoft}
        />
        {tab === 'produk' && (
          <Pressable
            style={({ pressed }) => [styles.scanBtn, pressed && styles.scanBtnPressed]}
            onPress={openScanner}
          >
            <Text style={styles.scanBtnText}>📷 Scan</Text>
          </Pressable>
        )}
      </View>

      {/* List — Produk */}
      {tab === 'produk' && (
        <>
          {loading && productTypes.length === 0 ? (
            <ActivityIndicator color={colors.ink} size="large" style={styles.loader} />
          ) : error ? (
            <View style={styles.center}>
              <Text style={styles.errorText}>{error}</Text>
              <Button title="Coba Lagi" variant="outline" onPress={handleRefresh} />
            </View>
          ) : filteredTypes.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.emptyText}>Belum ada jenis produk</Text>
              <Text style={styles.emptyHint}>Tambahkan jenis produk pertama Anda</Text>
            </View>
          ) : (
            <FlatList
              data={filteredTypes}
              keyExtractor={(item) => item.type_id}
              renderItem={renderItem}
              contentContainerStyle={styles.list}
              onRefresh={handleRefresh}
              refreshing={loading}
              ItemSeparatorComponent={() => <View style={{ height: spacing.xs }} />}
            />
          )}
        </>
      )}

      {/* List — Perusahaan */}
      {tab === 'perusahaan' && (
        <>
          {companyStore.loading && companyStore.companies.length === 0 ? (
            <ActivityIndicator color={colors.ink} size="large" style={styles.loader} />
          ) : companyStore.error ? (
            <View style={styles.center}>
              <Text style={styles.errorText}>{companyStore.error}</Text>
              <Button title="Coba Lagi" variant="outline" onPress={() => companyStore.fetchCompanies()} />
            </View>
          ) : filteredCompanies.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.emptyText}>Belum ada perusahaan</Text>
              <Text style={styles.emptyHint}>Tambahkan perusahaan pertama Anda</Text>
            </View>
          ) : (
            <FlatList
              data={filteredCompanies}
              keyExtractor={(item) => item.company_id}
              renderItem={renderCompanyItem}
              contentContainerStyle={styles.list}
              onRefresh={() => companyStore.fetchCompanies()}
              refreshing={companyStore.loading}
              ItemSeparatorComponent={() => <View style={{ height: spacing.xs }} />}
            />
          )}
        </>
      )}

      {/* Modal Scanner QR Produk */}
      <Modal visible={scanModalVisible} animationType="slide" onRequestClose={() => setScanModalVisible(false)}>
        <View style={styles.scanModal}>
          <View style={styles.scanHeader}>
            <Text style={styles.scanTitle}>Scan QR Produk</Text>
            <Pressable onPress={() => setScanModalVisible(false)} style={styles.scanCloseBtn}>
              <Text style={styles.scanCloseText}>✕ Tutup</Text>
            </Pressable>
          </View>
          {permission?.granted ? (
            <StockScanner
              style={styles.scanCamera}
              onScanSuccess={handleScanSuccess}
              frameThreshold={2}
              lockDuration={2000}
            />
          ) : (
            <View style={styles.scanNoPerm}>
              <Text style={styles.scanNoPermText}>Kamera diperlukan untuk scan QR produk</Text>
              <Button title="Izinkan Kamera" onPress={requestPermission} />
            </View>
          )}
        </View>
      </Modal>

      {/* FAB */}
      <Pressable
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        onPress={() => 
          tab === 'produk' 
            ? router.push('/master/create') 
            : router.push('/master/company-create')
        }
      >
        <Text style={styles.fabIcon}>+</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  tabBar: {
    flexDirection: 'row', marginTop: spacing.xs, marginHorizontal: spacing.md,
    backgroundColor: colors.surfaceCard, borderRadius: radius.md,
    padding: 3, gap: 2,
  },
  tab: {
    flex: 1, paddingVertical: spacing.sm, borderRadius: radius.sm,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: colors.canvas },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.muted },
  tabTextActive: { color: colors.ink },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  heading: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.ink,
  },
  subheading: {
    fontSize: typography.size.sm,
    color: colors.muted,
  },
  searchRow: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xxs,
    paddingBottom: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  searchInput: {
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    padding: spacing.sm,
    fontSize: typography.size.base,
    color: colors.ink,
  },
  scanBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanBtnPressed: { backgroundColor: colors.primaryActive },
  scanBtnText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.onPrimary,
  },
  scanModal: { flex: 1, backgroundColor: '#000' },
  scanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.canvas,
  },
  scanTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.ink,
  },
  scanCloseBtn: { padding: spacing.xxs },
  scanCloseText: {
    fontSize: typography.size.base,
    color: colors.brand,
    fontWeight: typography.weight.medium,
  },
  scanCamera: { flex: 1 },
  scanNoPerm: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.lg },
  scanNoPermText: { color: colors.muted, textAlign: 'center' },
  list: { padding: spacing.md, paddingTop: spacing.xxs },
  loader: { marginTop: spacing.xxl },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg, gap: spacing.xs },
  errorText: { fontSize: typography.size.base, color: colors.error, textAlign: 'center' },
  emptyText: { fontSize: typography.size.md, color: colors.muted },
  emptyHint: { fontSize: typography.size.sm, color: colors.muted },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.canvas,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardPressed: { opacity: 0.8, backgroundColor: colors.surfaceSoft },
  deleteBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  deleteBtnPressed: { backgroundColor: colors.error + '22' },
  deleteBtnText: { fontSize: 15 },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceCard,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  cardIconImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  cardIconText: { fontSize: 22 },
  cardContent: { flex: 1, gap: 2 },
  typeName: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.ink,
  },
  typeCode: {
    fontSize: typography.size.sm,
    fontFamily: typography.font.mono,
    color: colors.muted,
  },
  typeDesc: {
    fontSize: typography.size.sm,
    color: colors.mutedSoft,
    marginTop: 2,
  },
  cardChevron: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevronText: {
    fontSize: 22,
    color: colors.mutedSoft,
    fontWeight: typography.weight.medium,
  },
  fab: {
    position: 'absolute',
    bottom: spacing.lg,
    right: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  fabPressed: { backgroundColor: colors.primaryActive },
  fabIcon: {
    fontSize: 28,
    color: colors.onPrimary,
    lineHeight: 30,
  },
})
