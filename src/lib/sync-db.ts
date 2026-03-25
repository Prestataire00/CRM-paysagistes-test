import { brand } from '../config/brand'
import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

export interface SyncItem {
  id: string
  type: string
  table: string
  operation: 'insert' | 'update' | 'delete'
  payload: Record<string, unknown>
  created_at: string
  status: 'pending' | 'syncing' | 'error'
  retry_count: number
  last_error: string | null
}

interface SyncDB extends DBSchema {
  'sync-queue': {
    key: string
    value: SyncItem
    indexes: { 'by-status': string }
  }
}

const DB_NAME = `${brand.slug}-sync`
const DB_VERSION = 1

let dbInstance: IDBPDatabase<SyncDB> | null = null

export async function getSyncDB(): Promise<IDBPDatabase<SyncDB>> {
  if (dbInstance) return dbInstance

  dbInstance = await openDB<SyncDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      const store = db.createObjectStore('sync-queue', { keyPath: 'id' })
      store.createIndex('by-status', 'status')
    },
  })

  return dbInstance
}

export async function addSyncItem(item: Omit<SyncItem, 'id' | 'created_at' | 'status' | 'retry_count' | 'last_error'>): Promise<SyncItem> {
  const db = await getSyncDB()
  const syncItem: SyncItem = {
    ...item,
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    status: 'pending',
    retry_count: 0,
    last_error: null,
  }
  await db.put('sync-queue', syncItem)
  return syncItem
}

export async function getPendingItems(): Promise<SyncItem[]> {
  const db = await getSyncDB()
  const pending = await db.getAllFromIndex('sync-queue', 'by-status', 'pending')
  const errors = await db.getAllFromIndex('sync-queue', 'by-status', 'error')
  // Include errored items with fewer than 5 retries
  const retryable = errors.filter(i => i.retry_count < 5)
  return [...pending, ...retryable].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )
}

export async function updateSyncItemStatus(
  id: string,
  status: SyncItem['status'],
  error?: string,
): Promise<void> {
  const db = await getSyncDB()
  const item = await db.get('sync-queue', id)
  if (!item) return

  item.status = status
  if (status === 'error') {
    item.retry_count += 1
    item.last_error = error ?? null
  }
  await db.put('sync-queue', item)
}

export async function removeSyncItem(id: string): Promise<void> {
  const db = await getSyncDB()
  await db.delete('sync-queue', id)
}

export async function getPendingCount(): Promise<number> {
  const items = await getPendingItems()
  return items.length
}
