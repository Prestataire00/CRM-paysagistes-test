import { useQuery } from '@tanstack/react-query'
import {
  getReportingKpis,
  getMonthlyRevenueSeries,
  getRevenueByCommercial,
  getConversionFunnel,
  getHoursEfficiency,
} from '../services/reporting.service'

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------
export const reportingKeys = {
  all: ['reporting'] as const,
  kpis: (year: number) => [...reportingKeys.all, 'kpis', year] as const,
  monthly: (year: number) => [...reportingKeys.all, 'monthly', year] as const,
  byCommercial: (year: number) => [...reportingKeys.all, 'by-commercial', year] as const,
  funnel: (year: number) => [...reportingKeys.all, 'funnel', year] as const,
  hoursEfficiency: (year: number) => [...reportingKeys.all, 'hours-efficiency', year] as const,
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useReportingKpis(year: number) {
  return useQuery({
    queryKey: reportingKeys.kpis(year),
    queryFn: () => getReportingKpis(year),
    staleTime: 5 * 60 * 1000,
  })
}

export function useMonthlyRevenueSeries(year: number) {
  return useQuery({
    queryKey: reportingKeys.monthly(year),
    queryFn: () => getMonthlyRevenueSeries(year),
    staleTime: 5 * 60 * 1000,
  })
}

export function useRevenueByCommercial(year: number) {
  return useQuery({
    queryKey: reportingKeys.byCommercial(year),
    queryFn: () => getRevenueByCommercial(year),
    staleTime: 5 * 60 * 1000,
  })
}

export function useConversionFunnel(year: number) {
  return useQuery({
    queryKey: reportingKeys.funnel(year),
    queryFn: () => getConversionFunnel(year),
    staleTime: 5 * 60 * 1000,
  })
}

export function useHoursEfficiency(year: number) {
  return useQuery({
    queryKey: reportingKeys.hoursEfficiency(year),
    queryFn: () => getHoursEfficiency(year),
    staleTime: 5 * 60 * 1000,
  })
}
