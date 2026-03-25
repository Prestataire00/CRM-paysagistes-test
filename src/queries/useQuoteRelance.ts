import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getRelancesForQuote,
  generateQuoteRelance,
  sendQuoteRelance,
  updateQuoteRelanceDraft,
  cancelQuoteRelance,
} from '../services/quote-relance.service'
import type { GenerateQuoteRelanceRequest, SendQuoteRelanceRequest } from '../types'
import { billingKeys } from './useBilling'

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------
export const quoteRelanceKeys = {
  all: ['quote-relances'] as const,
  forQuote: (quoteId: string) =>
    [...quoteRelanceKeys.all, 'quote', quoteId] as const,
}

// ---------------------------------------------------------------------------
// useRelancesForQuote - All relances for a specific quote
// ---------------------------------------------------------------------------
export function useRelancesForQuote(quoteId: string | undefined) {
  return useQuery({
    queryKey: quoteRelanceKeys.forQuote(quoteId!),
    queryFn: () => getRelancesForQuote(quoteId!),
    enabled: !!quoteId,
    staleTime: 30 * 1000,
  })
}

// ---------------------------------------------------------------------------
// useGenerateQuoteRelance - Trigger AI generation via Edge Function
// ---------------------------------------------------------------------------
export function useGenerateQuoteRelance() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: GenerateQuoteRelanceRequest) => generateQuoteRelance(request),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: quoteRelanceKeys.forQuote(variables.quote_id),
      })
    },
  })
}

// ---------------------------------------------------------------------------
// useSendQuoteRelance - Send the email via Brevo Edge Function
// ---------------------------------------------------------------------------
export function useSendQuoteRelance() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: SendQuoteRelanceRequest) => sendQuoteRelance(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quoteRelanceKeys.all })
      queryClient.invalidateQueries({ queryKey: billingKeys.quotes() })
    },
  })
}

// ---------------------------------------------------------------------------
// useUpdateQuoteRelanceDraft - Edit subject/body locally
// ---------------------------------------------------------------------------
export function useUpdateQuoteRelanceDraft() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string
      updates: { subject?: string; body_html?: string }
    }) => updateQuoteRelanceDraft(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: quoteRelanceKeys.forQuote(data.quote_id),
      })
    },
  })
}

// ---------------------------------------------------------------------------
// useCancelQuoteRelance - Mark a relance as cancelled
// ---------------------------------------------------------------------------
export function useCancelQuoteRelance() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => cancelQuoteRelance(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quoteRelanceKeys.all })
    },
  })
}
