// utils/barcodeGenerator.ts
// ⚠️ jsbarcode tidak punya API "toSVGString" untuk React Native (DOM-less).
// File ini sebagai dokumentasi. Untuk produksi gunakan react-native-barcode-builder.
// Lihat components/ui/BarcodeGenerator.tsx untuk implementasi siap pakai.

import JsBarcode from 'jsbarcode'

export interface BarcodeOptions {
  data: string
  format?: 'CODE128' | 'CODE128A' | 'CODE128B' | 'CODE128C'
  width?: number
  height?: number
  displayValue?: boolean
  fontSize?: number
  textMargin?: number
  margin?: number
}

/**
 * Generate SVG string barcode Code-128 (DOM-based — tidak bekerja di React Native).
 * Gunakan react-native-barcode-builder untuk RN/Expo.
 */
export function generateBarcodeSVG(options: BarcodeOptions): string {
  const {
    data,
    format = 'CODE128',
    width = 240,
    height = 80,
    displayValue = true,
    fontSize = 14,
    textMargin = 2,
    margin = 4,
  } = options

  try {
    const encoder = new (JsBarcode as any).getEncoding(format)
    const encoded = encoder(data, {
      width: 2,
      height,
      displayValue,
      fontSize,
      textMargin,
      margin,
    })

    const bars = buildBarcodePath(encoded, width, height, margin)

    const textY = height - margin + fontSize + textMargin
    const textX = width / 2

    const svg = [
      `<svg xmlns="http://www.w3.org/2000/svg"`,
      `  width="${width}" height="${height + (displayValue ? fontSize + textMargin + 2 : 0)}"`,
      `  viewBox="0 0 ${width} ${height + (displayValue ? fontSize + textMargin + 2 : 0)}">`,
      `  <rect width="100%" height="100%" fill="white"/>`,
      `  <path d="${bars}" fill="black"/>`,
      displayValue
        ? `  <text x="${textX}" y="${textY}" text-anchor="middle" font-family="monospace" font-size="${fontSize}" fill="black">${data}</text>`
        : '',
      `</svg>`,
    ].join('\n')

    return svg
  } catch {
    throw new Error(
      'jsbarcode tidak kompatibel dengan React Native (butuh DOM Canvas). ' +
      'Gunakan react-native-barcode-builder. Lihat components/ui/BarcodeGenerator.tsx.',
    )
  }
}

function buildBarcodePath(
  encoded: any,
  totalWidth: number,
  height: number,
  margin: number,
): string {
  throw new Error(
    'Gunakan react-native-barcode-builder untuk rendering langsung. ' +
    'File ini menyediakan wrapper & konfigurasi.',
  )
}
