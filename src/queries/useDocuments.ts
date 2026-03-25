import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getDocumentsForClient,
  getDocumentsForQuote,
  getDocumentsForInvoice,
  uploadDocument,
  deleteDocument,
  type UploadDocumentParams,
} from '../services/document.service'

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------
export const documentKeys = {
  all: ['documents'] as const,
  forClient: (clientId: string) => [...documentKeys.all, 'client', clientId] as const,
  forQuote: (quoteId: string) => [...documentKeys.all, 'quote', quoteId] as const,
  forInvoice: (invoiceId: string) => [...documentKeys.all, 'invoice', invoiceId] as const,
}

// ---------------------------------------------------------------------------
// useDocumentsForClient
// ---------------------------------------------------------------------------
export function useDocumentsForClient(clientId: string | undefined) {
  return useQuery({
    queryKey: documentKeys.forClient(clientId!),
    queryFn: () => getDocumentsForClient(clientId!),
    enabled: !!clientId,
    staleTime: 60 * 1000,
  })
}

// ---------------------------------------------------------------------------
// useDocumentsForQuote
// ---------------------------------------------------------------------------
export function useDocumentsForQuote(quoteId: string | undefined) {
  return useQuery({
    queryKey: documentKeys.forQuote(quoteId!),
    queryFn: () => getDocumentsForQuote(quoteId!),
    enabled: !!quoteId,
    staleTime: 60 * 1000,
  })
}

// ---------------------------------------------------------------------------
// useDocumentsForInvoice
// ---------------------------------------------------------------------------
export function useDocumentsForInvoice(invoiceId: string | undefined) {
  return useQuery({
    queryKey: documentKeys.forInvoice(invoiceId!),
    queryFn: () => getDocumentsForInvoice(invoiceId!),
    enabled: !!invoiceId,
    staleTime: 60 * 1000,
  })
}

// ---------------------------------------------------------------------------
// useUploadDocument
// ---------------------------------------------------------------------------
export function useUploadDocument() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: UploadDocumentParams) => uploadDocument(params),
    onSuccess: (_data, variables) => {
      if (variables.client_id) {
        queryClient.invalidateQueries({ queryKey: documentKeys.forClient(variables.client_id) })
      }
      if (variables.quote_id) {
        queryClient.invalidateQueries({ queryKey: documentKeys.forQuote(variables.quote_id) })
      }
      if (variables.invoice_id) {
        queryClient.invalidateQueries({ queryKey: documentKeys.forInvoice(variables.invoice_id) })
      }
    },
  })
}

// ---------------------------------------------------------------------------
// useDeleteDocument
// ---------------------------------------------------------------------------
export function useDeleteDocument() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteDocument(id),
    onSuccess: () => {
      // Invalidate all document queries
      queryClient.invalidateQueries({ queryKey: documentKeys.all })
    },
  })
}
