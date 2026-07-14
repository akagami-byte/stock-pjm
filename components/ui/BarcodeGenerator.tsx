// components/ui/BarcodeGenerator.tsx
import React from 'react'
import { View, StyleSheet } from 'react-native'
import Barcode from 'react-native-barcode-builder'
import ViewShot, { captureRef } from 'react-native-view-shot'

interface BarcodeGeneratorProps {
  /** Data barcode (contoh: 'AA0001') */
  value: string
  /** Format barcode (default: CODE128) */
  format?: 'CODE128' | 'EAN' | 'CODE39' | 'ITF' | 'MSI' | 'Pharmacode' | 'Codabar'
  /** Lebar tiap bar dalam px (default: 2) */
  barWidth?: number
  /** Tinggi barcode dalam px (default: 80) */
  height?: number
  /** Tampilkan teks di bawah barcode */
  showText?: boolean
  /** Style tambahan */
  style?: any
}

/**
 * Komponen wrapper Barcode Code-128 siap render + siap capture.
 * Gunakan ViewShot wrapper untuk export ke PNG.
 */
export function BarcodeGenerator({
  value,
  format = 'CODE128',
  barWidth = 2,
  height = 80,
  showText = true,
  style,
}: BarcodeGeneratorProps) {
  return (
    <View style={[styles.wrapper, style]} collapsable={false}>
      <Barcode
        value={value}
        format={format}
        width={barWidth}
        height={height}
        text={showText ? value : ''}
        background="white"
        lineColor="black"
      />
    </View>
  )
}

// --- Komponen dengan ViewShot untuk capture ke PNG ---

interface CapturableBarcodeProps extends BarcodeGeneratorProps {
  onCapture?: (uri: string) => void
}

export const CapturableBarcode = React.forwardRef<any, CapturableBarcodeProps>(
  (props, ref) => {
    return (
      <ViewShot
        ref={ref}
        options={{ format: 'png', quality: 1.0, result: 'tmpfile' }}
        style={{ backgroundColor: 'white' }}
      >
        <BarcodeGenerator {...props} />
      </ViewShot>
    )
  },
)

CapturableBarcode.displayName = 'CapturableBarcode'

/**
 * Capture barcode menjadi file PNG.
 * Return: { uri: string } — path file lokal siap upload.
 */
export async function captureBarcodeAsPNG(
  viewShotRef: React.RefObject<any>,
): Promise<{ uri: string; width: number; height: number }> {
  if (!viewShotRef.current) {
    throw new Error('ViewShot ref belum tersedia. Pastikan komponen sudah di-render.')
  }
  const uri = await captureRef(viewShotRef, {
    format: 'png',
    quality: 1.0,
    result: 'tmpfile',
  })
  return { uri, width: 480, height: 160 }
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: 'white',
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
