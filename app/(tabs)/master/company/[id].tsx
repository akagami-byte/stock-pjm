import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, ScrollView, Alert, ActivityIndicator, StyleSheet, Image, Pressable,
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
import { formatDate, formatCurrency } from '@/utils/formatters'
import { colors, radius } from '@/constants'
import type { Company, StockBatchWithDetails } from '@/types'

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

  useEffect(() => {
    if (id) loadCompany(id)
  }, [id])

  async function loadCompany(companyId: string) {
    setLoading(true)
    try {
      const c = companyStore.companies.find(c => c.company_id === companyId)
      if (!c) { await companyStore.fetchCompanies(); setCompany(companyStore.companies.find(c => c.company_id === companyId) || null) }
      else setCompany(c)
    } catch {} finally { setLoading(false) }
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
        <View style={{ width: 30 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(['info','batch','transaksi'] as const).map(t => (
          <Pressable key={t} style={[styles.tab, tab===t&&styles.tabActive]} onPress={()=>setTab(t)}>
            <Text style={[styles.tabText, tab===t&&styles.tabTextActive]}>
              {t==='info'?'Info':t==='batch'?'Reserved':'Transaksi'}
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
            <View style={styles.row}><Text style={styles.lbl}>Nama</Text><Text style={styles.val}>{company.company_name}</Text></View>
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
          <Text style={{ color: colors.muted, textAlign: 'center', padding: 24 }}>
            Riwayat transaksi akan tersedia setelah sinkronisasi data.
          </Text>
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  ctr: { flex: 1, backgroundColor: colors.canvas },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  title: { flex: 1, fontSize: 18, fontWeight: '700', color: colors.ink },
  tabs: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 8 },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: colors.ink },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.muted },
  tabTextActive: { color: colors.ink },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  img: { width: '100%', height: 200, borderRadius: radius.lg, backgroundColor: colors.surfaceCard },
  imgPlaceholder: { width: '100%', height: 160, borderRadius: radius.lg, backgroundColor: colors.surfaceCard, justifyContent: 'center', alignItems: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.hairlineSoft },
  lbl: { fontSize: 13, color: colors.muted },
  val: { fontSize: 13, color: colors.body, fontWeight: '500' },
})
