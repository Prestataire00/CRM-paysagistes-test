-- ============================================================================
-- 026 — Vues matérialisées pour le reporting / BI
-- ============================================================================

-- Vue : Chiffre d'affaires mensuel
CREATE OR REPLACE VIEW public.v_monthly_revenue AS
SELECT
  date_trunc('month', i.paid_date)::date AS month,
  COUNT(*)                                AS invoice_count,
  SUM(i.total_ttc)                        AS total_ttc,
  SUM(i.subtotal_ht)                      AS total_ht,
  SUM(i.tva_amount)                       AS total_tva,
  SUM(i.labor_amount_ht)                  AS total_labor_ht
FROM public.invoices i
WHERE i.status IN ('payee', 'partiellement_payee')
  AND i.paid_date IS NOT NULL
GROUP BY date_trunc('month', i.paid_date)
ORDER BY month;

-- Vue : CA par commercial (basé sur les devis convertis)
CREATE OR REPLACE VIEW public.v_revenue_by_commercial AS
SELECT
  p.id                AS commercial_id,
  p.first_name,
  p.last_name,
  COUNT(DISTINCT i.id) AS invoice_count,
  SUM(i.total_ttc)    AS total_ttc,
  SUM(i.subtotal_ht)  AS total_ht
FROM public.invoices i
  JOIN public.quotes q ON q.converted_to_invoice_id = i.id
  JOIN public.profiles p ON p.id = q.assigned_commercial_id
WHERE i.status IN ('payee', 'partiellement_payee')
GROUP BY p.id, p.first_name, p.last_name;

-- Vue : Entonnoir de conversion des devis
CREATE OR REPLACE VIEW public.v_quote_conversion AS
SELECT
  COUNT(*)                                        AS total_quotes,
  COUNT(*) FILTER (WHERE status = 'envoye')        AS sent,
  COUNT(*) FILTER (WHERE status = 'accepte')       AS accepted,
  COUNT(*) FILTER (WHERE status = 'refuse')        AS refused,
  COUNT(*) FILTER (WHERE status = 'expire')        AS expired,
  COUNT(*) FILTER (WHERE converted_to_invoice_id IS NOT NULL) AS converted,
  SUM(total_ttc)                                   AS total_amount,
  SUM(total_ttc) FILTER (WHERE status = 'accepte') AS accepted_amount
FROM public.quotes
WHERE status != 'brouillon';
