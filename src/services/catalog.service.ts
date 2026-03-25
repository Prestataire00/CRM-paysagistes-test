import { supabase } from '../lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface CatalogItem {
  id: string
  name: string
  description: string | null
  category: string | null
  unit: string
  unit_price_ht: number
  tva_rate: number
  is_labor: boolean
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export type CatalogItemCreate = Omit<CatalogItem, 'id' | 'created_at' | 'updated_at'>
export type CatalogItemUpdate = Partial<CatalogItemCreate>

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

export async function getCatalogItems(): Promise<CatalogItem[]> {
  const { data, error } = await supabase
    .from('catalog_items')
    .select('*')
    .eq('is_active', true)
    .order('category', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function createCatalogItem(item: CatalogItemCreate): Promise<CatalogItem> {
  const { data, error } = await supabase
    .from('catalog_items')
    .insert({ ...item, updated_at: new Date().toISOString() })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateCatalogItem(id: string, updates: CatalogItemUpdate): Promise<CatalogItem> {
  const { data, error } = await supabase
    .from('catalog_items')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteCatalogItem(id: string): Promise<void> {
  const { error } = await supabase
    .from('catalog_items')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}
