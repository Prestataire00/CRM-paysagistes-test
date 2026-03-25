import { supabase } from '../lib/supabase'
import type { Document as CrmDocument, DocumentType } from '../types'

const BUCKET = 'documents'

// ---------------------------------------------------------------------------
// Upload metadata
// ---------------------------------------------------------------------------
export interface UploadDocumentParams {
  file: File
  document_type: DocumentType
  client_id?: string
  quote_id?: string
  invoice_id?: string
  description?: string
}

// ---------------------------------------------------------------------------
// uploadDocument — Upload file to Storage + insert DB record
// ---------------------------------------------------------------------------
export async function uploadDocument(params: UploadDocumentParams): Promise<CrmDocument> {
  const { file, document_type, client_id, quote_id, invoice_id, description } = params

  // Build a unique storage path: documents/{context}/{uuid}-{filename}
  const context = client_id
    ? `clients/${client_id}`
    : quote_id
      ? `quotes/${quote_id}`
      : invoice_id
        ? `invoices/${invoice_id}`
        : 'general'
  const uniqueName = `${crypto.randomUUID()}-${file.name}`
  const storagePath = `${context}/${uniqueName}`

  // 1. Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) throw uploadError

  // 2. Get the current user id
  const { data: { user } } = await supabase.auth.getUser()

  // 3. Insert document record
  const { data, error } = await supabase
    .from('documents')
    .insert({
      client_id: client_id ?? null,
      quote_id: quote_id ?? null,
      invoice_id: invoice_id ?? null,
      document_type,
      name: file.name,
      description: description ?? null,
      file_url: storagePath,
      file_size: file.size,
      mime_type: file.type || null,
      uploaded_by: user?.id ?? null,
    })
    .select()
    .single()

  if (error) {
    // Rollback: delete uploaded file if DB insert fails
    await supabase.storage.from(BUCKET).remove([storagePath])
    throw error
  }

  return data as CrmDocument
}

// ---------------------------------------------------------------------------
// getDocumentsForClient
// ---------------------------------------------------------------------------
export async function getDocumentsForClient(clientId: string): Promise<CrmDocument[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('client_id', clientId)
    .eq('is_archived', false)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as CrmDocument[]
}

// ---------------------------------------------------------------------------
// getDocumentsForQuote
// ---------------------------------------------------------------------------
export async function getDocumentsForQuote(quoteId: string): Promise<CrmDocument[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('quote_id', quoteId)
    .eq('is_archived', false)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as CrmDocument[]
}

// ---------------------------------------------------------------------------
// getDocumentsForInvoice
// ---------------------------------------------------------------------------
export async function getDocumentsForInvoice(invoiceId: string): Promise<CrmDocument[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('invoice_id', invoiceId)
    .eq('is_archived', false)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as CrmDocument[]
}

// ---------------------------------------------------------------------------
// deleteDocument — Remove file from Storage + delete DB record
// ---------------------------------------------------------------------------
export async function deleteDocument(id: string): Promise<void> {
  // 1. Fetch the document to get the storage path
  const { data: doc, error: fetchError } = await supabase
    .from('documents')
    .select('file_url')
    .eq('id', id)
    .single()

  if (fetchError) throw fetchError

  // 2. Delete from Storage
  if (doc.file_url) {
    await supabase.storage.from(BUCKET).remove([doc.file_url])
  }

  // 3. Delete DB record
  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('id', id)

  if (error) throw error
}

// ---------------------------------------------------------------------------
// getSignedUrl — Create a temporary signed URL for download (1 hour)
// ---------------------------------------------------------------------------
export async function getSignedUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 3600) // 1 hour

  if (error) throw error
  return data.signedUrl
}
