import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as WebBrowser from 'expo-web-browser'
import { makeRedirectUri } from 'expo-auth-session'
import { supabase } from '@/lib/supabase'
import { getDatabase } from '@/lib/database'
import type { AuthStore, User, AuthSession } from '@/types'

WebBrowser.maybeCompleteAuthSession()

// Daftar email Premium
const PREMIUM_EMAILS = [
  'rehanforic@gmail.com',
  'hanvankernel@gmail.com',
  'dabrisam11@gmail.com'
];

// Pengaturan Role untuk Premium User
const OWNER_EMAILS = [
  'rehanforic@gmail.com',
  'dabrisam11@gmail.com'
];

function getUserRole(email: string): 'owner' | 'staff' {
  if (OWNER_EMAILS.includes(email.toLowerCase().trim())) return 'owner';
  return 'staff';
}

async function initLocalUsersTable() {
  const db = await getDatabase();
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS local_users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

export const useAuthStore = create<AuthStore & { loginWithGoogle: () => Promise<void> }>((set, get) => ({
  user: null,
  session: null,
  loading: true,
  error: null,
  isAuthenticated: false,

  /** 1. LOGIN EMAIL & PASSWORD (HYBRID) */
  login: async (email: string, password: string) => {
    set({ loading: true, error: null })
    const cleanEmail = email.toLowerCase().trim()
    const isPremiumEmail = PREMIUM_EMAILS.includes(cleanEmail)

    try {
      if (isPremiumEmail) {
        // --- PREMIUM USER TO SUPABASE ---
        const { data, error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password })
        if (error) throw error

        const userEmail = data.user.email ?? ''
        const user: User = {
          id: data.user.id,
          email: userEmail,
          full_name: data.user.user_metadata?.full_name ?? null,
          avatar_url: data.user.user_metadata?.avatar_url ?? null,
          is_premium: true,
          role: getUserRole(userEmail),
        }

        const session: AuthSession = {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at ?? 0,
          user,
        }

        set({ user, session, isAuthenticated: true, loading: false, error: null })
      } else {
        // --- NON-PREMIUM TOSQLite Lokal ---
        await initLocalUsersTable();
        const db = await getDatabase();
        const localUser = await db.getFirstAsync<{ id: string; email: string; password: string }>(
          'SELECT * FROM local_users WHERE email = ? AND password = ?',
          [cleanEmail, password]
        );

        if (!localUser) throw new Error('Email atau password lokal salah!')

        // lokal user menggnakan previl 'owner' untuk di lokal
        const user: User = {
          id: localUser.id,
          email: localUser.email,
          full_name: 'Local User',
          avatar_url: null,
          is_premium: false,
          role: 'owner', 
        }

        const session: AuthSession = {
          access_token: `local_token_${localUser.id}`,
          refresh_token: `local_refresh_${localUser.id}`,
          expires_at: Date.now() + (30 * 24 * 60 * 60 * 1000),
          user,
        }

        await AsyncStorage.setItem('@pjm_local_session', JSON.stringify(session))
        set({ user, session, isAuthenticated: true, loading: false, error: null })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login gagal'
      set({ loading: false, error: message, isAuthenticated: false })
      throw error
    }
  },

  /** 2. LOGIN GOOGLE*/
  loginWithGoogle: async () => {
    set({ loading: true, error: null })
    try {
      const redirectUrl = makeRedirectUri({ scheme: 'pjmstock', path: 'auth/callback' })
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: redirectUrl }
      })

      if (error) throw error
      if (data?.url) {
        await WebBrowser.openAuthSessionAsync(data.url, redirectUrl)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Google Login gagal'
      set({ loading: false, error: message })
      throw error
    }
  },

  /** 3. SIGN UP (HYBRID) */
  signUp: async (email: string, password: string) => {
    set({ loading: true, error: null })
    const cleanEmail = email.toLowerCase().trim()
    const isPremiumEmail = PREMIUM_EMAILS.includes(cleanEmail)

    try {
      if (isPremiumEmail) {
        const { data, error } = await supabase.auth.signUp({ email: cleanEmail, password })
        if (error) throw error
        if (data.session) {
          const signUpEmail = data.user?.email ?? ''
          const user: User = {
            id: data.user?.id ?? '',
            email: signUpEmail,
            full_name: data.user?.user_metadata?.full_name ?? null,
            avatar_url: data.user?.user_metadata?.avatar_url ?? null,
            is_premium: true,
            role: getUserRole(signUpEmail),
          }
          const session: AuthSession = {
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
            expires_at: data.session.expires_at ?? 0,
            user,
          }
          set({ user, session, isAuthenticated: true, loading: false, error: null })
        } else {
          set({ loading: false, error: null })
        }
      } else {
        await initLocalUsersTable();
        const db = await getDatabase();
        const existing = await db.getFirstAsync<{ id: string }>(
          'SELECT id FROM local_users WHERE email = ?', [cleanEmail]
        );
        if (existing) throw new Error('Email ini sudah terdaftar di database lokal!')

        const localId = `local_${Date.now()}`
        await db.runAsync('INSERT INTO local_users (id, email, password) VALUES (?, ?, ?)', [localId, cleanEmail, password]);

        const user: User = {
          id: localId,
          email: cleanEmail,
          full_name: 'Local User',
          avatar_url: null,
          is_premium: false,
          role: 'owner',
        }
        const session: AuthSession = {
          access_token: `local_token_${localId}`,
          refresh_token: `local_refresh_${localId}`,
          expires_at: Date.now() + (30 * 24 * 60 * 60 * 1000),
          user,
        }
        await AsyncStorage.setItem('@pjm_local_session', JSON.stringify(session))
        set({ user, session, isAuthenticated: true, loading: false, error: null })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Daftar gagal'
      set({ loading: false, error: message })
      throw error
    }
  },

  logout: async () => {
    set({ loading: true })
    try {
      await supabase.auth.signOut()
      await AsyncStorage.removeItem('@pjm_local_session')
    } finally {
      set({ user: null, session: null, isAuthenticated: false, loading: false, error: null })
    }
  },

  restoreSession: async () => {
    set({ loading: true })
    try {
      // 1. Cek Session Lokal
      const localSessionStr = await AsyncStorage.getItem('@pjm_local_session')
      if (localSessionStr) {
        const localSession: AuthSession = JSON.parse(localSessionStr)
        set({ user: localSession.user, session: localSession, isAuthenticated: true, loading: false })
        return;
      }

      // 2. Cek Session Supabase Cloud
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        const userEmail = session.user.email?.toLowerCase().trim() ?? ''
        
        // GATEKEEPER
        if (!PREMIUM_EMAILS.includes(userEmail)) {
          await supabase.auth.signOut()
          set({ loading: false, isAuthenticated: false, error: 'Akun Google ini tidak terdaftar sebagai User Premium!' })
          return;
        }

        const user: User = {
          id: session.user.id,
          email: userEmail,
          full_name: session.user.user_metadata?.full_name ?? null,
          avatar_url: session.user.user_metadata?.avatar_url ?? null,
          is_premium: true,
          role: getUserRole(userEmail),
        }
        const authSession: AuthSession = {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_at: session.expires_at ?? 0,
          user,
        }
        set({ user, session: authSession, isAuthenticated: true, loading: false })
      } else {
        set({ loading: false, isAuthenticated: false })
      }

      // Listen perubahan Supabase Auth
      supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session) {
          const userEmail = session.user.email?.toLowerCase().trim() ?? ''
          if (!PREMIUM_EMAILS.includes(userEmail)) {
            await supabase.auth.signOut()
            set({ user: null, session: null, isAuthenticated: false, error: 'Email bukan Premium User!' })
            return;
          }
          const user: User = {
            id: session.user.id,
            email: userEmail,
            full_name: session.user.user_metadata?.full_name ?? null,
            avatar_url: session.user.user_metadata?.avatar_url ?? null,
            is_premium: true,
            role: getUserRole(userEmail),
          }
          set({ user, isAuthenticated: true })
        } else {
          if (!get().user?.id.startsWith('local_')) {
            set({ user: null, session: null, isAuthenticated: false })
          }
        }
      })
    } catch (error) {
      set({ loading: false, isAuthenticated: false })
    }
  },

  clearError: () => set({ error: null }),
}))