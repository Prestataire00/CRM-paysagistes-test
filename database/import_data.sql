-- ==========================================================================
-- IMPORT DES DONNÉES DEPUIS LES ANCIENS CRM (Dreamflore + Oplead)
-- ==========================================================================
-- Ce script importe les données des 6 tables sources vers le schéma CRM.
-- À exécuter dans le SQL Editor de Supabase.
-- ==========================================================================

BEGIN;

-- ==========================================================================
-- NETTOYAGE : Supprimer les données d'imports précédents (si existants)
-- ==========================================================================
DELETE FROM public.quotes WHERE special_conditions LIKE '%Source Dreamflore%';
DELETE FROM public.suppliers WHERE notes LIKE '%Source Dreamflore%';
DELETE FROM public.prospects WHERE notes LIKE '%Source Dreamflore%' OR notes LIKE '%Source Oplead%';
DELETE FROM public.clients WHERE notes LIKE '%Source Dreamflore%' OR notes LIKE '%Source Oplead%';

-- ==========================================================================
-- PARTIE 1 : Import des clients depuis "Lead contact dreamflore"
-- 4868 contacts → table clients
-- ==========================================================================

-- 1A: Clients Dreamflore marqués CLIENT ou sans type (avec Nom non vide)
INSERT INTO public.clients (
  first_name,
  last_name,
  company_name,
  client_type,
  address_line1,
  postal_code,
  city,
  country,
  phone,
  email,
  contract_type,
  eligible_tax_credit,
  tax_credit_percentage,
  payment_terms_days,
  is_active,
  notes
)
SELECT
  -- Prénom : utiliser le champ si disponible, sinon 'N/A'
  COALESCE(NULLIF(TRIM(d."Prénom"), ''), 'N/A') AS first_name,

  -- Nom : nettoyer les civilités (Madame, M et Mme, Mme, M., etc.)
  TRIM(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        REGEXP_REPLACE(
          REGEXP_REPLACE(
            TRIM(COALESCE(d."Nom", 'Inconnu')),
            '^M\s*et\s*Mme\s+', '', 'i'
          ),
          '^Madame\s+', '', 'i'
        ),
        '^Monsieur\s+', '', 'i'
      ),
      '^Mme\s+M?\s*', '', 'i'
    )
  ) AS last_name,

  -- company_name : si le Code client ressemble à un nom de société (tout en majuscules, contient espace)
  CASE
    WHEN d."Prénom" IS NULL
      AND d."Nom" IS NOT NULL
      AND UPPER(d."Nom") = d."Nom"
      AND d."Nom" ~ '[A-Z]{2,}\s+[A-Z]'
    THEN TRIM(d."Nom")
    ELSE NULL
  END AS company_name,

  -- client_type : par défaut particulier
  'particulier'::public.client_type AS client_type,

  -- Adresse
  COALESCE(TRIM(d."Libellé voie"), 'Non renseignée') AS address_line1,
  COALESCE(TRIM(d."C.P."), '00000') AS postal_code,
  COALESCE(TRIM(d."Ville"), 'Non renseignée') AS city,
  'France' AS country,

  -- Téléphone
  TRIM(d."Info Tél Dom/Bur") AS phone,

  -- Email : préférer Email Devis, fallback sur Email Facture
  COALESCE(
    NULLIF(TRIM(d."Email Devis"), ''),
    NULLIF(TRIM(d."Email Facture"), '')
  ) AS email,

  -- Contrat
  CASE
    WHEN UPPER(d."CONTRAT") = 'OUI' THEN 'annuel'::public.contract_type
    ELSE 'ponctuel'::public.contract_type
  END AS contract_type,

  -- URSSAF / crédit d'impôt
  CASE WHEN UPPER(COALESCE(d."URSSAF", '')) IN ('OUI', 'VRAI', 'TRUE') THEN true ELSE false END AS eligible_tax_credit,
  50 AS tax_credit_percentage,
  30 AS payment_terms_days,

  -- is_active
  CASE WHEN UPPER(d."Inactif") = 'VRAI' THEN false ELSE true END AS is_active,

  -- Notes : combiner origine + type + code client
  CONCAT_WS(' | ',
    NULLIF('Source Dreamflore', ''),
    CASE WHEN d."Code client" IS NOT NULL THEN 'Réf: ' || d."Code client" ELSE NULL END,
    CASE WHEN d."TYPE DE CLIENT" IS NOT NULL THEN 'Type: ' || d."TYPE DE CLIENT" ELSE NULL END,
    CASE WHEN d."ORIGINE" IS NOT NULL THEN 'Origine: ' || d."ORIGINE" ELSE NULL END
  ) AS notes

FROM "Lead contact dreamflore" d
WHERE d."Nom" IS NOT NULL
  AND TRIM(d."Nom") != ''
  AND (d."TYPE DE CLIENT" IS NULL OR UPPER(d."TYPE DE CLIENT") = 'CLIENT');


-- 1B: Prospects Dreamflore (TYPE DE CLIENT = PROSPECT)
INSERT INTO public.prospects (
  first_name,
  last_name,
  company_name,
  client_type,
  address_line1,
  postal_code,
  city,
  country,
  phone,
  email,
  source,
  pipeline_stage,
  notes
)
SELECT
  COALESCE(NULLIF(TRIM(d."Prénom"), ''), 'N/A') AS first_name,
  TRIM(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        REGEXP_REPLACE(
          REGEXP_REPLACE(
            TRIM(COALESCE(d."Nom", 'Inconnu')),
            '^M\s*et\s*Mme\s+', '', 'i'
          ),
          '^Madame\s+', '', 'i'
        ),
        '^Monsieur\s+', '', 'i'
      ),
      '^Mme\s+M?\s*', '', 'i'
    )
  ) AS last_name,
  NULL AS company_name,
  'particulier'::public.client_type AS client_type,
  TRIM(d."Libellé voie") AS address_line1,
  TRIM(d."C.P.") AS postal_code,
  TRIM(d."Ville") AS city,
  'France' AS country,
  TRIM(d."Info Tél Dom/Bur") AS phone,
  COALESCE(
    NULLIF(TRIM(d."Email Devis"), ''),
    NULLIF(TRIM(d."Email Facture"), '')
  ) AS email,
  COALESCE(d."ORIGINE", 'Dreamflore') AS source,
  'qualification'::public.pipeline_stage_type AS pipeline_stage,
  CONCAT_WS(' | ',
    'Source Dreamflore',
    CASE WHEN d."Code client" IS NOT NULL THEN 'Réf: ' || d."Code client" ELSE NULL END,
    CASE WHEN d."ORIGINE" IS NOT NULL THEN 'Origine: ' || d."ORIGINE" ELSE NULL END
  ) AS notes
FROM "Lead contact dreamflore" d
WHERE d."Nom" IS NOT NULL
  AND TRIM(d."Nom") != ''
  AND UPPER(d."TYPE DE CLIENT") IN ('PROSPECT', 'PREPROSPECT');


-- ==========================================================================
-- PARTIE 2 : Import depuis "Export suivi contact Oplead" (764 lignes)
-- Vente (529) → clients | Autres → prospects
-- ==========================================================================

-- 2A: Clients Oplead (Statut = Vente)
INSERT INTO public.clients (
  first_name,
  last_name,
  company_name,
  client_type,
  address_line1,
  address_line2,
  postal_code,
  city,
  country,
  phone,
  mobile,
  email,
  contract_type,
  eligible_tax_credit,
  tax_credit_percentage,
  payment_terms_days,
  is_active,
  notes
)
SELECT
  COALESCE(NULLIF(TRIM(o."Contact - Prénom"), ''), 'N/A') AS first_name,
  COALESCE(NULLIF(TRIM(o."Contact - Nom"), ''), 'Inconnu') AS last_name,
  NULLIF(TRIM(o."Contact - Société"), '') AS company_name,

  CASE
    WHEN o."Contact - Profil" = 'Particulier' THEN 'particulier'::public.client_type
    ELSE 'professionnel'::public.client_type
  END AS client_type,

  COALESCE(NULLIF(TRIM(o."Contact - Adresse"), ''), 'Non renseignée') AS address_line1,
  TRIM(o."Contact - Adresse suite") AS address_line2,
  COALESCE(NULLIF(TRIM(o."Contact - Code postal"::text), ''), '00000') AS postal_code,
  COALESCE(NULLIF(TRIM(o."Contact - Ville"), ''), 'Non renseignée') AS city,
  'France' AS country,

  TRIM(o."Contact - Téléphone") AS phone,
  TRIM(o."Contact - Mobile") AS mobile,

  -- Email : ignorer les emails invalides (juste un ".")
  CASE
    WHEN TRIM(COALESCE(o."Contact - Email", '')) IN ('', '.') THEN NULL
    ELSE TRIM(o."Contact - Email")
  END AS email,

  'ponctuel'::public.contract_type AS contract_type,
  true AS eligible_tax_credit,
  50 AS tax_credit_percentage,
  30 AS payment_terms_days,
  true AS is_active,

  CONCAT_WS(' | ',
    'Source Oplead',
    CASE WHEN o."Lead - Id" IS NOT NULL THEN 'Lead: ' || o."Lead - Id" ELSE NULL END,
    CASE WHEN o."Notoriété" IS NOT NULL THEN 'Notoriété: ' || o."Notoriété" ELSE NULL END,
    CASE WHEN o."Marketing - Canal" IS NOT NULL THEN 'Canal: ' || o."Marketing - Canal" ELSE NULL END,
    CASE WHEN o."Ventes - CA Total" IS NOT NULL AND o."Ventes - CA Total" != '0'
      THEN 'CA: ' || o."Ventes - CA Total" || '€' ELSE NULL END,
    CASE WHEN o."Lead - Message" IS NOT NULL THEN 'Message: ' || LEFT(o."Lead - Message", 200) ELSE NULL END
  ) AS notes

FROM "Export suivi contact Oplead" o
WHERE o."Statut - Dernier" = 'Vente'
  AND o."Contact - Nom" IS NOT NULL
  AND TRIM(o."Contact - Nom") != '';


-- 2B: Prospects Oplead (Statut != Vente)
INSERT INTO public.prospects (
  first_name,
  last_name,
  company_name,
  client_type,
  address_line1,
  address_line2,
  postal_code,
  city,
  country,
  phone,
  mobile,
  email,
  source,
  estimated_value,
  pipeline_stage,
  notes
)
SELECT
  COALESCE(NULLIF(TRIM(o."Contact - Prénom"), ''), 'N/A') AS first_name,
  COALESCE(NULLIF(TRIM(o."Contact - Nom"), ''), 'Inconnu') AS last_name,
  NULLIF(TRIM(o."Contact - Société"), '') AS company_name,
  CASE
    WHEN o."Contact - Profil" = 'Particulier' THEN 'particulier'::public.client_type
    ELSE 'professionnel'::public.client_type
  END AS client_type,
  TRIM(o."Contact - Adresse") AS address_line1,
  TRIM(o."Contact - Adresse suite") AS address_line2,
  NULLIF(TRIM(o."Contact - Code postal"::text), '') AS postal_code,
  TRIM(o."Contact - Ville") AS city,
  'France' AS country,
  TRIM(o."Contact - Téléphone") AS phone,
  TRIM(o."Contact - Mobile") AS mobile,
  CASE
    WHEN TRIM(COALESCE(o."Contact - Email", '')) IN ('', '.') THEN NULL
    ELSE TRIM(o."Contact - Email")
  END AS email,

  COALESCE(o."Notoriété", o."Marketing - Canal", 'Oplead') AS source,

  -- Valeur estimée depuis Suivi - Potentiel
  CASE
    WHEN o."Suivi - Potentiel" IS NOT NULL AND o."Suivi - Potentiel" ~ '^\d+(\.\d+)?$'
    THEN o."Suivi - Potentiel"::numeric
    ELSE NULL
  END AS estimated_value,

  -- Mapping statut → pipeline_stage
  CASE
    WHEN o."Statut - Dernier" = 'En cours' THEN
      CASE
        WHEN o."Suivi - Progression" = 'Devis envoyé' THEN 'proposition'::public.pipeline_stage_type
        WHEN o."Suivi - Progression" = 'Négociation finale en cours' THEN 'negociation'::public.pipeline_stage_type
        ELSE 'qualification'::public.pipeline_stage_type
      END
    WHEN o."Statut - Dernier" IN ('Sans suite', 'Perdu') THEN 'perdu'::public.pipeline_stage_type
    WHEN o."Statut - Dernier" IN ('Nurserie', 'A traiter') THEN 'nouveau'::public.pipeline_stage_type
    ELSE 'nouveau'::public.pipeline_stage_type
  END AS pipeline_stage,

  CONCAT_WS(' | ',
    'Source Oplead',
    CASE WHEN o."Lead - Id" IS NOT NULL THEN 'Lead: ' || o."Lead - Id" ELSE NULL END,
    CASE WHEN o."Statut - Dernier" IS NOT NULL THEN 'Statut: ' || o."Statut - Dernier" ELSE NULL END,
    CASE WHEN o."Suivi - Progression" IS NOT NULL THEN 'Progression: ' || o."Suivi - Progression" ELSE NULL END,
    CASE WHEN o."Marketing - Canal" IS NOT NULL THEN 'Canal: ' || o."Marketing - Canal" ELSE NULL END,
    CASE WHEN o."Lead - Message" IS NOT NULL THEN 'Message: ' || LEFT(o."Lead - Message", 200) ELSE NULL END
  ) AS notes

FROM "Export suivi contact Oplead" o
WHERE o."Statut - Dernier" != 'Vente'
  AND o."Contact - Nom" IS NOT NULL
  AND TRIM(o."Contact - Nom") != '';


-- ==========================================================================
-- PARTIE 3 : Import des leads Oplead récents non présents dans Export suivi
-- (71 leads uniquement dans "Leads Oplead")
-- ==========================================================================

INSERT INTO public.prospects (
  first_name,
  last_name,
  company_name,
  client_type,
  address_line1,
  address_line2,
  postal_code,
  city,
  country,
  phone,
  mobile,
  email,
  source,
  pipeline_stage,
  notes
)
SELECT
  COALESCE(NULLIF(TRIM(l."Contact - Prénom"), ''), 'N/A') AS first_name,
  COALESCE(NULLIF(TRIM(l."Contact - Nom"), ''), 'Inconnu') AS last_name,
  NULLIF(TRIM(l."Contact - Société"), '') AS company_name,
  CASE
    WHEN l."Contact - Profil" = 'Particulier' THEN 'particulier'::public.client_type
    ELSE 'professionnel'::public.client_type
  END AS client_type,
  TRIM(l."Contact - Adresse") AS address_line1,
  TRIM(l."Contact - Adresse suite") AS address_line2,
  NULLIF(TRIM(l."Contact - Code postal"), '') AS postal_code,
  TRIM(l."Contact - Ville") AS city,
  'France' AS country,
  TRIM(l."Contact - Téléphone") AS phone,
  TRIM(l."Contact - Mobile") AS mobile,
  CASE
    WHEN TRIM(COALESCE(l."Contact - Email", '')) IN ('', '.') THEN NULL
    ELSE TRIM(l."Contact - Email")
  END AS email,
  COALESCE(l."Notoriété", l."Marketing - Canal", 'Oplead') AS source,

  -- Mapping statut qualification → pipeline_stage
  CASE
    WHEN l."Statut qualification - Dernier" = 'Transmis' THEN 'qualification'::public.pipeline_stage_type
    WHEN l."Statut qualification - Dernier" IN ('Abandon', 'Inexploitable') THEN 'perdu'::public.pipeline_stage_type
    WHEN l."Statut qualification - Dernier" IN ('Nurserie', 'Qualifier') THEN 'nouveau'::public.pipeline_stage_type
    ELSE 'nouveau'::public.pipeline_stage_type
  END AS pipeline_stage,

  CONCAT_WS(' | ',
    'Source Oplead (lead récent)',
    CASE WHEN l."Lead - Id" IS NOT NULL THEN 'Lead: ' || l."Lead - Id" ELSE NULL END,
    CASE WHEN l."Statut qualification - Dernier" IS NOT NULL
      THEN 'Qualification: ' || l."Statut qualification - Dernier" ELSE NULL END,
    CASE WHEN l."Notoriété" IS NOT NULL THEN 'Notoriété: ' || l."Notoriété" ELSE NULL END,
    CASE WHEN l."Marketing - Canal" IS NOT NULL THEN 'Canal: ' || l."Marketing - Canal" ELSE NULL END,
    CASE WHEN l."Lead - Message" IS NOT NULL THEN 'Message: ' || LEFT(l."Lead - Message", 200) ELSE NULL END
  ) AS notes

FROM "Leads Oplead" l
WHERE l."Lead - Id" NOT IN (
  SELECT o."Lead - Id" FROM "Export suivi contact Oplead" o WHERE o."Lead - Id" IS NOT NULL
)
AND l."Contact - Nom" IS NOT NULL
AND TRIM(l."Contact - Nom") != '';


-- ==========================================================================
-- PARTIE 4 : Import des devis depuis "Devis - dreamflore" (156 devis)
-- ==========================================================================

-- On matche les devis aux clients importés via le "Code client" stocké dans notes
INSERT INTO public.quotes (
  client_id,
  prospect_id,
  reference,
  title,
  description,
  status,
  issue_date,
  subtotal_ht,
  tva_rate,
  tva_amount,
  total_ttc,
  discount_percentage,
  discount_amount,
  eligible_tax_credit,
  tax_credit_amount,
  net_after_credit,
  payment_terms,
  special_conditions
)
SELECT
  -- Chercher le client correspondant dans les clients importés Dreamflore
  -- Le champ "Client" du devis correspond au "Code client" stocké dans notes
  (
    SELECT c.id FROM public.clients c
    WHERE c.notes LIKE '%Réf: ' || TRIM(d."Client") || '%'
      AND c.notes LIKE '%Source Dreamflore%'
    LIMIT 1
  ) AS client_id,

  -- Si pas de client trouvé, chercher dans les prospects
  CASE WHEN (
    SELECT c.id FROM public.clients c
    WHERE c.notes LIKE '%Réf: ' || TRIM(d."Client") || '%'
      AND c.notes LIKE '%Source Dreamflore%'
    LIMIT 1
  ) IS NULL THEN (
    SELECT p.id FROM public.prospects p
    WHERE p.notes LIKE '%Réf: ' || TRIM(d."Client") || '%'
      AND p.notes LIKE '%Source Dreamflore%'
    LIMIT 1
  ) ELSE NULL END AS prospect_id,

  -- Référence au format DEV-YYYY-XXXXX (avec suffixe si doublon)
  'DEV-' || EXTRACT(YEAR FROM TO_DATE(d."Date devis", 'DD/MM/YYYY'))::text
    || '-' || LPAD(d."Devis n°"::text, 5, '0')
    || CASE
      WHEN ROW_NUMBER() OVER (PARTITION BY d."Devis n°" ORDER BY d."Date devis", d."Nom") > 1
      THEN '-' || ROW_NUMBER() OVER (PARTITION BY d."Devis n°" ORDER BY d."Date devis", d."Nom")::text
      ELSE ''
    END AS reference,

  -- Titre depuis Référence 1
  COALESCE(NULLIF(TRIM(d."Référence 1"), ''), 'Devis Dreamflore #' || d."Devis n°") AS title,

  -- Description avec info client
  CONCAT_WS(' | ',
    'Import Dreamflore',
    CASE WHEN d."Client" IS NOT NULL THEN 'Client: ' || TRIM(d."Client") ELSE NULL END,
    CASE WHEN d."Nom" IS NOT NULL THEN 'Nom: ' || TRIM(d."Nom") ELSE NULL END,
    CASE WHEN d."Prénom" IS NOT NULL THEN 'Prénom: ' || TRIM(d."Prénom") ELSE NULL END,
    CASE WHEN d."Commercial" IS NOT NULL THEN 'Commercial: ' || d."Commercial" ELSE NULL END,
    CASE WHEN d."Ville" IS NOT NULL THEN 'Ville: ' || TRIM(d."Ville") ELSE NULL END
  ) AS description,

  -- Status : tous marqués "Non envoyé" → brouillon
  'brouillon'::public.quote_status AS status,

  -- Date du devis
  TO_DATE(d."Date devis", 'DD/MM/YYYY') AS issue_date,

  -- Montants (REPLACE virgule → point pour format décimal français)
  COALESCE(REPLACE(d."Montant HT", ',', '.')::numeric, 0) AS subtotal_ht,
  20.0 AS tva_rate,
  COALESCE(REPLACE(d."Montant TTC", ',', '.')::numeric, 0) - COALESCE(REPLACE(d."Montant HT", ',', '.')::numeric, 0) AS tva_amount,
  COALESCE(REPLACE(d."Montant TTC", ',', '.')::numeric, 0) AS total_ttc,
  0 AS discount_percentage,
  0 AS discount_amount,

  -- Crédit d'impôt
  CASE WHEN UPPER(COALESCE(d."URSSAF", '')) IN ('OUI', 'VRAI') THEN true ELSE false END AS eligible_tax_credit,
  0 AS tax_credit_amount,
  COALESCE(REPLACE(d."Montant TTC", ',', '.')::numeric, 0) AS net_after_credit,

  'Paiement à 30 jours' AS payment_terms,

  CONCAT_WS(' | ',
    'Source Dreamflore',
    'Devis original #' || d."Devis n°",
    CASE WHEN d."TYPE DE CLIENT" IS NOT NULL THEN 'Type client: ' || d."TYPE DE CLIENT" ELSE NULL END,
    CASE WHEN d."ORIGINE" IS NOT NULL THEN 'Origine: ' || d."ORIGINE" ELSE NULL END,
    CASE WHEN d."Nature chantier" IS NOT NULL THEN 'Nature: ' || d."Nature chantier" ELSE NULL END,
    CASE WHEN d."Marge brute" IS NOT NULL THEN 'Marge: ' || d."Marge brute" || '€' ELSE NULL END,
    CASE WHEN d."Equipe" IS NOT NULL THEN 'Equipe: ' || d."Equipe" ELSE NULL END
  ) AS special_conditions

FROM "Devis - dreamflore" d
WHERE d."Devis n°" IS NOT NULL
  -- S'assurer qu'on trouve au moins un client OU prospect
  AND (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.notes LIKE '%Réf: ' || TRIM(d."Client") || '%'
        AND c.notes LIKE '%Source Dreamflore%'
    )
    OR EXISTS (
      SELECT 1 FROM public.prospects p
      WHERE p.notes LIKE '%Réf: ' || TRIM(d."Client") || '%'
        AND p.notes LIKE '%Source Dreamflore%'
    )
  )
ON CONFLICT (reference) DO NOTHING;


-- ==========================================================================
-- PARTIE 5 : Import des fournisseurs depuis "Liste fournisseur - dreamflore"
-- (314 fournisseurs)
-- ==========================================================================

INSERT INTO public.suppliers (
  company_name,
  contact_first_name,
  contact_last_name,
  email,
  phone,
  mobile,
  address_line1,
  postal_code,
  city,
  notes,
  is_active
)
SELECT
  COALESCE(NULLIF(TRIM(f."Nom"), ''), 'Fournisseur inconnu') AS company_name,

  -- Pas de champ séparé pour prénom/nom contact
  NULL AS contact_first_name,
  TRIM(f."Titre") AS contact_last_name,

  -- Email : nettoyer (certains ont des ';' au lieu de '@')
  CASE
    WHEN f."Email" IS NOT NULL AND f."Email" LIKE '%@%' THEN TRIM(f."Email")
    WHEN f."Email" IS NOT NULL AND f."Email" LIKE '%;%' THEN REPLACE(TRIM(f."Email"), ';', '@')
    ELSE NULL
  END AS email,

  TRIM(f."Bureau/Domicile") AS phone,
  TRIM(f."Portable") AS mobile,

  -- Adresse composée
  CONCAT_WS(' ',
    NULLIF(TRIM(f."numerovoie"), ''),
    NULLIF(TRIM(f."lettrevoie"), ''),
    NULLIF(TRIM(f."typevoie"), ''),
    NULLIF(TRIM(f."libellevoie"), ''),
    NULLIF(TRIM(f."complement"), ''),
    NULLIF(TRIM(f."lieudit"), '')
  ) AS address_line1,

  TRIM(f."C.P.") AS postal_code,
  TRIM(f."Ville") AS city,

  CONCAT_WS(' | ',
    'Source Dreamflore',
    CASE WHEN f."Code" IS NOT NULL THEN 'Réf: ' || f."Code" ELSE NULL END,
    CASE WHEN f."Type" IS NOT NULL THEN 'Type: ' || f."Type" ELSE NULL END,
    CASE WHEN f."motsclefs" IS NOT NULL THEN 'Mots-clés: ' || f."motsclefs" ELSE NULL END
  ) AS notes,

  true AS is_active

FROM "Liste fournisseur - dreamflore" f
WHERE f."Nom" IS NOT NULL
  AND TRIM(f."Nom") != '';


COMMIT;

-- ==========================================================================
-- Résumé de l'import
-- ==========================================================================
SELECT 'clients' AS table_name, COUNT(*) AS total FROM public.clients
UNION ALL
SELECT 'prospects', COUNT(*) FROM public.prospects
UNION ALL
SELECT 'quotes', COUNT(*) FROM public.quotes
UNION ALL
SELECT 'suppliers', COUNT(*) FROM public.suppliers
ORDER BY table_name;
