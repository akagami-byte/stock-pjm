import { useEffect, useState } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { ActivityIndicator, View, Text } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { useAuthStore } from '@/stores/authStore'
import { useBatchStore } from '@/stores/batchStore'
import { useAppFonts } from '@/hooks/useFonts'

export default function RootLayout() {
  const router = useRouter()
  const segments = useSegments()
  const { session, loading, restoreSession } = useAuthStore()
  const [isReady, setIsReady] = useState(false)
  const { loaded: fontsLoaded } = useAppFonts()

  const batchStore = useBatchStore()

  useEffect(() => {
    restoreSession().finally(() => setIsReady(true))
  }, [])

  // Init realtime subscription after auth ready
  useEffect(() => {
    if (isReady && session) {
      batchStore.subscribeToRealtime()
    }
    return () => {
      batchStore.unsubscribeFromRealtime()
    }
  }, [isReady, session])

  useEffect(() => {
    if (!isReady || loading || !fontsLoaded) return
    const inAuthGroup = segments[0] === '(auth)'
    if (!session && !inAuthGroup) {
      router.replace('/(auth)/welcome')
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)')
    }
  }, [session, segments, isReady, loading, fontsLoaded])

  if (!isReady || !fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff' }}>
        <ActivityIndicator size="large" color="#111111" />
      </View>
    )
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </SafeAreaProvider>
  )
}
