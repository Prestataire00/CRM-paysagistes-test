import { cn } from '../../utils/cn'

interface TabItem {
  id: string
  label: string
  count?: number
}

interface TabsProps {
  tabs: TabItem[]
  activeTab: string
  onChange: (tabId: string) => void
  className?: string
}

export function Tabs({ tabs, activeTab, onChange, className }: TabsProps) {
  return (
    <div className={cn('flex border-b border-slate-200', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            'relative px-4 py-2.5 text-sm font-medium transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500',
            activeTab === tab.id
              ? 'text-green-700'
              : 'text-slate-500 hover:text-slate-700',
          )}
        >
          <span className="flex items-center gap-1.5">
            {tab.label}
            {tab.count != null && tab.count > 0 && (
              <span
                className={cn(
                  'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold',
                  activeTab === tab.id
                    ? 'bg-green-100 text-green-700'
                    : 'bg-slate-100 text-slate-500',
                )}
              >
                {tab.count}
              </span>
            )}
          </span>
          {activeTab === tab.id && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-600 rounded-t" />
          )}
        </button>
      ))}
    </div>
  )
}
