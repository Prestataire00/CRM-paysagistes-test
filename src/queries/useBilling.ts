import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getInvoices,
  getInvoice,
  createInvoice,
  updateInvoiceStatus,
  recordInvoicePayment,
  getQuotes,
  getQuote,
  createQuote,
  updateQuote,
  updateQuoteStatus,
  deleteQuote,
  sendQuoteEmail,
  convertQuoteToInvoice,
  generateFiscalAttestation,
  getFiscalAttestations,
  getEligibleClientsForAttestation,
  getQuoteTemplates,
  getQuoteTemplate,
  createQuoteTemplate,
  updateQuoteTemplate,
  deleteQuoteTemplate,
  type InvoiceFilters,
  type QuoteFilters,
} from '../services/billing.service'
import type { Invoice, InvoiceLine, InvoiceStatus, Quote, QuoteLine, QuoteStatus, QuoteTemplate } from '../types'

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------
export const billingKeys = {
  all: ['billing'] as const,

  // Invoices
  invoices: () => [...billingKeys.all, 'invoices'] as const,
  invoiceList: (filters: InvoiceFilters) => [...billingKeys.invoices(), 'list', filters] as const,
  invoiceDetail: (id: string) => [...billingKeys.invoices(), 'detail', id] as const,

  // Quotes
  quotes: () => [...billingKeys.all, 'quotes'] as const,
  quoteList: (filters: QuoteFilters) => [...billingKeys.quotes(), 'list', filters] as const,
  quoteDetail: (id: string) => [...billingKeys.quotes(), 'detail', id] as const,

  // Quote templates
  templates: () => [...billingKeys.all, 'templates'] as const,
  templateDetail: (id: string) => [...billingKeys.all, 'templates', id] as const,

  // Fiscal attestations
  attestations: (year?: number) => [...billingKeys.all, 'attestations', year] as const,
  eligibleClients: (year: number) => [...billingKeys.all, 'eligible-clients', year] as const,
}

// ---------------------------------------------------------------------------
// useInvoices - Paginated invoice list
// ---------------------------------------------------------------------------
export function useInvoices(filters: InvoiceFilters = {}) {
  return useQuery({
    queryKey: billingKeys.invoiceList(filters),
    queryFn: () => getInvoices(filters),
    staleTime: 30 * 1000,
    placeholderData: (previousData) => previousData,
  })
}

// ---------------------------------------------------------------------------
// useInvoice - Single invoice with lines
// ---------------------------------------------------------------------------
export function useInvoice(id: string | undefined) {
  return useQuery({
    queryKey: billingKeys.invoiceDetail(id!),
    queryFn: () => getInvoice(id!),
    enabled: !!id,
    staleTime: 60 * 1000,
  })
}

// ---------------------------------------------------------------------------
// useCreateInvoice
// ---------------------------------------------------------------------------
export function useCreateInvoice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      invoice,
      lines,
    }: {
      invoice: Omit<Invoice, 'id' | 'reference' | 'created_at' | 'updated_at'>
      lines: Omit<InvoiceLine, 'id' | 'invoice_id' | 'created_at'>[]
    }) => createInvoice(invoice, lines),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billingKeys.invoices() })
      // Also invalidate dashboard stats since revenue may change
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

// ---------------------------------------------------------------------------
// useUpdateInvoiceStatus
// ---------------------------------------------------------------------------
export function useUpdateInvoiceStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: InvoiceStatus }) =>
      updateInvoiceStatus(id, status),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: billingKeys.invoiceDetail(variables.id) })
      queryClient.invalidateQueries({ queryKey: billingKeys.invoices() })
      // Invalidate dashboard if status changed to paid
      if (variables.status === 'payee') {
        queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      }
    },
  })
}

// ---------------------------------------------------------------------------
// useQuotes - Paginated quote list
// ---------------------------------------------------------------------------
export function useQuotes(filters: QuoteFilters = {}) {
  return useQuery({
    queryKey: billingKeys.quoteList(filters),
    queryFn: () => getQuotes(filters),
    staleTime: 30 * 1000,
    placeholderData: (previousData) => previousData,
  })
}

// ---------------------------------------------------------------------------
// useQuote - Single quote with lines
// ---------------------------------------------------------------------------
export function useQuote(id: string | undefined) {
  return useQuery({
    queryKey: billingKeys.quoteDetail(id!),
    queryFn: () => getQuote(id!),
    enabled: !!id,
    staleTime: 60 * 1000,
  })
}

// ---------------------------------------------------------------------------
// useCreateQuote
// ---------------------------------------------------------------------------
export function useCreateQuote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      quote,
      lines,
    }: {
      quote: Omit<Quote, 'id' | 'reference' | 'created_at' | 'updated_at'>
      lines: Omit<QuoteLine, 'id' | 'quote_id' | 'created_at'>[]
    }) => createQuote(quote, lines),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billingKeys.quotes() })
      // Also invalidate dashboard since pending quotes count may change
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

// ---------------------------------------------------------------------------
// useRecordInvoicePayment - Record a partial or full payment
// ---------------------------------------------------------------------------
export function useRecordInvoicePayment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      amount,
      method,
      reference,
      currentAmountPaid,
      totalTtc,
    }: {
      id: string
      amount: number
      method: string
      reference: string | null
      currentAmountPaid: number
      totalTtc: number
    }) => recordInvoicePayment(id, amount, method, reference, currentAmountPaid, totalTtc),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: billingKeys.invoiceDetail(variables.id) })
      queryClient.invalidateQueries({ queryKey: billingKeys.invoices() })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

// ---------------------------------------------------------------------------
// useUpdateQuote - Edit a quote (brouillon)
// ---------------------------------------------------------------------------
export function useUpdateQuote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      quote,
      lines,
    }: {
      id: string
      quote: Partial<Omit<Quote, 'id' | 'reference' | 'created_at' | 'updated_at'>>
      lines?: Omit<QuoteLine, 'id' | 'quote_id' | 'created_at'>[]
    }) => updateQuote(id, quote, lines),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: billingKeys.quoteDetail(variables.id) })
      queryClient.invalidateQueries({ queryKey: billingKeys.quotes() })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

// ---------------------------------------------------------------------------
// useUpdateQuoteStatus
// ---------------------------------------------------------------------------
export function useUpdateQuoteStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      status,
      additionalData,
    }: {
      id: string
      status: QuoteStatus
      additionalData?: Record<string, unknown>
    }) => updateQuoteStatus(id, status, additionalData),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: billingKeys.quoteDetail(variables.id) })
      queryClient.invalidateQueries({ queryKey: billingKeys.quotes() })
      queryClient.invalidateQueries({ queryKey: billingKeys.invoices() })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

// ---------------------------------------------------------------------------
// useDeleteQuote
// ---------------------------------------------------------------------------
export function useDeleteQuote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteQuote(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billingKeys.quotes() })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

// ---------------------------------------------------------------------------
// useSendQuoteEmail
// ---------------------------------------------------------------------------
export function useSendQuoteEmail() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (quoteId: string) => sendQuoteEmail(quoteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billingKeys.quotes() })
    },
  })
}

// ---------------------------------------------------------------------------
// useConvertQuoteToInvoice
// ---------------------------------------------------------------------------
export function useConvertQuoteToInvoice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (quoteId: string) => convertQuoteToInvoice(quoteId),
    onSuccess: (_data, quoteId) => {
      queryClient.invalidateQueries({ queryKey: billingKeys.quoteDetail(quoteId) })
      queryClient.invalidateQueries({ queryKey: billingKeys.quotes() })
      queryClient.invalidateQueries({ queryKey: billingKeys.invoices() })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

// ---------------------------------------------------------------------------
// useGenerateFiscalAttestation
// ---------------------------------------------------------------------------
export function useGenerateFiscalAttestation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ clientId, year }: { clientId: string; year: number }) =>
      generateFiscalAttestation(clientId, year),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: billingKeys.attestations(variables.year),
      })
      queryClient.invalidateQueries({
        queryKey: billingKeys.attestations(undefined),
      })
    },
  })
}

// ---------------------------------------------------------------------------
// useFiscalAttestations - List attestations, optionally by year
// ---------------------------------------------------------------------------
export function useFiscalAttestations(year?: number) {
  return useQuery({
    queryKey: billingKeys.attestations(year),
    queryFn: () => getFiscalAttestations(year),
    staleTime: 60 * 1000,
  })
}

// ---------------------------------------------------------------------------
// useEligibleClientsForAttestation - Clients with paid tax-credit invoices
// ---------------------------------------------------------------------------
export function useEligibleClientsForAttestation(year: number, enabled = true) {
  return useQuery({
    queryKey: billingKeys.eligibleClients(year),
    queryFn: () => getEligibleClientsForAttestation(year),
    enabled,
    staleTime: 60 * 1000,
  })
}

// ---------------------------------------------------------------------------
// useQuoteTemplates - List all active templates
// ---------------------------------------------------------------------------
export function useQuoteTemplates(includeInactive = false) {
  return useQuery({
    queryKey: billingKeys.templates(),
    queryFn: () => getQuoteTemplates(includeInactive),
    staleTime: 60 * 1000,
  })
}

// ---------------------------------------------------------------------------
// useQuoteTemplate - Single template by id
// ---------------------------------------------------------------------------
export function useQuoteTemplate(id: string | undefined) {
  return useQuery({
    queryKey: billingKeys.templateDetail(id!),
    queryFn: () => getQuoteTemplate(id!),
    enabled: !!id,
    staleTime: 60 * 1000,
  })
}

// ---------------------------------------------------------------------------
// useCreateQuoteTemplate
// ---------------------------------------------------------------------------
export function useCreateQuoteTemplate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: Omit<QuoteTemplate, 'id' | 'created_at' | 'updated_at'>) =>
      createQuoteTemplate(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billingKeys.templates() })
    },
  })
}

// ---------------------------------------------------------------------------
// useUpdateQuoteTemplate
// ---------------------------------------------------------------------------
export function useUpdateQuoteTemplate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string
      input: Partial<Omit<QuoteTemplate, 'id' | 'created_at' | 'updated_at'>>
    }) => updateQuoteTemplate(id, input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: billingKeys.templateDetail(variables.id) })
      queryClient.invalidateQueries({ queryKey: billingKeys.templates() })
    },
  })
}

// ---------------------------------------------------------------------------
// useDeleteQuoteTemplate
// ---------------------------------------------------------------------------
export function useDeleteQuoteTemplate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteQuoteTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billingKeys.templates() })
    },
  })
}
