-- ============================================================================
-- Migration 021: Add electronic signature support for quotes
-- ============================================================================

-- Add signing columns to quotes table
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS signing_token UUID UNIQUE DEFAULT NULL;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS signature_url TEXT DEFAULT NULL;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS signer_ip TEXT DEFAULT NULL;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS signing_expires_at TIMESTAMPTZ DEFAULT NULL;

-- Index for fast token lookup
CREATE INDEX IF NOT EXISTS idx_quotes_signing_token
  ON quotes(signing_token)
  WHERE signing_token IS NOT NULL;
