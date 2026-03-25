import { useState } from 'react'
import { TrendingUp, TrendingDown, FileText, Receipt, Users, Target, Loader2, Clock } from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { PageHeader } from '../../../components/layout/PageHeader'
import {
  useReportingKpis,
  useMonthlyRevenueSeries,
  useRevenueByCommercial,
  useConversionFunnel,
  useHoursEfficiency,
} from '../../../queries/useReporting'

const CURRENT_YEAR = new Date().getFullYear()
const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

const TABS = [
  { id: 'revenus', label: 'Revenus' },
  { id: 'devis', label: 'Devis' },
  { id: 'commerciaux', label: 'Par Commercial' },
  { id: 'operations', label: 'Opérations' },
] as const
type TabId = (typeof TABS)[number]['id']

const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']

function formatCurrency(n: number) {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
}

function formatK(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k €`
  return `${n.toFixed(0)} €`
}

export function ReportingPage() {
  const [year, setYear] = useState(CURRENT_YEAR)
  const [activeTab, setActiveTab] = useState<TabId>('revenus')

  const { data: kpis, isLoading: isLoadingKpis } = useReportingKpis(year)
  const { data: monthly, isLoading: isLoadingMonthly } = useMonthlyRevenueSeries(year)
  const { data: byCommercial, isLoading: isLoadingCommercial } = useRevenueByCommercial(year)
  const { data: funnel, isLoading: isLoadingFunnel } = useConversionFunnel(year)
  const { data: hoursData, isLoading: isLoadingHours } = useHoursEfficiency(year)

  const isLoading = isLoadingKpis || isLoadingMonthly || isLoadingCommercial || isLoadingFunnel || isLoadingHours

  const monthlyData = (monthly ?? []).map((p, i) => ({
    ...p,
    label: MONTH_LABELS[i] ?? p.month,
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rapports & Statistiques"
        description={`Vue d'ensemble de l'activité ${year}`}
        actions={
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            className="px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          >
            {[CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        }
      />

      {/* KPI Cards */}
      {isLoadingKpis ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
        </div>
      ) : kpis && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Chiffre d'affaires TTC"
            value={formatCurrency(kpis.revenue_ttc)}
            icon={Receipt}
            trend={kpis.monthly_growth}
          />
          <KpiCard
            label="Factures encaissées"
            value={String(kpis.invoice_count)}
            icon={FileText}
            sub={`Moy. ${formatCurrency(kpis.avg_invoice)}`}
          />
          <KpiCard
            label="Devis en attente"
            value={String(kpis.pending_quotes)}
            icon={Target}
            sub={formatCurrency(kpis.pending_quotes_amount)}
          />
          <KpiCard
            label="Taux de conversion"
            value={`${kpis.conversion_rate.toFixed(1)}%`}
            icon={Users}
          />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-white text-primary-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
        </div>
      ) : (
        <>
          {/* Revenus Tab */}
          {activeTab === 'revenus' && (
            <div className="space-y-6">
              {/* Monthly revenue chart */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6">
                <h3 className="text-sm font-semibold text-slate-800 mb-4">Chiffre d'affaires mensuel</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                      <YAxis tickFormatter={formatK} tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={(value) => formatCurrency(Number(value ?? 0))}
                        labelFormatter={(label) => `${label} ${year}`}
                      />
                      <Legend />
                      <Bar dataKey="total_ht" name="HT" fill="#6366f1" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="total_tva" name="TVA" fill="#c7d2fe" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Revenue line trend */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6">
                <h3 className="text-sm font-semibold text-slate-800 mb-4">Évolution du CA TTC</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                      <YAxis tickFormatter={formatK} tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0))} />
                      <Line
                        type="monotone"
                        dataKey="total_ttc"
                        name="CA TTC"
                        stroke="#6366f1"
                        strokeWidth={2}
                        dot={{ r: 4, fill: '#6366f1' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* Devis Tab */}
          {activeTab === 'devis' && funnel && (
            <div className="space-y-6">
              {/* Funnel stats */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6">
                <h3 className="text-sm font-semibold text-slate-800 mb-4">Entonnoir de conversion</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                  <FunnelStep label="Total devis" value={funnel.total_quotes} color="text-slate-700" />
                  <FunnelStep label="Envoyés" value={funnel.sent} color="text-blue-600" />
                  <FunnelStep label="Acceptés" value={funnel.accepted} color="text-green-600" />
                  <FunnelStep label="Convertis" value={funnel.converted} color="text-primary-600" />
                </div>
                <div className="h-8 bg-slate-100 rounded-full overflow-hidden flex">
                  {funnel.total_quotes > 0 && (
                    <>
                      <div
                        className="bg-green-500 h-full transition-all"
                        style={{ width: `${(funnel.accepted / funnel.total_quotes) * 100}%` }}
                        title={`Acceptés: ${funnel.accepted}`}
                      />
                      <div
                        className="bg-red-400 h-full transition-all"
                        style={{ width: `${(funnel.refused / funnel.total_quotes) * 100}%` }}
                        title={`Refusés: ${funnel.refused}`}
                      />
                      <div
                        className="bg-amber-400 h-full transition-all"
                        style={{ width: `${(funnel.expired / funnel.total_quotes) * 100}%` }}
                        title={`Expirés: ${funnel.expired}`}
                      />
                      <div
                        className="bg-blue-400 h-full transition-all"
                        style={{ width: `${(funnel.sent / funnel.total_quotes) * 100}%` }}
                        title={`En attente: ${funnel.sent}`}
                      />
                    </>
                  )}
                </div>
                <div className="flex gap-4 mt-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500" /> Acceptés</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-400" /> Refusés</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Expirés</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-400" /> En attente</span>
                </div>
              </div>

              {/* Pie chart */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6">
                <h3 className="text-sm font-semibold text-slate-800 mb-4">Répartition par statut</h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Acceptés', value: funnel.accepted },
                          { name: 'Refusés', value: funnel.refused },
                          { name: 'Expirés', value: funnel.expired },
                          { name: 'En attente', value: funnel.sent },
                        ].filter((d) => d.value > 0)}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {['#22c55e', '#ef4444', '#f59e0b', '#3b82f6'].map((color, i) => (
                          <Cell key={i} fill={color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Amounts */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center">
                  <p className="text-sm text-slate-500 mb-1">Montant total devis</p>
                  <p className="text-2xl font-bold text-slate-800">{formatCurrency(funnel.total_amount)}</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center">
                  <p className="text-sm text-slate-500 mb-1">Montant accepté</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(funnel.accepted_amount)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Opérations Tab */}
          {activeTab === 'operations' && (
            <div className="space-y-6">
              {hoursData && hoursData.length > 0 ? (
                <>
                  {/* Summary KPIs */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-white border border-slate-200 rounded-2xl p-5 text-center">
                      <Clock className="w-5 h-5 text-slate-400 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-slate-900">
                        {hoursData.reduce((s, r) => s + r.estimated_hours, 0).toFixed(0)}h
                      </p>
                      <p className="text-xs text-slate-500 mt-1">Heures estimées totales</p>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-2xl p-5 text-center">
                      <Clock className="w-5 h-5 text-primary-400 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-slate-900">
                        {hoursData.reduce((s, r) => s + r.actual_hours, 0).toFixed(0)}h
                      </p>
                      <p className="text-xs text-slate-500 mt-1">Heures réelles totales</p>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-2xl p-5 text-center">
                      <p className="text-2xl font-bold text-slate-900">
                        {hoursData.reduce((s, r) => s + r.count, 0)}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">Interventions avec données</p>
                    </div>
                  </div>

                  {/* Bar chart: estimated vs actual */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-6">
                    <h3 className="text-sm font-semibold text-slate-800 mb-4">Heures estimées vs réelles par type d'intervention</h3>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={hoursData} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis type="number" tick={{ fontSize: 12 }} unit="h" />
                          <YAxis
                            type="category"
                            dataKey="intervention_type"
                            width={140}
                            tick={{ fontSize: 11 }}
                          />
                          <Tooltip formatter={(value) => `${value}h`} />
                          <Legend />
                          <Bar dataKey="estimated_hours" name="Estimé (h)" fill="#94a3b8" radius={[0, 4, 4, 0]} />
                          <Bar dataKey="actual_hours" name="Réel (h)" fill="#7AB928" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Table with efficiency */}
                  <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50">
                          <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Type d'intervention</th>
                          <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Nb</th>
                          <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Estimé</th>
                          <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Réel</th>
                          <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Écart</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {hoursData.map((row) => {
                          const diff = row.actual_hours - row.estimated_hours
                          const isOver = diff > 0
                          return (
                            <tr key={row.intervention_type} className="hover:bg-slate-50">
                              <td className="px-5 py-3 text-sm font-medium text-slate-800">{row.intervention_type}</td>
                              <td className="px-5 py-3 text-sm text-slate-600 text-right">{row.count}</td>
                              <td className="px-5 py-3 text-sm text-slate-600 text-right">{row.estimated_hours}h</td>
                              <td className="px-5 py-3 text-sm text-slate-600 text-right">{row.actual_hours}h</td>
                              <td className={`px-5 py-3 text-sm font-medium text-right ${isOver ? 'text-red-600' : 'text-emerald-600'}`}>
                                {isOver ? '+' : ''}{diff.toFixed(1)}h
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
                  <Clock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm text-slate-500">Aucune donnée opérationnelle pour {year}</p>
                  <p className="text-xs text-slate-400 mt-1">Les heures estimées et réelles doivent être renseignées sur les chantiers</p>
                </div>
              )}
            </div>
          )}

          {/* Par Commercial Tab */}
          {activeTab === 'commerciaux' && (
            <div className="space-y-6">
              {byCommercial && byCommercial.length > 0 ? (
                <>
                  {/* Bar chart */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-6">
                    <h3 className="text-sm font-semibold text-slate-800 mb-4">CA par commercial</h3>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={byCommercial} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis type="number" tickFormatter={formatK} tick={{ fontSize: 12 }} />
                          <YAxis
                            type="category"
                            dataKey={(d) => `${d.first_name} ${d.last_name}`}
                            width={120}
                            tick={{ fontSize: 12 }}
                          />
                          <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0))} />
                          <Bar dataKey="total_ttc" name="CA TTC" radius={[0, 4, 4, 0]}>
                            {byCommercial.map((_, i) => (
                              <Cell key={i} fill={COLORS[i % COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Table */}
                  <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50">
                          <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Commercial</th>
                          <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Factures</th>
                          <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase">CA HT</th>
                          <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase">CA TTC</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {byCommercial.map((c) => (
                          <tr key={c.commercial_id} className="hover:bg-slate-50">
                            <td className="px-5 py-3 text-sm font-medium text-slate-800">
                              {c.first_name} {c.last_name}
                            </td>
                            <td className="px-5 py-3 text-sm text-slate-600 text-right">{c.invoice_count}</td>
                            <td className="px-5 py-3 text-sm text-slate-600 text-right">{formatCurrency(c.total_ht)}</td>
                            <td className="px-5 py-3 text-sm font-medium text-slate-800 text-right">{formatCurrency(c.total_ttc)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
                  <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm text-slate-500">Aucune donnée commerciale pour {year}</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function KpiCard({
  label,
  value,
  icon: Icon,
  trend,
  sub,
}: {
  label: string
  value: string
  icon: typeof Receipt
  trend?: number
  sub?: string
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</span>
        <Icon className="w-5 h-5 text-slate-400" />
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <div className="flex items-center gap-2 mt-1">
        {trend !== undefined && trend !== 0 && (
          <span
            className={`flex items-center gap-0.5 text-xs font-medium ${
              trend > 0 ? 'text-green-600' : 'text-red-500'
            }`}
          >
            {trend > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            {trend > 0 ? '+' : ''}{trend.toFixed(1)}%
          </span>
        )}
        {sub && <span className="text-xs text-slate-400">{sub}</span>}
      </div>
    </div>
  )
}

function FunnelStep({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center">
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-slate-500 mt-1">{label}</p>
    </div>
  )
}
