// components/ui/QRGenerator.tsx
// QR Code generator — pengganti BarcodeGenerator setelah migrasi ke QR

import React from 'react'
import { View, StyleSheet } from 'react-native'
import QRCode from 'react-native-qrcode-svg'
import ViewShot, { captureRef } from 'react-native-view-shot'

interface QRGeneratorProps {
  value: string
  size?: number
  backgroundColor?: string
  color?: string
  style?: any
}

export function QRGenerator({
  value,
  size = 120,
  backgroundColor = 'white',
  color = 'black',
  style,
}: QRGeneratorProps) {
  return (
    <View style={[styles.wrapper, style]} collapsable={false}>
      <QRCode
        value={value}
        size={size}
        backgroundColor={backgroundColor}
        color={color}
      />
    </View>
  )
}

// ─── Capturable QR (untuk upload ke S3) ──────────────────────────

interface CapturableQRProps extends QRGeneratorProps {
  onCapture?: (uri: string) => void
}

export const CapturableQR = React.forwardRef<any, CapturableQRProps>(
  (props, ref) => {
    return (
      <ViewShot
        ref={ref}
        options={{ format: 'png', quality: 1.0, result: 'tmpfile' }}
        style={{ backgroundColor: 'white' }}
      >
        <QRGenerator {...props} />
      </ViewShot>
    )
  },
)

CapturableQR.displayName = 'CapturableQR'

export async function captureQRAsPNG(
  viewShotRef: React.RefObject<any>,
): Promise<{ uri: string; width: number; height: number }> {
  if (!viewShotRef.current) {
    throw new Error('ViewShot ref belum tersedia')
  }
  const uri = await captureRef(viewShotRef, {
    format: 'png',
    quality: 1.0,
    result: 'tmpfile',
  })
  return { uri, width: 480, height: 480 }
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: 'white',
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
