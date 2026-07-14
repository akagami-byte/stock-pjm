import { View } from 'react-native'
import { colors, radius, spacing } from '@/constants'

interface CardProps {
  children: React.ReactNode
  style?: object
  padded?: boolean
}

export default function Card({ children, style, padded = true }: CardProps) {
  return (
    <View
      style={[
        {
          backgroundColor: colors.surfaceCard,
          borderRadius: radius.lg,
        },
        padded && { padding: spacing.md },
        style,
      ]}
    >
      {children}
    </View>
  )
}
