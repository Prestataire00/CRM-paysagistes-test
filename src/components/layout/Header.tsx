import { memo } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { ROLE_LABELS } from '../../types'
import { MobileMenuButton } from './Sidebar'
import { GlobalSearch } from './GlobalSearch'
import { NotificationCenter } from './NotificationCenter'
import { EntitySelector } from './EntitySelector'

interface HeaderProps {
  onMobileMenuOpen: () => void
}

export const Header = memo(function Header({ onMobileMenuOpen }: HeaderProps) {
  const { user } = useAuth()

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/80 backdrop-blur-md border-b border-slate-100 flex items-center gap-4 px-4 lg:px-8">
      {/* Left: mobile menu + entity selector */}
      <div className="flex items-center gap-3 shrink-0">
        <MobileMenuButton onClick={onMobileMenuOpen} />
        <EntitySelector />
      </div>

      {/* Center: global search */}
      <div className="flex-1 max-w-2xl mx-auto">
        <GlobalSearch />
      </div>

      {/* Right: notifications + user */}
      <div className="flex items-center gap-3 shrink-0">
        <NotificationCenter />
        {user && (
          <div className="hidden sm:flex items-center gap-3 pl-4 border-l border-slate-100">
            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-xs font-semibold text-primary-700">
              {user.first_name?.[0] ?? '?'}{user.last_name?.[0] ?? ''}
            </div>
            <div className="hidden md:block">
              <div className="text-sm font-semibold text-slate-900">{user.first_name} {user.last_name}</div>
              <div className="text-[11px] text-slate-400">{ROLE_LABELS[user.role]}</div>
            </div>
          </div>
        )}
      </div>
    </header>
  )
})
