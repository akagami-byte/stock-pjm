// components/scanner/StockScanner.tsx
// QR Code scanner optimized — cepat, akurat, anti double-input
// Migrasi dari Code-128 ke QR Code

import React, { useRef, useCallback } from 'react'
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import { CameraView } from 'expo-camera'
import { colors } from '@/constants'

// ─── Regex validasi ─────────────────────────────────────────────
// Full format: HGP-00-C-AA0001  (productCode-version-finishing-batchCode)
const FULL_SKU_REGEX = /^[A-Z]{3}-\d{2}-[A-Z]-[A-Z]{2}\d{4}$/

// Fallback format: AA0001 (batch code only, 2 letters + 4 digits)
const BATCH_REGEX = /^[A-Z]{2}\d{4}$/

// ─── Types ───────────────────────────────────────────────────────
export interface StockScannerProps {
  style?: StyleProp<ViewStyle>
  /** Called with validated barcode text after frame stabilization */
  onScanSuccess: (barcodeText: string) => void
  /** Frame count threshold before accepting (default: 2 — QR sangat stabil) */
  frameThreshold?: number
  /** Anti-spam lock duration in ms after success (default: 2000) */
  lockDuration?: number
  /** Enable torch */
  torchOn?: boolean
}

// ─── Component ───────────────────────────────────────────────────
export default function StockScanner({
  style,
  onScanSuccess,
  frameThreshold = 2,
  lockDuration = 2000,
  torchOn = false,
}: StockScannerProps) {
  // Scanning lock — false setelah sukses, true kembali setelah lockDuration
  const [scanning, setScanning] = React.useState(true)

  // Buffer: { [barcodeText]: hitCount }
  const scanBuffer = useRef<Record<string, number>>({})

  // Reset buffer setelah lockDuration
  const resetBufferTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleBarcodeScanned = useCallback(
    ({ data }: { data: string }) => {
      if (!scanning) return

      const raw = data.trim().toUpperCase()

      // ─── DEBUG: log raw scan ──────────────────────────────
      console.log('[QR-Scanner] RAW:', raw)

      // ─── Validasi format ─────────────────────────────────
      if (FULL_SKU_REGEX.test(raw)) {
        console.log('[QR-Scanner] FULL match:', raw)
      } else if (BATCH_REGEX.test(raw)) {
        console.log('[QR-Scanner] BATCH match:', raw)
      } else {
        console.log('[QR-Scanner] REJECT (invalid format):', raw)
        return
      }

      // ─── Frame stabilization buffer (2x untuk QR) ────────
      scanBuffer.current[raw] = (scanBuffer.current[raw] || 0) + 1
      const hits = scanBuffer.current[raw]
      console.log(`[QR-Scanner] Buffer "${raw}": ${hits}/${frameThreshold}`)

      if (hits >= frameThreshold) {
        // ─── ACCEPT! ───────────────────────────────────────
        console.log('[QR-Scanner] ACCEPTED →', raw)

        // Lock scanner immediately
        setScanning(false)
        scanBuffer.current = {}

        if (resetBufferTimer.current) {
          clearTimeout(resetBufferTimer.current)
          resetBufferTimer.current = null
        }

        onScanSuccess(raw)

        // Anti-spam: unlock setelah lockDuration
        resetBufferTimer.current = setTimeout(() => {
          scanBuffer.current = {}
          setScanning(true)
        }, lockDuration)
      }
    },
    [scanning, frameThreshold, lockDuration, onScanSuccess],
  )

  return (
    <View style={[styles.container, style]}>
      <CameraView
        style={styles.camera}
        enableTorch={torchOn}
        barcodeScannerSettings={{
          // HANYA QR — jauh lebih cepat & akurat dari 1D barcode
          barcodeTypes: ['qr'],
        }}
        onBarcodeScanned={scanning ? handleBarcodeScanned : undefined}
      />

      {/* Visual guide frame — posisikan QR di dalam kotak */}
      <View style={styles.guideOverlay} pointerEvents="none">
        <View style={styles.guideFrame}>
          {/* Corner brackets */}
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </View>
        <Text style={styles.guideText}>
          {scanning ? 'Arahkan QR Code ke dalam kotak' : '✓ Terbaca'}
        </Text>
        {!scanning && (
          <Text style={styles.guideHint}>Scanner terkunci 2 detik...</Text>
        )}
      </View>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────
const FRAME_SIZE = 200
const CORNER_LEN = 24
const CORNER_THICK = 3

const styles = StyleSheet.create({
  container: { flex: 1 },
  camera: { flex: 1 },
  guideOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  guideFrame: {
    width: FRAME_SIZE,
    height: FRAME_SIZE,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: CORNER_LEN,
    height: CORNER_LEN,
    borderColor: '#3b82f6',
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: CORNER_THICK, borderLeftWidth: CORNER_THICK, borderTopLeftRadius: 8 },
  cornerTR: { top: 0, right: 0, borderTopWidth: CORNER_THICK, borderRightWidth: CORNER_THICK, borderTopRightRadius: 8 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: CORNER_THICK, borderLeftWidth: CORNER_THICK, borderBottomLeftRadius: 8 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: CORNER_THICK, borderRightWidth: CORNER_THICK, borderBottomRightRadius: 8 },
  guideText: {
    color: '#fff',
    fontSize: 13,
    marginTop: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 6,
    overflow: 'hidden',
  },
  guideHint: {
    color: '#f59e0b',
    fontSize: 11,
    marginTop: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
    overflow: 'hidden',
  },
})
