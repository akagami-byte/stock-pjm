import { useState } from 'react'
import { View, Text, ScrollView, Alert, StyleSheet, Image, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import { useCompanyStore } from '@/stores/companyStore'
import { uploadBarcodePresigned } from '@/services/s3/uploadBarcodePresigned'
import { colors, radius } from '@/constants'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function CreateCompanyScreen() {
  const router = useRouter()
  const companyStore = useCompanyStore()

  const [companyName, setCompanyName] = useState('')
  const insets = useSafeAreaInsets()
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [imageUri, setImageUri] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  const pickImage = async () => {
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
      setImageUri(result.assets[0].uri)
    }
  }

  const handleSave = async () => {
    if (!companyName.trim()) {
      Alert.alert('Error', 'Nama perusahaan WAJIB diisi')
      return
    }

    setSaving(true)
    try {
      let imageUrl: string | undefined

      // Upload gambar ke S3 jika ada
      if (imageUri) {
        setUploading(true)
        try {
          const result = await uploadBarcodePresigned(
            imageUri,
            `company_${Date.now()}`,
            'companies/',
          )
          imageUrl = result.publicUrl
        } catch (err: any) {
          Alert.alert('Upload Gagal', err.message ?? 'Gagal upload gambar ke S3. Lanjut simpan tanpa gambar?')
          // Tetap lanjut tanpa gambar
        } finally {
          setUploading(false)
        }
      }

      await companyStore.createCompany({
        company_name: companyName.trim(),
        address: address.trim() || undefined,
        phone: phone.trim() || undefined,
        image_url: imageUrl,
      })

      Alert.alert('Berhasil', `Perusahaan "${companyName.trim()}" berhasil dibuat`, [
        { text: 'OK', onPress: () => router.back() },
      ])
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Gagal membuat perusahaan')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}>
      <Text style={styles.heading}>Tambah Perusahaan Baru</Text>

      <Card>
        <Input
          label="Nama Perusahaan (WAJIB)"
          value={companyName}
          onChangeText={setCompanyName}
          placeholder="PT Maju Jaya"
          autoCapitalize="words"
        />
        <View style={{ height: 12 }} />
        <Input
          label="Alamat"
          value={address}
          onChangeText={setAddress}
          placeholder="Jl. Raya ..."
          multiline
        />
        <View style={{ height: 12 }} />
        <Input
          label="Telepon"
          value={phone}
          onChangeText={setPhone}
          placeholder="0812..."
          keyboardType="phone-pad"
        />
      </Card>

      {/* Upload Gambar */}
      <View style={{ height: 12 }} />
      <Card>
        <Text style={styles.sectionTitle}>Logo / Gambar</Text>
        <TouchableOpacity style={styles.uploadBox} onPress={pickImage}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.preview} />
          ) : (
            <View style={styles.uploadPlaceholder}>
              <Text style={styles.uploadText}>Ketuk untuk pilih gambar</Text>
              <Text style={styles.uploadHint}>Rasio 1:1, max 5MB</Text>
            </View>
          )}
        </TouchableOpacity>
        {imageUri && (
          <Button
            title="🔄 Ganti Gambar"
            variant="ghost"
            size="sm"
            onPress={pickImage}
          />
        )}
      </Card>

      <View style={{ height: 16 }} />

      <Button
        title={uploading ? 'Upload gambar...' : saving ? 'Menyimpan...' : 'Simpan Perusahaan'}
        onPress={handleSave}
        fullWidth
        loading={saving || uploading}
        disabled={saving || uploading || !companyName.trim()}
      />

      <View style={{ height: 8 }} />
      <Button title="← Kembali" variant="ghost" onPress={() => router.back()} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: 16, paddingBottom: 40 },
  heading: { fontSize: 22, fontWeight: '700', color: colors.ink, marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: colors.body, marginBottom: 8 },
  uploadBox: {
    borderWidth: 2,
    borderColor: colors.hairline,
    borderStyle: 'dashed',
    borderRadius: radius.lg,
    overflow: 'hidden',
    minHeight: 160,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surfaceSoft,
  },
  uploadPlaceholder: {
    alignItems: 'center',
    padding: 24,
  },
  uploadIcon: { fontSize: 36, marginBottom: 8 },
  uploadText: { fontSize: 13, color: colors.body, fontWeight: '500' },
  uploadHint: { fontSize: 11, color: colors.muted, marginTop: 4 },
  preview: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
})
