import { brand } from '../../config/brand'
import { useState, useRef, useCallback, useEffect, useMemo, memo } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router'
import { useAuth, useRole } from '../../contexts/AuthContext'
import { cn } from '../../utils/cn'
import {
  LayoutDashboard, CalendarDays, Users, UserPlus, FileText, Package,
  Receipt, Shield, Truck, Wrench, UserCog, Settings, FileSearch,
  LogOut, ChevronLeft, ChevronDown, Building2, Menu,
  Plus, ClipboardCheck, Heart, Mail, MessageSquare, LayoutTemplate, BarChart2, Zap,
  CreditCard, ScrollText,
} from 'lucide-react'
// Logo is now an inline <img> in the sidebar header
import { useUnreadMessageCount } from '../../queries/useMessaging'
import type { Role } from '../../types'
import type { LucideIcon } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NavChild {
  label: string
  icon: LucideIcon
  path: string
  roles: Role[]
}

interface NavGroup {
  id: string
  label: string
  section?: string
  icon: LucideIcon
  path?: string
  roles: Role[]
  children?: NavChild[]
}

// ---------------------------------------------------------------------------
// Navigation structure
// ---------------------------------------------------------------------------

const navigation: NavGroup[] = [
  // ── Tableau de bord ──
  {
    id: 'dashboard',
    label: 'Tableau de bord',
    icon: LayoutDashboard,
    path: '/dashboard',
    roles: ['super_admin', 'admin', 'responsable_commercial', 'commercial', 'conducteur_travaux', 'comptabilite', 'facturation'] as Role[],
  },

  // ── COMMERCIAL ──
  {
    id: 'crm',
    label: 'Clients',
    icon: Building2,
    section: 'Commercial',
    roles: ['super_admin', 'admin', 'responsable_commercial', 'commercial', 'conducteur_travaux', 'comptabilite'] as Role[],
    children: [
      { label: 'Clients', icon: Building2, path: '/crm/clients', roles: ['super_admin', 'admin', 'responsable_commercial', 'commercial', 'conducteur_travaux', 'comptabilite'] as Role[] },
      { label: 'Prospects', icon: UserPlus, path: '/crm/prospects', roles: ['super_admin', 'admin', 'responsable_commercial', 'commercial'] as Role[] },
      { label: 'Fournisseurs', icon: Package, path: '/crm/fournisseurs', roles: ['super_admin', 'admin', 'responsable_commercial', 'commercial', 'conducteur_travaux'] as Role[] },
      { label: 'Agenda', icon: CalendarDays, path: '/crm/agenda', roles: ['super_admin', 'admin', 'responsable_commercial', 'commercial'] as Role[] },
    ],
  },

  // ── DEVIS & FACTURATION ──
  {
    id: 'finance',
    label: 'Devis & Facturation',
    icon: Receipt,
    section: 'Devis & Facturation',
    roles: ['super_admin', 'admin', 'responsable_commercial', 'commercial', 'comptabilite', 'facturation'] as Role[],
    children: [
      { label: 'Devis', icon: FileText, path: '/crm/devis', roles: ['super_admin', 'admin', 'responsable_commercial', 'commercial', 'facturation'] as Role[] },
      { label: 'Factures', icon: Receipt, path: '/billing/invoices', roles: ['super_admin', 'admin', 'comptabilite', 'facturation'] as Role[] },
      { label: 'Contrats', icon: ScrollText, path: '/crm/contrats', roles: ['super_admin', 'admin', 'responsable_commercial', 'commercial'] as Role[] },
      { label: 'Paiements', icon: CreditCard, path: '/billing/paiements', roles: ['super_admin', 'admin', 'comptabilite', 'facturation'] as Role[] },
      { label: 'Attestations', icon: Shield, path: '/billing/attestations', roles: ['super_admin', 'admin', 'comptabilite'] as Role[] },
      { label: 'Catalogue', icon: Package, path: '/catalog', roles: ['super_admin', 'admin', 'responsable_commercial', 'commercial'] as Role[] },
      { label: 'Modèles devis', icon: LayoutTemplate, path: '/billing/templates', roles: ['super_admin', 'admin', 'responsable_commercial', 'commercial'] as Role[] },
    ],
  },

  // ── TERRAIN ──
  {
    id: 'planning',
    label: 'Planning',
    icon: CalendarDays,
    path: '/planning',
    section: 'Terrain',
    roles: ['super_admin', 'admin', 'responsable_commercial', 'commercial', 'conducteur_travaux'] as Role[],
  },
  {
    id: 'interventions',
    label: 'Interventions',
    icon: ClipboardCheck,
    path: '/interventions',
    roles: ['super_admin', 'admin', 'conducteur_travaux'] as Role[],
  },

  // ── COMMUNICATION ──
  {
    id: 'messagerie',
    label: 'Messagerie',
    icon: MessageSquare,
    path: '/messagerie',
    section: 'Communication',
    roles: ['super_admin', 'admin', 'responsable_commercial', 'commercial', 'conducteur_travaux', 'comptabilite', 'facturation'] as Role[],
  },
  {
    id: 'newsletters',
    label: 'Newsletters',
    icon: Mail,
    path: '/relation/newsletters',
    roles: ['super_admin', 'admin', 'responsable_commercial', 'commercial'] as Role[],
  },
  {
    id: 'events',
    label: 'Événements',
    icon: Heart,
    path: '/relation/events',
    roles: ['super_admin', 'admin', 'responsable_commercial', 'commercial'] as Role[],
  },

  // ── RESSOURCES ──
  {
    id: 'resources',
    label: 'Ressources',
    icon: Users,
    section: 'Ressources',
    roles: ['super_admin', 'admin', 'conducteur_travaux'] as Role[],
    children: [
      { label: 'Personnel', icon: Users, path: '/resources/personnel', roles: ['super_admin', 'admin', 'conducteur_travaux'] as Role[] },
      { label: 'Véhicules', icon: Truck, path: '/resources/vehicles', roles: ['super_admin', 'admin', 'conducteur_travaux'] as Role[] },
      { label: 'Matériel', icon: Wrench, path: '/resources/equipment', roles: ['super_admin', 'admin', 'conducteur_travaux'] as Role[] },
    ],
  },

  // ── RAPPORTS ──
  {
    id: 'reporting',
    label: 'Rapports',
    icon: BarChart2,
    path: '/reporting',
    roles: ['super_admin', 'admin', 'responsable_commercial', 'comptabilite'] as Role[],
  },

  // ── ADMINISTRATION ──
  {
    id: 'admin',
    label: 'Paramètres',
    icon: Settings,
    section: 'Administration',
    roles: ['super_admin', 'admin'] as Role[],
    children: [
      { label: 'Utilisateurs', icon: UserCog, path: '/admin/users', roles: ['super_admin', 'admin'] as Role[] },
      { label: 'Paramètres', icon: Settings, path: '/admin/settings', roles: ['super_admin', 'admin'] as Role[] },
      { label: 'Audit', icon: FileSearch, path: '/admin/audit', roles: ['super_admin', 'admin'] as Role[] },
      { label: 'Champs perso.', icon: LayoutTemplate, path: '/admin/custom-fields', roles: ['super_admin', 'admin'] as Role[] },
      { label: 'Automatisations', icon: Zap, path: '/admin/workflows', roles: ['super_admin', 'admin'] as Role[] },
    ],
  },
]

const QUICK_ACTIONS = [
  { label: 'Nouveau Client', icon: Building2, path: '/crm/clients?action=create' },
  { label: 'Nouveau Chantier', icon: ClipboardCheck, path: '/planning?action=create' },
  { label: 'Nouveau Devis', icon: FileText, path: '/crm/devis/new' },
]

// ---------------------------------------------------------------------------
// Helper: check if a group has an active child
// ---------------------------------------------------------------------------

function groupHasActiveChild(group: NavGroup, pathname: string): boolean {
  if (group.children) {
    return group.children.some((c) => pathname.startsWith(c.path))
  }
  return false
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  mobileOpen: boolean
  onMobileClose: () => void
}

export const Sidebar = memo(function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: SidebarProps) {
  const { hasRole } = useRole()
  const { signOut, user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const { data: unreadCount = 0 } = useUnreadMessageCount()

  // Persistent open groups state
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('sidebar-open-groups')
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })

  // Quick actions dropdown
  const [quickActionsOpen, setQuickActionsOpen] = useState(false)
  const quickActionsRef = useRef<HTMLDivElement>(null)

  // Flyout for collapsed sidebar groups
  const [flyoutGroupId, setFlyoutGroupId] = useState<string | null>(null)

  // Auto-open groups that have an active child on initial render
  useEffect(() => {
    const updates: Record<string, boolean> = {}
    for (const group of navigation) {
      if (group.children && groupHasActiveChild(group, location.pathname)) {
        updates[group.id] = true
      }
    }
    if (Object.keys(updates).length > 0) {
      setOpenGroups((prev) => ({ ...prev, ...updates }))
    }
  }, [location.pathname])

  const toggleGroup = useCallback((groupId: string) => {
    setOpenGroups((prev) => {
      const next = { ...prev, [groupId]: !prev[groupId] }
      localStorage.setItem('sidebar-open-groups', JSON.stringify(next))
      return next
    })
  }, [])

  // Close quick actions on outside click
  useEffect(() => {
    if (!quickActionsOpen) return
    const handler = (e: MouseEvent) => {
      if (quickActionsRef.current && !quickActionsRef.current.contains(e.target as Node)) {
        setQuickActionsOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [quickActionsOpen])

  // Filter navigation by role
  const filteredNav = useMemo(() => navigation.filter((group) => hasRole(group.roles)), [hasRole])

  // Pre-compute visible children per group
  const visibleChildrenMap = useMemo(() => {
    const map: Record<string, NavChild[]> = {}
    for (const group of filteredNav) {
      if (group.children && group.children.length > 0) {
        map[group.id] = group.children.filter((c) => hasRole(c.roles))
      }
    }
    return map
  }, [filteredNav, hasRole])

  const linkClass = (isActive: boolean) =>
    cn(
      'flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150',
      isActive
        ? 'bg-primary-50 text-primary-700'
        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
      collapsed && 'justify-center px-0',
    )

  const childLinkClass = (isActive: boolean) =>
    cn(
      'flex items-center gap-3 pl-10 pr-3 py-1.5 rounded-lg text-[13px] transition-all duration-150',
      isActive
        ? 'bg-primary-50 text-primary-700 font-medium'
        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700',
    )

  // Track which sections have been rendered to avoid duplicate headers
  const renderedSections = new Set<string>()

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 lg:hidden" onClick={onMobileClose} />
      )}

      <aside
        aria-label="Navigation principale"
        className={cn(
          'fixed top-0 left-0 h-full bg-white border-r border-slate-200 z-50 flex flex-col transition-all duration-300',
          collapsed ? 'w-16' : 'w-64',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* Logo */}
        <div className={cn(
          'flex items-center justify-center border-b border-slate-100 shrink-0',
          collapsed ? 'px-2 py-3' : 'px-4 py-4',
        )}>
          <img
            src={brand.logoPath}
            alt={brand.logoAlt}
            className={cn(
              'object-contain',
              collapsed ? 'h-10 w-10' : 'w-full max-h-16',
            )}
          />
        </div>

        {/* Quick Actions */}
        <div className="px-3 pt-4 pb-2 shrink-0 relative" ref={quickActionsRef}>
          {!collapsed ? (
            <button
              onClick={() => setQuickActionsOpen((v) => !v)}
              className="flex items-center gap-2 w-full px-3 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Action rapide
            </button>
          ) : (
            <button
              onClick={() => setQuickActionsOpen((v) => !v)}
              className="w-full flex justify-center"
            >
              <span className="w-10 h-10 rounded-lg bg-primary-600 text-white flex items-center justify-center hover:bg-primary-700 transition-colors shadow-sm">
                <Plus className="w-5 h-5" />
              </span>
            </button>
          )}

          {/* Quick Actions Dropdown */}
          {quickActionsOpen && (
            <div
              className={cn(
                'absolute z-50 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 min-w-[200px]',
                collapsed ? 'left-full top-0 ml-2' : 'left-3 right-3 top-full mt-1',
              )}
            >
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.path}
                  onClick={() => {
                    setQuickActionsOpen(false)
                    onMobileClose()
                    navigate(action.path)
                  }}
                  className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <action.icon className="w-4 h-4 text-primary-600" />
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav aria-label="Menu principal" className="flex-1 overflow-y-auto py-2 px-3 space-y-0.5">
          {filteredNav.map((group) => {
            const visibleChildren = visibleChildrenMap[group.id] ?? []
            const hasChildren = visibleChildren.length > 0 || (group.children && group.children.length > 0)
            const isGroupOpen = openGroups[group.id] ?? false
            const hasActiveChild = groupHasActiveChild(group, location.pathname)

            // Section header
            let sectionHeader = null
            if (group.section && !collapsed && !renderedSections.has(group.section)) {
              renderedSections.add(group.section)
              sectionHeader = (
                <p className="px-3 pt-5 pb-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  {group.section}
                </p>
              )
            }

            // Simple link (no children)
            if (!hasChildren || visibleChildren.length === 0) {
              return (
                <div key={group.id}>
                  {sectionHeader}
                  <NavLink
                    to={group.path!}
                    onClick={onMobileClose}
                    className={({ isActive }) => linkClass(isActive)}
                  >
                    <group.icon className={cn('w-[18px] h-[18px] shrink-0', 'transition-colors')} />
                    {!collapsed && <span className="truncate flex-1">{group.label}</span>}
                    {group.id === 'messagerie' && unreadCount > 0 && (
                      <span className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-primary-600 text-white text-[11px] font-bold flex items-center justify-center">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </NavLink>
                </div>
              )
            }

            // Collapsed: group icon + flyout
            if (collapsed) {
              return (
                <div
                  key={group.id}
                  className="relative"
                  onMouseEnter={() => setFlyoutGroupId(group.id)}
                  onMouseLeave={() => setFlyoutGroupId(null)}
                >
                  <button
                    className={cn(
                      'flex items-center justify-center w-full py-2 rounded-lg text-[13px] transition-all duration-150',
                      hasActiveChild
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                    )}
                  >
                    <group.icon className="w-[18px] h-[18px] shrink-0" />
                  </button>

                  {/* Flyout */}
                  {flyoutGroupId === group.id && (
                    <div className="absolute left-full top-0 ml-2 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 min-w-[180px] z-50">
                      <div className="px-3 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        {group.label}
                      </div>
                      {visibleChildren.map((child) => (
                        <NavLink
                          key={child.path}
                          to={child.path}
                          onClick={() => {
                            setFlyoutGroupId(null)
                            onMobileClose()
                          }}
                          className={({ isActive }) =>
                            cn(
                              'flex items-center gap-2.5 px-3 py-2 text-sm transition-colors',
                              isActive
                                ? 'bg-primary-50 text-primary-700 font-medium'
                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                            )
                          }
                        >
                          <child.icon className="w-4 h-4 shrink-0" />
                          <span>{child.label}</span>
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              )
            }

            // Expanded: collapsible group
            return (
              <div key={group.id}>
                {sectionHeader}
                <button
                  onClick={() => toggleGroup(group.id)}
                  className={cn(
                    'flex items-center gap-3 w-full px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150',
                    hasActiveChild
                      ? 'text-primary-700'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                  )}
                >
                  <group.icon className="w-[18px] h-[18px] shrink-0" />
                  <span className="truncate flex-1 text-left">{group.label}</span>
                  <ChevronDown
                    className={cn(
                      'w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200',
                      !isGroupOpen && '-rotate-90',
                    )}
                  />
                </button>

                {isGroupOpen && (
                  <div className="mt-0.5 space-y-0.5">
                    {visibleChildren.map((child) => (
                      <NavLink
                        key={child.path}
                        to={child.path}
                        onClick={onMobileClose}
                        className={({ isActive }) => childLinkClass(isActive)}
                      >
                        <child.icon className="w-4 h-4 shrink-0" />
                        <span className="truncate">{child.label}</span>
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-slate-100 p-3 space-y-1.5 shrink-0">
          {!collapsed && user && (
            <div className="px-3 py-2 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                <span className="text-xs font-semibold text-primary-700">
                  {user.first_name?.[0]}{user.last_name?.[0]}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">
                  {user.first_name} {user.last_name}
                </p>
              </div>
            </div>
          )}
          <button
            onClick={signOut}
            className={cn(
              'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors w-full',
              collapsed && 'justify-center',
            )}
          >
            <LogOut className="w-[18px] h-[18px] shrink-0" />
            {!collapsed && <span>Déconnexion</span>}
          </button>
          <button
            onClick={onToggle}
            className="hidden lg:flex items-center justify-center w-full py-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <ChevronLeft className={cn('w-4 h-4 transition-transform', collapsed && 'rotate-180')} />
          </button>
        </div>
      </aside>
    </>
  )
})

export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
    >
      <Menu className="w-5 h-5" />
    </button>
  )
}
