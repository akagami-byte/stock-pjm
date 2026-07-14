import { BATCH_CODE } from '@/constants'

/**
 * Generate the next batch code following the pattern:
 * AA0001 → AA0002 → ... → AA9999 → AB0001 → ... → AZ9999 → BA0001 → ...
 *
 * @param lastCode - The last used batch code (e.g. "AA0001")
 * @returns The next available batch code
 */
export function generateNextBatchCode(lastCode: string | null): string {
  if (!lastCode) {
    return `${BATCH_CODE.INITIAL_LETTERS}${String(BATCH_CODE.INITIAL_NUMBER).padStart(BATCH_CODE.PAD_LENGTH, '0')}`
  }

  const letters = lastCode.substring(0, 2)
  const numbers = parseInt(lastCode.substring(2), 10)

  if (numbers < BATCH_CODE.MAX_NUMBER) {
    return letters + String(numbers + 1).padStart(BATCH_CODE.PAD_LENGTH, '0')
  } else {
    // Overflow: increment letters
    const newLetters = incrementLetters(letters)
    return newLetters + String(1).padStart(BATCH_CODE.PAD_LENGTH, '0')
  }
}

/**
 * Increment the 2-letter prefix.
 * AA → AB → ... → AZ → BA → ... → ZZ → (error)
 */
function incrementLetters(letters: string): string {
  const first = letters.charCodeAt(0)
  const second = letters.charCodeAt(1)

  if (second < 90) {
    // Z = 90
    return letters[0] + String.fromCharCode(second + 1)
  } else if (first < 90) {
    return String.fromCharCode(first + 1) + 'A'
  } else {
    throw new Error('Batch code overflow: exceeded ZZ9999')
  }
}

/**
 * Parse a full barcode string to extract components.
 * Format: PRODUCT_CODE-VERSION-FINISHING-BATCH_CODE
 * E.g. "HGP-00-C-AA0001" → { productCode: "HGP", version: "00", finishing: "C", batchCode: "AA0001" }
 */
export function parseBarcodeString(barcode: string): {
  productCode: string
  version: string
  finishing: string
  batchCode: string
} | null {
  const parts = barcode.split('-')
  if (parts.length < 4) return null

  return {
    productCode: parts[0],
    version: parts[1],
    finishing: parts[2],
    batchCode: parts.slice(3).join('-'), // Handle potential hyphens in batch code
  }
}

/**
 * Build a full barcode string from components.
 */
export function buildBarcodeString(
  productCode: string,
  version: string,
  finishing: string,
  batchCode: string
): string {
  return `${productCode}-${version}-${finishing}-${batchCode}`
}
