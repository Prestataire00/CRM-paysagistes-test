import { useQuery } from '@tanstack/react-query'
import {
  getDashboardStats,
  getMonthlyRevenue,
  getRecentInterventions,
  getUpcomingBirthdays,
  getExpiringContracts,
  getOverdueInvoiceStats,
  getTeamUtilization,
  getRevenueByZone,
  getSatisfactionStats,
} from '../services/dashboard.service'

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------
export const dashboardKeys = {
  all: ['dashboard'] as const,
  stats: () => [...dashboardKeys.all, 'stats'] as const,
  monthlyRevenue: (year: number) => [...dashboardKeys.all, 'monthlyRevenue', year] as const,
  recentInterventions: (limit: number) =>
    [...dashboardKeys.all, 'recentInterventions', limit] as const,
  upcomingBirthdays: () => [...dashboardKeys.all, 'upcomingBirthdays'] as const,
  expiringContracts: () => [...dashboardKeys.all, 'expiringContracts'] as const,
  overdueInvoices: () => [...dashboardKeys.all, 'overdueInvoices'] as const,
  teamUtilization: () => [...dashboardKeys.all, 'teamUtilization'] as const,
  revenueByZone: () => [...dashboardKeys.all, 'revenueByZone'] as const,
  satisfaction: () => [...dashboardKeys.all, 'satisfaction'] as const,
}

// ---------------------------------------------------------------------------
// useDashboardStats - KPI aggregations
// ---------------------------------------------------------------------------
export function useDashboardStats() {
  return useQuery({
    queryKey: dashboardKeys.stats(),
    queryFn: getDashboardStats,
    staleTime: 60 * 1000, // 1 minute - dashboard data can be slightly stale
    refetchInterval: 5 * 60 * 1000, // Auto-refetch every 5 minutes
  })
}

// ---------------------------------------------------------------------------
// useMonthlyRevenue - Chart data for a given year
// ---------------------------------------------------------------------------
export function useMonthlyRevenue(year: number) {
  return useQuery({
    queryKey: dashboardKeys.monthlyRevenue(year),
    queryFn: () => getMonthlyRevenue(year),
    staleTime: 5 * 60 * 1000, // 5 minutes - historical data changes less frequently
  })
}

// ---------------------------------------------------------------------------
// useRecentInterventions - Latest completed interventions
// ---------------------------------------------------------------------------
export function useRecentInterventions(limit: number = 10) {
  return useQuery({
    queryKey: dashboardKeys.recentInterventions(limit),
    queryFn: () => getRecentInterventions(limit),
    staleTime: 60 * 1000,
  })
}

// ---------------------------------------------------------------------------
// useUpcomingBirthdays - Client birthdays within the next 7 days
// ---------------------------------------------------------------------------
export function useUpcomingBirthdays() {
  return useQuery({
    queryKey: dashboardKeys.upcomingBirthdays(),
    queryFn: () => getUpcomingBirthdays(7),
    staleTime: 60 * 60 * 1000, // 1 hour
  })
}

// ---------------------------------------------------------------------------
// useExpiringContracts - Clients with contracts expiring within 60 days
// ---------------------------------------------------------------------------
export function useExpiringContracts() {
  return useQuery({
    queryKey: dashboardKeys.expiringContracts(),
    queryFn: () => getExpiringContracts(60),
    staleTime: 60 * 60 * 1000,
  })
}

export function useOverdueInvoiceStats() {
  return useQuery({
    queryKey: dashboardKeys.overdueInvoices(),
    queryFn: getOverdueInvoiceStats,
    staleTime: 5 * 60 * 1000,
  })
}

export function useTeamUtilization() {
  return useQuery({
    queryKey: dashboardKeys.teamUtilization(),
    queryFn: getTeamUtilization,
    staleTime: 5 * 60 * 1000,
  })
}

export function useRevenueByZone() {
  return useQuery({
    queryKey: dashboardKeys.revenueByZone(),
    queryFn: getRevenueByZone,
    staleTime: 10 * 60 * 1000,
  })
}

export function useSatisfactionStats() {
  return useQuery({
    queryKey: dashboardKeys.satisfaction(),
    queryFn: getSatisfactionStats,
    staleTime: 10 * 60 * 1000,
  })
}
