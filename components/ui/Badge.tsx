import { View, Text } from 'react-native'
import type { BatchStatus } from '@/types'
import { getStatusColor, typography, radius } from '@/constants'

interface BadgeProps {
  status: BatchStatus
  size?: 'sm' | 'md'
}

export default function Badge({ status, size = 'md' }: BadgeProps) {
  const c = getStatusColor(status)
  const isSmall = size === 'sm'

  return (
    <View
      style={{
        backgroundColor: c.background + '18',
        borderRadius: radius.xs,
        paddingHorizontal: isSmall ? 8 : 10,
        paddingVertical: isSmall ? 2 : 4,
        alignSelf: 'flex-start',
      }}
    >
      <Text
        style={{
          fontSize: isSmall ? typography.size.xs : typography.size.sm,
          fontWeight: typography.weight.semibold,
          color: c.background,
        }}
      >
        {c.label}
      </Text>
    </View>
  )
}
