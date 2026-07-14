import { getQuery, getAuthUser } from '@/lib/dataRouter'
import type { Product, ProductType, ProductVariant, CreateProductInput, CreateProductTypeInput, CreateVariantInput } from '@/types'

/**
 * Product service – Master Data CRUD operations.
 * Routes to Supabase (premium) or SQLite (basic) via dataRouter.
 * Supports 3-level hierarchy: product_types → products → product_variants
 */

/** Fetch all active product types. */
export async function fetchProductTypes() {
  const { data, error } = await getQuery('product_types')
    .select('*')
    .eq('is_active', true)
    .order('type_code', { ascending: true })

  if (error) throw error
  return data as unknown as ProductType[]
}

/** Fetch all active products (with type join). */
export async function fetchProducts() {
  const { data, error } = await getQuery('products')
    .select('*, type:product_types(*)')
    .eq('is_active', true)
    .order('product_name', { ascending: true })

  if (error) throw error
  return data as unknown as Product[]
}

/** Fetch a single product by ID. */
export async function fetchProductById(productId: string) {
  const { data, error } = await getQuery('products')
    .select('*, type:product_types(*)')
    .eq('product_id', productId)
    .single()

  if (error) throw error
  return data as unknown as Product
}

/** Create a new product type. */
export async function createProductType(input: CreateProductTypeInput) {
  const { data: userData } = await getAuthUser()

  const { data, error } = await getQuery('product_types')
    .insert({
      type_code: input.type_code.toUpperCase().trim(),
      type_name: input.type_name.trim(),
      is_active: true,
      created_by: userData.user?.id ?? null,
    } as any)
    .select()
    .single()

  if (error) throw error
  return data as unknown as ProductType
}

/** Create a new product. */
export async function createProduct(input: CreateProductInput) {
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
  return data as unknown as Product
}

/** Fetch all product variants for a given product. */
export async function fetchVariantsByProduct(productId: string) {
  const { data, error } = await getQuery('product_variants')
    .select('*')
    .eq('product_id', productId)
    .eq('is_active', true)
    .order('finishing', { ascending: true })

  if (error) throw error
  return data as ProductVariant[]
}

/** Create a new product variant. */
export async function createVariant(input: CreateVariantInput & { sku_full: string }) {
  const { data: userData } = await getAuthUser()

  const { data, error } = await getQuery('product_variants')
    .insert({
      product_id: input.product_id,
      finishing: input.finishing,
      sku_full: input.sku_full,
      price_modifier: input.price_modifier ?? 0,
      description: input.description ?? null,
      is_active: true,
      created_by: userData.user?.id ?? null,
    } as any)
    .select()
    .single()

  if (error) throw error
  return data as ProductVariant
}

/** Check if a type code already exists. */
export async function typeCodeExists(code: string): Promise<boolean> {
  const { data } = await getQuery('product_types')
    .select('type_id')
    .eq('type_code', code)
    .limit(1)

  return (data?.length ?? 0) > 0
}
