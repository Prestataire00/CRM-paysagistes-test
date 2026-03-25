-- ============================================================================
-- Migration 006: Create Billing Tables & Deferred FKs
-- CRM Demonfaucon - Supabase PostgreSQL
-- Tables: quotes, quote_lines, invoices, invoice_lines, fiscal_attestations
-- Also adds deferred FKs: chantiers.quote_id -> quotes, chantiers.invoice_id -> invoices
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Sequences for auto-references
-- ---------------------------------------------------------------------------
CREATE SEQUENCE public.quote_ref_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE public.invoice_ref_seq START WITH 1 INCREMENT BY 1;

-- ---------------------------------------------------------------------------
-- generate_quote_reference()
-- Produces references like DEV-2026-00001
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_quote_reference()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year TEXT;
  v_seq  BIGINT;
BEGIN
  v_year := to_char(now(), 'YYYY');
  v_seq  := nextval('public.quote_ref_seq');
  NEW.reference := 'DEV-' || v_year || '-' || lpad(v_seq::TEXT, 5, '0');
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- generate_invoice_reference()
-- Produces references like FAC-2026-00001
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_invoice_reference()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year TEXT;
  v_seq  BIGINT;
BEGIN
  v_year := to_char(now(), 'YYYY');
  v_seq  := nextval('public.invoice_ref_seq');
  NEW.reference := 'FAC-' || v_year || '-' || lpad(v_seq::TEXT, 5, '0');
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- quotes (devis)
-- ---------------------------------------------------------------------------
CREATE TABLE public.quotes (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference               TEXT NOT NULL UNIQUE,
  client_id               UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  prospect_id             UUID REFERENCES public.prospects(id) ON DELETE SET NULL,
  title                   TEXT NOT NULL,
  description             TEXT,
  status                  public.quote_status NOT NULL DEFAULT 'brouillon',
  issue_date              DATE NOT NULL DEFAULT CURRENT_DATE,
  validity_date           DATE,
  accepted_date           DATE,
  subtotal_ht             NUMERIC(12,2) NOT NULL DEFAULT 0,
  tva_rate                NUMERIC(5,2) NOT NULL DEFAULT 20.00,
  tva_amount              NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_ttc               NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_percentage     NUMERIC(5,2) NOT NULL DEFAULT 0,
  discount_amount         NUMERIC(12,2) NOT NULL DEFAULT 0,
  eligible_tax_credit     BOOLEAN NOT NULL DEFAULT FALSE,
  tax_credit_amount       NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_after_credit        NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_terms           TEXT,
  special_conditions      TEXT,
  pdf_url                 TEXT,
  created_by              UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_commercial_id  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  converted_to_invoice_id UUID,              -- FK added below after invoices table
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_quotes_amounts CHECK (subtotal_ht >= 0 AND total_ttc >= 0),
  CONSTRAINT chk_quotes_tva CHECK (tva_rate >= 0 AND tva_rate <= 100),
  CONSTRAINT chk_quotes_discount CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  CONSTRAINT chk_quotes_validity CHECK (validity_date IS NULL OR validity_date >= issue_date),
  CONSTRAINT chk_quotes_client_or_prospect CHECK (
    client_id IS NOT NULL OR prospect_id IS NOT NULL
  )
);

COMMENT ON TABLE public.quotes IS 'Commercial quotes (devis)';

CREATE TRIGGER trg_quotes_auto_reference
  BEFORE INSERT ON public.quotes
  FOR EACH ROW
  WHEN (NEW.reference IS NULL OR NEW.reference = '')
  EXECUTE FUNCTION public.generate_quote_reference();

CREATE TRIGGER trg_quotes_updated_at
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------------------------------------------------------------------------
-- quote_lines
-- ---------------------------------------------------------------------------
CREATE TABLE public.quote_lines (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id        UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  description     TEXT NOT NULL,
  quantity        NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit            TEXT NOT NULL DEFAULT 'u',
  unit_price_ht   NUMERIC(12,2) NOT NULL DEFAULT 0,
  tva_rate        NUMERIC(5,2) NOT NULL DEFAULT 20.00,
  total_ht        NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_ttc       NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_labor        BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_quote_lines_qty CHECK (quantity > 0),
  CONSTRAINT chk_quote_lines_price CHECK (unit_price_ht >= 0),
  CONSTRAINT chk_quote_lines_tva CHECK (tva_rate >= 0 AND tva_rate <= 100)
);

COMMENT ON TABLE public.quote_lines IS 'Individual line items within a quote';

-- ---------------------------------------------------------------------------
-- invoices (factures)
-- ---------------------------------------------------------------------------
CREATE TABLE public.invoices (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference               TEXT NOT NULL UNIQUE,
  client_id               UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  quote_id                UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
  chantier_id             UUID REFERENCES public.chantiers(id) ON DELETE SET NULL,
  title                   TEXT NOT NULL,
  description             TEXT,
  status                  public.invoice_status NOT NULL DEFAULT 'brouillon',
  issue_date              DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date                DATE NOT NULL,
  paid_date               DATE,
  subtotal_ht             NUMERIC(12,2) NOT NULL DEFAULT 0,
  tva_rate                NUMERIC(5,2) NOT NULL DEFAULT 20.00,
  tva_amount              NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_ttc               NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_percentage     NUMERIC(5,2) NOT NULL DEFAULT 0,
  discount_amount         NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount_paid             NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method          public.payment_method,
  payment_reference       TEXT,
  eligible_tax_credit     BOOLEAN NOT NULL DEFAULT FALSE,
  labor_amount_ht         NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_credit_amount       NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_after_credit        NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_archived             BOOLEAN NOT NULL DEFAULT FALSE,
  pdf_url                 TEXT,
  exported_at             TIMESTAMPTZ,
  accounting_reference    TEXT,
  created_by              UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_invoices_amounts CHECK (subtotal_ht >= 0 AND total_ttc >= 0),
  CONSTRAINT chk_invoices_tva CHECK (tva_rate >= 0 AND tva_rate <= 100),
  CONSTRAINT chk_invoices_discount CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  CONSTRAINT chk_invoices_paid CHECK (amount_paid >= 0),
  CONSTRAINT chk_invoices_due_date CHECK (due_date >= issue_date)
);

COMMENT ON TABLE public.invoices IS 'Client invoices (factures)';

CREATE TRIGGER trg_invoices_auto_reference
  BEFORE INSERT ON public.invoices
  FOR EACH ROW
  WHEN (NEW.reference IS NULL OR NEW.reference = '')
  EXECUTE FUNCTION public.generate_invoice_reference();

CREATE TRIGGER trg_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------------------------------------------------------------------------
-- invoice_lines
-- ---------------------------------------------------------------------------
CREATE TABLE public.invoice_lines (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description     TEXT NOT NULL,
  quantity        NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit            TEXT NOT NULL DEFAULT 'u',
  unit_price_ht   NUMERIC(12,2) NOT NULL DEFAULT 0,
  tva_rate        NUMERIC(5,2) NOT NULL DEFAULT 20.00,
  total_ht        NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_ttc       NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_labor        BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_invoice_lines_qty CHECK (quantity > 0),
  CONSTRAINT chk_invoice_lines_price CHECK (unit_price_ht >= 0),
  CONSTRAINT chk_invoice_lines_tva CHECK (tva_rate >= 0 AND tva_rate <= 100)
);

COMMENT ON TABLE public.invoice_lines IS 'Individual line items within an invoice';

-- ---------------------------------------------------------------------------
-- fiscal_attestations
-- Annual fiscal attestation for tax credit eligible clients (unique per client+year).
-- ---------------------------------------------------------------------------
CREATE TABLE public.fiscal_attestations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference           TEXT NOT NULL UNIQUE,
  client_id           UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  fiscal_year         INTEGER NOT NULL,
  total_amount_ttc    NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_labor_ht      NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_credit_amount   NUMERIC(12,2) NOT NULL DEFAULT 0,
  invoice_ids         UUID[] NOT NULL DEFAULT '{}',
  company_name        TEXT NOT NULL,
  company_siret       TEXT NOT NULL,
  company_address     TEXT NOT NULL,
  company_agrement    TEXT,
  is_sent             BOOLEAN NOT NULL DEFAULT FALSE,
  sent_at             TIMESTAMPTZ,
  sent_method         TEXT,
  pdf_url             TEXT,
  generated_by        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One attestation per client per fiscal year
  CONSTRAINT uq_fiscal_attestation_client_year UNIQUE (client_id, fiscal_year),
  CONSTRAINT chk_fiscal_attestation_year CHECK (fiscal_year >= 2000 AND fiscal_year <= 2100),
  CONSTRAINT chk_fiscal_attestation_amounts CHECK (
    total_amount_ttc >= 0 AND total_labor_ht >= 0 AND tax_credit_amount >= 0
  )
);

COMMENT ON TABLE public.fiscal_attestations IS 'Annual fiscal attestations for tax-credit-eligible clients';

CREATE TRIGGER trg_fiscal_attestations_updated_at
  BEFORE UPDATE ON public.fiscal_attestations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------------------------------------------------------------------------
-- Deferred Foreign Keys
-- Now that quotes and invoices exist, link them back to chantiers and quotes.
-- ---------------------------------------------------------------------------

-- chantiers.quote_id -> quotes
ALTER TABLE public.chantiers
  ADD CONSTRAINT fk_chantiers_quote
  FOREIGN KEY (quote_id) REFERENCES public.quotes(id) ON DELETE SET NULL;

-- chantiers.invoice_id -> invoices
ALTER TABLE public.chantiers
  ADD CONSTRAINT fk_chantiers_invoice
  FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL;

-- quotes.converted_to_invoice_id -> invoices
ALTER TABLE public.quotes
  ADD CONSTRAINT fk_quotes_converted_invoice
  FOREIGN KEY (converted_to_invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL;
