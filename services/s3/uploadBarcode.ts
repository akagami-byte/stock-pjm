// services/s3/uploadBarcode.ts
import * as FileSystem from 'expo-file-system/legacy'
import CryptoJS from 'crypto-js'

// ═══════════════════════════════════════════════════
// Konfigurasi (pindahkan ke .env untuk production)
// ═══════════════════════════════════════════════════

const S3_CONFIG = {
  endpoint: process.env.EXPO_PUBLIC_S3_ENDPOINT || 'https://is3.cloudhost.id',
  region: process.env.EXPO_PUBLIC_S3_REGION || 'id-jkt-1',
  bucket: process.env.EXPO_PUBLIC_S3_BUCKET || 'pjm-mobile-storage',
  accessKeyId: process.env.EXPO_PUBLIC_S3_ACCESS_KEY_ID || '',
  secretAccessKey: process.env.EXPO_PUBLIC_S3_SECRET_ACCESS_KEY || '',
}

// ═══════════════════════════════════════════════════
// AWS Signature V4 Manual (via crypto-js)
// ═══════════════════════════════════════════════════

/**
 * Sign request menggunakan AWS Signature Version 4.
 * Kompatibel dengan IdCloudHost S3-compatible storage.
 */
async function signRequestV4(
  method: string,
  objectKey: string,
  contentType: string,
  payloadBase64: string,
): Promise<{ url: string; headers: Record<string, string> }> {
  const { endpoint, region, bucket, accessKeyId, secretAccessKey } = S3_CONFIG

  const service = 's3'
  const host = endpoint.replace('https://', '')
  const now = new Date()
  const amzDate =
    now.getUTCFullYear().toString() +
    String(now.getUTCMonth() + 1).padStart(2, '0') +
    String(now.getUTCDate()).padStart(2, '0') +
    'T' +
    String(now.getUTCHours()).padStart(2, '0') +
    String(now.getUTCMinutes()).padStart(2, '0') +
    String(now.getUTCSeconds()).padStart(2, '0') +
    'Z'
  const dateStamp = amzDate.slice(0, 8)

  const canonicalUri = `/${bucket}/${objectKey}`
  const canonicalQuerystring = ''
  const canonicalHeaders =
    `content-type:${contentType}\n` +
    `host:${host}\n` +
    `x-amz-acl:public-read\n` +
    `x-amz-content-sha256:${payloadBase64}\n` +
    `x-amz-date:${amzDate}\n`

  const signedHeaders = 'content-type;host;x-amz-acl;x-amz-content-sha256;x-amz-date'

  const payloadHash = payloadBase64 // SHA256 dari konten file

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuerystring,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n')

  const algorithm = 'AWS4-HMAC-SHA256'
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    CryptoJS.SHA256(canonicalRequest).toString(CryptoJS.enc.Hex),
  ].join('\n')

  // Derive signing key
  const kDate = CryptoJS.HmacSHA256(dateStamp, `AWS4${secretAccessKey}`)
  const kRegion = CryptoJS.HmacSHA256(region, kDate)
  const kService = CryptoJS.HmacSHA256(service, kRegion)
  const kSigning = CryptoJS.HmacSHA256('aws4_request', kService)

  const signature = CryptoJS.HmacSHA256(stringToSign, kSigning).toString(
    CryptoJS.enc.Hex,
  )

  const authorizationHeader =
    `${algorithm} ` +
    `Credential=${accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, ` +
    `Signature=${signature}`

  return {
    url: `${endpoint}${canonicalUri}`,
    headers: {
      'Content-Type': contentType,
      'x-amz-acl': 'public-read',
      'x-amz-content-sha256': payloadBase64,
      'x-amz-date': amzDate,
      Authorization: authorizationHeader,
    },
  }
}

// ═══════════════════════════════════════════════════
// Tipe
// ═══════════════════════════════════════════════════

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
  /** URL public untuk diakses */
  publicUrl: string
  /** Object key di bucket */
  key: string
  /** HTTP status code */
  statusCode: number
}

// ═══════════════════════════════════════════════════
// Fungsi Upload Utama
// ═══════════════════════════════════════════════════

/**
 * Upload file gambar barcode ke IdCloudHost Object Storage.
 *
 * @param localFileUri - Path lokal file (dari captureRef atau expo-file-system)
 * @param batchCode   - Kode batch untuk nama file (contoh: 'AA0001')
 * @param prefix      - Prefix folder di bucket (default: 'barcodes/')
 * @returns UploadResult dengan publicUrl
 */
export async function uploadBarcodeToS3(
  localFileUri: string,
  batchCode: string,
  prefix: string = 'barcodes/',
): Promise<UploadResult> {
  // 1. Baca file sebagai base64
  const fileBase64 = await FileSystem.readAsStringAsync(localFileUri, {
    encoding: FileSystem.EncodingType.Base64,
  })

  // 2. Generate nama file unik + deteksi content type
  const timestamp = Date.now()
  const { ext, mime: contentType } = detectContentType(localFileUri)
  const objectKey = `${prefix}${batchCode}_${timestamp}.${ext}`

  // 3. Build signed request
  // SHA256 dari binary file (bukan hex string-nya!)
  const payloadHash = CryptoJS.SHA256(
    CryptoJS.enc.Base64.parse(fileBase64),
  ).toString(CryptoJS.enc.Hex)

  const { url, headers } = await signRequestV4(
    'PUT',
    objectKey,
    contentType,
    payloadHash,
  )

  // 4. Upload via FileSystem.uploadAsync (PUT method)
  const uploadResult = await FileSystem.uploadAsync(url, localFileUri, {
    httpMethod: 'PUT',
    headers,
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
  })

  if (uploadResult.status < 200 || uploadResult.status >= 300) {
    const body = typeof uploadResult.body === 'string'
      ? uploadResult.body.slice(0, 500)
      : JSON.stringify(uploadResult.body).slice(0, 500)
    throw new Error(`Upload gagal: HTTP ${uploadResult.status}\n${body}`)
  }

  // 5. Build public URL
  const publicUrl = `${S3_CONFIG.endpoint}/${S3_CONFIG.bucket}/${objectKey}`

  return {
    publicUrl,
    key: objectKey,
    statusCode: uploadResult.status,
  }
}

// ═══════════════════════════════════════════════════
// Helper: Hapus file dari S3
// ═══════════════════════════════════════════════════

export async function deleteBarcodeFromS3(objectKey: string): Promise<void> {
  const payloadHash = CryptoJS.SHA256('').toString(CryptoJS.enc.Hex)

  const { url, headers } = await signRequestV4(
    'DELETE',
    objectKey,
    'application/octet-stream',
    payloadHash,
  )

  const response = await fetch(url, { method: 'DELETE', headers })
  if (response.status >= 300) {
    throw new Error(`Delete gagal: HTTP ${response.status}`)
  }
}
