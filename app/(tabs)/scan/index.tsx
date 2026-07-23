import { useEffect, useCallback, useState, useRef } from 'react'
import {
  View, Text, FlatList, Pressable, TextInput,
  ActivityIndicator, StyleSheet, Vibration,
 Alert, Modal } from 'react-native'
import { useCameraPermissions } from 'expo-camera'
import { useRouter, useFocusEffect } from 'expo-router'
import { useIsFocused } from '@react-navigation/native'
import StockScanner from '@/components/scanner/StockScanner'
import ScanEditModal from '@/components/scanner/ScanEditModal'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { useBatchStore } from '@/stores/batchStore'
import { colors, typography, radius, SCANNER } from '@/constants'

export default function ScanScreen() {
  const router = useRouter()
  const batchStore = useBatchStore()
  const [permission, requestPermission] = useCameraPermissions()
  const [manualCode, setManualCode] = useState('')
  const [showManual, setShowManual] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  const [countdown, setCountdown] = useState(SCANNER.TIMEOUT_MS / 1000)
  const [history, setHistory] = useState<string[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [scannedCode, setScannedCode] = useState('')
  const [showEditModal, setShowEditModal] = useState(false)
  const isFocused = useIsFocused()
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef(SCANNER.TIMEOUT_MS / 1000)
  const manualDismissedRef = useRef(false)

  // Restart timer & reset scan state saat kembali ke halaman (dari result page)
  useFocusEffect(
    useCallback(() => {
      manualDismissedRef.current = false
      countdownRef.current = SCANNER.TIMEOUT_MS / 1000
      setCountdown(countdownRef.current)
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = setInterval(() => {
        countdownRef.current -= 1
        setCountdown(countdownRef.current)
        if (countdownRef.current <= 0) {
          if (!manualDismissedRef.current) setShowManual(true)
          if (timerRef.current) clearInterval(timerRef.current)
        }
      }, 1000)
      return () => { if (timerRef.current) clearInterval(timerRef.current) }
    }, [])
  )

  // Force camera remount when screen loses/re-gains focus
  useEffect(() => {
    if (isFocused) {
      resetTimer()
    }
  }, [isFocused])
  useEffect(() => {
    if (!permission?.granted) return
    countdownRef.current = SCANNER.TIMEOUT_MS / 1000
    setCountdown(countdownRef.current)
    timerRef.current = setInterval(() => {
      countdownRef.current -= 1
      setCountdown(countdownRef.current)
      if (countdownRef.current <= 0) {
        if (!manualDismissedRef.current) setShowManual(true)
        if (timerRef.current) clearInterval(timerRef.current)
      }
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [permission?.granted])

  const resetTimer = () => {
    countdownRef.current = SCANNER.TIMEOUT_MS / 1000
    setCountdown(countdownRef.current)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      countdownRef.current -= 1
      setCountdown(countdownRef.current)
      if (countdownRef.current <= 0) {
        if (!manualDismissedRef.current) setShowManual(true)
        if (timerRef.current) clearInterval(timerRef.current)
      }
    }, 1000)
  }

  const handleScanSuccess = (code: string) => {
    Vibration.vibrate(100)
    if (timerRef.current) clearInterval(timerRef.current)
    setScannedCode(code)
    setShowEditModal(true)
  }

  const handleEditConfirm = async (editedCode: string) => {
    setShowEditModal(false)
    try {
      const batch = await batchStore.findBatchByCode(editedCode)
      setHistory((prev) => [editedCode, ...prev.filter(c => c !== editedCode)].slice(0, 20))
      if (batch) {
        router.push({ pathname: '/scan/result', params: { code: editedCode } })
      } else {
        Alert.alert('Tidak Ditemukan', `Batch "${editedCode}" tidak valid`, [
          { text: 'OK', onPress: () => resetTimer() }
        ])
      }
    } catch { resetTimer() }
  }

  const handleEditCancel = () => {
    setShowEditModal(false)
    resetTimer()
  }

  if (!permission) return <View style={styles.center}><ActivityIndicator color={colors.ink} /></View>
  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={{ color: colors.muted, marginBottom: 12 }}>Kamera diperlukan</Text>
        <Button title="Izinkan Kamera" onPress={requestPermission} />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {isFocused && (
        <StockScanner
          style={styles.camera}
          torchOn={torchOn}
          onScanSuccess={handleScanSuccess}
          frameThreshold={2}
          lockDuration={2500}
        />
      )}

      <View style={styles.toolbar}>
        <Text style={styles.countdownText}>⏳ {countdown}s</Text>
        <Button title="⌨️ Manual" variant="secondary" size="sm" onPress={() => { manualDismissedRef.current = false; setShowManual(true) }} />
        <Button title={torchOn ? '🔦 Off' : '🔦 Torch'} variant="ghost" size="sm" onPress={() => setTorchOn(!torchOn)} />
        <Button title="📋 Histori" variant="ghost" size="sm" onPress={() => setShowHistory(true)} />
      </View>

      <Modal visible={showManual} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Manual Input Barcode</Text>
            <Input value={manualCode} onChangeText={setManualCode} placeholder="HGP-00-C-AA0001" autoCapitalize="characters" />
            <Text style={{ fontSize: 11, color: colors.muted, textAlign: 'center', marginTop: 8, marginBottom: 16 }}>
              Tips: Periksa kembali kode yang Anda masukkan
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Button title="Batal" variant="ghost" onPress={() => { setShowManual(false); setManualCode(''); manualDismissedRef.current = true; if (timerRef.current) clearInterval(timerRef.current) }} />
              <Button title="Cari Batch" onPress={async () => {
                const code = manualCode.trim()
                if (!code) return Alert.alert('Error', 'Masukkan kode')
                const batch = await batchStore.findBatchByCode(code)
                if (batch) {
                  setShowManual(false); setManualCode('')
                  router.push({ pathname: '/scan/result', params: { code } })
                } else Alert.alert('Tidak Ditemukan', `Batch "${code}" tidak ditemukan`)
              }} />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showHistory} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Histori Scan</Text>
            {history.length === 0 ? (
              <Text style={{ color: colors.muted, textAlign: 'center', paddingVertical: 32 }}>Belum ada scan</Text>
            ) : (
              <FlatList data={history} keyExtractor={(item, i) => `${item}-${i}`} style={{ maxHeight: 300 }}
                renderItem={({ item }) => (
                  <Pressable style={{ paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.hairline }}
                    onPress={() => { setShowHistory(false); router.push({ pathname: '/scan/result', params: { code: item } }) }}>
                    <Text style={{ fontFamily: typography.font.mono, color: colors.ink, fontSize: 14 }}>{item}</Text>
                  </Pressable>
                )} />
            )}
            <View style={{ marginTop: 12 }}><Button title="Tutup" variant="ghost" fullWidth onPress={() => setShowHistory(false)} /></View>
          </View>
        </View>
      </Modal>

      <ScanEditModal
        visible={showEditModal}
        rawBarcode={scannedCode}
        onConfirm={handleEditConfirm}
        onCancel={handleEditCancel}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  center: { flex: 1, backgroundColor: colors.canvas, justifyContent: 'center', alignItems: 'center', padding: 24 },
  toolbar: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, backgroundColor: colors.canvas, borderTopWidth: 1, borderTopColor: colors.hairline },
  countdownText: { color: colors.warning, fontSize: 13, fontFamily: typography.font.mono },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 },
  modal: { backgroundColor: colors.canvas, borderRadius: radius.lg, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.ink, textAlign: 'center', marginBottom: 16 },
})
