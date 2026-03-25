import { cn } from '../../utils/cn'

interface UserAvatarProps {
  user: { first_name: string; last_name: string; avatar_url?: string | null }
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeStyles = {
  sm: 'w-7 h-7 text-[10px]',
  md: 'w-9 h-9 text-xs',
  lg: 'w-11 h-11 text-sm',
}

const COLORS = [
  'bg-blue-500',
  'bg-emerald-500',
  'bg-purple-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-cyan-500',
  'bg-indigo-500',
  'bg-teal-500',
]

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return Math.abs(hash)
}

export function UserAvatar({ user, size = 'md', className }: UserAvatarProps) {
  if (user.avatar_url) {
    return (
      <img
        src={user.avatar_url}
        alt={`${user.first_name} ${user.last_name}`}
        className={cn('rounded-full object-cover shrink-0', sizeStyles[size], className)}
      />
    )
  }

  const initials = `${user.first_name.charAt(0)}${user.last_name.charAt(0)}`.toUpperCase()
  const colorIndex = hashString(`${user.first_name}${user.last_name}`) % COLORS.length
  const bgColor = COLORS[colorIndex]

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-semibold text-white shrink-0',
        sizeStyles[size],
        bgColor,
        className,
      )}
    >
      {initials}
    </div>
  )
}
