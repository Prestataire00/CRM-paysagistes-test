-- ============================================================================
-- 023 — Index pour recherche rapide d'historique par enregistrement
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_audit_logs_record
  ON public.audit_logs (table_name, record_id, created_at DESC);
