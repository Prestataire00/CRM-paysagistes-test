import { Suspense } from 'react'
import { Outlet, NavLink } from 'react-router'
import { CalendarDays, Users, User, WifiOff, Loader2 } from 'lucide-react'
import { useSync } from '../../contexts/SyncContext'
import { cn } from '../../utils/cn'

export function MobileShell() {
  const { isOnline, pendingCount, isSyncing } = useSync()

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Sync status bar */}
      {(!isOnline || pendingCount > 0) && (
        <div className={cn(
          'px-4 py-2 text-xs font-medium text-center',
          !isOnline ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800',
        )}>
          {!isOnline ? (
            <span className="inline-flex items-center gap-1">
              <WifiOff className="w-3 h-3" /> Mode hors connexion
            </span>
          ) : isSyncing ? (
            'Synchronisation en cours...'
          ) : (
            `${pendingCount} action(s) en attente de synchronisation`
          )}
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-y-auto pb-20">
        <Suspense fallback={
          <div className="flex items-center justify-center py-32">
            <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
          </div>
        }>
          <Outlet />
        </Suspense>
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex items-center justify-around h-16 z-40">
        <NavLink
          to="/m/schedule"
          className={({ isActive }) => cn(
            'flex flex-col items-center gap-1 px-4 py-2 text-xs font-medium transition-colors',
            isActive ? 'text-primary-600' : 'text-slate-400',
          )}
        >
          <CalendarDays className="w-5 h-5" />
          <span>Planning</span>
        </NavLink>
        <NavLink
          to="/m/team"
          className={({ isActive }) => cn(
            'flex flex-col items-center gap-1 px-4 py-2 text-xs font-medium transition-colors',
            isActive ? 'text-primary-600' : 'text-slate-400',
          )}
        >
          <Users className="w-5 h-5" />
          <span>Équipe</span>
        </NavLink>
        <NavLink
          to="/m/profile"
          className={({ isActive }) => cn(
            'flex flex-col items-center gap-1 px-4 py-2 text-xs font-medium transition-colors',
            isActive ? 'text-primary-600' : 'text-slate-400',
          )}
        >
          <User className="w-5 h-5" />
          <span>Profil</span>
        </NavLink>
      </nav>
    </div>
  )
}
