import { Stack } from 'expo-router'

export default function ScanLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0F172A' },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen
        name="result"
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen name="history" />
    </Stack>
  )
}
