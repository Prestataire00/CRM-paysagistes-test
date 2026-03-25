import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getUsers,
  getUser,
  createUser,
  updateUserRole,
  updateUserProfile,
  updateProfileTeam,
  deactivateUser,
  getSettings,
  getSettingsByCategory,
  updateSetting,
  getAuditLogs,
  type CreateUserInput,
  type AuditLogFilters,
} from '../services/admin.service'
import type { Role } from '../types'

// ---------------------------------------------------------------------------
// Query key factory - centralised keys for cache management
// ---------------------------------------------------------------------------
export const adminKeys = {
  all: ['admin'] as const,
  users: () => [...adminKeys.all, 'users'] as const,
  user: (id: string) => [...adminKeys.users(), id] as const,
  settings: () => [...adminKeys.all, 'settings'] as const,
  settingsByCategory: () => [...adminKeys.settings(), 'byCategory'] as const,
  auditLogs: () => [...adminKeys.all, 'auditLogs'] as const,
  auditLogList: (filters: AuditLogFilters) => [...adminKeys.auditLogs(), filters] as const,
}

// ---------------------------------------------------------------------------
// useUsers - All users
// ---------------------------------------------------------------------------
export function useUsers() {
  return useQuery({
    queryKey: adminKeys.users(),
    queryFn: () => getUsers(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  })
}

// ---------------------------------------------------------------------------
// useUser - Single user detail
// ---------------------------------------------------------------------------
export function useUser(id: string | undefined) {
  return useQuery({
    queryKey: adminKeys.user(id!),
    queryFn: () => getUser(id!),
    enabled: !!id,
  })
}

// ---------------------------------------------------------------------------
// useCreateUser - Create a new user via edge function
// ---------------------------------------------------------------------------
export function useCreateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateUserInput) => createUser(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users() })
    },
  })
}

// ---------------------------------------------------------------------------
// useUpdateUserRole
// ---------------------------------------------------------------------------
export function useUpdateUserRole() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role }) =>
      updateUserRole(id, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users() })
    },
  })
}

// ---------------------------------------------------------------------------
// useUpdateProfileTeam - Assign user to a default team
// ---------------------------------------------------------------------------
export function useUpdateProfileTeam() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, defaultTeamId }: { id: string; defaultTeamId: string }) =>
      updateProfileTeam(id, defaultTeamId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users() })
    },
  })
}

// ---------------------------------------------------------------------------
// useUpdateUserProfile - Update user profile fields
// ---------------------------------------------------------------------------
export function useUpdateUserProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, fields }: { id: string; fields: { first_name?: string; last_name?: string; email?: string; phone?: string | null } }) =>
      updateUserProfile(id, fields),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users() })
    },
  })
}

// ---------------------------------------------------------------------------
// useDeactivateUser
// ---------------------------------------------------------------------------
export function useDeactivateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deactivateUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users() })
    },
  })
}

// ---------------------------------------------------------------------------
// useSettings - All settings, optional category filter
// ---------------------------------------------------------------------------
export function useSettings(category?: string) {
  return useQuery({
    queryKey: [...adminKeys.settings(), category] as const,
    queryFn: () => getSettings(category),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

// ---------------------------------------------------------------------------
// useSettingsByCategory - Settings grouped by category
// ---------------------------------------------------------------------------
export function useSettingsByCategory() {
  return useQuery({
    queryKey: adminKeys.settingsByCategory(),
    queryFn: () => getSettingsByCategory(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

// ---------------------------------------------------------------------------
// useUpdateSetting
// ---------------------------------------------------------------------------
export function useUpdateSetting() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ key, value, updatedBy }: { key: string; value: unknown; updatedBy: string }) =>
      updateSetting(key, value, updatedBy),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.settings() })
      queryClient.invalidateQueries({ queryKey: adminKeys.settingsByCategory() })
    },
  })
}

// ---------------------------------------------------------------------------
// useAuditLogs - Paginated audit logs
// ---------------------------------------------------------------------------
export function useAuditLogs(filters: AuditLogFilters = {}) {
  return useQuery({
    queryKey: adminKeys.auditLogList(filters),
    queryFn: () => getAuditLogs(filters),
    staleTime: 30 * 1000, // 30 seconds
    placeholderData: (previousData) => previousData,
  })
}
