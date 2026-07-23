import { create } from 'zustand'
import type { ProductStore, Product, ProductType, ProductVariant, CreateProductTypeInput, UpdateProductTypeInput, CreateProductInput, UpdateProductInput, CreateVariantInput, UpdateVariantInput } from '@/types'
import { getQuery, getAuthUser } from '@/lib/dataRouter'

/**
 * Product (Master Data) store – CRUD for product types, products, variants.
 * Central store for all master data operations.
 * 3-level hierarchy: product_types → products → product_variants
 */
export const useProductStore = create<ProductStore>((set, get) => ({
  // ─── State ──────────────────────────────────────────────
  productTypes: [],
  products: [],
  variants: [],
  selectedProduct: null,
  loading: false,
  error: null,

  // ─── Actions ────────────────────────────────────────────

  fetchProductTypes: async () => {
    set({ loading: true, error: null })
    try {
      const { data, error } = await getQuery('product_types')
        .select('*')
        .eq('is_active', true)
        .order('type_code', { ascending: true })

      if (error) throw error
      set({ productTypes: (data as unknown as ProductType[]) ?? [], loading: false })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal memuat jenis produk'
      set({ error: message, loading: false })
    }
  },

  fetchProducts: async () => {
    set({ loading: true, error: null })
    try {
      const { data, error } = await getQuery('products')
        .select('*, type:product_types(*)')
        .eq('is_active', true)
        .order('product_name', { ascending: true })

      if (error) throw error
      set({ products: (data as unknown as Product[]) ?? [], loading: false })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal memuat produk'
      set({ error: message, loading: false })
    }
  },

  fetchProductsByType: async (typeId: string) => {
    try {
      const { data, error } = await getQuery('products')
        .select('*, type:product_types(*)')
        .eq('type_id', typeId)
        .eq('is_active', true)
        .order('version', { ascending: true })

      if (error) throw error
      const products = (data as unknown as Product[]) ?? []
      return products
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal memuat produk'
      set({ error: message })
      return []
    }
  },

  fetchVariantsByProduct: async (productId: string) => {
    try {
      const { data, error } = await getQuery('product_variants')
        .select('*')
        .eq('product_id', productId)
        .eq('is_active', true)
        .order('finishing', { ascending: true })

      if (error) throw error
      const variants = (data as ProductVariant[]) ?? []
      set({ variants })
      return variants
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal memuat varian'
      set({ error: message })
      return []
    }
  },

  createProductType: async (input: CreateProductTypeInput) => {
    set({ loading: true, error: null })
    try {
      const { data: userData } = await getAuthUser()

      const { data, error } = await getQuery('product_types')
        .insert({
          type_code: input.type_code.toUpperCase().trim(),
          type_name: input.type_name.trim(),
          image_url: input.image_url ?? null,
          is_active: true,
          created_by: userData.user?.id ?? null,
        } as any)
        .select()
        .single()

      if (error) throw error

      const productType = data as unknown as ProductType
      set((s) => ({
        productTypes: [...s.productTypes, productType],
        loading: false,
      }))
      return productType
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal membuat jenis produk'
      set({ error: message, loading: false })
      throw error
    }
  },

  updateProductType: async (typeId: string, input: UpdateProductTypeInput) => {
    set({ loading: true, error: null })
    try {
      const updatePayload: any = {
        updated_at: new Date().toISOString()
      }
      if (input.type_name !== undefined) updatePayload.type_name = input.type_name
      if (input.image_url !== undefined) updatePayload.image_url = input.image_url
      if (input.is_active !== undefined) updatePayload.is_active = input.is_active

      const { error } = await getQuery('product_types')
        .update(updatePayload)
        .eq('type_id', typeId)

      if (error) throw error

      set((s) => ({
        productTypes: s.productTypes.map((pt) =>
          pt.type_id === typeId ? { ...pt, ...input } : pt
        ),
        loading: false,
      }))
    } catch (error: any) {
      const message = error?.message || error?.details || 'Gagal memperbarui jenis produk'
      set({ error: message, loading: false })
      throw error
    }
  },

  createProduct: async (input: CreateProductInput) => {
    set({ loading: true, error: null })
    try {
      const { data: userData } = await getAuthUser()

      const { data, error } = await getQuery('products')
        .insert({
          type_id: input.type_id,
          version: input.version.trim(),
          product_name: input.product_name.trim(),
          base_price: input.base_price,
          description: input.description ?? null,
          image_url: input.image_url ?? null,
          is_active: true,
          created_by: userData.user?.id ?? null,
        } as any)
        .select('*, type:product_types(*)')
        .single()

      if (error) throw error

      const product = data as unknown as Product
      set((s) => ({
        products: [...s.products, product],
        loading: false,
      }))
      return product
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal membuat produk'
      set({ error: message, loading: false })
      throw error
    }
  },

  updateProduct: async (productId: string, input: UpdateProductInput) => {
    set({ loading: true, error: null })
    try {
      const { error } = await getQuery('products')
        .update({ ...input, updated_at: new Date().toISOString() } as any)
        .eq('product_id', productId)

      if (error) throw error

      set((s) => ({
        products: s.products.map((p) =>
          p.product_id === productId ? { ...p, ...input } : p
        ),
        loading: false,
      }))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal mengupdate produk'
      set({ error: message, loading: false })
      throw error
    }
  },

  createVariant: async (input: CreateVariantInput) => {
    set({ loading: true, error: null })
    try {
      const { data: productData, error: productError } = await getQuery('products')
        .select('*, type:product_types(*)')
        .eq('product_id', input.product_id)
        .single()

      if (productError) throw productError

      const prod = productData as any
      const typeCode = prod?.type?.type_code ?? 'UNK'
      const version = prod?.version ?? '00'
      const skuFull = `${typeCode}-${version}-${input.finishing}`

      const { data: userData } = await getAuthUser()

      const { data, error } = await getQuery('product_variants')
        .insert({
          product_id: input.product_id,
          finishing: input.finishing,
          sku_full: skuFull,
          price_modifier: input.price_modifier ?? 0,
          description: input.description ?? null,
          is_active: true,
          created_by: userData.user?.id ?? null,
        } as any)
        .select()
        .single()

      if (error) throw error

      const variant = data as ProductVariant
      set((s) => ({
        variants: [...s.variants, variant],
        loading: false,
      }))
      return variant
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal membuat varian'
      set({ error: message, loading: false })
      throw error
    }
  },

  updateVariant: async (variantId: string, input: UpdateVariantInput) => {
    set({ loading: true, error: null })
    try {
      const { error } = await getQuery('product_variants')
        .update({ ...input, updated_at: new Date().toISOString() } as any)
        .eq('variant_id', variantId)

      if (error) throw error

      set((s) => ({
        variants: s.variants.map((v) =>
          v.variant_id === variantId ? { ...v, ...input } : v
        ),
        loading: false,
      }))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal mengupdate varian'
      set({ error: message, loading: false })
      throw error
    }
  },

  setSelectedProduct: (product) => set({ selectedProduct: product }),
  clearError: () => set({ error: null }),
}))
