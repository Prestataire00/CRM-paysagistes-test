import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '../../utils/cn'

interface PhoneInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  label?: string
  error?: string
  helperText?: string
  onRemove?: () => void
  onChange?: (value: string) => void
}

function formatPhoneDisplay(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length <= 2) return digits
  const parts: string[] = []
  for (let i = 0; i < digits.length && i < 10; i += 2) {
    parts.push(digits.slice(i, i + 2))
  }
  return parts.join(' ')
}

function stripPhoneFormat(value: string): string {
  return value.replace(/\s/g, '')
}

export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ label, error, helperText, onRemove, onChange, className, id, value, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)
    const displayValue = typeof value === 'string' ? formatPhoneDisplay(value) : value

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-slate-700 mb-1.5"
          >
            {label}
          </label>
        )}
        <div className="flex gap-2">
          <input
            ref={ref}
            id={inputId}
            type="tel"
            value={displayValue}
            onChange={(e) => {
              const raw = stripPhoneFormat(e.target.value)
              onChange?.(raw)
            }}
            placeholder="06 12 34 56 78"
            className={cn(
              'block w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900',
              'placeholder:text-slate-400',
              'transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-offset-0',
              error
                ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
                : 'border-slate-300 focus:border-green-500 focus:ring-green-500/20',
              'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500',
              className,
            )}
            aria-invalid={error ? 'true' : undefined}
            {...props}
          />
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="shrink-0 px-2.5 py-2 text-sm text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
            >
              Retirer
            </button>
          )}
        </div>
        {error && (
          <p className="mt-1.5 text-xs text-red-600">{error}</p>
        )}
        {!error && helperText && (
          <p className="mt-1.5 text-xs text-slate-500">{helperText}</p>
        )}
      </div>
    )
  },
)

PhoneInput.displayName = 'PhoneInput'
