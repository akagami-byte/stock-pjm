import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { AuthStore, User, AuthSession } from '@/types'

const PREMIUM_EMAILS = ['rehanforic@gmail.com', 'handivanda@protonmail.com', 'hanvankernel@gmail.com'];

const OWNER_EMAILS = ['rehanforic@gmail.com', 'handivanda@protonmail.com'];

function getUserRole(email: string): 'owner' | 'staff' {
  if (OWNER_EMAILS.includes(email)) return 'owner';
  return 'staff';
}

/**
 * Authentication store – manages user session and auth state.
 * Uses Supabase GoTrue for authentication.
 */
export const useAuthStore = create<AuthStore>((set, get) => ({
  // ─── State ──────────────────────────────────────────────
  user: null,
  session: null,
  loading: true,
  error: null,
  isAuthenticated: false,

  // ─── Actions ────────────────────────────────────────────
  login: async (email: string, password: string) => {
    set({ loading: true, error: null })
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      const userEmail = data.user.email ?? '';
      const user: User = {
        id: data.user.id,
        email: userEmail,
        full_name: data.user.user_metadata?.full_name ?? null,
        avatar_url: data.user.user_metadata?.avatar_url ?? null,
        is_premium: PREMIUM_EMAILS.includes(userEmail),
        role: getUserRole(userEmail),
      }

      const session: AuthSession = {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at ?? 0,
        user,
      }

      set({
        user,
        session,
        isAuthenticated: true,
        loading: false,
        error: null,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login gagal'
      set({ loading: false, error: message, isAuthenticated: false })
      throw error
    }
  },

  signUp: async (email: string, password: string) => {
    set({ loading: true, error: null })
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      })

      if (error) throw error

      if (data.session) {
        const signUpEmail = data.user?.email ?? '';
        const user: User = {
          id: data.user?.id ?? '',
          email: signUpEmail,
          full_name: data.user?.user_metadata?.full_name ?? null,
          avatar_url: data.user?.user_metadata?.avatar_url ?? null,
          is_premium: PREMIUM_EMAILS.includes(signUpEmail),
          role: getUserRole(signUpEmail),
        }

        const session: AuthSession = {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at ?? 0,
          user,
        }

        set({
          user,
          session,
          isAuthenticated: true,
          loading: false,
          error: null,
        })
      } else {
        set({ loading: false, error: null })
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
    } finally {
      set({
        user: null,
        session: null,
        isAuthenticated: false,
        loading: false,
        error: null,
      })
    }
  },

  restoreSession: async () => {
    set({ loading: true })
    try {
      const { data: { session } } = await supabase.auth.getSession()

      if (session) {
        const userEmail = session.user.email ?? '';
        const user: User = {
          id: session.user.id,
          email: userEmail,
          full_name: session.user.user_metadata?.full_name ?? null,
          avatar_url: session.user.user_metadata?.avatar_url ?? null,
          is_premium: PREMIUM_EMAILS.includes(userEmail),
        role: getUserRole(userEmail),
        }

        const authSession: AuthSession = {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_at: session.expires_at ?? 0,
          user,
        }

        set({
          user,
          session: authSession,
          isAuthenticated: true,
          loading: false,
        })
      } else {
        set({ loading: false, isAuthenticated: false })
      }

      // Listen for auth state changes
      supabase.auth.onAuthStateChange((_event, session) => {
        if (session) {
          const userEmail = session.user.email ?? '';
          const user: User = {
            id: session.user.id,
            email: userEmail,
            full_name: session.user.user_metadata?.full_name ?? null,
            avatar_url: session.user.user_metadata?.avatar_url ?? null,
            is_premium: PREMIUM_EMAILS.includes(userEmail),
        role: getUserRole(userEmail),
          }
          set({ user, isAuthenticated: true })
        } else {
          set({ user: null, session: null, isAuthenticated: false })
        }
      })
    } catch (error) {
      set({ loading: false, isAuthenticated: false })
    }
  },

  clearError: () => set({ error: null }),
}))
