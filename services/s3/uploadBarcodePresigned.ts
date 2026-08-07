// services/s3/uploadBarcodePresigned.ts
import * as FileSystem from 'expo-file-system/legacy'
import Constants from 'expo-constants'

/**
 * Resolve Supabase URL — same pattern as lib/supabase.ts.
 * Works in Expo Go, EAS builds, and production.
 */
function getApiBase(): string {
  // env vars dari app.config.js extra (EAS build / production)
  const fromExtra = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_URL as string | undefined
  // Fallback ke process.env (Metro / Expo Go dev)
  const fromEnv = fromExtra || process.env.EXPO_PUBLIC_SUPABASE_URL
  // Fallback ke env var khusus API (bisa berbeda dari Supabase URL)
  const apiUrl = fromEnv || process.env.EXPO_PUBLIC_API_URL
  // Last resort: local dev fallback
  return apiUrl || 'http://localhost:54321'
}

/** Map ekstensi file → MIME type */
const EXT_TO_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
}

function detectContentType(uri: string): { ext: string; mime: string } {
  const match = uri.match(/\.(\w+)(?:\?.*)?$/)
  const ext = match ? match[1].toLowerCase() : 'png'
  const mime = EXT_TO_MIME[ext] || 'image/png'
  return { ext, mime }
}

export interface UploadResult {
  publicUrl: string
  key: string
  statusCode: number
}

/**
 * Upload file gambar ke S3 via presigned URL dari backend Edge Function.
 * Kredensial S3 hanya di server — aman, tidak perlu embed secret key di client.
 *
 * @param localFileUri - Path lokal file (dari ImagePicker)
 * @param batchCode    - Kode untuk nama file (contoh: 'AA0001')
 * @param prefix       - Prefix folder di bucket (default: 'barcodes/')
 */
export async function uploadBarcodePresigned(
  localFileUri: string,
  batchCode: string,
  prefix: string = 'barcodes/',
): Promise<UploadResult> {
  const API_BASE = getApiBase()
  const timestamp = Date.now()
  const { ext, mime: contentType } = detectContentType(localFileUri)
  const objectKey = `${prefix}${batchCode}_${timestamp}.${ext}`

  // 1. Minta presigned URL dari backend
  const presignResp = await fetch(`${API_BASE}/functions/v1/s3-presign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: objectKey,
      contentType,
    }),
  })

  if (!presignResp.ok) {
    const errBody = await presignResp.text().catch(() => '')
    throw new Error(
      `Presigned URL gagal: HTTP ${presignResp.status}\n${errBody.slice(0, 300)}`,
    )
  }

  const { uploadUrl, publicUrl } = await presignResp.json()

  // 2. Upload file ke presigned URL
  const uploadResult = await FileSystem.uploadAsync(uploadUrl, localFileUri, {
    httpMethod: 'PUT',
    headers: { 'Content-Type': contentType, 'x-amz-acl': 'public-read' },
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
  })

  if (uploadResult.status < 200 || uploadResult.status >= 300) {
    const body =
      typeof uploadResult.body === 'string'
        ? uploadResult.body.slice(0, 500)
        : JSON.stringify(uploadResult.body).slice(0, 500)
    throw new Error(`Upload gagal: HTTP ${uploadResult.status}\n${body}`)
  }

  return {
    publicUrl,
    key: objectKey,
    statusCode: uploadResult.status,
  }
}
