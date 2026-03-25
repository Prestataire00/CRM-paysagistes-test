import { cn } from '../../utils/cn'

interface Tab {
  key: string
  label: string
  count?: number
  disabled?: boolean
}

interface TabsProps {
  tabs: Tab[]
  activeTab: string
  onChange: (key: string) => void
  className?: string
}

export function Tabs({ tabs, activeTab, onChange, className }: TabsProps) {
  return (
    <div className={cn('', className)}>
      <nav className="flex gap-1 overflow-x-auto bg-slate-100 rounded-lg p-1" role="tablist">
        {tabs.map((tab) => {
          const isActive = tab.key === activeTab

          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={isActive}
              aria-disabled={tab.disabled}
              disabled={tab.disabled}
              onClick={() => onChange(tab.key)}
              className={cn(
                'inline-flex items-center gap-2 whitespace-nowrap px-4 py-2 rounded-md text-sm font-medium transition-all',
                isActive
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700',
                tab.disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className={cn(
                    'inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-medium',
                    isActive
                      ? 'bg-primary-100 text-primary-700'
                      : 'bg-slate-200 text-slate-600'
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
