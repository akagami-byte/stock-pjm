import { create } from 'zustand'
import * as WebBrowser from 'expo-web-browser'
import { makeRedirectUri } from 'expo-auth-session'
import { supabase } from '@/lib/supabase'
import type { AuthStore, User, AuthSession, UserRole } from '@/types'

export const PREMIUM_EMAILS = ['rehanforic@gmail.com', 'hanvankernel@gmail.com', 'adminputrajayametal@gmail.com', 'sadambsaputra@gmail.com', 'staffputrajayametal@gmail.com'];

export const OWNER_EMAILS = ['rehanforic@gmail.com', 'sadambsaputra@gmail.com'];

/**
 * Whitelist akun ADMIN (akses penuh seperti owner, tapi transaksi wajib
 * approval owner). Tambahkan email di sini + migration SQL is_premium_user().
 * Prioritas role: owner > admin > staff (jika email masuk OWNER, jadi owner).
 */
export const ADMIN_EMAILS: string[] = [
  'adminputrajayametal@gmail.com',
];

/**
 * Premium users: role ikut whitelist OWNER_EMAILS / ADMIN_EMAILS.
 * Non-premium users: selalu owner (akses penuh, storage SQLite lokal).
 * Staff hanya untuk user premium yang tidak masuk OWNER/ADMIN.
 */
export function getUserRole(email: string): UserRole {
  // Owner menang atas admin
  if (OWNER_EMAILS.includes(email)) return 'owner';
  if (ADMIN_EMAILS.includes(email)) return 'admin';
  // Premium tanpa owner/admin → staff
  if (PREMIUM_EMAILS.includes(email)) return 'staff';
  // Non-premium: full access (owner)
  return 'owner';
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
  pendingEmail: null,

  // ─── Actions ────────────────────────────────────────────
  login: async (email: string, password: string) => {
    set({ loading: true, error: null })
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      const userEmail = data.user.email ?? email
      set({ pendingEmail: userEmail, loading: false })
      
      // Send OTP to email after successful password check
      await get().sendOtp(userEmail)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login gagal'
      set({ loading: false, error: message, isAuthenticated: false })
      throw error
    }
  },

  sendOtp: async (email: string) => {
    set({ loading: true, error: null })
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
      })
      if (error) throw error
      set({ pendingEmail: email, loading: false })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal mengirim kode OTP'
      set({ loading: false, error: message })
      throw error
    }
  },

  verifyOtp: async (email: string, token: string) => {
    set({ loading: true, error: null })
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'email',
      })

      if (error) throw error

      const userEmail = data.user?.email ?? email
      const user: User = {
        id: data.user?.id ?? 'usr_' + Date.now(),
        email: userEmail,
        full_name: data.user?.user_metadata?.full_name ?? null,
        avatar_url: data.user?.user_metadata?.avatar_url ?? null,
        is_premium: PREMIUM_EMAILS.includes(userEmail),
        role: getUserRole(userEmail),
      }

      const session: AuthSession = {
        access_token: data.session?.access_token ?? '',
        refresh_token: data.session?.refresh_token ?? '',
        expires_at: data.session?.expires_at ?? 0,
        user,
      }

      set({
        user,
        session,
        isAuthenticated: true,
        pendingEmail: null,
        loading: false,
        error: null,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Kode OTP tidak valid atau kadaluarsa'
      set({ loading: false, error: message })
      throw error
    }
  },

  resendOtp: async () => {
    const { pendingEmail, sendOtp } = get()
    if (!pendingEmail) throw new Error('Email tidak ditemukan')
    await sendOtp(pendingEmail)
  },

  loginWithGoogle: async () => {
    set({ loading: true, error: null })
    try {
      const redirectTo = makeRedirectUri({ scheme: 'pjmstock', path: 'auth/callback' });

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      });

      if (error) throw error;

      if (data.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
        if (result.type === 'success' && result.url) {
          const url = new URL(result.url);
          const params = new URLSearchParams(url.hash.substring(1));
          const access_token = params.get('access_token');
          const refresh_token = params.get('refresh_token');

          if (access_token && refresh_token) {
            await supabase.auth.setSession({ access_token, refresh_token });
          }
        }
      }
      set({ loading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Google login gagal';
      set({ loading: false, error: message });
      throw error;
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
