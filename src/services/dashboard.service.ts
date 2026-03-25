import { supabase } from '../lib/supabase'
import type { Chantier } from '../types'

// ---------------------------------------------------------------------------
// Dashboard KPI types
// ---------------------------------------------------------------------------
export interface DashboardStats {
  totalClients: number
  activeClients: number
  totalProspects: number
  totalSuppliers: number
  totalQuotes: number
  totalQuotesValue: number
  monthlyRevenue: number
  weeklyInterventions: number
}

export interface MonthlyRevenueData {
  month: number
  label: string
  revenue: number
}

// ---------------------------------------------------------------------------
// getDashboardStats - Aggregate KPIs for the dashboard
// ---------------------------------------------------------------------------
export async function getDashboardStats(): Promise<DashboardStats> {
  const now = new Date()
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split('T')[0]
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .split('T')[0]

  // Calculate the start of the current week (Monday)
  const dayOfWeek = now.getDay()
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() + mondayOffset)
  const weekStartStr = weekStart.toISOString().split('T')[0]

  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  const weekEndStr = weekEnd.toISOString().split('T')[0]

  // Run all queries in parallel
  const [
    activeClientsResult,
    totalClientsResult,
    prospectsResult,
    suppliersResult,
    quotesResult,
    revenueResult,
    interventionsResult,
  ] = await Promise.all([
    // Active clients count
    supabase
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true),

    // Total clients count
    supabase
      .from('clients')
      .select('id', { count: 'exact', head: true }),

    // Total prospects count
    supabase
      .from('prospects')
      .select('id', { count: 'exact', head: true }),

    // Total active suppliers count
    supabase
      .from('suppliers')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true),

    // Quotes: count + sum via selecting only needed column
    supabase
      .from('quotes')
      .select('total_ttc')
      .neq('status', 'refuse')
      .neq('status', 'expire'),

    // Monthly revenue: sum of total_ttc for paid invoices this month
    supabase
      .from('invoices')
      .select('total_ttc')
      .eq('status', 'payee')
      .gte('paid_date', firstDayOfMonth)
      .lte('paid_date', lastDayOfMonth),

    // Weekly interventions: chantiers scheduled this week
    supabase
      .from('chantiers')
      .select('id', { count: 'exact', head: true })
      .gte('scheduled_date', weekStartStr)
      .lte('scheduled_date', weekEndStr)
      .neq('status', 'annulee'),
  ])

  if (activeClientsResult.error) throw activeClientsResult.error
  if (totalClientsResult.error) throw totalClientsResult.error
  if (prospectsResult.error) throw prospectsResult.error
  if (suppliersResult.error) throw suppliersResult.error
  if (quotesResult.error) throw quotesResult.error
  if (revenueResult.error) throw revenueResult.error
  if (interventionsResult.error) throw interventionsResult.error

  // Sum up the monthly revenue
  const monthlyRevenue = (revenueResult.data ?? []).reduce(
    (sum, inv) => sum + Number(inv.total_ttc),
    0,
  )

  // Sum up total quotes value
  const quotesData = quotesResult.data ?? []
  const totalQuotesValue = quotesData.reduce(
    (sum, q) => sum + Number(q.total_ttc),
    0,
  )

  return {
    totalClients: totalClientsResult.count ?? 0,
    activeClients: activeClientsResult.count ?? 0,
    totalProspects: prospectsResult.count ?? 0,
    totalSuppliers: suppliersResult.count ?? 0,
    totalQuotes: quotesData.length,
    totalQuotesValue,
    monthlyRevenue,
    weeklyInterventions: interventionsResult.count ?? 0,
  }
}

// ---------------------------------------------------------------------------
// getMonthlyRevenue - Monthly revenue data for a full year (chart data)
// ---------------------------------------------------------------------------
export async function getMonthlyRevenue(year: number): Promise<MonthlyRevenueData[]> {
  const MONTH_LABELS = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
  ]

  // Fetch all paid invoices for the year
  const { data, error } = await supabase
    .from('invoices')
    .select('total_ttc, paid_date')
    .eq('status', 'payee')
    .gte('paid_date', `${year}-01-01`)
    .lte('paid_date', `${year}-12-31`)

  if (error) throw error

  // Group by month
  const monthlyTotals = new Array(12).fill(0) as number[]

  for (const invoice of data ?? []) {
    if (invoice.paid_date) {
      const month = new Date(invoice.paid_date).getMonth()
      monthlyTotals[month] += Number(invoice.total_ttc)
    }
  }

  return monthlyTotals.map((revenue, index) => ({
    month: index + 1,
    label: MONTH_LABELS[index],
    revenue: Math.round(revenue * 100) / 100,
  }))
}

// ---------------------------------------------------------------------------
// getUpcomingBirthdays - Client birthdays within the next N days
// ---------------------------------------------------------------------------

export interface UpcomingBirthday {
  clientId: string
  clientName: string
  birthdayLabel: string
  date: string
  daysUntil: number
}

export async function getUpcomingBirthdays(daysAhead: number = 7): Promise<UpcomingBirthday[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('id, first_name, last_name, company_name, birthdays')
    .eq('is_active', true)
    .not('birthdays', 'eq', '[]')

  if (error) throw error

  const results: UpcomingBirthday[] = []
  const today = new Date()

  for (const client of data ?? []) {
    if (!client.birthdays || !Array.isArray(client.birthdays)) continue

    for (const bday of client.birthdays as Array<{ label: string; date: string }>) {
      if (!bday.date) continue
      const parts = bday.date.split('-')
      if (parts.length < 3) continue
      const bdayMonth = parseInt(parts[1], 10)
      const bdayDay = parseInt(parts[2], 10)

      for (let offset = 0; offset <= daysAhead; offset++) {
        const checkDate = new Date(today)
        checkDate.setDate(today.getDate() + offset)
        if (checkDate.getMonth() + 1 === bdayMonth && checkDate.getDate() === bdayDay) {
          results.push({
            clientId: client.id,
            clientName: client.company_name || `${client.first_name} ${client.last_name}`,
            birthdayLabel: bday.label,
            date: `${String(bdayDay).padStart(2, '0')}/${String(bdayMonth).padStart(2, '0')}`,
            daysUntil: offset,
          })
          break
        }
      }
    }
  }

  results.sort((a, b) => a.daysUntil - b.daysUntil)
  return results
}

// ---------------------------------------------------------------------------
// getExpiringContracts - Clients whose contract ends within the next N days
// ---------------------------------------------------------------------------
export interface ExpiringContract {
  clientId: string
  clientName: string
  contractEndDate: string
  daysUntil: number
}

export async function getExpiringContracts(daysAhead: number = 60): Promise<ExpiringContract[]> {
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const futureDate = new Date(today)
  futureDate.setDate(today.getDate() + daysAhead)
  const futureDateStr = futureDate.toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('clients')
    .select('id, first_name, last_name, company_name, contract_end_date')
    .eq('is_active', true)
    .not('contract_end_date', 'is', null)
    .gte('contract_end_date', todayStr)
    .lte('contract_end_date', futureDateStr)
    .order('contract_end_date', { ascending: true })

  if (error) throw error

  return (data ?? []).map((client) => {
    const end = new Date(client.contract_end_date!)
    const diff = Math.round((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    return {
      clientId: client.id,
      clientName: client.company_name || `${client.first_name} ${client.last_name}`,
      contractEndDate: client.contract_end_date!,
      daysUntil: diff,
    }
  })
}

// ---------------------------------------------------------------------------
// getRecentInterventions - Latest completed interventions
// ---------------------------------------------------------------------------
export async function getRecentInterventions(limit: number = 10): Promise<Chantier[]> {
  const { data, error } = await supabase
    .from('chantiers')
    .select(`
      *,
      client:clients!client_id(id, first_name, last_name, company_name),
      assigned_team:teams!assigned_team_id(id, name, color)
    `)
    .eq('status', 'terminee')
    .order('completed_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []) as Chantier[]
}

// ---------------------------------------------------------------------------
// getOverdueInvoiceStats - Count & amount of overdue invoices
// ---------------------------------------------------------------------------
export interface OverdueInvoiceStats {
  count: number
  totalAmount: number
}

export async function getOverdueInvoiceStats(): Promise<OverdueInvoiceStats> {
  const today = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('invoices')
    .select('total_ttc, amount_paid')
    .in('status', ['emise', 'envoyee', 'en_retard'])
    .lt('due_date', today)

  if (error) throw error

  const invoices = data ?? []
  return {
    count: invoices.length,
    totalAmount: invoices.reduce((sum, inv) => sum + (Number(inv.total_ttc) - Number(inv.amount_paid || 0)), 0),
  }
}

// ---------------------------------------------------------------------------
// getTeamUtilization - % of team slots filled this week
// ---------------------------------------------------------------------------
export async function getTeamUtilization(): Promise<number> {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() + mondayOffset)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 4) // Mon-Fri

  const [slotsResult, teamsResult] = await Promise.all([
    supabase
      .from('planning_slots')
      .select('id', { count: 'exact', head: true })
      .gte('slot_date', weekStart.toISOString().split('T')[0])
      .lte('slot_date', weekEnd.toISOString().split('T')[0]),
    supabase
      .from('teams')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true),
  ])

  const slots = slotsResult.count ?? 0
  const teams = teamsResult.count ?? 1
  const maxSlots = teams * 5 // 5 days per team

  return maxSlots > 0 ? Math.min(100, Math.round((slots / maxSlots) * 100)) : 0
}

// ---------------------------------------------------------------------------
// getRevenueByZone - Revenue breakdown by geographic zone
// ---------------------------------------------------------------------------
export interface RevenueByZone {
  zone: string
  revenue: number
}

export async function getRevenueByZone(): Promise<RevenueByZone[]> {
  const year = new Date().getFullYear()

  const { data, error } = await supabase
    .from('invoices')
    .select('total_ttc, client:clients!client_id(geographic_zone)')
    .eq('status', 'payee')
    .gte('paid_date', `${year}-01-01`)

  if (error) throw error

  const zoneLabels: Record<string, string> = {
    zone_1: 'Zone 1',
    zone_2: 'Zone 2',
    zone_3: 'Zone 3',
    zone_4: 'Zone 4',
    zone_5: 'Zone 5',
  }

  const totals: Record<string, number> = {}
  for (const inv of data ?? []) {
    const zone = (inv as unknown as { client?: { geographic_zone: string | null } | null }).client?.geographic_zone || 'non_defini'
    const label = zoneLabels[zone] || 'Non défini'
    totals[label] = (totals[label] || 0) + Number(inv.total_ttc)
  }

  return Object.entries(totals)
    .map(([zone, revenue]) => ({ zone, revenue: Math.round(revenue) }))
    .sort((a, b) => b.revenue - a.revenue)
}

// ---------------------------------------------------------------------------
// getSatisfactionStats - Average rating and count (last 30 days)
// ---------------------------------------------------------------------------
export interface SatisfactionStats {
  averageRating: number
  totalReviews: number
  satisfiedPercent: number
}

export async function getSatisfactionStats(): Promise<SatisfactionStats> {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data, error } = await supabase
    .from('chantiers')
    .select('satisfaction_rating')
    .not('satisfaction_rating', 'is', null)
    .gte('satisfaction_date', thirtyDaysAgo.toISOString())

  if (error) throw error

  const ratings = (data ?? []).map(d => Number(d.satisfaction_rating))
  if (ratings.length === 0) return { averageRating: 0, totalReviews: 0, satisfiedPercent: 0 }

  const avg = ratings.reduce((s, r) => s + r, 0) / ratings.length
  const satisfied = ratings.filter(r => r >= 4).length

  return {
    averageRating: Math.round(avg * 10) / 10,
    totalReviews: ratings.length,
    satisfiedPercent: Math.round((satisfied / ratings.length) * 100),
  }
}
