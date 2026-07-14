// components/scanner/ScanEditModal.tsx
// Popup edit hasil scan — user bisa koreksi tiap komponen sebelum confirm

import React, { useState, useEffect } from 'react'
import {
  View, Text, Modal, StyleSheet, Pressable, TextInput,
  ScrollView,
} from 'react-native'
import { colors, typography, radius } from '@/constants'

// ─── Types ───────────────────────────────────────────────────────
export interface ParsedBarcode {
  productCode: string
  version: string
  finishing: string
  batchCode: string
}

interface ScanEditModalProps {
  visible: boolean
  rawBarcode: string
  onConfirm: (barcode: string) => void
  onCancel: () => void
}

// ─── Parser ──────────────────────────────────────────────────────
function parseBarcode(raw: string): ParsedBarcode | null {
  const parts = raw.trim().toUpperCase().split('-')
  if (parts.length >= 4) {
    return {
      productCode: parts[0],
      version: parts[1],
      finishing: parts[2],
      batchCode: parts.slice(3).join('-'),
    }
  }
  // Batch-code-only format: AA0001
  if (/^[A-Z]{2}\d{4}$/.test(raw)) {
    return { productCode: '', version: '', finishing: '', batchCode: raw }
  }
  return null
}

// ─── Constants untuk dropdown ────────────────────────────────────
const FINISHING_OPTIONS = ['C', 'P', 'S']
const FINISHING_LABELS: Record<string, string> = {
  C: 'Chrome',
  P: 'Plating',
  S: 'Stainless',
}

// ─── Component ───────────────────────────────────────────────────
export default function ScanEditModal({
  visible,
  rawBarcode,
  onConfirm,
  onCancel,
}: ScanEditModalProps) {
  const [productCode, setProductCode] = useState('')
  const [version, setVersion] = useState('')
  const [finishing, setFinishing] = useState('C')
  const [batchCode, setBatchCode] = useState('')
  const [showFinishingPicker, setShowFinishingPicker] = useState(false)

  // Parse raw barcode saat modal muncul
  useEffect(() => {
    if (!visible) return
    const parsed = parseBarcode(rawBarcode)
    if (parsed) {
      setProductCode(parsed.productCode)
      setVersion(parsed.version)
      setFinishing(parsed.finishing || 'C')
      setBatchCode(parsed.batchCode)
    } else {
      // Fallback: isi semua kosong, batchCode = raw
      setProductCode('')
      setVersion('')
      setFinishing('C')
      setBatchCode(rawBarcode)
    }
  }, [visible, rawBarcode])

  const handleConfirm = () => {
    const parts: string[] = []
    if (productCode.trim()) parts.push(productCode.trim().toUpperCase())
    if (version.trim()) parts.push(version.trim())
    if (parts.length > 0) parts.push(finishing) // finishing selalu ada kalau ada prefix
    parts.push(batchCode.trim().toUpperCase())
    onConfirm(parts.join('-'))
  }

  const rebuiltPreview = [
    productCode || '___',
    version || '__',
    finishing,
    batchCode || '______',
  ].join('-')

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.modal}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>Edit Kode QR</Text>

            {/* Raw scanned */}
            <View style={styles.rawBox}>
              <Text style={styles.rawLabel}>Hasil Scan QR</Text>
              <Text style={styles.rawText}>{rawBarcode}</Text>
            </View>

            {/* Product Code */}
            <Text style={styles.label}>Kode Produk</Text>
            <TextInput
              style={styles.input}
              value={productCode}
              onChangeText={(t) => setProductCode(t.toUpperCase().slice(0, 3))}
              placeholder="HGP"
              placeholderTextColor={colors.mutedSoft}
              autoCapitalize="characters"
              maxLength={3}
            />

            {/* Version */}
            <Text style={styles.label}>Versi</Text>
            <TextInput
              style={styles.input}
              value={version}
              onChangeText={(t) => setVersion(t.replace(/[^0-9]/g, '').slice(0, 2))}
              placeholder="00"
              placeholderTextColor={colors.mutedSoft}
              keyboardType="numeric"
              maxLength={2}
            />

            {/* Finishing — dropdown chip style */}
            <Text style={styles.label}>Finishing</Text>
            <Pressable
              style={styles.dropdown}
              onPress={() => setShowFinishingPicker(!showFinishingPicker)}
            >
              <Text style={styles.dropdownText}>
                [{finishing}] {FINISHING_LABELS[finishing]}
              </Text>
              <Text style={styles.dropdownArrow}>
                {showFinishingPicker ? '▲' : '▼'}
              </Text>
            </Pressable>
            {showFinishingPicker && (
              <View style={styles.pickerContainer}>
                {FINISHING_OPTIONS.map((f) => (
                  <Pressable
                    key={f}
                    style={[
                      styles.pickerItem,
                      finishing === f && styles.pickerItemActive,
                    ]}
                    onPress={() => {
                      setFinishing(f)
                      setShowFinishingPicker(false)
                    }}
                  >
                    <Text
                      style={[
                        styles.pickerItemText,
                        finishing === f && styles.pickerItemTextActive,
                      ]}
                    >
                      [{f}] {FINISHING_LABELS[f]}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            {/* Batch Code */}
            <Text style={styles.label}>Kode Batch</Text>
            <TextInput
              style={[styles.input, styles.batchInput]}
              value={batchCode}
              onChangeText={(t) =>
                setBatchCode(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))
              }
              placeholder="AA0001"
              placeholderTextColor={colors.mutedSoft}
              autoCapitalize="characters"
              maxLength={6}
            />

            {/* Preview rebuilt */}
            <View style={styles.previewBox}>
              <Text style={styles.previewLabel}>Preview</Text>
              <Text style={styles.previewText}>{rebuiltPreview}</Text>
            </View>

            {/* Actions */}
            <View style={styles.actions}>
              <Pressable style={styles.cancelBtn} onPress={onCancel}>
                <Text style={styles.cancelText}>Batal</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.confirmBtn,
                  !batchCode.trim() && styles.confirmBtnDisabled,
                ]}
                onPress={handleConfirm}
                disabled={!batchCode.trim()}
              >
                <Text style={styles.confirmText}>✅ Confirm</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

// ─── Styles ───────────────────────────────────────────────────────
const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: '#1a1a2e',
    borderRadius: radius.xl,
    padding: 20,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: '#2a2a4e',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 16,
  },
  rawBox: {
    backgroundColor: '#0f0f23',
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#3b82f644',
  },
  rawLabel: {
    fontSize: 11,
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  rawText: {
    fontSize: 16,
    fontFamily: typography.font.mono,
    color: '#3b82f6',
    fontWeight: '700',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#a0a0c0',
    marginTop: 12,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#0f0f23',
    borderWidth: 1,
    borderColor: '#2a2a4e',
    borderRadius: radius.md,
    padding: 12,
    fontSize: 15,
    color: '#fff',
    fontFamily: typography.font.mono,
  },
  batchInput: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 2,
  },
  dropdown: {
    backgroundColor: '#0f0f23',
    borderWidth: 1,
    borderColor: '#2a2a4e',
    borderRadius: radius.md,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownText: {
    fontSize: 14,
    color: '#fff',
    fontFamily: typography.font.mono,
  },
  dropdownArrow: {
    fontSize: 10,
    color: colors.muted,
  },
  pickerContainer: {
    backgroundColor: '#0f0f23',
    borderWidth: 1,
    borderColor: '#2a2a4e',
    borderRadius: radius.md,
    marginTop: 4,
    overflow: 'hidden',
  },
  pickerItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4e',
  },
  pickerItemActive: {
    backgroundColor: '#3b82f622',
  },
  pickerItemText: {
    fontSize: 14,
    color: '#a0a0c0',
    fontFamily: typography.font.mono,
  },
  pickerItemTextActive: {
    color: '#3b82f6',
    fontWeight: '700',
  },
  previewBox: {
    marginTop: 16,
    backgroundColor: '#3b82f612',
    borderRadius: radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: '#3b82f633',
    alignItems: 'center',
  },
  previewLabel: {
    fontSize: 11,
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  previewText: {
    fontSize: 18,
    fontFamily: typography.font.mono,
    color: '#3b82f6',
    fontWeight: '700',
    letterSpacing: 1,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#2a2a4e',
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 15,
    color: colors.muted,
    fontWeight: '600',
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.md,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
  },
  confirmBtnDisabled: {
    backgroundColor: '#3b82f644',
  },
  confirmText: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '700',
  },
})
