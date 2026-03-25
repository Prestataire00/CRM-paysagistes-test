// ---------------------------------------------------------------------------
// Diff utilities for audit log history display
// ---------------------------------------------------------------------------

export interface FieldChange {
  field: string
  label: string
  oldValue: unknown
  newValue: unknown
}

// Fields to skip in diff display (internal fields)
const SKIP_FIELDS = new Set([
  'id',
  'created_at',
  'updated_at',
  'created_by',
  'updated_by',
])

// French labels for common DB fields
const FIELD_LABELS: Record<string, string> = {
  // Clients
  first_name: 'Prénom',
  last_name: 'Nom',
  company_name: 'Société',
  email: 'Email',
  phone: 'Téléphone',
  mobile: 'Mobile',
  address_line1: 'Adresse',
  address_line2: 'Adresse (suite)',
  postal_code: 'Code postal',
  city: 'Ville',
  country: 'Pays',
  geographic_zone: 'Zone géographique',
  client_type: 'Type de client',
  contract_type: 'Type de contrat',
  contract_start_date: 'Début de contrat',
  contract_end_date: 'Fin de contrat',
  eligible_tax_credit: 'Crédit d\'impôt',
  is_active: 'Actif',
  notes: 'Notes',
  assigned_commercial_id: 'Commercial assigné',

  // Quotes
  reference: 'Référence',
  status: 'Statut',
  title: 'Titre',
  issue_date: 'Date d\'émission',
  valid_until: 'Valide jusqu\'au',
  total_ht: 'Total HT',
  total_tva: 'Total TVA',
  total_ttc: 'Total TTC',
  accepted_date: 'Date d\'acceptation',
  special_conditions: 'Conditions particulières',
  payment_terms: 'Conditions de paiement',
  validity_days: 'Validité (jours)',
  tva_rate: 'Taux TVA',

  // Invoices
  due_date: 'Date d\'échéance',
  paid_date: 'Date de paiement',
  payment_method: 'Mode de paiement',

  // Prospects
  pipeline_stage: 'Étape pipeline',
  estimated_value: 'Valeur estimée',
  probability: 'Probabilité',
  source: 'Source',

  // Chantiers
  intervention_type: 'Type d\'intervention',
  scheduled_date: 'Date planifiée',
  description: 'Description',
  assigned_team_id: 'Équipe assignée',

  // Signing
  signing_token: 'Token signature',
  signature_url: 'URL signature',
  signed_at: 'Date de signature',
  signer_ip: 'IP signataire',
  signing_expires_at: 'Expiration signature',
}

// ---------------------------------------------------------------------------
// Compute diff between old and new values
// ---------------------------------------------------------------------------
export function computeDiff(
  oldValues: Record<string, unknown> | null,
  newValues: Record<string, unknown> | null,
): FieldChange[] {
  if (!oldValues && !newValues) return []

  const changes: FieldChange[] = []
  const allKeys = new Set([
    ...Object.keys(oldValues ?? {}),
    ...Object.keys(newValues ?? {}),
  ])

  for (const key of allKeys) {
    if (SKIP_FIELDS.has(key)) continue

    const oldVal = oldValues?.[key]
    const newVal = newValues?.[key]

    // Skip if values are the same
    if (JSON.stringify(oldVal) === JSON.stringify(newVal)) continue

    changes.push({
      field: key,
      label: FIELD_LABELS[key] ?? key,
      oldValue: oldVal,
      newValue: newVal,
    })
  }

  return changes
}

// ---------------------------------------------------------------------------
// Format a field value for display
// ---------------------------------------------------------------------------
export function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined) return 'Vide'
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non'
  if (typeof value === 'number') return value.toLocaleString('fr-FR')

  const str = String(value)

  // ISO date detection
  if (/^\d{4}-\d{2}-\d{2}(T|$)/.test(str)) {
    try {
      const date = new Date(str)
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
      }
    } catch {
      // fallthrough
    }
  }

  // Truncate long strings
  if (str.length > 100) return str.slice(0, 100) + '…'

  return str
}
