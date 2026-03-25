import { useEffect, useCallback, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '../../utils/cn'

type ModalSize = 'sm' | 'md' | 'lg' | 'xl'

interface ModalProps {
  open: boolean
  onClose: () => void
  size?: ModalSize
  children: ReactNode
  className?: string
  closeOnOverlay?: boolean
  closeOnEscape?: boolean
  'aria-labelledby'?: string
}

interface ModalHeaderProps {
  title: string
  description?: string
  onClose?: () => void
  children?: ReactNode
}

interface ModalFooterProps {
  children: ReactNode
  className?: string
}

const sizeStyles: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
}

export function Modal({
  open,
  onClose,
  size = 'md',
  children,
  className,
  closeOnOverlay = true,
  closeOnEscape = true,
  'aria-labelledby': ariaLabelledBy,
}: ModalProps) {
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeOnEscape) {
        onClose()
      }
    },
    [onClose, closeOnEscape]
  )

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [open, handleEscape])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-200 animate-in fade-in"
        onClick={closeOnOverlay ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={ariaLabelledBy}
        className={cn(
          'relative z-10 w-full bg-white rounded-2xl shadow-2xl',
          'transition-all duration-200',
          'animate-in fade-in zoom-in-95',
          'max-h-[90vh] overflow-y-auto',
          sizeStyles[size],
          className
        )}
      >
        {children}
      </div>
    </div>
  )
}

export function ModalHeader({ title, description, onClose, children }: ModalHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {description && (
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {children}
        {onClose && (
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  )
}

export function ModalFooter({ children, className }: ModalFooterProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl',
        className
      )}
    >
      {children}
    </div>
  )
}
