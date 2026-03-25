import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getCampaigns,
  getCampaign,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  getNewsletterRecipients,
  sendCampaign,
  type CampaignFilters,
} from '../services/newsletter.service'
import type { NewsletterCampaign } from '../types'

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------
export const newsletterKeys = {
  all: ['newsletters'] as const,
  list: (filters: CampaignFilters) => [...newsletterKeys.all, 'list', filters] as const,
  detail: (id: string) => [...newsletterKeys.all, 'detail', id] as const,
  recipients: (tagIds?: string[]) => [...newsletterKeys.all, 'recipients', tagIds] as const,
}

// ---------------------------------------------------------------------------
// useCampaigns
// ---------------------------------------------------------------------------
export function useCampaigns(filters: CampaignFilters = {}) {
  return useQuery({
    queryKey: newsletterKeys.list(filters),
    queryFn: () => getCampaigns(filters),
    staleTime: 30 * 1000,
  })
}

// ---------------------------------------------------------------------------
// useCampaign
// ---------------------------------------------------------------------------
export function useCampaign(id: string | undefined) {
  return useQuery({
    queryKey: newsletterKeys.detail(id!),
    queryFn: () => getCampaign(id!),
    enabled: !!id,
    staleTime: 60 * 1000,
  })
}

// ---------------------------------------------------------------------------
// useCreateCampaign
// ---------------------------------------------------------------------------
export function useCreateCampaign() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Omit<NewsletterCampaign, 'id' | 'created_at' | 'updated_at' | 'recipients_count' | 'sent_count'>) =>
      createCampaign(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: newsletterKeys.all })
    },
  })
}

// ---------------------------------------------------------------------------
// useUpdateCampaign
// ---------------------------------------------------------------------------
export function useUpdateCampaign() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Omit<NewsletterCampaign, 'id' | 'created_at' | 'updated_at'>> }) =>
      updateCampaign(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: newsletterKeys.detail(variables.id) })
      queryClient.invalidateQueries({ queryKey: newsletterKeys.all })
    },
  })
}

// ---------------------------------------------------------------------------
// useDeleteCampaign
// ---------------------------------------------------------------------------
export function useDeleteCampaign() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteCampaign(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: newsletterKeys.all })
    },
  })
}

// ---------------------------------------------------------------------------
// useNewsletterRecipients
// ---------------------------------------------------------------------------
export function useNewsletterRecipients(tagIds?: string[]) {
  return useQuery({
    queryKey: newsletterKeys.recipients(tagIds),
    queryFn: () => getNewsletterRecipients(tagIds),
    staleTime: 60 * 1000,
  })
}

// ---------------------------------------------------------------------------
// useSendCampaign
// ---------------------------------------------------------------------------
export function useSendCampaign() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, recipientCount }: { id: string; recipientCount: number }) =>
      sendCampaign(id, recipientCount),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: newsletterKeys.detail(variables.id) })
      queryClient.invalidateQueries({ queryKey: newsletterKeys.all })
    },
  })
}
