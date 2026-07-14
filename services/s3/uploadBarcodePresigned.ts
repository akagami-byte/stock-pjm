// services/s3/uploadBarcodePresigned.ts
import * as FileSystem from 'expo-file-system/legacy'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://100.118.194.66:3050'

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

  // 2. Upload file ke presigned URL (harus sertakan x-amz-acl)
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
