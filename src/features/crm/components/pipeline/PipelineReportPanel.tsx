import { useState, useMemo, lazy, Suspense } from 'react'
import {
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Users,
  Trophy,
  XCircle,
} from 'lucide-react'
import { useWeeklyCommercialReport } from '../../../../queries/useProspects'
import { Skeleton } from '../../../../components/ui/Skeleton'
import type { PipelineStats } from '../../../../types'

const FunnelChart = lazy(() => import('./FunnelChart').then(m => ({ default: m.FunnelChart })))

interface PipelineReportPanelProps {
  stats: PipelineStats
}

const eurFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

function getWeekRange(): { start: string; end: string } {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? 6 : day - 1 // Monday as start
  const monday = new Date(now)
  monday.setDate(now.getDate() - diff)
  monday.setHours(0, 0, 0, 0)

  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)

  return {
    start: monday.toISOString(),
    end: sunday.toISOString(),
  }
}

function formatDateShort(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(iso))
}

export function PipelineReportPanel({ stats }: PipelineReportPanelProps) {
  const [expanded, setExpanded] = useState(false)

  const { start, end } = useMemo(getWeekRange, [])
  const { data: report, isLoading } = useWeeklyCommercialReport(
    expanded ? start : '',
    expanded ? end : '',
  )

  const funnelData = useMemo(
    () => [
      { name: 'Nouveau', value: stats.activeCount },
      { name: 'Qualification', value: Math.round(stats.activeCount * 0.7) },
      { name: 'Proposition', value: Math.round(stats.activeCount * 0.4) },
      { name: 'Negociation', value: Math.round(stats.activeCount * 0.2) },
      { name: 'Gagne', value: Math.round(stats.activeCount * (stats.conversionRate / 100)) },
    ],
    [stats],
  )

  return (
    <div className="mt-4 bg-white rounded-xl border border-slate-200">
      {/* Toggle header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors rounded-xl"
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-slate-400" />
          Reporting commercial — Semaine du {formatDateShort(start)} au {formatDateShort(end)}
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {/* Collapsible content */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-slate-100">
          {isLoading ? (
            <div className="py-6 space-y-3">
              <Skeleton width="100%" height={20} />
              <Skeleton width="80%" height={20} />
              <Skeleton width="60%" height={20} />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
              {/* Commercial performance table */}
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                  Performance par commercial
                </h4>
                {!report || report.length === 0 ? (
                  <p className="text-sm text-slate-400 py-4">Aucune donnee pour cette semaine</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="text-left py-2 pr-3 text-xs font-medium text-slate-500">
                            <Users className="w-3.5 h-3.5 inline mr-1" />
                            Commercial
                          </th>
                          <th className="text-center py-2 px-2 text-xs font-medium text-slate-500">Nouveaux</th>
                          <th className="text-center py-2 px-2 text-xs font-medium text-slate-500">Activites</th>
                          <th className="text-center py-2 px-2 text-xs font-medium text-slate-500">
                            <Trophy className="w-3 h-3 inline mr-0.5" />
                            Gagnes
                          </th>
                          <th className="text-center py-2 px-2 text-xs font-medium text-slate-500">
                            <XCircle className="w-3 h-3 inline mr-0.5" />
                            Perdus
                          </th>
                          <th className="text-right py-2 pl-2 text-xs font-medium text-slate-500">Valeur gagnee</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.map((row) => (
                          <tr key={row.commercial_id} className="border-b border-slate-50 hover:bg-slate-50/50">
                            <td className="py-2 pr-3 font-medium text-slate-800 whitespace-nowrap">
                              {row.commercial_name}
                            </td>
                            <td className="py-2 px-2 text-center text-slate-600">{row.new_prospects}</td>
                            <td className="py-2 px-2 text-center text-slate-600">{row.activities_completed}</td>
                            <td className="py-2 px-2 text-center">
                              <span className="text-emerald-600 font-semibold">{row.prospects_won}</span>
                            </td>
                            <td className="py-2 px-2 text-center">
                              <span className="text-red-500">{row.prospects_lost}</span>
                            </td>
                            <td className="py-2 pl-2 text-right font-semibold text-slate-800">
                              {eurFormatter.format(row.total_won_value)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Funnel chart */}
              <Suspense fallback={<Skeleton width="100%" height={220} />}>
                <FunnelChart data={funnelData} />
              </Suspense>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
