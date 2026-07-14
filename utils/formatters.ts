import { CURRENCY } from '@/constants'

/**
 * Format a number as Indonesian Rupiah currency.
 * E.g. 50000 → "Rp 50.000"
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat(CURRENCY.locale, {
    style: 'currency',
    currency: CURRENCY.code,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

/**
 * Format a number with thousand separators.
 * E.g. 50000 → "50.000"
 */
export function formatNumber(num: number): string {
  return new Intl.NumberFormat(CURRENCY.locale).format(num)
}

/**
 * Format an ISO timestamp to DD-MM-YYYY.
 * E.g. "2026-05-26T10:30:00Z" → "26-05-2026"
 */
export function formatDate(isoString: string): string {
  const date = new Date(isoString)
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const yyyy = date.getFullYear()
  return `${dd}-${mm}-${yyyy}`
}

/**
 * Format an ISO timestamp to DD-MM-YYYY HH:mm.
 * E.g. "2026-05-26T10:30:00Z" → "26-05-2026 10:30"
 */
export function formatDateTime(isoString: string): string {
  const date = new Date(isoString)
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const yyyy = date.getFullYear()
  const hh = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${dd}-${mm}-${yyyy} ${hh}:${min}`
}

/**
 * Format an ISO timestamp to relative time.
 * E.g. "2 jam lalu", "5 menit lalu", "baru saja"
 */
export function formatRelativeTime(isoString: string): string {
  const now = new Date()
  const then = new Date(isoString)
  const diffMs = now.getTime() - then.getTime()
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMinutes < 1) return 'baru saja'
  if (diffMinutes < 60) return `${diffMinutes} menit lalu`
  if (diffHours < 24) return `${diffHours} jam lalu`
  if (diffDays < 7) return `${diffDays} hari lalu`
  return formatDate(isoString)
}

/**
 * Format days remaining until a deadline.
 * Returns "X hari lagi" or "Lewat X hari"
 */
export function formatDeadline(isoString: string): string {
  const now = new Date()
  const deadline = new Date(isoString)
  const diffMs = deadline.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays > 0) return `${diffDays} hari lagi`
  if (diffDays === 0) return 'Hari ini'
  return `Lewat ${Math.abs(diffDays)} hari`
}

/**
 * Truncate text with ellipsis.
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - 3) + '...'
}

/**
 * Format percentage with 1 decimal.
 * E.g. 0.035 → "3.5%"
 */
export function formatPercentage(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}
