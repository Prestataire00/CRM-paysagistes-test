import { cn } from '../../utils/cn'
import { brand } from '../../config/brand'

type LogoSize = 'sm' | 'md' | 'lg'

interface LogoProps {
  size?: LogoSize
  showText?: boolean
  className?: string
}

const iconSizes: Record<LogoSize, number> = {
  sm: 32,
  md: 48,
  lg: 64,
}

export function Logo({ size = 'md', showText = false, className }: LogoProps) {
  const iconSize = iconSizes[size]

  return (
    <div className={cn('flex items-center', className)}>
      <img
        src={brand.logoPath}
        alt={brand.logoAlt}
        width={iconSize}
        height={iconSize}
        className="shrink-0 rounded-lg object-contain"
        style={{ width: iconSize, height: iconSize }}
      />
      {showText && (
        <div className={cn('flex flex-col', size === 'lg' ? 'ml-3.5' : 'ml-2.5')}>
          <span
            className={cn(
              'font-bold leading-tight text-slate-800 tracking-wide',
              size === 'lg' ? 'text-lg' : size === 'md' ? 'text-sm' : 'text-xs'
            )}
          >
            {brand.name.split(' ')[0]}
          </span>
          <span
            className={cn(
              'font-bold leading-tight text-slate-800 tracking-wide',
              size === 'lg' ? 'text-lg' : size === 'md' ? 'text-sm' : 'text-xs'
            )}
          >
            {brand.name.split(' ').slice(1).join(' ') || 'SERVICES'}
          </span>
          <span
            className={cn(
              'font-medium tracking-[0.2em] uppercase',
              size === 'lg' ? 'text-xs mt-0.5' : 'text-[9px]'
            )}
            style={{ color: brand.primaryColor }}
          >
            {brand.sector}
          </span>
        </div>
      )}
    </div>
  )
}
