import { useState, useRef } from 'react'
import { ChevronDown, Building } from 'lucide-react'
import { useEntity } from '../../contexts/EntityContext'
import { useClickOutside } from '../../hooks/useClickOutside'

export function EntitySelector() {
  const { entities, currentEntity, setCurrentEntity } = useEntity()
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useClickOutside(containerRef, () => setIsOpen(false))

  return (
    <div ref={containerRef} className="relative hidden lg:block">
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
      >
        <Building className="w-4 h-4 text-slate-400" />
        <span>{currentEntity.shortLabel}</span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1 bg-white rounded-lg shadow-xl border border-slate-200 z-50 py-1 min-w-[200px]">
          {entities.map((entity) => (
            <button
              key={entity.id}
              onClick={() => {
                setCurrentEntity(entity)
                setIsOpen(false)
              }}
              className={`flex items-center gap-2.5 w-full px-3 py-2.5 text-sm transition-colors ${
                entity.id === currentEntity.id
                  ? 'bg-primary-50 text-primary-700 font-medium'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Building className="w-4 h-4 text-slate-400" />
              <div>
                <div className="font-medium">{entity.shortLabel}</div>
                <div className="text-xs text-slate-400">{entity.label}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
