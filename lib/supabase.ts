import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Constants from 'expo-constants'
import { Platform } from 'react-native' // <-- 1. TAMBAHKAN IMPORT INI

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

// <-- 2. TAMBAHKAN SAFE STORAGE ADAPTER INI -->
// Mencegah crash "ReferenceError: window is not defined" saat Expo pre-rendering untuk Web
const SafeStorage = {
  getItem: async (key: string) => {
    if (Platform.OS === 'web' && typeof window === 'undefined') {
      return null;
    }
    return await AsyncStorage.getItem(key);
  },
  setItem: async (key: string, value: string) => {
    if (Platform.OS === 'web' && typeof window === 'undefined') {
      return;
    }
    await AsyncStorage.setItem(key, value);
  },
  removeItem: async (key: string) => {
    if (Platform.OS === 'web' && typeof window === 'undefined') {
      return;
    }
    await AsyncStorage.removeItem(key);
  },
};

// Declaring as any removes strict DB constraints that cause compilation errors when columns don't align with local DB views.
// We cast return types at the call site for safety.
export const supabase = createClient<any>(resolvedUrl, resolvedKey, {
  auth: {
    storage: SafeStorage, // <-- 3. GANTI DARI AsyncStorage KE SafeStorage
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})