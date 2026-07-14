import { Stack } from 'expo-router'

export default function StockLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0F172A' },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" />
      <Stack.Screen name="status-change" />
      <Stack.Screen name="trash" />
    </Stack>
  )
}
