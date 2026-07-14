import { Tabs } from 'expo-router'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, typography } from '@/constants'
import { useAuthStore } from '@/stores/authStore'
import Svg, { Path, Rect, Circle, Line, Polyline } from 'react-native-svg'

function DashboardIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Rect x="3" y="3" width="7" height="9" />
      <Rect x="14" y="3" width="7" height="5" />
      <Rect x="14" y="12" width="7" height="9" />
      <Rect x="3" y="16" width="7" height="5" />
    </Svg>
  )
}

function LabelIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <Line x1="7" y1="7" x2="7.01" y2="7" />
    </Svg>
  )
}

function CameraIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <Circle cx="12" cy="13" r="4" />
    </Svg>
  )
}

function BoxIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <Polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <Line x1="12" y1="22.08" x2="12" y2="12" />
    </Svg>
  )
}

function TransactionIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Line x1="12" y1="1" x2="12" y2="23" />
      <Path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </Svg>
  )
}

export default function TabLayout() {
  const insets = useSafeAreaInsets()
  const role = useAuthStore((s) => s.user?.role ?? 'staff')

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.canvas,
          borderTopColor: colors.hairline,
          borderTopWidth: 1,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom + 6,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: typography.size.xs,
          fontWeight: typography.weight.semibold,
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Dashboard', tabBarIcon: ({ color }) => <DashboardIcon color={color} size={20} />, href: role === 'owner' ? undefined : null }} />
      <Tabs.Screen name="label"  options={{ title: 'Label',     tabBarIcon: ({ color }) => <LabelIcon color={color} size={20} /> }} />
      <Tabs.Screen name="scan"   options={{ title: 'Scan',      tabBarIcon: ({ color }) => <CameraIcon color={color} size={20} /> }} />
      <Tabs.Screen name="stock"  options={{ title: 'Stok',      tabBarIcon: ({ color }) => <BoxIcon color={color} size={20} /> }} />
      <Tabs.Screen name="transaction" options={{ title: 'Transaksi', tabBarIcon: ({ color }) => <TransactionIcon color={color} size={20} />, href: role === 'owner' ? undefined : null }} />
      <Tabs.Screen name="master" options={{ href: null }} />
    </Tabs>
  )
}
