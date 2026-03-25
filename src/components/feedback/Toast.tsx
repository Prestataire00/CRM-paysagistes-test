import { useEffect, useState } from 'react'
import { X, CheckCircle2, AlertCircle, AlertTriangle, Info } from 'lucide-react'
import { cn } from '../../utils/cn'

export type ToastVariant = 'success' | 'error' | 'warning' | 'info'

export interface ToastData {
  id: string
  variant: ToastVariant
  title: string
  description?: string
}

interface ToastProps {
  toast: ToastData
  onDismiss: (id: string) => void
}

const variantConfig: Record<
  ToastVariant,
  { icon: typeof CheckCircle2; containerClass: string; iconClass: string }
> = {
  success: {
    icon: CheckCircle2,
    containerClass: 'border-green-200 bg-green-50',
    iconClass: 'text-green-600',
  },
  error: {
    icon: AlertCircle,
    containerClass: 'border-red-200 bg-red-50',
    iconClass: 'text-red-600',
  },
  warning: {
    icon: AlertTriangle,
    containerClass: 'border-amber-200 bg-amber-50',
    iconClass: 'text-amber-600',
  },
  info: {
    icon: Info,
    containerClass: 'border-blue-200 bg-blue-50',
    iconClass: 'text-blue-600',
  },
}

export function Toast({ toast, onDismiss }: ToastProps) {
  const [isExiting, setIsExiting] = useState(false)
  const config = variantConfig[toast.variant]
  const Icon = config.icon

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true)
    }, 4700)

    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (isExiting) {
      const timer = setTimeout(() => {
        onDismiss(toast.id)
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [isExiting, onDismiss, toast.id])

  const handleDismiss = () => {
    setIsExiting(true)
  }

  return (
    <div
      role="alert"
      className={cn(
        'pointer-events-auto w-80 rounded-lg border p-4 shadow-lg',
        'transition-all duration-300',
        isExiting
          ? 'opacity-0 translate-x-4'
          : 'opacity-100 translate-x-0 animate-in slide-in-from-right fade-in',
        config.containerClass
      )}
    >
      <div className="flex items-start gap-3">
        <Icon className={cn('w-5 h-5 shrink-0 mt-0.5', config.iconClass)} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-900">{toast.title}</p>
          {toast.description && (
            <p className="mt-1 text-sm text-slate-600">{toast.description}</p>
          )}
        </div>
        <button
          onClick={handleDismiss}
          className="shrink-0 rounded-md p-1 text-slate-400 hover:text-slate-600 hover:bg-white/60 transition-colors"
          aria-label="Fermer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
