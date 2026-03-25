import { useState, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '../../utils/cn'
import type { LucideIcon } from 'lucide-react'

interface CollapseProps {
  title: string
  icon?: LucideIcon
  defaultOpen?: boolean
  badge?: string
  children: ReactNode
}

export function Collapse({ title, icon: Icon, defaultOpen = true, badge, children }: CollapseProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors"
      >
        <ChevronRight
          className={cn(
            'w-4 h-4 text-slate-400 transition-transform duration-200',
            open && 'rotate-90',
          )}
        />
        {Icon && <Icon className="w-4.5 h-4.5 text-slate-500" />}
        <span className="text-sm font-semibold text-slate-700">{title}</span>
        {badge && (
          <span className="ml-auto text-xs font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
            {badge}
          </span>
        )}
      </button>

      <div
        className={cn(
          'transition-all duration-200 ease-in-out overflow-hidden',
          open ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0',
        )}
      >
        <div className="px-4 pb-4 pt-1 border-t border-slate-100">
          {children}
        </div>
      </div>
    </div>
  )
}
