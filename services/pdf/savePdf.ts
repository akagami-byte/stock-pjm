// services/pdf/savePdf.ts
import * as Print from 'expo-print'
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import { Platform, Alert } from 'react-native'

// ═══════════════════════════════════════════════════
// Tipe
// ═══════════════════════════════════════════════════

export interface SavePdfOptions {
  /** Nama file default (tanpa ekstensi) */
  defaultFileName: string
  /** Konten HTML lengkap yang akan dikonversi ke PDF */
  htmlContent: string
  /** Ukuran halaman (default: A4) */
  pageSize?: 'A4' | 'Letter' | 'A5'
  /** Margin dalam pixel (default: 16) */
  margin?: number
}

export interface SavePdfResult {
  /** Path file final setelah disimpan */
  filePath: string
  /** Nama file */
  fileName: string
  /** Ukuran file dalam bytes */
  fileSize: number
}

// ═══════════════════════════════════════════════════
// Template HTML Barcode (contoh)
// ═══════════════════════════════════════════════════

export function buildBarcodeHtml(
  barcodeSvg: string,
  batchCode: string,
  productName: string,
  variantSku: string,
): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', monospace;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: white;
    }
    .label {
      text-align: center;
      padding: 16px;
      border: 2px dashed #ccc;
      border-radius: 8px;
    }
    .product-name { font-size: 12px; color: #333; margin-bottom: 4px; }
    .sku { font-size: 10px; color: #666; margin-bottom: 8px; }
    .barcode { margin: 8px 0; }
    .batch-code { font-size: 11px; color: #000; font-weight: bold; }
  </style>
</head>
<body>
  <div class="label">
    <div class="product-name">${escapeHtml(productName)}</div>
    <div class="sku">SKU: ${escapeHtml(variantSku)}</div>
    <div class="barcode">${barcodeSvg}</div>
    <div class="batch-code">${escapeHtml(batchCode)}</div>
  </div>
</body>
</html>`
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ═══════════════════════════════════════════════════
// Fungsi Save PDF Utama
// ═══════════════════════════════════════════════════

/**
 * Konversi HTML → PDF, lalu minta user pilih folder tujuan
 * dan simpan file ke lokasi yang dipilih.
 *
 * Flow:
 *   1. HTML → PDF (expo-print) → file tmp
 *   2. User pilih folder via SAF (Android) atau share sheet (iOS)
 *   3. Copy file ke folder tujuan
 *   4. Return path final
 */
export async function savePdfToLocal(
  options: SavePdfOptions,
): Promise<SavePdfResult> {
  const {
    defaultFileName,
    htmlContent,
    pageSize = 'A4',
    margin = 16,
  } = options

  // ── Step 1: HTML → PDF (expo-print) ──
  const { uri: pdfUri } = await Print.printToFileAsync({
    html: htmlContent,
    width: pageSize === 'A4' ? 595 : pageSize === 'A5' ? 420 : 612,
    height: pageSize === 'A4' ? 842 : pageSize === 'A5' ? 595 : 792,
    margins: {
      top: margin,
      right: margin,
      bottom: margin,
      left: margin,
    },
  })

  console.log('PDF generated at:', pdfUri)

  const fileName = `${defaultFileName}.pdf`

  if (Platform.OS === 'android') {
    // ── Android: Storage Access Framework (SAF) ──
    try {
      const permissions =
        await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync()

      if (!permissions.granted) {
        throw new Error('Izin akses folder ditolak')
      }

      // Copy file dari tmp ke folder SAF
      const fileBase64 = await FileSystem.readAsStringAsync(pdfUri, {
        encoding: FileSystem.EncodingType.Base64,
      })

      const destUri =
        await FileSystem.StorageAccessFramework.createFileAsync(
          permissions.directoryUri,
          fileName,
          'application/pdf',
        )

      await FileSystem.writeAsStringAsync(destUri, fileBase64, {
        encoding: FileSystem.EncodingType.Base64,
      })

      // Dapatkan info file
      const fileInfo = await FileSystem.getInfoAsync(destUri)

      // Cleanup tmp
      await FileSystem.deleteAsync(pdfUri, { idempotent: true })

      return {
        filePath: destUri,
        fileName,
        fileSize: (fileInfo.exists ? (fileInfo as any).size : 0) ?? 0,
      }
    } catch (safError) {
      console.warn('SAF gagal, fallback ke share sheet:', safError)
    }
  }

  // ── Fallback: iOS & Android tanpa SAF → Share Sheet ──

  const canShare = await Sharing.isAvailableAsync()
  if (!canShare) {
    Alert.alert(
      'Share Tidak Tersedia',
      'Perangkat ini tidak mendukung share PDF.',
    )
    throw new Error('Share tidak tersedia')
  }

  // Copy ke folder Documents (bisa di-share)
  const destPath = `${FileSystem.documentDirectory}${fileName}`

  await FileSystem.copyAsync({
    from: pdfUri,
    to: destPath,
  })

  // Cleanup tmp
  await FileSystem.deleteAsync(pdfUri, { idempotent: true })

  // Buka share sheet — user bisa Save to Files / kirim ke app lain
  await Sharing.shareAsync(destPath, {
    mimeType: 'application/pdf',
    dialogTitle: `Simpan ${fileName}`,
    UTI: 'com.adobe.pdf', // iOS UTI
  })

  const fileInfo = await FileSystem.getInfoAsync(destPath)

  return {
    filePath: destPath,
    fileName,
    fileSize: (fileInfo.exists ? (fileInfo as any).size : 0) ?? 0,
  }
}

// ═══════════════════════════════════════════════════
// Helper: Simpan PDF dengan Folder Picker
// ═══════════════════════════════════════════════════

/**
 * Simpan PDF ke folder pilihan user menggunakan SAF.
 * Android: membuka SAF folder picker
 * iOS: membuka share sheet dengan opsi "Save to Files"
 */
export async function savePdfWithFolderPicker(
  options: SavePdfOptions,
): Promise<SavePdfResult> {
  const {
    defaultFileName,
    htmlContent,
    pageSize = 'A4',
    margin = 16,
  } = options

  // 1. Generate PDF
  const { uri: pdfUri } = await Print.printToFileAsync({
    html: htmlContent,
    width: pageSize === 'A4' ? 595 : pageSize === 'A5' ? 420 : 612,
    height: pageSize === 'A4' ? 842 : pageSize === 'A5' ? 595 : 792,
    margins: { top: margin, right: margin, bottom: margin, left: margin },
  })

  const fileName = `${defaultFileName}.pdf`

  if (Platform.OS === 'android') {
    // Android SAF: buat file di folder pilihan user
    try {
      const permissions =
        await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync()

      if (permissions.granted) {
        const pdfBase64 = await FileSystem.readAsStringAsync(pdfUri, {
          encoding: FileSystem.EncodingType.Base64,
        })

        const destUri =
          await FileSystem.StorageAccessFramework.createFileAsync(
            permissions.directoryUri,
            fileName,
            'application/pdf',
          )

        await FileSystem.writeAsStringAsync(destUri, pdfBase64, {
          encoding: FileSystem.EncodingType.Base64,
        })

        await FileSystem.deleteAsync(pdfUri, { idempotent: true })

        const info = await FileSystem.getInfoAsync(destUri)
        return {
          filePath: destUri,
          fileName,
          fileSize: (info.exists ? (info as any).size : 0) ?? 0,
        }
      }
    } catch (err) {
      console.warn('SAF folder picker failed, using share sheet:', err)
    }
  }

  // Fallback: share sheet
  const destPath = `${FileSystem.cacheDirectory}${fileName}`
  await FileSystem.copyAsync({ from: pdfUri, to: destPath })
  await FileSystem.deleteAsync(pdfUri, { idempotent: true })

  await Sharing.shareAsync(destPath, {
    mimeType: 'application/pdf',
    dialogTitle: `Simpan ${fileName}`,
    UTI: 'com.adobe.pdf',
  })

  const info = await FileSystem.getInfoAsync(destPath)
  return {
    filePath: destPath,
    fileName,
    fileSize: (info.exists ? (info as any).size : 0) ?? 0,
  }
}
