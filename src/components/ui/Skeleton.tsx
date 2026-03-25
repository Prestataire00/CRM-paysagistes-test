import { cn } from '../../utils/cn'

interface SkeletonProps {
  width?: string | number
  height?: string | number
  className?: string
  rounded?: 'sm' | 'md' | 'lg' | 'full'
}

const roundedStyles = {
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  full: 'rounded-full',
}

export function Skeleton({
  width,
  height,
  className,
  rounded = 'md',
}: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse bg-slate-200',
        roundedStyles[rounded],
        className
      )}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
      }}
      aria-hidden="true"
    />
  )
}
