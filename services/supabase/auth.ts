import { supabase } from '@/lib/supabase'
import type { User } from '@/types'

/**
 * Supabase Auth service – login, logout, session management.
 */

/** Sign in with email and password. */
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  if (error) throw error
  return data
}

/** Sign out the current user. */
export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

/** Get the current session (may return null). */
export async function getSession() {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session
}

/** Get the current authenticated user profile. */
export async function getCurrentUser(): Promise<User | null> {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return null

  const email = data.user.email ?? ''
  return {
    id: data.user.id,
    email,
    full_name: data.user.user_metadata?.full_name ?? null,
    avatar_url: data.user.user_metadata?.avatar_url ?? null,
    is_premium: false,
    role: 'staff' as const,
  }
}
