import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
  addParticipants,
  updateParticipantStatus,
  removeParticipant,
  type EventFilters,
} from '../services/event.service'
import type { CrmEvent, ParticipantStatus } from '../types'

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------
export const eventKeys = {
  all: ['events'] as const,
  list: (filters: EventFilters) => [...eventKeys.all, 'list', filters] as const,
  detail: (id: string) => [...eventKeys.all, 'detail', id] as const,
}

// ---------------------------------------------------------------------------
// useEvents
// ---------------------------------------------------------------------------
export function useEvents(filters: EventFilters = {}) {
  return useQuery({
    queryKey: eventKeys.list(filters),
    queryFn: () => getEvents(filters),
    staleTime: 30 * 1000,
  })
}

// ---------------------------------------------------------------------------
// useEvent
// ---------------------------------------------------------------------------
export function useEvent(id: string | undefined) {
  return useQuery({
    queryKey: eventKeys.detail(id!),
    queryFn: () => getEvent(id!),
    enabled: !!id,
    staleTime: 60 * 1000,
  })
}

// ---------------------------------------------------------------------------
// useCreateEvent
// ---------------------------------------------------------------------------
export function useCreateEvent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Omit<CrmEvent, 'id' | 'created_at' | 'updated_at'>) => createEvent(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: eventKeys.all })
    },
  })
}

// ---------------------------------------------------------------------------
// useUpdateEvent
// ---------------------------------------------------------------------------
export function useUpdateEvent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Omit<CrmEvent, 'id' | 'created_at' | 'updated_at'>> }) =>
      updateEvent(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: eventKeys.detail(variables.id) })
      queryClient.invalidateQueries({ queryKey: eventKeys.all })
    },
  })
}

// ---------------------------------------------------------------------------
// useDeleteEvent
// ---------------------------------------------------------------------------
export function useDeleteEvent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteEvent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: eventKeys.all })
    },
  })
}

// ---------------------------------------------------------------------------
// useAddParticipants
// ---------------------------------------------------------------------------
export function useAddParticipants() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ eventId, clientIds }: { eventId: string; clientIds: string[] }) =>
      addParticipants(eventId, clientIds),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: eventKeys.detail(variables.eventId) })
    },
  })
}

// ---------------------------------------------------------------------------
// useUpdateParticipantStatus
// ---------------------------------------------------------------------------
export function useUpdateParticipantStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ participantId, status }: { participantId: string; status: ParticipantStatus }) =>
      updateParticipantStatus(participantId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: eventKeys.all })
    },
  })
}

// ---------------------------------------------------------------------------
// useRemoveParticipant
// ---------------------------------------------------------------------------
export function useRemoveParticipant() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (participantId: string) => removeParticipant(participantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: eventKeys.all })
    },
  })
}
