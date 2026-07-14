import { View, Text, TextInput } from 'react-native'
import { colors, typography, radius } from '@/constants'

interface InputProps {
  label?: string
  value: string
  onChangeText: (text: string) => void
  placeholder?: string
  error?: string | null
  disabled?: boolean
  multiline?: boolean
  numberOfLines?: number
  keyboardType?: 'default' | 'numeric' | 'email-address' | 'phone-pad'
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters'
  suffix?: string
  maxLength?: number
}

export default function Input({
  label, value, onChangeText, placeholder, error,
  disabled = false, multiline = false, numberOfLines = 1,
  keyboardType = 'default', autoCapitalize = 'none', suffix, maxLength,
}: InputProps) {
  return (
    <View style={{ gap: 6 }}>
      {label && (
        <Text style={{ fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.muted, marginLeft: 4 }}>
          {label}
        </Text>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <TextInput
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: error ? colors.error : colors.hairline,
            borderRadius: radius.md,
            padding: 12,
            fontSize: typography.size.base,
            color: colors.ink,
            backgroundColor: colors.canvas,
            opacity: disabled ? 0.5 : 1,
            textAlignVertical: multiline ? 'top' : 'auto',
            minHeight: multiline ? 80 : undefined,
          }}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedSoft}
          editable={!disabled}
          multiline={multiline}
          numberOfLines={multiline ? numberOfLines : undefined}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          maxLength={maxLength}
        />
        {suffix && (
          <Text style={{ marginLeft: 8, fontSize: typography.size.base, color: colors.muted }}>
            {suffix}
          </Text>
        )}
      </View>
      {error && (
        <Text style={{ fontSize: typography.size.xs, color: colors.error, marginLeft: 4, marginTop: 2 }}>
          {error}
        </Text>
      )}
    </View>
  )
}
