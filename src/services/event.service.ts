import { supabase } from '../lib/supabase'
import type { CrmEvent, EventParticipant, EventStatus, EventType, ParticipantStatus } from '../types'

// ---------------------------------------------------------------------------
// Filter types
// ---------------------------------------------------------------------------
export interface EventFilters {
  search?: string
  status?: EventStatus
  event_type?: EventType
  date_from?: string
  date_to?: string
}

// ---------------------------------------------------------------------------
// getEvents
// ---------------------------------------------------------------------------
export async function getEvents(filters: EventFilters = {}): Promise<CrmEvent[]> {
  let query = supabase
    .from('events')
    .select('*')
    .order('start_date', { ascending: false })

  if (filters.status) {
    query = query.eq('status', filters.status)
  }
  if (filters.event_type) {
    query = query.eq('event_type', filters.event_type)
  }
  if (filters.search) {
    query = query.or(`title.ilike.%${filters.search}%,location.ilike.%${filters.search}%`)
  }
  if (filters.date_from) {
    query = query.gte('start_date', filters.date_from)
  }
  if (filters.date_to) {
    query = query.lte('start_date', filters.date_to + 'T23:59:59')
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as CrmEvent[]
}

// ---------------------------------------------------------------------------
// getEvent — with participants + client info
// ---------------------------------------------------------------------------
export async function getEvent(id: string): Promise<CrmEvent & { participants: (EventParticipant & { client: { id: string; first_name: string; last_name: string; company_name: string | null; email: string | null } })[] }> {
  const { data, error } = await supabase
    .from('events')
    .select(`
      *,
      participants:event_participants(
        *,
        client:clients!client_id(id, first_name, last_name, company_name, email)
      )
    `)
    .eq('id', id)
    .single()

  if (error) throw error
  return data as CrmEvent & { participants: (EventParticipant & { client: { id: string; first_name: string; last_name: string; company_name: string | null; email: string | null } })[] }
}

// ---------------------------------------------------------------------------
// createEvent
// ---------------------------------------------------------------------------
export async function createEvent(data: Omit<CrmEvent, 'id' | 'created_at' | 'updated_at'>): Promise<CrmEvent> {
  const { data: event, error } = await supabase
    .from('events')
    .insert(data)
    .select()
    .single()

  if (error) throw error
  return event as CrmEvent
}

// ---------------------------------------------------------------------------
// updateEvent
// ---------------------------------------------------------------------------
export async function updateEvent(id: string, data: Partial<Omit<CrmEvent, 'id' | 'created_at' | 'updated_at'>>): Promise<CrmEvent> {
  const { data: event, error } = await supabase
    .from('events')
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return event as CrmEvent
}

// ---------------------------------------------------------------------------
// deleteEvent
// ---------------------------------------------------------------------------
export async function deleteEvent(id: string): Promise<void> {
  const { error } = await supabase.from('events').delete().eq('id', id)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// addParticipants — bulk insert
// ---------------------------------------------------------------------------
export async function addParticipants(eventId: string, clientIds: string[]): Promise<EventParticipant[]> {
  const rows = clientIds.map((clientId) => ({
    event_id: eventId,
    client_id: clientId,
    status: 'invite' as ParticipantStatus,
  }))

  const { data, error } = await supabase
    .from('event_participants')
    .upsert(rows, { onConflict: 'event_id,client_id' })
    .select()

  if (error) throw error
  return (data ?? []) as EventParticipant[]
}

// ---------------------------------------------------------------------------
// updateParticipantStatus
// ---------------------------------------------------------------------------
export async function updateParticipantStatus(
  participantId: string,
  status: ParticipantStatus,
): Promise<EventParticipant> {
  const updateData: Record<string, unknown> = { status }
  if (status !== 'invite') {
    updateData.responded_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('event_participants')
    .update(updateData)
    .eq('id', participantId)
    .select()
    .single()

  if (error) throw error
  return data as EventParticipant
}

// ---------------------------------------------------------------------------
// removeParticipant
// ---------------------------------------------------------------------------
export async function removeParticipant(participantId: string): Promise<void> {
  const { error } = await supabase
    .from('event_participants')
    .delete()
    .eq('id', participantId)

  if (error) throw error
}
