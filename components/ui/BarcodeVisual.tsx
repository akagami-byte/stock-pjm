// components/ui/BarcodeVisual.tsx
// QR Code visual — pengganti bar visual setelah migrasi ke QR
// Backward-compatible: menerima prop `code` yang sama

import { View, Text, StyleSheet } from 'react-native'
import QRCode from 'react-native-qrcode-svg'
import { colors } from '@/constants'

interface BarcodeVisualProps {
  code: string
  height?: number
}

export default function BarcodeVisual({ code, height = 80 }: BarcodeVisualProps) {
  if (!code) return null

  const qrSize = Math.min(height, 80)

  return (
    <View style={styles.container}>
      <QRCode value={code} size={qrSize} backgroundColor="white" color="black" />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
