-- ============================================================================
-- 018 — Add content_json to newsletter_campaigns
-- ============================================================================

ALTER TABLE public.newsletter_campaigns
  ADD COLUMN content_json JSONB;

COMMENT ON COLUMN public.newsletter_campaigns.content_json IS
  'Structured content JSON for the template-based editor. body_html is auto-generated from this.';
