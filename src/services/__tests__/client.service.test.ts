import { describe, it, expect, vi, beforeEach } from 'vitest'
import { supabase } from '@/lib/supabase'
import {
  getClients,
  getClient,
  createClient,
  updateClient,
  deleteClient,
  checkDuplicateClient,
  importClients,
} from '../client.service'

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// Helper to build a chainable Supabase mock
// ---------------------------------------------------------------------------
function mockSupabaseQuery(resolvedValue: { data: unknown; error: unknown; count?: number }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  const handler = () => new Proxy({} as Record<string, unknown>, {
    get(_target, prop) {
      if (prop === 'then') {
        // Make the proxy thenable so `await` resolves it
        return (resolve: (v: unknown) => void) => resolve(resolvedValue)
      }
      if (!chain[prop as string]) {
        chain[prop as string] = vi.fn(() => handler())
      }
      return chain[prop as string]
    },
  })
  vi.mocked(supabase.from).mockReturnValue(handler() as never)
  return chain
}

describe('client.service', () => {
  describe('getClients', () => {
    it('should return paginated clients with defaults', async () => {
      const mockClients = [
        { id: '1', first_name: 'Jean', last_name: 'Dupont' },
        { id: '2', first_name: 'Marie', last_name: 'Martin' },
      ]
      mockSupabaseQuery({ data: mockClients, error: null, count: 2 })

      const result = await getClients()

      expect(supabase.from).toHaveBeenCalledWith('clients')
      expect(result.data).toEqual(mockClients)
      expect(result.count).toBe(2)
      expect(result.page).toBe(1)
      expect(result.pageSize).toBe(25)
      expect(result.totalPages).toBe(1)
    })

    it('should throw on Supabase error', async () => {
      mockSupabaseQuery({ data: null, error: { message: 'Database error' }, count: 0 })

      await expect(getClients()).rejects.toEqual({ message: 'Database error' })
    })

    it('should handle empty results', async () => {
      mockSupabaseQuery({ data: [], error: null, count: 0 })

      const result = await getClients()

      expect(result.data).toEqual([])
      expect(result.count).toBe(0)
      expect(result.totalPages).toBe(0)
    })

    it('should calculate totalPages correctly', async () => {
      mockSupabaseQuery({ data: Array(25).fill({}), error: null, count: 73 })

      const result = await getClients({ page: 1, pageSize: 25 })

      expect(result.totalPages).toBe(3) // ceil(73/25) = 3
    })
  })

  describe('getClient', () => {
    it('should return a single client by id', async () => {
      const mockClient = { id: '1', first_name: 'Jean', last_name: 'Dupont' }
      mockSupabaseQuery({ data: mockClient, error: null })

      const result = await getClient('1')

      expect(supabase.from).toHaveBeenCalledWith('clients')
      expect(result).toEqual(mockClient)
    })

    it('should throw on not found', async () => {
      mockSupabaseQuery({ data: null, error: { message: 'Row not found', code: 'PGRST116' } })

      await expect(getClient('999')).rejects.toEqual({ message: 'Row not found', code: 'PGRST116' })
    })
  })

  describe('createClient', () => {
    it('should create and return a new client', async () => {
      const newClient = { first_name: 'Pierre', last_name: 'Durand' }
      const createdClient = { id: '3', ...newClient }
      mockSupabaseQuery({ data: createdClient, error: null })

      const result = await createClient(newClient as never)

      expect(supabase.from).toHaveBeenCalledWith('clients')
      expect(result).toEqual(createdClient)
    })
  })

  describe('updateClient', () => {
    it('should update and return the client', async () => {
      const updated = { id: '1', first_name: 'Jean-Pierre', last_name: 'Dupont' }
      mockSupabaseQuery({ data: updated, error: null })

      const result = await updateClient('1', { first_name: 'Jean-Pierre' })

      expect(supabase.from).toHaveBeenCalledWith('clients')
      expect(result).toEqual(updated)
    })
  })

  describe('deleteClient', () => {
    it('should soft delete (set is_active = false)', async () => {
      const deleted = { id: '1', is_active: false }
      mockSupabaseQuery({ data: deleted, error: null })

      const result = await deleteClient('1')

      expect(supabase.from).toHaveBeenCalledWith('clients')
      expect(result.is_active).toBe(false)
    })
  })

  describe('checkDuplicateClient', () => {
    it('should return isDuplicate=true when matches found', async () => {
      const matches = [{ id: '1', first_name: 'Jean', last_name: 'Dupont', email: 'j@d.fr', company_name: null }]
      mockSupabaseQuery({ data: matches, error: null })

      const result = await checkDuplicateClient('Jean', 'Dupont')

      expect(result.isDuplicate).toBe(true)
      expect(result.matches).toHaveLength(1)
    })

    it('should return isDuplicate=false when no matches', async () => {
      mockSupabaseQuery({ data: [], error: null })

      const result = await checkDuplicateClient('Inexistant', 'Personne')

      expect(result.isDuplicate).toBe(false)
      expect(result.matches).toHaveLength(0)
    })
  })

  describe('importClients', () => {
    it('should import a batch of clients', async () => {
      const rows = [
        { first_name: 'A', last_name: 'B', address_line1: '1 rue', postal_code: '75001', city: 'Paris' },
      ]
      mockSupabaseQuery({ data: [{ id: '1' }], error: null })

      const result = await importClients(rows as never, 'user-1')

      expect(result.inserted).toBe(1)
      expect(result.errors).toHaveLength(0)
    })

    it('should collect errors for failed batches', async () => {
      const rows = Array(60).fill({
        first_name: 'A', last_name: 'B', address_line1: '1 rue', postal_code: '75001', city: 'Paris',
      })
      // First batch succeeds, second fails
      let callCount = 0
      vi.mocked(supabase.from).mockImplementation(() => {
        callCount++
        const shouldFail = callCount > 1
        const handler = (): Record<string, unknown> => new Proxy({} as Record<string, unknown>, {
          get(_target, prop) {
            if (prop === 'then') {
              return (resolve: (v: unknown) => void) => resolve(
                shouldFail
                  ? { data: null, error: { message: 'Batch failed' } }
                  : { data: Array(50).fill({ id: 'x' }), error: null },
              )
            }
            return vi.fn(() => handler())
          },
        })
        return handler() as never
      })

      const result = await importClients(rows as never, 'user-1')

      expect(result.inserted).toBe(50)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain('Lot 2')
    })
  })
})
