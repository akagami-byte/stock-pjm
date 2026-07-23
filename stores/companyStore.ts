import { create } from 'zustand'
import type { Company } from '@/types'
import { getQuery, getAuthUser } from '@/lib/dataRouter'

interface CompanyStore {
  companies: Company[]
  loading: boolean
  error: string | null
  fetchCompanies: () => Promise<void>
  createCompany: (input: { company_name: string; address?: string; phone?: string; image_url?: string }) => Promise<Company>
  updateCompany: (companyId: string, input: { address?: string; phone?: string; image_url?: string }) => Promise<void>
  clearError: () => void
}

export const useCompanyStore = create<CompanyStore>((set, get) => ({
  companies: [],
  loading: false,
  error: null,

  fetchCompanies: async () => {
    set({ loading: true, error: null })
    try {
      const { data, error } = await getQuery('companies')
        .select('*')
        .eq('is_active', true)
        .order('company_name', { ascending: true })

      if (error) throw error
      set({ companies: (data as Company[]) ?? [], loading: false })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal memuat perusahaan'
      set({ error: message, loading: false })
    }
  },

  createCompany: async (input) => {
    set({ loading: true, error: null })
    try {
      const { data: userData } = await getAuthUser()

      const { data, error } = await getQuery('companies')
        .insert({
          company_name: input.company_name,
          address: input.address ?? null,
          phone: input.phone ?? null,
          image_url: input.image_url ?? null,
          is_active: true,
          created_by: userData.user?.id ?? null,
        })
        .select()
        .single()

      if (error) throw error

      const company = data as Company
      set((s) => ({
        companies: [...s.companies, company],
        loading: false,
      }))
      return company
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal membuat perusahaan'
      set({ error: message, loading: false })
      throw error
    }
  },

  updateCompany: async (companyId, input) => {
    set({ loading: true, error: null })
    try {
      const { error } = await getQuery('companies')
        .update({
          ...input,
          updated_at: new Date().toISOString(),
        })
        .eq('company_id', companyId)

      if (error) throw error

      set((s) => ({
        companies: s.companies.map((c) =>
          c.company_id === companyId ? { ...c, ...input } : c
        ),
        loading: false,
      }))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal memperbarui perusahaan'
      set({ error: message, loading: false })
      throw error
    }
  },

  clearError: () => set({ error: null }),
}))
