import { supabase } from '../lib/supabase'

export type SearchResultCategory = 'client' | 'chantier' | 'facture'

export interface SearchResult {
  id: string
  category: SearchResultCategory
  title: string
  subtitle: string
  url: string
}

export interface GlobalSearchResponse {
  results: SearchResult[]
  totalCount: number
}

export async function globalSearch(query: string): Promise<GlobalSearchResponse> {
  if (!query || query.trim().length < 2) {
    return { results: [], totalCount: 0 }
  }

  const term = query.trim()
  const limit = 5

  const [clientsRes, chantiersRes, invoicesRes] = await Promise.all([
    supabase
      .from('clients')
      .select('id, first_name, last_name, company_name, phone, mobile, city')
      .eq('is_active', true)
      .or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,company_name.ilike.%${term}%,phone.ilike.%${term}%,mobile.ilike.%${term}%,email.ilike.%${term}%`)
      .limit(limit),

    supabase
      .from('chantiers')
      .select('id, reference, title, city, status')
      .or(`reference.ilike.%${term}%,title.ilike.%${term}%,city.ilike.%${term}%,address_line1.ilike.%${term}%`)
      .limit(limit),

    supabase
      .from('invoices')
      .select('id, reference, title, total_ttc, status')
      .or(`reference.ilike.%${term}%,title.ilike.%${term}%`)
      .limit(limit),
  ])

  const results: SearchResult[] = []

  for (const c of clientsRes.data ?? []) {
    results.push({
      id: c.id,
      category: 'client',
      title: c.company_name || `${c.first_name} ${c.last_name}`,
      subtitle: [c.city, c.phone || c.mobile].filter(Boolean).join(' — '),
      url: `/crm/clients/${c.id}`,
    })
  }

  for (const ch of chantiersRes.data ?? []) {
    results.push({
      id: ch.id,
      category: 'chantier',
      title: ch.title ?? ch.reference,
      subtitle: `${ch.reference} — ${ch.city ?? ''} — ${ch.status}`,
      url: `/planning`,
    })
  }

  for (const inv of invoicesRes.data ?? []) {
    results.push({
      id: inv.id,
      category: 'facture',
      title: inv.reference,
      subtitle: `${inv.title ?? ''} — ${Number(inv.total_ttc).toFixed(2)} € — ${inv.status}`,
      url: `/billing/invoices`,
    })
  }

  return { results, totalCount: results.length }
}
