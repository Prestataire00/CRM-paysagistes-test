import { supabase } from '../lib/supabase'
import type { Supplier } from '../types'
import type { PaginatedResult } from './client.service'

// ---------------------------------------------------------------------------
// Filter types
// ---------------------------------------------------------------------------
export interface SupplierFilters {
  search?: string
  category?: string
  is_active?: boolean
  page?: number
  pageSize?: number
}

// ---------------------------------------------------------------------------
// getSuppliers - Paginated list with optional filters
// ---------------------------------------------------------------------------
export async function getSuppliers(
  filters: SupplierFilters = {},
): Promise<PaginatedResult<Supplier>> {
  const { search, category, is_active, page = 1, pageSize = 25 } = filters

  let query = supabase
    .from('suppliers')
    .select('*', { count: 'exact' })

  // Filters
  if (typeof is_active === 'boolean') {
    query = query.eq('is_active', is_active)
  }

  if (category) {
    query = query.eq('category', category)
  }

  if (search) {
    query = query.or(
      `company_name.ilike.%${search}%,contact_first_name.ilike.%${search}%,contact_last_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`,
    )
  }

  // Pagination
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  query = query
    .order('company_name', { ascending: true })
    .range(from, to)

  const { data, error, count } = await query

  if (error) throw error

  return {
    data: (data ?? []) as Supplier[],
    count: count ?? 0,
    page,
    pageSize,
    totalPages: Math.ceil((count ?? 0) / pageSize),
  }
}

// ---------------------------------------------------------------------------
// getSupplier - Single supplier
// ---------------------------------------------------------------------------
export async function getSupplier(id: string): Promise<Supplier> {
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data as Supplier
}

// ---------------------------------------------------------------------------
// createSupplier
// ---------------------------------------------------------------------------
export async function createSupplier(
  supplierData: Omit<Supplier, 'id' | 'created_at' | 'updated_at'>,
): Promise<Supplier> {
  const { data, error } = await supabase
    .from('suppliers')
    .insert(supplierData)
    .select()
    .single()

  if (error) throw error
  return data as Supplier
}

// ---------------------------------------------------------------------------
// updateSupplier
// ---------------------------------------------------------------------------
export async function updateSupplier(
  id: string,
  supplierData: Partial<Omit<Supplier, 'id' | 'created_at' | 'updated_at'>>,
): Promise<Supplier> {
  const { data, error } = await supabase
    .from('suppliers')
    .update(supplierData)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Supplier
}

// ---------------------------------------------------------------------------
// deleteSupplier - Soft delete (set is_active = false)
// ---------------------------------------------------------------------------
export async function deleteSupplier(id: string): Promise<Supplier> {
  const { data, error } = await supabase
    .from('suppliers')
    .update({ is_active: false })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Supplier
}
