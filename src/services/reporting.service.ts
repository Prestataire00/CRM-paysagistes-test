import { supabase } from '../lib/supabase'
import type {
  MonthlyRevenuePoint,
  RevenueByCommercial,
  ConversionFunnelData,
  ReportingKpis,
} from '../types'

// ---------------------------------------------------------------------------
// KPIs agrégés
// ---------------------------------------------------------------------------
export async function getReportingKpis(year: number): Promise<ReportingKpis> {
  const startDate = `${year}-01-01`
  const endDate = `${year}-12-31`

  // Paid invoices for the year
  const { data: invoices, error: invoiceErr } = await supabase
    .from('invoices')
    .select('total_ttc, subtotal_ht')
    .in('status', ['payee', 'partiellement_payee'])
    .gte('paid_date', startDate)
    .lte('paid_date', endDate)
  if (invoiceErr) throw invoiceErr

  const revenueTtc = (invoices ?? []).reduce((s, i) => s + (i.total_ttc ?? 0), 0)
  const revenueHt = (invoices ?? []).reduce((s, i) => s + (i.subtotal_ht ?? 0), 0)
  const invoiceCount = invoices?.length ?? 0
  const avgInvoice = invoiceCount > 0 ? revenueTtc / invoiceCount : 0

  // Pending quotes
  const { data: pendingQuotes, error: quoteErr } = await supabase
    .from('quotes')
    .select('total_ttc')
    .eq('status', 'envoye')
  if (quoteErr) throw quoteErr

  const pendingQuotesCount = pendingQuotes?.length ?? 0
  const pendingQuotesAmount = (pendingQuotes ?? []).reduce((s, q) => s + (q.total_ttc ?? 0), 0)

  // Conversion rate (accepted / non-draft)
  const { data: allQuotes, error: allErr } = await supabase
    .from('quotes')
    .select('status')
    .neq('status', 'brouillon')
    .gte('created_at', startDate)
    .lte('created_at', `${endDate}T23:59:59`)
  if (allErr) throw allErr

  const totalNonDraft = allQuotes?.length ?? 0
  const accepted = (allQuotes ?? []).filter((q) => q.status === 'accepte').length
  const conversionRate = totalNonDraft > 0 ? (accepted / totalNonDraft) * 100 : 0

  // Monthly growth: compare current month revenue vs previous month
  const now = new Date()
  const currentMonth = now.getMonth()
  const currentMonthStart = `${year}-${String(currentMonth + 1).padStart(2, '0')}-01`
  const prevMonth = currentMonth === 0 ? 12 : currentMonth
  const prevYear = currentMonth === 0 ? year - 1 : year
  const prevMonthStart = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`

  const { data: currentMonthInvoices } = await supabase
    .from('invoices')
    .select('total_ttc')
    .in('status', ['payee', 'partiellement_payee'])
    .gte('paid_date', currentMonthStart)
    .lt('paid_date', `${year}-${String(currentMonth + 2).padStart(2, '0')}-01`.replace('-13-', '-01-'))

  const { data: prevMonthInvoices } = await supabase
    .from('invoices')
    .select('total_ttc')
    .in('status', ['payee', 'partiellement_payee'])
    .gte('paid_date', prevMonthStart)
    .lt('paid_date', currentMonthStart)

  const currentRev = (currentMonthInvoices ?? []).reduce((s, i) => s + (i.total_ttc ?? 0), 0)
  const prevRev = (prevMonthInvoices ?? []).reduce((s, i) => s + (i.total_ttc ?? 0), 0)
  const monthlyGrowth = prevRev > 0 ? ((currentRev - prevRev) / prevRev) * 100 : 0

  return {
    revenue_ttc: revenueTtc,
    revenue_ht: revenueHt,
    invoice_count: invoiceCount,
    avg_invoice: avgInvoice,
    pending_quotes: pendingQuotesCount,
    pending_quotes_amount: pendingQuotesAmount,
    conversion_rate: conversionRate,
    monthly_growth: monthlyGrowth,
  }
}

// ---------------------------------------------------------------------------
// Série mensuelle de CA
// ---------------------------------------------------------------------------
export async function getMonthlyRevenueSeries(year: number): Promise<MonthlyRevenuePoint[]> {
  const { data, error } = await supabase
    .from('invoices')
    .select('paid_date, total_ttc, subtotal_ht, tva_amount, labor_amount_ht')
    .in('status', ['payee', 'partiellement_payee'])
    .gte('paid_date', `${year}-01-01`)
    .lte('paid_date', `${year}-12-31`)
    .order('paid_date', { ascending: true })
  if (error) throw error

  // Group by month
  const monthMap = new Map<string, MonthlyRevenuePoint>()
  for (let m = 0; m < 12; m++) {
    const key = `${year}-${String(m + 1).padStart(2, '0')}`
    monthMap.set(key, {
      month: key,
      total_ttc: 0,
      total_ht: 0,
      total_tva: 0,
      invoice_count: 0,
      total_labor_ht: 0,
    })
  }

  for (const row of data ?? []) {
    if (!row.paid_date) continue
    const key = row.paid_date.slice(0, 7)
    const point = monthMap.get(key)
    if (point) {
      point.total_ttc += row.total_ttc ?? 0
      point.total_ht += row.subtotal_ht ?? 0
      point.total_tva += row.tva_amount ?? 0
      point.invoice_count += 1
      point.total_labor_ht += row.labor_amount_ht ?? 0
    }
  }

  return Array.from(monthMap.values())
}

// ---------------------------------------------------------------------------
// CA par commercial
// ---------------------------------------------------------------------------
export async function getRevenueByCommercial(year: number): Promise<RevenueByCommercial[]> {
  // Fetch paid invoices from quotes with assigned commercials
  const { data, error } = await supabase
    .from('invoices')
    .select(`
      total_ttc,
      subtotal_ht,
      quotes!inner(assigned_commercial_id, profiles!assigned_commercial_id(id, first_name, last_name))
    `)
    .in('status', ['payee', 'partiellement_payee'])
    .gte('paid_date', `${year}-01-01`)
    .lte('paid_date', `${year}-12-31`)
  if (error) throw error

  const map = new Map<string, RevenueByCommercial>()
  for (const row of data ?? []) {
    const quote = row.quotes as unknown as {
      assigned_commercial_id: string
      profiles: { id: string; first_name: string; last_name: string }
    }
    if (!quote?.profiles) continue
    const id = quote.profiles.id
    const existing = map.get(id) ?? {
      commercial_id: id,
      first_name: quote.profiles.first_name,
      last_name: quote.profiles.last_name,
      invoice_count: 0,
      total_ttc: 0,
      total_ht: 0,
    }
    existing.invoice_count += 1
    existing.total_ttc += row.total_ttc ?? 0
    existing.total_ht += row.subtotal_ht ?? 0
    map.set(id, existing)
  }

  return Array.from(map.values()).sort((a, b) => b.total_ttc - a.total_ttc)
}

// ---------------------------------------------------------------------------
// Efficacité opérationnelle — heures réelles vs estimées par type d'intervention
// ---------------------------------------------------------------------------
export interface HoursEfficiencyRow {
  intervention_type: string
  count: number
  estimated_hours: number
  actual_hours: number
  efficiency_pct: number // actual / estimated * 100 (>100 = dépassement)
}

export async function getHoursEfficiency(year: number): Promise<HoursEfficiencyRow[]> {
  const { data, error } = await supabase
    .from('chantiers')
    .select('intervention_type, estimated_duration_minutes, actual_duration_minutes')
    .not('intervention_type', 'is', null)
    .not('estimated_duration_minutes', 'is', null)
    .gte('scheduled_date', `${year}-01-01`)
    .lte('scheduled_date', `${year}-12-31`)
  if (error) throw error

  const map = new Map<string, { count: number; estimated: number; actual: number }>()
  for (const row of data ?? []) {
    const type = row.intervention_type ?? 'Non défini'
    const existing = map.get(type) ?? { count: 0, estimated: 0, actual: 0 }
    existing.count += 1
    existing.estimated += row.estimated_duration_minutes ?? 0
    existing.actual += row.actual_duration_minutes ?? 0
    map.set(type, existing)
  }

  return Array.from(map.entries())
    .map(([type, { count, estimated, actual }]) => ({
      intervention_type: type,
      count,
      estimated_hours: Math.round((estimated / 60) * 10) / 10,
      actual_hours: Math.round((actual / 60) * 10) / 10,
      efficiency_pct: estimated > 0 ? Math.round((actual / estimated) * 100) : 0,
    }))
    .sort((a, b) => b.estimated_hours - a.estimated_hours)
}

// ---------------------------------------------------------------------------
// Entonnoir de conversion
// ---------------------------------------------------------------------------
export async function getConversionFunnel(year: number): Promise<ConversionFunnelData> {
  const { data, error } = await supabase
    .from('quotes')
    .select('status, total_ttc, converted_to_invoice_id')
    .neq('status', 'brouillon')
    .gte('created_at', `${year}-01-01`)
    .lte('created_at', `${year}-12-31T23:59:59`)
  if (error) throw error

  const quotes = data ?? []
  return {
    total_quotes: quotes.length,
    sent: quotes.filter((q) => q.status === 'envoye').length,
    accepted: quotes.filter((q) => q.status === 'accepte').length,
    refused: quotes.filter((q) => q.status === 'refuse').length,
    expired: quotes.filter((q) => q.status === 'expire').length,
    converted: quotes.filter((q) => q.converted_to_invoice_id !== null).length,
    total_amount: quotes.reduce((s, q) => s + (q.total_ttc ?? 0), 0),
    accepted_amount: quotes
      .filter((q) => q.status === 'accepte')
      .reduce((s, q) => s + (q.total_ttc ?? 0), 0),
  }
}
