import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Constants from 'expo-constants'

// Use expo-constants to read env vars injected via app.config.js.
// This is more reliable in production/EAS builds than process.env.
const supabaseUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_URL as string | undefined
const supabaseAnonKey = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_ANON_KEY as string | undefined

// Fallback to process.env for development (Expo Go / Metro)
const resolvedUrl = supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL
const resolvedKey = supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

if (!resolvedUrl || !resolvedKey) {
  throw new Error(
    `Supabase configuration is missing. ` +
    `Ensure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY ` +
    `are set in your .env file and rebuilt. ` +
    `(url: ${resolvedUrl ? '✓' : '✗'}, key: ${resolvedKey ? '✓' : '✗'})`
  )
}

// Declaring as any removes strict DB constraints that cause compilation errors when columns don't align with local DB views.
// We cast return types at the call site for safety.
export const supabase = createClient<any>(resolvedUrl, resolvedKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
