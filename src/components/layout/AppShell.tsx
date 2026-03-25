import { useState, Suspense } from 'react'
import { Outlet, useLocation } from 'react-router'
import { Loader2 } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { ErrorBoundary } from '../feedback/ErrorBoundary'
import { cn } from '../../utils/cn'
import { useFollowUpChecker } from '../../hooks/useFollowUpChecker'

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-32">
      <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
    </div>
  )
}

export function AppShell() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  // Relance automatique : vérifie prospects, devis, factures toutes les 30min
  useFollowUpChecker()

  return (
    <div className="min-h-screen bg-slate-50">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-primary-600 focus:text-white focus:rounded-lg focus:text-sm focus:font-medium"
      >
        Aller au contenu principal
      </a>
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div className={cn(
        'transition-all duration-300',
        sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64',
      )}>
        <Header onMobileMenuOpen={() => setMobileOpen(true)} />
        <main id="main-content" className="p-5 lg:p-8">
          <ErrorBoundary key={location.pathname}>
            <Suspense fallback={<PageLoader />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}
