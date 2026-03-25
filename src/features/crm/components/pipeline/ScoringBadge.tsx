import { cn } from '../../../../utils/cn'

interface ScoringBadgeProps {
  score: number
  size?: 'sm' | 'md'
}

export function ScoringBadge({ score, size = 'md' }: ScoringBadgeProps) {
  const variant =
    score >= 70
      ? 'bg-emerald-100 text-emerald-700'
      : score >= 40
        ? 'bg-amber-100 text-amber-700'
        : 'bg-red-100 text-red-700'

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full font-bold shrink-0',
        variant,
        size === 'sm' ? 'w-6 h-6 text-[10px]' : 'w-7 h-7 text-xs',
      )}
      title={`Score: ${score}/100`}
    >
      {score}
    </span>
  )
}
