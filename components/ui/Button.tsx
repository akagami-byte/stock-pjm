import { Pressable, Text, ActivityIndicator, StyleSheet } from 'react-native'
import { colors, typography, radius, spacing } from '@/constants'

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost'
export type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps {
  title: string
  onPress: () => void
  variant?: ButtonVariant
  size?: ButtonSize
  disabled?: boolean
  loading?: boolean
  fullWidth?: boolean
}

const variantMap: Record<ButtonVariant, { bg: string; text: string; border?: string }> = {
  primary:   { bg: colors.primary, text: colors.onPrimary },
  secondary: { bg: colors.canvas, text: colors.ink, border: colors.hairline },
  outline:   { bg: colors.canvas, text: colors.ink, border: colors.hairline },
  danger:    { bg: colors.error, text: colors.onPrimary },
  ghost:     { bg: 'transparent', text: colors.ink },
}

const sizeMap: Record<ButtonSize, { py: number; px: number; fs: number }> = {
  sm: { py: 8, px: 14, fs: typography.size.sm },
  md: { py: 12, px: 20, fs: typography.size.base },
  lg: { py: 14, px: 24, fs: typography.size.md },
}

export default function Button({
  title, onPress, variant = 'primary', size = 'md',
  disabled = false, loading = false, fullWidth = false,
}: ButtonProps) {
  const v = variantMap[variant]
  const s = sizeMap[size]
  const isDisabled = disabled || loading

  return (
    <Pressable
      style={({ pressed }) => [
        {
          backgroundColor: isDisabled ? colors.surfaceStrong
            : pressed && variant === 'primary' ? colors.primaryActive
            : pressed ? colors.surfaceSoft
            : v.bg,
          borderColor: v.border ?? 'transparent',
          borderWidth: v.border ? 1 : 0,
          paddingVertical: s.py,
          paddingHorizontal: s.px,
          borderRadius: radius.md,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row' as const,
          gap: 8,
        },
      ]}
      onPress={onPress}
      disabled={isDisabled}
    >
      {loading ? (
        <ActivityIndicator color={v.text} size="small" />
      ) : (
        <Text style={{ color: v.text, fontSize: s.fs, fontWeight: typography.weight.semibold }}>
          {title}
        </Text>
      )}
    </Pressable>
  )
}
