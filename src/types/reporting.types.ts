export interface ReportingFilters {
  year?: number
  commercialId?: string
}

export interface MonthlyRevenuePoint {
  month: string
  total_ttc: number
  total_ht: number
  total_tva: number
  invoice_count: number
  total_labor_ht: number
}

export interface RevenueByCommercial {
  commercial_id: string
  first_name: string
  last_name: string
  invoice_count: number
  total_ttc: number
  total_ht: number
}

export interface ConversionFunnelData {
  total_quotes: number
  sent: number
  accepted: number
  refused: number
  expired: number
  converted: number
  total_amount: number
  accepted_amount: number
}

export interface ReportingKpis {
  revenue_ttc: number
  revenue_ht: number
  invoice_count: number
  avg_invoice: number
  pending_quotes: number
  pending_quotes_amount: number
  conversion_rate: number
  monthly_growth: number
}
