import { createContext, useContext, useCallback, useState, type ReactNode } from 'react'
import { Toast, type ToastData, type ToastVariant } from './Toast'

const MAX_TOASTS = 5

interface ToastInput {
  variant?: ToastVariant
  title: string
  description?: string
}

interface ToastContextValue {
  addToast: (toast: ToastInput) => void
  success: (title: string, description?: string) => void
  error: (title: string, description?: string) => void
  warning: (title: string, description?: string) => void
  info: (title: string, description?: string) => void
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

let toastCounter = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addToast = useCallback((input: ToastInput) => {
    const id = `toast-${++toastCounter}-${Date.now()}`
    const newToast: ToastData = {
      id,
      variant: input.variant || 'info',
      title: input.title,
      description: input.description,
    }

    setToasts((prev) => {
      const updated = [...prev, newToast]
      if (updated.length > MAX_TOASTS) {
        return updated.slice(updated.length - MAX_TOASTS)
      }
      return updated
    })
  }, [])

  const success = useCallback(
    (title: string, description?: string) =>
      addToast({ variant: 'success', title, description }),
    [addToast]
  )

  const error = useCallback(
    (title: string, description?: string) =>
      addToast({ variant: 'error', title, description }),
    [addToast]
  )

  const warning = useCallback(
    (title: string, description?: string) =>
      addToast({ variant: 'warning', title, description }),
    [addToast]
  )

  const info = useCallback(
    (title: string, description?: string) =>
      addToast({ variant: 'info', title, description }),
    [addToast]
  )

  return (
    <ToastContext.Provider value={{ addToast, success, error, warning, info, dismiss }}>
      {children}

      {/* Toast container - top right */}
      <div
        aria-live="polite"
        aria-label="Notifications"
        className="pointer-events-none fixed top-4 right-4 z-[100] flex flex-col gap-3"
      >
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast doit etre utilise dans un ToastProvider')
  }
  return context
}
