import { View, Text, ScrollView, Alert, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import { useAuthStore } from '@/stores/authStore'
import { colors, typography, radius } from '@/constants'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function SettingsScreen() {
  const router = useRouter()
  const { user, logout } = useAuthStore()
  const insets = useSafeAreaInsets()

  const handleLogout = () => {
    Alert.alert('Logout', 'Anda yakin ingin keluar?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout()
          router.replace('/(auth)/login')
        },
      },
    ])
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}>
      <Text style={styles.heading}>Pengaturan</Text>

      {/* Profile */}
      <Card>
        <View style={styles.profileRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.email?.charAt(0)?.toUpperCase() ?? 'U'}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{user?.full_name ?? user?.email ?? 'User'}</Text>
            <Text style={styles.email}>{user?.email}</Text>
          </View>
        </View>
      </Card>

      {/* App Info */}
      <Card>
        <Text style={styles.sectionTitle}>Informasi Aplikasi</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Versi</Text>
          <Text style={styles.value}>v1.0.0</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Nama</Text>
          <Text style={styles.value}>Bengkel Las Stock Management</Text>
        </View>
      </Card>

      {/* Data */}
      <Card>
        <Text style={styles.sectionTitle}>Data & Sinkronisasi</Text>
        <Button
          title="🔄 Refresh Data"
          variant="outline"
          fullWidth
          onPress={() => Alert.alert('Info', 'Data berhasil disegarkan')}
        />
      </Card>

      {/* Logout */}
      <Button title="Logout" variant="danger" fullWidth onPress={handleLogout} />

      <View style={{ height: 40 }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: 16, gap: 12 },
  heading: { fontSize: 22, fontWeight: '700', color: colors.ink, marginBottom: 4 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: colors.ink,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { color: colors.onPrimary, fontSize: 20, fontWeight: '700' },
  name: { fontSize: 16, fontWeight: '600', color: colors.ink },
  email: { fontSize: 13, color: colors.muted, marginTop: 2 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.hairline },
  label: { fontSize: 13, color: colors.muted },
  value: { fontSize: 13, color: colors.ink, fontWeight: '500' },
})
