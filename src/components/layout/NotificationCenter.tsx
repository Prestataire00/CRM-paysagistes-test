import { useState, useRef, useCallback, memo } from 'react'
import { useNavigate } from 'react-router'
import { Bell, Info, AlertTriangle, AlertCircle, CheckCircle, Clock, Check } from 'lucide-react'
import { useNotifications, useUnreadNotificationCount, useMarkNotificationAsRead, useMarkAllNotificationsAsRead } from '../../queries/useNotifications'
import { useClickOutside } from '../../hooks/useClickOutside'
import type { NotificationType } from '../../types'
import type { LucideIcon } from 'lucide-react'

const TYPE_CONFIG: Record<NotificationType, { icon: LucideIcon; color: string; bg: string }> = {
  info:     { icon: Info,          color: 'text-blue-500',   bg: 'bg-blue-50' },
  warning:  { icon: AlertTriangle, color: 'text-amber-500',  bg: 'bg-amber-50' },
  error:    { icon: AlertCircle,   color: 'text-red-500',    bg: 'bg-red-50' },
  success:  { icon: CheckCircle,   color: 'text-green-500',  bg: 'bg-green-50' },
  reminder: { icon: Clock,         color: 'text-purple-500', bg: 'bg-purple-50' },
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return "À l'instant"
  if (diffMin < 60) return `il y a ${diffMin}min`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `il y a ${diffH}h`
  const diffD = Math.floor(diffH / 24)
  if (diffD === 1) return 'Hier'
  return `il y a ${diffD}j`
}

export const NotificationCenter = memo(function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  // Only fetch full notification list when panel is open
  const { data: notifications = [] } = useNotifications(isOpen)
  const { data: unreadCount = 0 } = useUnreadNotificationCount()
  const markRead = useMarkNotificationAsRead()
  const markAllRead = useMarkAllNotificationsAsRead()

  useClickOutside(containerRef, () => setIsOpen(false))

  const handleNotificationClick = useCallback(
    (notif: typeof notifications[0]) => {
      if (!notif.is_read) {
        markRead.mutate(notif.id)
      }
      if (notif.action_url) {
        navigate(notif.action_url)
      }
      setIsOpen(false)
    },
    [markRead, navigate],
  )

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="relative p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center px-1 bg-red-500 text-white text-[10px] font-bold rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-[360px] bg-white rounded-lg shadow-xl border border-slate-200 z-50 flex flex-col max-h-[480px]">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
            <h3 className="text-sm font-semibold text-slate-800">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium"
              >
                <Check className="w-3.5 h-3.5" />
                Tout marquer lu
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400">Aucune notification</p>
              </div>
            ) : (
              notifications.map((notif) => {
                const config = TYPE_CONFIG[notif.notification_type] ?? TYPE_CONFIG.info
                const IconComp = config.icon
                return (
                  <button
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`flex items-start gap-3 w-full px-4 py-3 text-left transition-colors hover:bg-slate-50 border-b border-slate-50 ${
                      !notif.is_read ? 'bg-slate-50/50' : ''
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full ${config.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                      <IconComp className={`w-4 h-4 ${config.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm ${!notif.is_read ? 'font-semibold text-slate-800' : 'text-slate-600'} truncate`}>
                          {notif.title}
                        </span>
                        {!notif.is_read && (
                          <span className="w-2 h-2 rounded-full bg-primary-500 shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-slate-400 line-clamp-2 mt-0.5">{notif.message}</p>
                      <span className="text-[10px] text-slate-300 mt-1 block">{timeAgo(notif.created_at)}</span>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
})
