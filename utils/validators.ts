import type { Finishing } from '@/types'

/**
 * Validate email format.
 */
export function isValidEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return re.test(email)
}

/**
 * Validate that a string is not empty (after trimming).
 */
export function isNotEmpty(value: string): boolean {
  return value.trim().length > 0
}

/**
 * Validate quantity (must be a positive integer).
 */
export function isValidQuantity(qty: number): boolean {
  return Number.isInteger(qty) && qty > 0
}

/**
 * Validate price (must be non-negative number).
 */
export function isValidPrice(price: number): boolean {
  return typeof price === 'number' && price >= 0
}

/**
 * Validate finishing code.
 */
export function isValidFinishing(f: string): f is Finishing {
  return ['C', 'P', 'S'].includes(f)
}

/**
 * Validate batch code format (2 uppercase letters + 4 digits).
 * E.g. "AA0001", "ZZ9999"
 */
export function isValidBatchCode(code: string): boolean {
  return /^[A-Z]{2}\d{4}$/.test(code)
}

/**
 * Validate image file:
 * - Must be JPG or PNG
 * - Must be ≤ maxSizeBytes (default 5MB)
 */
export function validateImageFile(
  mimeType: string,
  sizeBytes: number,
  maxSizeBytes: number = 5 * 1024 * 1024
): { valid: boolean; error?: string } {
  const allowedTypes = ['image/jpeg', 'image/png']

  if (!allowedTypes.includes(mimeType)) {
    return { valid: false, error: 'Format gambar harus JPG atau PNG' }
  }

  if (sizeBytes > maxSizeBytes) {
    const maxMB = Math.round(maxSizeBytes / (1024 * 1024))
    return { valid: false, error: `Ukuran gambar maksimal ${maxMB}MB` }
  }

  return { valid: true }
}

/**
 * Product form validation.
 */
export function validateProductForm(data: {
  product_name: string
}): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {}

  if (!isNotEmpty(data.product_name)) {
    errors.product_name = 'Nama produk tidak boleh kosong'
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  }
}

/**
 * Variant form validation.
 */
export function validateVariantForm(data: {
  version: string
  finishing: string
  base_price: number
}): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {}

  if (!isNotEmpty(data.version)) {
    errors.version = 'Versi produk tidak boleh kosong'
  }

  if (!isValidFinishing(data.finishing)) {
    errors.finishing = 'Finishing harus C, P, atau S'
  }

  if (!isValidPrice(data.base_price) || data.base_price <= 0) {
    errors.base_price = 'Harga dasar harus lebih dari 0'
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  }
}

/**
 * Batch creation form validation.
 */
export function validateBatchForm(data: {
  variant_id: string
  initial_qty: number
  total_batches: number
}): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {}

  if (!isNotEmpty(data.variant_id)) {
    errors.variant_id = 'Varian produk harus dipilih'
  }

  if (!isValidQuantity(data.initial_qty)) {
    errors.initial_qty = 'Jumlah unit harus minimal 1'
  }

  if (!isValidQuantity(data.total_batches)) {
    errors.total_batches = 'Jumlah batch harus minimal 1'
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  }
}

/**
 * Transaction form validation.
 */
export function validateTransactionForm(data: {
  company_name: string
  items: Array<{ batch_id: string; quantity_sold: number; price_per_unit: number }>
}): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {}

  if (!isNotEmpty(data.company_name)) {
    errors.company_name = 'Nama perusahaan WAJIB diisi'
  }

  if (data.items.length === 0) {
    errors.items = 'Minimal 1 produk harus ditambahkan'
  }

  for (let i = 0; i < data.items.length; i++) {
    const item = data.items[i]
    if (!isValidQuantity(item.quantity_sold)) {
      errors[`item_${i}_qty`] = `Jumlah produk #${i + 1} harus minimal 1`
    }
    if (!isValidPrice(item.price_per_unit)) {
      errors[`item_${i}_price`] = `Harga produk #${i + 1} tidak valid`
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  }
}
