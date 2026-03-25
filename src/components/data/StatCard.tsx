import { TrendingUp, TrendingDown, type LucideIcon } from 'lucide-react'
import { cn } from '../../utils/cn'

interface StatCardProps {
  icon: LucideIcon
  label: string
  value: string | number
  trend?: {
    direction: 'up' | 'down'
    percentage: number
  }
  className?: string
}

export function StatCard({ icon: Icon, label, value, trend, className }: StatCardProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm hover:shadow-md transition-shadow',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50">
          <Icon className="w-5 h-5 text-primary-600" />
        </div>
        {trend && (
          <div
            className={cn(
              'flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
              trend.direction === 'up'
                ? 'bg-green-50 text-green-700'
                : 'bg-red-50 text-red-700'
            )}
          >
            {trend.direction === 'up' ? (
              <TrendingUp className="w-3.5 h-3.5" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5" />
            )}
            <span>{trend.percentage}%</span>
          </div>
        )}
      </div>
      <div className="mt-4">
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        <p className="text-sm text-slate-500 mt-1">{label}</p>
      </div>
    </div>
  )
}
