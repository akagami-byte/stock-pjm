import { useState, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
  TouchableOpacity,
} from 'react-native'
import { useRouter } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import SearchDropdown from '@/components/ui/SearchDropdown'
import { useProductStore } from '@/stores/productStore'
import { uploadBarcodePresigned } from '@/services/s3/uploadBarcodePresigned'
import { colors, typography, radius, spacing, FINISHING_OPTIONS } from '@/constants'
import type { Finishing, ProductType } from '@/types'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

type CreateStep = 'type' | 'product'

export default function CreateProductScreen() {
  const router = useRouter()
  const { productTypes, createProductType, createProduct, createVariant, fetchProductTypes, loading } = useProductStore()

  const [step, setStep] = useState<CreateStep>('type')
  const insets = useSafeAreaInsets()
  const [typeMode, setTypeMode] = useState<'select' | 'create'>('select')
  const [selectedType, setSelectedType] = useState<ProductType | null>(null)
  const [newTypeCode, setNewTypeCode] = useState('')
  const [newTypeName, setNewTypeName] = useState('')
  const [namaProduk, setNamaProduk] = useState('')
  const [deskripsi, setDeskripsi] = useState('')
  const [versiProduk, setVersiProduk] = useState('01')
  const [finishing, setFinishing] = useState<Finishing>('C')
  const [hargaDasar, setHargaDasar] = useState('')
  const [priceModifier, setPriceModifier] = useState('0')
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [imageUri, setImageUri] = useState<string | null>(null)
  const [typeImageUri, setTypeImageUri] = useState<string | null>(null)

  useEffect(() => { fetchProductTypes() }, [])

  const typeItems = productTypes.map((pt) => ({
    id: pt.type_id,
    label: `[${pt.type_code}] ${pt.type_name}`,
    subtitle: pt.type_code,
  }))

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) { Alert.alert('Izin', 'Akses galeri diperlukan'); return }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8,
    })
    if (!result.canceled && result.assets.length > 0) setImageUri(result.assets[0].uri)
  }

  const pickTypeImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) { Alert.alert('Izin', 'Akses galeri diperlukan'); return }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8,
    })
    if (!result.canceled && result.assets.length > 0) setTypeImageUri(result.assets[0].uri)
  }

  const handleTypeSelect = (item: { id: string; label: string }) => {
    const type = productTypes.find((t) => t.type_id === item.id)
    if (type) { setSelectedType(type); setStep('product') }
  }

  const handleCreateType = async () => {
    if (!newTypeCode.trim()) { setErrors({ typeCode: 'Kode jenis wajib diisi' }); return }
    if (!newTypeName.trim()) { setErrors({ typeName: 'Nama jenis wajib diisi' }); return }
    setSaving(true)
    try {
      let typeImageUrl: string | undefined
      if (typeImageUri) {
        try {
          const r = await uploadBarcodePresigned(typeImageUri, `type_${Date.now()}`, 'products/')
          typeImageUrl = r.publicUrl
        } catch { Alert.alert('Upload Gagal', 'Lanjut simpan tanpa gambar?') }
      }
      const newType = await createProductType({
        type_code: newTypeCode.toUpperCase().trim(),
        type_name: newTypeName.trim(),
        image_url: typeImageUrl,
      })
      setSelectedType(newType); setStep('product')
    } catch (e: any) { Alert.alert('Gagal', e?.message ?? 'Gagal') }
    finally { setSaving(false) }
  }

  const validate = (): boolean => {
    const err: Record<string, string> = {}
    if (!namaProduk.trim()) err.namaProduk = 'Nama produk wajib diisi'
    if (!versiProduk.trim()) err.versiProduk = 'Versi produk wajib diisi'
    if (!hargaDasar.trim() || isNaN(Number(hargaDasar)) || Number(hargaDasar) <= 0) err.hargaDasar = 'Harga dasar wajib diisi'
    setErrors(err); return Object.keys(err).length === 0
  }

  const handleSimpan = async () => {
    if (!selectedType) return
    if (!validate()) return
    setSaving(true)
    try {
      let imageUrl: string | undefined
      if (imageUri) {
        try {
          const r = await uploadBarcodePresigned(imageUri, `product_${Date.now()}`, 'products/')
          imageUrl = r.publicUrl
        } catch { Alert.alert('Upload Gagal', 'Lanjut simpan tanpa gambar?') }
      }
      const product = await createProduct({
        type_id: selectedType.type_id, version: versiProduk.trim(),
        product_name: namaProduk.trim(), base_price: Number(hargaDasar),
        description: deskripsi.trim() || undefined, image_url: imageUrl,
      })
      await createVariant({ product_id: product.product_id, finishing, price_modifier: Number(priceModifier) || 0 })
      Alert.alert('Berhasil', 'Produk berhasil ditambahkan', [{ text: 'OK', onPress: () => router.back() }])
    } catch (e: any) { Alert.alert('Gagal', e?.message ?? 'Gagal menyimpan produk') }
    finally { setSaving(false) }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.heading}>Tambah Produk Baru</Text>

        {step === 'type' && (
          <View style={styles.card}>
            <Text style={styles.stepLabel}>Langkah 1/2</Text>
            <Text style={styles.sectionTitle}>Pilih atau Buat Jenis Produk</Text>
            <View style={styles.tabs}>
              <Pressable style={[styles.tab, typeMode === 'select' && styles.tabActive]} onPress={() => setTypeMode('select')}>
                <Text style={[styles.tabText, typeMode === 'select' && styles.tabTextActive]}>Pilih</Text>
              </Pressable>
              <Pressable style={[styles.tab, typeMode === 'create' && styles.tabActive]} onPress={() => setTypeMode('create')}>
                <Text style={[styles.tabText, typeMode === 'create' && styles.tabTextActive]}>Buat Baru</Text>
              </Pressable>
            </View>
            {typeMode === 'select' ? (
              <SearchDropdown label="Cari Jenis Produk" placeholder="Ketik kode/nama..." items={typeItems} loading={loading} emptyMessage="Belum ada jenis" onSelect={handleTypeSelect} />
            ) : (
              <>
                <Input label="Kode Jenis (max 3 huruf)" value={newTypeCode} onChangeText={setNewTypeCode} placeholder="HGP" autoCapitalize="characters" maxLength={3} />
                <View style={{ height: 8 }} />
                <Input label="Nama Jenis" value={newTypeName} onChangeText={setNewTypeName} placeholder="Hollow Gate Pillar" />
                <View style={{ height: 8 }} />
                <Text style={{ fontSize: 13, fontWeight: '500', color: colors.body, marginBottom: 4 }}>Gambar Jenis Produk (opsional)</Text>
                <TouchableOpacity style={styles.uploadBox} onPress={pickTypeImage}>
                  {typeImageUri ? (
                    <Image source={{ uri: typeImageUri }} style={styles.preview} />
                  ) : (
                    <View style={styles.uploadPlaceholder}>
                      <Text style={styles.uploadText}>Ketuk untuk pilih gambar</Text>
                    </View>
                  )}
                </TouchableOpacity>
                <View style={{ height: 12 }} />
                <Button title="Buat & Lanjut" onPress={handleCreateType} fullWidth loading={saving} />
              </>
            )}
          </View>
        )}

        {step === 'product' && selectedType && (
          <View style={styles.card}>
            <Text style={styles.stepLabel}>Langkah 2/2</Text>
            <Text style={styles.sectionTitle}>Spesifikasi Produk</Text>
            <Text style={styles.context}>Jenis: [{selectedType.type_code}] {selectedType.type_name}</Text>

            <Input label="Nama Produk (WAJIB)" value={namaProduk} onChangeText={setNamaProduk} placeholder="Engsel Konsilet Biasa" />
            <View style={{ height: 8 }} />
            <Input label="Versi" value={versiProduk} onChangeText={setVersiProduk} placeholder="01" />
            <View style={{ height: 8 }} />
            <Input label="Harga Dasar (Rp)" value={hargaDasar} onChangeText={setHargaDasar} placeholder="15000" keyboardType="numeric" />
            <View style={{ height: 8 }} />
            <Input label="Deskripsi" value={deskripsi} onChangeText={setDeskripsi} placeholder="Opsional" multiline />
            <View style={{ height: 8 }} />
            <Input label="Harga Modifier Finishing (Rp)" value={priceModifier} onChangeText={setPriceModifier} placeholder="0" keyboardType="numeric" />

            <Text style={styles.pickerLabel}>Finishing Awal</Text>
            <View style={styles.chipRow}>
              {FINISHING_OPTIONS.map((f) => (
                <TouchableOpacity key={f.code} style={[styles.chip, finishing === f.code && styles.chipActive]} onPress={() => setFinishing(f.code)}>
                  <Text style={[styles.chipText, finishing === f.code && styles.chipTextActive]}>{f.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Upload Gambar */}
            <Text style={styles.pickerLabel}>Gambar Produk</Text>
            <TouchableOpacity style={styles.uploadBox} onPress={pickImage}>
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.preview} />
              ) : (
                <View style={styles.uploadPlaceholder}>
                  <Text style={styles.uploadIcon}>📷</Text>
                  <Text style={styles.uploadText}>Ketuk untuk pilih gambar</Text>
                </View>
              )}
            </TouchableOpacity>
            {imageUri && <Button title="🔄 Ganti Gambar" variant="ghost" size="sm" onPress={pickImage} />}

            <View style={{ height: 16 }} />
            <Button title={saving ? 'Menyimpan...' : 'Simpan Produk'} onPress={handleSimpan} fullWidth loading={saving} disabled={saving} />
            <View style={{ height: 8 }} />
            <Button title="← Kembali" variant="ghost" onPress={() => setStep('type')} />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: 16, paddingBottom: 40 },
  heading: { fontSize: 22, fontWeight: '700', color: colors.ink, marginBottom: 16 },
  card: { backgroundColor: colors.canvas, borderRadius: radius.lg, padding: 16, borderWidth: 1, borderColor: colors.hairline },
  stepLabel: { fontSize: 12, color: colors.brand, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: colors.ink, marginBottom: 8 },
  context: { fontSize: 13, color: colors.muted, marginBottom: 8 },
  tabs: { flexDirection: 'row', marginBottom: 12, backgroundColor: colors.surfaceCard, borderRadius: 8, padding: 2 },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6 },
  tabActive: { backgroundColor: colors.ink },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.muted },
  tabTextActive: { color: colors.onPrimary },
  pickerLabel: { fontSize: 12, fontWeight: '600', color: colors.body, marginTop: 12, marginBottom: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: colors.surfaceCard, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: colors.hairline },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.body },
  chipTextActive: { color: colors.onPrimary },
  uploadBox: { borderWidth: 2, borderColor: colors.hairline, borderStyle: 'dashed', borderRadius: radius.lg, overflow: 'hidden', minHeight: 160, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surfaceSoft, marginTop: 4 },
  uploadPlaceholder: { alignItems: 'center', padding: 24 },
  uploadIcon: { fontSize: 36, marginBottom: 8 },
  uploadText: { fontSize: 13, color: colors.body, fontWeight: '500' },
  preview: { width: '100%', height: 200, resizeMode: 'cover' },
})
