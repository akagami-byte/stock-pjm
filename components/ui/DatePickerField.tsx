// components/ui/DatePickerField.tsx
// Field tanggal yang membuka native date picker (@react-native-community/datetimepicker).
// Android → dialog kalender sistem (seperti gambar date_picker.png)
// iOS     → modal dengan inline calendar + tombol Batal/OK
// Nilai internal tetap "YYYY-MM-DD" agar logika filter yang ada tidak berubah;
// tampilan memakai DD-MM-YYYY (format umum di aplikasi).
import { useState } from 'react'
import {
  View,
  Text,
  Pressable,
  Modal,
  Platform,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
} from 'react-native'
import DateTimePicker from '@react-native-community/datetimepicker'
import { Icon } from '@/components/ui/Icon'
import { colors, typography, radius, spacing } from '@/constants'

interface DatePickerFieldProps {
  /** Label opsional di atas field (mis. "Dari", "Sampai") */
  label?: string
  /** Nilai tanggal, format "YYYY-MM-DD" ('' = kosong) */
  value: string
  /** Dipanggil saat tanggal dipilih, format "YYYY-MM-DD" */
  onChange: (value: string) => void
  /** Placeholder saat kosong */
  placeholder?: string
  /** Gaya wrapper luar (mis. flex: 1 untuk field berdampingan) */
  containerStyle?: StyleProp<ViewStyle>
  /** Gaya field (meniru gaya TextInput yang lama) */
  inputStyle?: StyleProp<TextStyle>
  /** Tanggal maksimum yang boleh dipilih */
  maximumDate?: Date
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** Parse "YYYY-MM-DD" → Date (lokal, hindari parse UTC) */
function parseDateString(s: string): Date | null {
  const parts = s.split('-').map(Number)
  if (parts.length !== 3 || parts.some((n) => isNaN(n))) return null
  const [y, m, d] = parts
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  return new Date(y, m - 1, d)
}

/** Date → "YYYY-MM-DD" (lokal) */
function toDateString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** "YYYY-MM-DD" → "DD-MM-YYYY" untuk tampilan */
function toDisplay(s: string): string {
  const d = parseDateString(s)
  if (!d) return s
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`
}

export default function DatePickerField({
  label,
  value,
  onChange,
  placeholder = 'Pilih Tanggal',
  containerStyle,
  inputStyle,
  maximumDate,
}: DatePickerFieldProps) {
  const [show, setShow] = useState(false)
  const [temp, setTemp] = useState<Date>(new Date())

  const openPicker = () => {
    setTemp(value ? (parseDateString(value) ?? new Date()) : new Date())
    setShow(true)
  }

  // Android: dialog native — langsung commit saat user pilih
  const handleAndroidChange = (_event: any, selected?: Date) => {
    setShow(false)
    if (selected) onChange(toDateString(selected))
  }

  // iOS: modal inline — commit saat tekan OK
  const commitIos = () => {
    setShow(false)
    onChange(toDateString(temp))
  }

  return (
    <View style={containerStyle}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <Pressable
        onPress={openPicker}
        style={({ pressed }) => [styles.field, pressed && styles.fieldPressed]}
      >
        <Text
          style={[styles.valueText, inputStyle, !value && styles.placeholderText]}
          numberOfLines={1}
        >
          {value ? toDisplay(value) : placeholder}
        </Text>
        {value ? (
          <Pressable
            hitSlop={8}
            onPress={() => onChange('')}
            style={styles.clearBtn}
          >
            <Text style={styles.clearText}>✕</Text>
          </Pressable>
        ) : (
          <Icon name="calendar" size={16} color={colors.muted} />
        )}
      </Pressable>

      {show && Platform.OS === 'android' && (
        <DateTimePicker
          value={temp}
          mode="date"
          display="default"
          maximumDate={maximumDate}
          onChange={handleAndroidChange}
        />
      )}

      {show && Platform.OS === 'ios' && (
        <Modal transparent animationType="fade" onRequestClose={() => setShow(false)}>
          <Pressable style={styles.overlay} onPress={() => setShow(false)}>
            {/* stopPropagation: tekan dalam card tidak menutup modal */}
            <Pressable style={styles.card} onPress={() => {}}>
              <DateTimePicker
                value={temp}
                mode="date"
                display="inline"
                maximumDate={maximumDate}
                onChange={(_e, d) => {
                  if (d) setTemp(d)
                }}
              />
              <View style={styles.actions}>
                <Pressable style={styles.actionBtn} onPress={() => setShow(false)}>
                  <Text style={styles.actionTextMuted}>Batal</Text>
                </Pressable>
                <Pressable style={[styles.actionBtn, styles.actionPrimary]} onPress={commitIos}>
                  <Text style={styles.actionTextPrimary}>OK</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  label: {
    fontSize: typography.size.xs,
    color: colors.muted,
    fontWeight: typography.weight.medium,
    marginBottom: 2,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs + 2,
    minHeight: 40,
  },
  fieldPressed: {
    borderColor: colors.brand,
  },
  valueText: {
    fontSize: typography.size.sm,
    color: colors.ink,
    fontFamily: typography.font.mono,
    flex: 1,
    marginRight: spacing.xs,
  },
  placeholderText: {
    color: colors.mutedSoft,
  },
  clearBtn: {
    padding: 2,
    marginLeft: spacing.xs,
  },
  clearText: {
    fontSize: 12,
    color: colors.muted,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  actionBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  actionPrimary: {
    backgroundColor: colors.brand,
  },
  actionTextMuted: {
    color: colors.muted,
    fontWeight: typography.weight.semibold,
  },
  actionTextPrimary: {
    color: '#ffffff',
    fontWeight: typography.weight.semibold,
  },
})
