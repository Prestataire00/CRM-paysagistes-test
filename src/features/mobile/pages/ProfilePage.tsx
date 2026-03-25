import { brand } from '../../../config/brand'
import { Mail, Phone, Calendar, Smartphone, LogOut, Loader2 } from 'lucide-react'
import { useAuth } from '../../../contexts/AuthContext'
import { useSync } from '../../../contexts/SyncContext'
import { ROLE_LABELS } from '../../../types'
import { useNavigate } from 'react-router'

export function ProfilePage() {
  const { user, isLoading, signOut } = useAuth()
  const { isOnline, pendingCount } = useSync()
  const navigate = useNavigate()

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
      </div>
    )
  }

  const initials = `${user.first_name.charAt(0)}${user.last_name.charAt(0)}`
  const roleLabel = ROLE_LABELS[user.role] ?? user.role

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  }

  return (
    <div className="px-4 py-4 space-y-4">
      {/* Profile header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xl font-bold mx-auto mb-3">
          {initials}
        </div>
        <h1 className="text-lg font-bold text-slate-900">
          {user.first_name} {user.last_name}
        </h1>
        <p className="text-sm text-slate-500">{roleLabel}</p>
      </div>

      {/* Contact info */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="divide-y divide-slate-100">
          <InfoRow icon={<Mail className="w-4 h-4" />} label="Email" value={user.email} />
          <InfoRow
            icon={<Phone className="w-4 h-4" />}
            label="Téléphone"
            value={user.phone || '—'}
            href={user.phone ? `tel:${user.phone}` : undefined}
          />
          <InfoRow
            icon={<Calendar className="w-4 h-4" />}
            label="Depuis"
            value={formatDate(user.hire_date)}
          />
        </div>
      </div>

      {/* App status */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="divide-y divide-slate-100">
          <InfoRow
            icon={<Smartphone className="w-4 h-4" />}
            label="Application"
            value={`CRM ${brand.name}`}
          />
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center flex-shrink-0">
              <span className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-500">Statut</p>
              <p className="text-sm text-slate-900">
                {isOnline ? 'En ligne' : 'Hors ligne'}
                {pendingCount > 0 && ` · ${pendingCount} en attente`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Sign out */}
      <button
        onClick={handleSignOut}
        className="w-full flex items-center justify-center gap-2 py-3 bg-red-50 text-red-600 rounded-xl border border-red-200 text-sm font-medium active:bg-red-100 transition-colors"
      >
        <LogOut className="w-4 h-4" />
        Se déconnecter
      </button>
    </div>
  )
}

function InfoRow({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode
  label: string
  value: string
  href?: string
}) {
  const content = (
    <>
      <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-sm text-slate-900 truncate">{value}</p>
      </div>
    </>
  )

  if (href) {
    return (
      <a href={href} className="flex items-center gap-3 px-4 py-3">
        {content}
      </a>
    )
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      {content}
    </div>
  )
}
