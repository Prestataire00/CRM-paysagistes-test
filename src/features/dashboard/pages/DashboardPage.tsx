import { brand } from '../../../config/brand'
import {
  Users,
  UserPlus,
  Package,
  Euro,
  CalendarCheck,
  FileText,
  ArrowRight,
  Clock,
  MapPin,
  InboxIcon,
  Cake,
  AlertTriangle,
  Smartphone,
  Star,
  Activity,
  CreditCard,
} from 'lucide-react'
import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import { useRole } from '../../../contexts/AuthContext'
import { Role } from '../../../types'
import { PageHeader } from '../../../components/layout/PageHeader'
import { Skeleton } from '../../../components/ui/Skeleton'
import {
  useDashboardStats,
  useMonthlyRevenue,
  useRecentInterventions,
  useUpcomingBirthdays,
  useExpiringContracts,
  useOverdueInvoiceStats,
  useTeamUtilization,
  useSatisfactionStats,
} from '../../../queries/useDashboard'

const statusLabels: Record<string, { label: string; className: string }> = {
  terminee: { label: 'Terminée', className: 'bg-emerald-100 text-emerald-700' },
  en_cours: { label: 'En cours', className: 'bg-blue-100 text-blue-700' },
  planifiee: { label: 'Planifiée', className: 'bg-slate-100 text-slate-600' },
}

const MONTH_SHORT_LABELS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('fr-FR').format(value) + ' €'
}

export function DashboardPage() {
  const navigate = useNavigate()
  const { role, hasRole } = useRole()
  const { data: statsData, isLoading: statsLoading } = useDashboardStats()
  const { data: revenueData, isLoading: revenueLoading } = useMonthlyRevenue(new Date().getFullYear())
  const { data: interventionsData, isLoading: interventionsLoading } = useRecentInterventions(5)
  const { data: birthdayData, isLoading: birthdayLoading } = useUpcomingBirthdays()
  const { data: expiringContracts } = useExpiringContracts()
  const { data: overdueStats } = useOverdueInvoiceStats()
  const { data: teamUtil } = useTeamUtilization()
  const { data: satisfactionStats } = useSatisfactionStats()

  const fmtCurrency = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)

  // Roles that can see each stat card
  const allStatCards = useMemo(() => statsData
    ? [
        {
          label: 'Clients',
          value: String(statsData.totalClients),
          sub: `${statsData.activeClients} actifs`,
          icon: Users,
          color: 'bg-blue-50 text-blue-600',
          roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.RESPONSABLE_COMMERCIAL, Role.COMMERCIAL, Role.CONDUCTEUR_TRAVAUX] as Role[],
        },
        {
          label: 'Prospects',
          value: String(statsData.totalProspects),
          sub: 'dans le pipeline',
          icon: UserPlus,
          color: 'bg-violet-50 text-violet-600',
          roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.RESPONSABLE_COMMERCIAL, Role.COMMERCIAL] as Role[],
        },
        {
          label: 'Fournisseurs',
          value: String(statsData.totalSuppliers),
          sub: 'actifs',
          icon: Package,
          color: 'bg-amber-50 text-amber-600',
          roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.RESPONSABLE_COMMERCIAL, Role.COMMERCIAL, Role.CONDUCTEUR_TRAVAUX] as Role[],
        },
        {
          label: 'Devis',
          value: String(statsData.totalQuotes),
          sub: formatCurrency(statsData.totalQuotesValue) + ' total',
          icon: FileText,
          color: 'bg-purple-50 text-purple-600',
          roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.RESPONSABLE_COMMERCIAL, Role.COMMERCIAL, Role.FACTURATION] as Role[],
        },
        {
          label: 'CA mensuel',
          value: formatCurrency(statsData.monthlyRevenue),
          sub: 'factures payees',
          icon: Euro,
          color: 'bg-emerald-50 text-emerald-600',
          roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.RESPONSABLE_COMMERCIAL, Role.COMMERCIAL, Role.COMPTABILITE, Role.FACTURATION] as Role[],
        },
        {
          label: 'Interventions',
          value: String(statsData.weeklyInterventions),
          sub: 'cette semaine',
          icon: CalendarCheck,
          color: 'bg-orange-50 text-orange-600',
          roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.CONDUCTEUR_TRAVAUX] as Role[],
        },
      ]
    : [], [statsData])

  const statCards = allStatCards.filter((card) => hasRole(card.roles))

  const maxRevenue = revenueData
    ? Math.max(...revenueData.map((d) => d.revenue), 1)
    : 1

  // Jardinier on desktop — show redirect banner to mobile app
  if (role === Role.JARDINIER) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-20 h-20 rounded-2xl bg-primary-100 flex items-center justify-center mb-6">
          <Smartphone className="w-10 h-10 text-primary-600" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Application mobile</h1>
        <p className="text-slate-500 mb-6 max-w-sm">
          Votre espace de travail est optimisé pour mobile. Accédez à votre planning et vos interventions depuis l'app.
        </p>
        <button
          onClick={() => navigate('/m/schedule')}
          className="flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-xl text-base font-semibold hover:bg-primary-700 transition-colors"
        >
          <CalendarCheck className="w-5 h-5" />
          Voir mon planning
        </button>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Tableau de bord"
        description={`Vue d'ensemble de l'activité ${brand.name}`}
      />

      {/* Expiring Contracts Alert — visible to admin and management */}
      {hasRole([Role.SUPER_ADMIN, Role.ADMIN, Role.RESPONSABLE_COMMERCIAL, Role.COMMERCIAL]) &&
        expiringContracts && expiringContracts.length > 0 && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <h3 className="text-sm font-semibold text-amber-800">
              {expiringContracts.length} contrat{expiringContracts.length > 1 ? 's' : ''} expire{expiringContracts.length > 1 ? 'nt' : ''} dans les 60 jours
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {expiringContracts.map((c) => (
              <button
                key={c.clientId}
                onClick={() => navigate(`/crm/clients/${c.clientId}`)}
                className="flex items-center gap-2 bg-white border border-amber-200 rounded-lg px-3 py-1.5 text-xs hover:bg-amber-50 transition-colors"
              >
                <span className="font-medium text-slate-800">{c.clientName}</span>
                <span className={`font-semibold ${c.daysUntil <= 30 ? 'text-red-600' : 'text-amber-600'}`}>
                  {c.daysUntil === 0 ? 'Expire aujourd\'hui' : `J-${c.daysUntil}`}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Stat Cards */}
      <div className={`grid grid-cols-2 sm:grid-cols-3 ${statCards.length <= 3 ? 'xl:grid-cols-3' : statCards.length <= 4 ? 'xl:grid-cols-4' : 'xl:grid-cols-6'} gap-4 mb-8`}>
        {statsLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm"
              >
                <div className="flex items-center justify-between mb-4">
                  <Skeleton width={44} height={44} rounded="lg" />
                </div>
                <Skeleton width={100} height={28} className="mb-1" />
                <Skeleton width={120} height={16} />
              </div>
            ))
          : statCards.map((stat) => (
              <div
                key={stat.label}
                className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm hover:shadow-md transition-all"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${stat.color}`}>
                    <stat.icon className="w-5 h-5" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-slate-900 tracking-tight">{stat.value}</p>
                <p className="text-sm text-slate-500 mt-0.5">{stat.label}</p>
                {stat.sub && <p className="text-xs text-slate-400 mt-0.5">{stat.sub}</p>}
              </div>
            ))}
      </div>

      {/* Quick insight widgets */}
      {hasRole([Role.SUPER_ADMIN, Role.ADMIN, Role.COMPTABILITE, Role.RESPONSABLE_COMMERCIAL]) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {/* Overdue invoices */}
          {overdueStats && overdueStats.count > 0 && (
            <button
              onClick={() => navigate('/billing/invoices')}
              className="bg-red-50 border border-red-200 rounded-xl p-4 text-left hover:bg-red-100 transition-colors"
            >
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="w-4 h-4 text-red-600" />
                <span className="text-xs font-semibold text-red-700 uppercase">Impayées</span>
              </div>
              <p className="text-2xl font-bold text-red-800">{overdueStats.count}</p>
              <p className="text-sm text-red-600 mt-1">{fmtCurrency(overdueStats.totalAmount)} en retard</p>
            </button>
          )}

          {/* Team utilization */}
          {teamUtil !== undefined && (
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-semibold text-slate-500 uppercase">Occupation équipes</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">{teamUtil}%</p>
              <div className="w-full bg-slate-100 rounded-full h-2 mt-2">
                <div
                  className={`h-2 rounded-full transition-all ${teamUtil >= 80 ? 'bg-emerald-500' : teamUtil >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                  style={{ width: `${teamUtil}%` }}
                />
              </div>
            </div>
          )}

          {/* Satisfaction */}
          {satisfactionStats && satisfactionStats.totalReviews > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Star className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-semibold text-slate-500 uppercase">Satisfaction (30j)</span>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold text-slate-900">{satisfactionStats.averageRating}</p>
                <div className="flex">
                  {[1, 2, 3, 4, 5].map(i => (
                    <Star key={i} className={`w-4 h-4 ${i <= Math.round(satisfactionStats.averageRating) ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`} />
                  ))}
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-1">{satisfactionStats.totalReviews} avis · {satisfactionStats.satisfiedPercent}% satisfaits</p>
            </div>
          )}
        </div>
      )}

      {/* Charts & Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart — visible to admin, commercial, comptabilite, facturation */}
        {hasRole([Role.SUPER_ADMIN, Role.ADMIN, Role.RESPONSABLE_COMMERCIAL, Role.COMMERCIAL, Role.COMPTABILITE, Role.FACTURATION]) && (
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between p-5 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Revenus mensuels</h2>
              <p className="text-sm text-slate-500">Évolution sur 12 mois</p>
            </div>
          </div>
          <div className="p-5">
            {revenueLoading ? (
              <div className="h-64 flex items-end justify-between gap-2 px-2">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <Skeleton
                      className="w-full"
                      height={`${30 + Math.random() * 60}%`}
                      rounded="md"
                    />
                    <span className="text-[10px] text-slate-400">
                      {MONTH_SHORT_LABELS[i]}
                    </span>
                  </div>
                ))}
              </div>
            ) : revenueData && revenueData.some((d) => d.revenue > 0) ? (
              <div className="h-64 flex items-end justify-between gap-2 px-2">
                {revenueData.map((item, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full bg-primary-500/80 rounded-t-md hover:bg-primary-600 transition-colors cursor-pointer"
                      style={{ height: `${(item.revenue / maxRevenue) * 100}%` }}
                      title={`${item.label}: ${formatCurrency(item.revenue)}`}
                    />
                    <span className="text-[10px] text-slate-400">
                      {MONTH_SHORT_LABELS[i]}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-slate-400">
                <Euro className="w-10 h-10 mb-2 opacity-40" />
                <p className="text-sm">Aucune donnée de revenu pour cette année</p>
              </div>
            )}
          </div>
        </div>
        )}

        {/* Recent Interventions — visible to admin, conducteur */}
        {hasRole([Role.SUPER_ADMIN, Role.ADMIN, Role.CONDUCTEUR_TRAVAUX]) && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between p-5 border-b border-slate-100">
            <h2 className="text-lg font-semibold text-slate-900">Interventions récentes</h2>
            <button
              onClick={() => navigate('/planning')}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
            >
              Voir tout
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {interventionsLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-4">
                  <div className="flex items-start justify-between mb-1.5">
                    <Skeleton width={140} height={16} />
                    <Skeleton width={64} height={18} rounded="full" />
                  </div>
                  <Skeleton width={200} height={14} className="mb-1" />
                  <div className="flex items-center justify-between">
                    <Skeleton width={100} height={14} />
                    <Skeleton width={80} height={14} />
                  </div>
                </div>
              ))
            ) : interventionsData && interventionsData.length > 0 ? (
              interventionsData.map((intervention) => {
                const client = intervention.client
                const clientName = client
                  ? client.company_name || `${client.first_name} ${client.last_name}`
                  : 'Client inconnu'
                const address = `${intervention.address_line1}, ${intervention.city}`
                const timeRange =
                  intervention.scheduled_start_time && intervention.scheduled_end_time
                    ? `${intervention.scheduled_start_time.slice(0, 5)} - ${intervention.scheduled_end_time.slice(0, 5)}`
                    : ''
                const statusInfo = statusLabels[intervention.status] || {
                  label: intervention.status,
                  className: 'bg-slate-100 text-slate-600',
                }

                return (
                  <div
                    key={intervention.id}
                    className="p-4 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-1.5">
                      <p className="text-sm font-medium text-slate-900">{clientName}</p>
                      <span
                        className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusInfo.className}`}
                      >
                        {statusInfo.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                      <MapPin className="w-3 h-3" />
                      {address}
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-slate-600">{intervention.intervention_type}</p>
                      {timeRange && (
                        <div className="flex items-center gap-1 text-xs text-slate-400">
                          <Clock className="w-3 h-3" />
                          {timeRange}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="p-8 flex flex-col items-center justify-center text-slate-400">
                <InboxIcon className="w-10 h-10 mb-2 opacity-40" />
                <p className="text-sm">Aucune intervention récente</p>
              </div>
            )}
          </div>
        </div>
        )}
      </div>

      {/* Upcoming Birthdays — visible to commercial roles */}
      {hasRole([Role.SUPER_ADMIN, Role.ADMIN, Role.RESPONSABLE_COMMERCIAL, Role.COMMERCIAL]) && (
      <div className="mt-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm max-w-md">
          <div className="flex items-center justify-between p-5 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-pink-50 flex items-center justify-center">
                <Cake className="w-4 h-4 text-pink-500" />
              </div>
              <h2 className="text-lg font-semibold text-slate-900">Prochains anniversaires</h2>
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {birthdayLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-4 flex items-center justify-between">
                  <div>
                    <Skeleton width={140} height={16} className="mb-1" />
                    <Skeleton width={80} height={14} />
                  </div>
                  <Skeleton width={70} height={22} rounded="full" />
                </div>
              ))
            ) : birthdayData && birthdayData.length > 0 ? (
              birthdayData.map((b) => (
                <div
                  key={`${b.clientId}-${b.date}`}
                  onClick={() => navigate(`/crm/clients/${b.clientId}`)}
                  className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">{b.clientName}</p>
                    <p className="text-xs text-slate-500">
                      {b.birthdayLabel} &middot; {b.date}
                    </p>
                  </div>
                  {b.daysUntil === 0 ? (
                    <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                      Aujourd&apos;hui
                    </span>
                  ) : (
                    <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500">
                      Dans {b.daysUntil} jour{b.daysUntil > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              ))
            ) : (
              <div className="p-8 flex flex-col items-center justify-center text-slate-400">
                <Cake className="w-10 h-10 mb-2 opacity-40" />
                <p className="text-sm">Aucun anniversaire cette semaine</p>
              </div>
            )}
          </div>
        </div>
      </div>
      )}
    </div>
  )
}
