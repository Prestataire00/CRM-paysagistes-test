-- ============================================================================
-- Migration 016: Create Supabase Storage bucket for document uploads
-- ============================================================================
-- NOTE: Run this migration in the Supabase SQL Editor (Dashboard > SQL Editor)
-- The storage schema is managed by Supabase and requires elevated permissions.
-- ============================================================================

-- 1. Create the private bucket for CRM documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  10485760, -- 10 MB
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- 2. Storage policies — authenticated users can upload and read
CREATE POLICY "documents_storage_insert"
  ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents');

CREATE POLICY "documents_storage_select"
  ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'documents');

CREATE POLICY "documents_storage_update"
  ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'documents');

CREATE POLICY "documents_storage_delete"
  ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'documents');
