import { Navigate, useLocation } from 'react-router'
import { useAuth } from '../../../contexts/AuthContext'
import type { Role } from '../../../types'
import type { ReactNode } from 'react'

interface AuthGuardProps {
  children: ReactNode
  roles?: Role[]
}

export function AuthGuard({ children, roles }: AuthGuardProps) {
  const { isAuthenticated, isLoading, user } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (roles && user && !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}

interface RoleGuardProps {
  children: ReactNode
  roles: Role[]
  fallback?: ReactNode
}

export function RoleGuard({ children, roles, fallback }: RoleGuardProps) {
  const { user } = useAuth()

  if (!user || !roles.includes(user.role)) {
    return fallback ? <>{fallback}</> : <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
