import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import {
  addSyncItem,
  getPendingItems,
  updateSyncItemStatus,
  removeSyncItem,
  getPendingCount,
  type SyncItem,
} from '../lib/sync-db'

interface SyncContextType {
  isOnline: boolean
  pendingCount: number
  isSyncing: boolean
  addToQueue: (params: {
    type: string
    table: string
    operation: 'insert' | 'update' | 'delete'
    payload: Record<string, unknown>
  }) => Promise<void>
  syncNow: () => Promise<void>
}

const SyncContext = createContext<SyncContextType | null>(null)

async function processSyncItem(item: SyncItem): Promise<void> {
  const { table, operation, payload } = item

  switch (operation) {
    case 'insert': {
      const { error } = await supabase.from(table).insert(payload)
      if (error) throw new Error(error.message)
      break
    }
    case 'update': {
      const { id, ...rest } = payload
      const { error } = await supabase.from(table).update(rest).eq('id', id as string)
      if (error) throw new Error(error.message)
      break
    }
    case 'delete': {
      const { error } = await supabase.from(table).delete().eq('id', payload.id as string)
      if (error) throw new Error(error.message)
      break
    }
  }
}

export function SyncProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [pendingCount, setPendingCount] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)

  const isSyncingRef = useRef(false)
  const isOnlineRef = useRef(isOnline)
  isOnlineRef.current = isOnline

  // Track online/offline status
  useEffect(() => {
    const onOnline = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  // Load pending count from IndexedDB on mount
  useEffect(() => {
    getPendingCount().then(setPendingCount).catch(() => {})
  }, [])

  const refreshPendingCount = useCallback(async () => {
    const count = await getPendingCount()
    setPendingCount(count)
  }, [])

  const addToQueue = useCallback(async (params: {
    type: string
    table: string
    operation: 'insert' | 'update' | 'delete'
    payload: Record<string, unknown>
  }) => {
    await addSyncItem(params)
    await refreshPendingCount()
  }, [refreshPendingCount])

  const syncNow = useCallback(async () => {
    if (isSyncingRef.current || !isOnlineRef.current) return
    isSyncingRef.current = true
    setIsSyncing(true)

    try {
      const items = await getPendingItems()

      for (const item of items) {
        await updateSyncItemStatus(item.id, 'syncing')
        try {
          await processSyncItem(item)
          await removeSyncItem(item.id)
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error'
          await updateSyncItemStatus(item.id, 'error', message)
        }
      }
    } finally {
      isSyncingRef.current = false
      setIsSyncing(false)
      await refreshPendingCount()
    }
  }, [refreshPendingCount])

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && pendingCount > 0) {
      syncNow()
    }
  }, [isOnline, pendingCount, syncNow])

  const value = useMemo(() => ({
    isOnline, pendingCount, isSyncing, addToQueue, syncNow,
  }), [isOnline, pendingCount, isSyncing, addToQueue, syncNow])

  return (
    <SyncContext.Provider value={value}>
      {children}
    </SyncContext.Provider>
  )
}

export function useSync() {
  const ctx = useContext(SyncContext)
  if (!ctx) throw new Error('useSync must be used within SyncProvider')
  return ctx
}
