import { Stack } from 'expo-router'

export default function TransactionLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#ffffff' },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="create" />
      <Stack.Screen name="[id]" />
      <Stack.Screen name="company/index" />
      <Stack.Screen name="company/[name]" />
      <Stack.Screen name="alternative-price" />
      <Stack.Screen name="report" />
    </Stack>
  )
}
