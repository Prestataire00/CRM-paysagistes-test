export const Role = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  RESPONSABLE_COMMERCIAL: 'responsable_commercial',
  COMMERCIAL: 'commercial',
  CONDUCTEUR_TRAVAUX: 'conducteur_travaux',
  COMPTABILITE: 'comptabilite',
  FACTURATION: 'facturation',
  JARDINIER: 'jardinier',
} as const

export type Role = (typeof Role)[keyof typeof Role]

export const ROLE_LABELS: Record<Role, string> = {
  [Role.SUPER_ADMIN]: 'Super Administrateur',
  [Role.ADMIN]: 'Administrateur',
  [Role.RESPONSABLE_COMMERCIAL]: 'Responsable Commercial',
  [Role.COMMERCIAL]: 'Commercial',
  [Role.CONDUCTEUR_TRAVAUX]: 'Conducteur de Travaux',
  [Role.COMPTABILITE]: 'Comptabilité',
  [Role.FACTURATION]: 'Facturation',
  [Role.JARDINIER]: 'Jardinier',
}

export interface User {
  id: string
  email: string
  first_name: string
  last_name: string
  phone: string | null
  role: Role
  avatar_url: string | null
  is_active: boolean
  hire_date: string | null
  default_team_id: string | null
  default_team?: { id: string; name: string; color: string } | null
  calendar_token: string | null
  created_at: string
  updated_at: string
}

export interface AuthState {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
}
