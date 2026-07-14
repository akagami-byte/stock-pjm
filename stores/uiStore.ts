import { create } from 'zustand'
import type { UIStore, ToastMessage } from '@/types'

/**
 * UI store – manages global loading state and toast notifications.
 */
export const useUIStore = create<UIStore>((set) => ({
  // ─── State ──────────────────────────────────────────────
  globalLoading: false,
  toastMessage: null,

  // ─── Actions ────────────────────────────────────────────
  setGlobalLoading: (loading: boolean) => set({ globalLoading: loading }),

  showToast: (toast: ToastMessage) => {
    const id = toast.id ?? Date.now().toString()
    set({ toastMessage: { ...toast, id } })

    // Auto-dismiss after duration
    const duration = toast.duration ?? 3000
    setTimeout(() => {
      set((s) => (s.toastMessage?.id === id ? { toastMessage: null } : s))
    }, duration)
  },

  dismissToast: () => set({ toastMessage: null }),
}))
