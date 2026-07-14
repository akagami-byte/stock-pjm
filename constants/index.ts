// =============================================================================
// DESIGN TOKENS — from figma-folder + Design-cal.md (Cal.com-inspired)
// =============================================================================
// Replaces old hardcoded colors with proper design token system.
// Figma light theme with Inter + JetBrains Mono typography.
// =============================================================================

import type { BatchStatus, Finishing, TransactionStatus } from '@/types'

// ═══════════════════════════════════════════════════════════════════
// 1. COLOR PALETTE
// ═══════════════════════════════════════════════════════════════════

export const colors = {
  // ── Surfaces ──
  canvas: '#ffffff',
  surfaceCard: '#f5f5f5',
  surfaceSoft: '#f8f9fa',
  surfaceStrong: '#e5e7eb',
  surfaceDark: '#101010',

  // ── Text ──
  ink: '#111111',
  body: '#374151',
  muted: '#6b7280',
  mutedSoft: '#9ca3af',
  onPrimary: '#ffffff',
  onDark: '#ffffff',
  onDarkSoft: '#a1a1aa',

  // ── Actions ──
  primary: '#111111',
  primaryActive: '#242424',
  brand: '#3b82f6',

  // ── Semantic ──
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  orange: '#fb923c',

  // ── Borders ──
  hairline: '#e5e7eb',
  hairlineSoft: '#f3f4f6',
} as const

// ═══════════════════════════════════════════════════════════════════
// 2. STATUS COLOR MAP (from figma App.tsx statusConfig)
// ═══════════════════════════════════════════════════════════════════

export interface StatusColorConfig {
  background: string
  text: string
  icon: string
  label: string
}

export const STATUS_COLORS: Record<BatchStatus, StatusColorConfig> = {
  DRAFT:         { background: '#f59e0b', text: '#ffffff', icon: '📝', label: 'DRAFT' },
  ACTIVE:        { background: '#3b82f6', text: '#ffffff', icon: '🔧', label: 'ACTIVE' },
  AVAILABLE:     { background: '#10b981', text: '#ffffff', icon: '✅', label: 'AVAILABLE' },
  RESERVED:      { background: '#fb923c', text: '#ffffff', icon: '📌', label: 'RESERVED' },
  PARTIALLY_SOLD:{ background: '#f59e0b', text: '#ffffff', icon: '📦', label: 'PARTIAL' },
  SOLD_OUT:      { background: '#6b7280', text: '#ffffff', icon: '❌', label: 'SOLD OUT' },
  OBSOLETE:      { background: '#ef4444', text: '#ffffff', icon: '⚠️', label: 'OBSOLETE' },
  ARCHIVED:      { background: '#e5e7eb', text: '#374151', icon: '📁', label: 'ARCHIVED' },
}

export const TRANSACTION_STATUS_COLORS: Record<TransactionStatus, StatusColorConfig> = {
  RESERVED:  { background: '#fb923c', text: '#ffffff', icon: '📌', label: 'RESERVED' },
  COMPLETED: { background: '#10b981', text: '#ffffff', icon: '✅', label: 'COMPLETED' },
  CANCELLED: { background: '#ef4444', text: '#ffffff', icon: '❌', label: 'CANCELLED' },
  RETURNED:  { background: '#6b7280', text: '#ffffff', icon: '🔄', label: 'RETURNED' },
}

export function getStatusColor(status: BatchStatus): StatusColorConfig {
  return STATUS_COLORS[status]
}

// ═══════════════════════════════════════════════════════════════════
// 3. TYPOGRAPHY
// ═══════════════════════════════════════════════════════════════════

export const typography = {
  font: {
    sans: 'Inter-Regular',
    sansMedium: 'Inter-Medium',
    sansSemiBold: 'Inter-SemiBold',
    sansBold: 'Inter-Bold',
    mono: 'JetBrainsMono-Regular',
    monoBold: 'JetBrainsMono-Bold',
  },
  size: {
    xs: 10,
    sm: 12,
    base: 14,
    md: 16,
    lg: 18,
    xl: 22,
    '2xl': 28,
    '3xl': 36,
  },
  weight: {
    normal: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
} as const

// ═══════════════════════════════════════════════════════════════════
// 4. BORDER RADIUS SCALE (Design-cal.md)
// ═══════════════════════════════════════════════════════════════════

export const radius = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  pill: 9999,
} as const

// ═══════════════════════════════════════════════════════════════════
// 5. SPACING SCALE
// ═══════════════════════════════════════════════════════════════════

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const

// ═══════════════════════════════════════════════════════════════════
// 6. STATUS TRANSITION MAP (State Machine — unchanged)
// ═══════════════════════════════════════════════════════════════════

export type StatusTransitionMap = Record<BatchStatus, BatchStatus[]>

export const STATUS_TRANSITIONS: StatusTransitionMap = {
  DRAFT: ['ACTIVE'],
  ACTIVE: ['AVAILABLE'],
  AVAILABLE: ['RESERVED', 'SOLD_OUT', 'OBSOLETE'],
  RESERVED: ['AVAILABLE', 'PARTIALLY_SOLD', 'SOLD_OUT'],
  PARTIALLY_SOLD: ['SOLD_OUT', 'AVAILABLE'],
  SOLD_OUT: ['PARTIALLY_SOLD', 'ARCHIVED'],
  OBSOLETE: ['ARCHIVED'],
  ARCHIVED: [],
}

export function canTransitionStatus(from: BatchStatus, to: BatchStatus): boolean {
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false
}

export function getAllowedTransitions(from: BatchStatus): BatchStatus[] {
  return STATUS_TRANSITIONS[from] ?? []
}

// ═══════════════════════════════════════════════════════════════════
// 7. MANDATORY FIELDS PER TRANSITION
// ═══════════════════════════════════════════════════════════════════

export interface TransitionRequirement {
  requiresCompany: boolean
  requiresNote: boolean
  requiresQuantity: boolean
  description: string
}

export const TRANSITION_REQUIREMENTS: Partial<
  Record<`${BatchStatus}_${BatchStatus}`, TransitionRequirement>
> = {
  AVAILABLE_RESERVED: {
    requiresCompany: true, requiresNote: false, requiresQuantity: false,
    description: 'Pilih perusahaan pembeli (WAJIB)',
  },
  AVAILABLE_SOLD_OUT: {
    requiresCompany: true, requiresNote: false, requiresQuantity: false,
    description: 'Pilih perusahaan pembeli (WAJIB). Akan lanjut ke transaksi.',
  },
  AVAILABLE_OBSOLETE: {
    requiresCompany: false, requiresNote: true, requiresQuantity: false,
    description: 'Alasan obsolete WAJIB diisi',
  },
  RESERVED_AVAILABLE: {
    requiresCompany: false, requiresNote: false, requiresQuantity: false,
    description: 'Pembatalan pesanan (alasan opsional)',
  },
  RESERVED_PARTIALLY_SOLD: {
    requiresCompany: false, requiresNote: false, requiresQuantity: false,
    description: 'Akan diarahkan ke halaman transaksi',
  },
  RESERVED_SOLD_OUT: {
    requiresCompany: false, requiresNote: false, requiresQuantity: false,
    description: 'Akan diarahkan ke halaman transaksi',
  },
  PARTIALLY_SOLD_AVAILABLE: {
    requiresCompany: false, requiresNote: true, requiresQuantity: false,
    description: 'Alasan retur WAJIB diisi',
  },
  PARTIALLY_SOLD_SOLD_OUT: {
    requiresCompany: false, requiresNote: false, requiresQuantity: false,
    description: 'Akan diarahkan ke halaman transaksi',
  },
  SOLD_OUT_PARTIALLY_SOLD: {
    requiresCompany: false, requiresNote: true, requiresQuantity: false,
    description: 'Alasan retur WAJIB diisi',
  },
}

export function getTransitionRequirements(
  from: BatchStatus,
  to: BatchStatus
): TransitionRequirement | null {
  const key = `${from}_${to}` as `${BatchStatus}_${BatchStatus}`
  return TRANSITION_REQUIREMENTS[key] ?? null
}

// ═══════════════════════════════════════════════════════════════════
// 8. FINISHING CONFIG
// ═══════════════════════════════════════════════════════════════════

export interface FinishingConfig {
  code: Finishing
  label: string
  description: string
}

export const FINISHING_OPTIONS: FinishingConfig[] = [
  { code: 'C', label: 'Chrome', description: 'Chrome finishing' },
  { code: 'P', label: 'Plating', description: 'Plating finishing' },
  { code: 'S', label: 'Stainless', description: 'Stainless steel finishing' },
]

export function getFinishingLabel(code: Finishing): string {
  return FINISHING_OPTIONS.find((f) => f.code === code)?.label ?? code
}

// ═══════════════════════════════════════════════════════════════════
// 9. APP CONFIGURATION CONSTANTS
// ═══════════════════════════════════════════════════════════════════

export const BATCH_CODE = {
  INITIAL_LETTERS: 'AA',
  INITIAL_NUMBER: 1,
  MAX_NUMBER: 9999,
  PAD_LENGTH: 4,
} as const

export const SCANNER = {
  TIMEOUT_MS: 10000,
  DEBOUNCE_MS: 1000,
} as const

export const AUTO_SUGGEST = {
  MIN_CHARS: 2,
  DEBOUNCE_MS: 300,
  MAX_RESULTS: 10,
} as const

export const LOW_STOCK_THRESHOLD = 0.05
export const TRASH_DEADLINE_DAYS = 30
export const RESERVATION_DEADLINE_DAYS = 3

export const IMAGE_UPLOAD = {
  MAX_SIZE_BYTES: 5 * 1024 * 1024,
  ALLOWED_TYPES: ['image/jpeg', 'image/png'],
} as const

export const DATE_FORMAT = 'DD-MM-YYYY'

export const CURRENCY = {
  code: 'IDR',
  symbol: 'Rp',
  locale: 'id-ID',
} as const

export const ALL_BATCH_STATUSES: BatchStatus[] = [
  'DRAFT', 'ACTIVE', 'AVAILABLE', 'RESERVED',
  'PARTIALLY_SOLD', 'SOLD_OUT', 'OBSOLETE', 'ARCHIVED',
]
