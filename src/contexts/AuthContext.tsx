import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { User } from '../types'
import { Role } from '../types'

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes

interface AuthContextType {
  user: User | null
  session: Session | null
  isLoading: boolean
  isAuthenticated: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null; role: Role | null }>
  signOut: () => Promise<void>
  updateProfile: (updates: Partial<User>) => Promise<{ error: string | null }>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('Error fetching profile:', error)
      return null
    }
    return data as User
  }, [])

  useEffect(() => {
    let cancelled = false

    // Resolve auth state immediately from session, fetch profile in background
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      if (cancelled) return
      setSession(s)
      if (s?.user) {
        // Unblock UI immediately — profile loads in background
        setIsLoading(false)
        fetchProfile(s.user.id).then(profile => {
          if (!cancelled) setUser(profile)
        }).catch(() => {
          if (!cancelled) setUser(null)
        })
      } else {
        setUser(null)
        setIsLoading(false)
      }
    })

    // Hard fallback: never block more than 4 seconds
    const timeout = setTimeout(() => { if (!cancelled) setIsLoading(false) }, 4000)

    return () => {
      cancelled = true
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [fetchProfile])

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message, role: null as Role | null }
    // Fetch profile with timeout so login never hangs
    let profile = null
    if (data.user) {
      try {
        const result = await Promise.race([
          fetchProfile(data.user.id),
          new Promise<null>(resolve => setTimeout(() => resolve(null), 3000))
        ])
        profile = result
      } catch { profile = null }
    }
    if (profile) setUser(profile)
    return { error: null, role: (profile as { role?: string } | null)?.role as Role | null ?? null }
  }, [fetchProfile])

  const signOut = useCallback(async () => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current)
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
  }, [])

  // Auto-logout after 30 minutes of inactivity
  useEffect(() => {
    if (!session) return

    const resetTimer = () => {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current)
      inactivityTimer.current = setTimeout(() => {
        signOut()
      }, INACTIVITY_TIMEOUT_MS)
    }

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'] as const
    events.forEach((e) => window.addEventListener(e, resetTimer))
    resetTimer()

    return () => {
      events.forEach((e) => window.removeEventListener(e, resetTimer))
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current)
    }
  }, [session, signOut])

  const updateProfile = useCallback(async (updates: Partial<User>) => {
    if (!user) return { error: 'Non connecté' }
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
    if (error) return { error: error.message }
    setUser(prev => prev ? { ...prev, ...updates } : null)
    return { error: null }
  }, [user])

  const value = useMemo(() => ({
    user,
    session,
    isLoading,
    isAuthenticated: !!session,
    signIn,
    signOut,
    updateProfile,
  }), [user, session, isLoading, signIn, signOut, updateProfile])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export function useRole() {
  const { user } = useAuth()
  const role = user?.role ?? null

  return {
    role,
    isSuperAdmin: role === Role.SUPER_ADMIN,
    isAdmin: role === Role.SUPER_ADMIN || role === Role.ADMIN,
    isManagement: role === Role.SUPER_ADMIN || role === Role.ADMIN || role === Role.RESPONSABLE_COMMERCIAL || role === Role.CONDUCTEUR_TRAVAUX,
    isCommercial: role === Role.COMMERCIAL || role === Role.RESPONSABLE_COMMERCIAL,
    isJardinier: role === Role.JARDINIER,
    isComptabilite: role === Role.COMPTABILITE,
    isFacturation: role === Role.FACTURATION,
    hasRole: (roles: Role[]) => role !== null && roles.includes(role),
  }
}
