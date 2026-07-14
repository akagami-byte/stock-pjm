import { Redirect } from 'expo-router'
import { useAuthStore } from '@/stores/authStore'

/**
 * Root index – redirects based on auth state.
 */
export default function Index() {
  const { isAuthenticated } = useAuthStore()

  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />
  }

  return <Redirect href="/(auth)/welcome" />
}
