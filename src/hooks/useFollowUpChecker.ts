import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { runFollowUpCheck } from '../services/followup-checker.service'
import { notificationKeys } from '../queries/useNotifications'

const CHECK_INTERVAL_MS = 30 * 60 * 1000 // 30 minutes
const INITIAL_DELAY_MS = 3_000 // 3 seconds after mount

const RELEVANT_ROLES = [
  'super_admin', 'admin', 'responsable_commercial',
  'commercial', 'comptabilite',
]

export function useFollowUpChecker() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const hasRun = useRef(false)

  useEffect(() => {
    if (!user || !RELEVANT_ROLES.includes(user.role)) return

    // Prevent double-run in StrictMode
    if (hasRun.current) return
    hasRun.current = true

    async function check() {
      try {
        const count = await runFollowUpCheck(user!.id, user!.role)
        if (count > 0) {
          queryClient.invalidateQueries({ queryKey: notificationKeys.all })
        }
      } catch (err) {
        console.error('[FollowUpChecker]', err)
      }
    }

    // Initial check after short delay (don't block first render)
    const timeout = setTimeout(check, INITIAL_DELAY_MS)
    // Periodic check every 30 minutes
    const interval = setInterval(check, CHECK_INTERVAL_MS)

    return () => {
      clearTimeout(timeout)
      clearInterval(interval)
    }
  }, [user, queryClient])
}
