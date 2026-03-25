import { AlertTriangle } from 'lucide-react'
import { Modal, ModalFooter } from './Modal'
import { Button } from '../ui/Button'
import { cn } from '../../utils/cn'

type ConfirmVariant = 'danger' | 'primary'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: ConfirmVariant
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

const variantConfig: Record<
  ConfirmVariant,
  { iconBg: string; iconColor: string; buttonVariant: 'danger' | 'primary' }
> = {
  danger: {
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
    buttonVariant: 'danger',
  },
  primary: {
    iconBg: 'bg-green-100',
    iconColor: 'text-green-600',
    buttonVariant: 'primary',
  },
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  variant = 'danger',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const config = variantConfig[variant]

  return (
    <Modal open={open} onClose={onCancel} size="sm">
      <div className="px-6 pt-6 pb-4">
        <div className="flex gap-4">
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
              config.iconBg
            )}
          >
            <AlertTriangle className={cn('w-5 h-5', config.iconColor)} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
            <p className="mt-1 text-sm text-slate-600">{message}</p>
          </div>
        </div>
      </div>
      <ModalFooter>
        <Button variant="secondary" onClick={onCancel} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button
          variant={config.buttonVariant}
          onClick={onConfirm}
          loading={loading}
        >
          {confirmLabel}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
