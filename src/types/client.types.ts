export type ClientType = 'particulier' | 'professionnel' | 'copropriete' | 'collectivite'
export type ContractType = 'ponctuel' | 'annuel' | 'trimestriel' | 'mensuel'
export type ClientStatut = 'prospect' | 'actif' | 'inactif' | 'ancien'
export type GeographicZone = 'zone_1' | 'zone_2' | 'zone_3' | 'zone_4' | 'zone_5'
export type Civility = 'M' | 'Mme' | 'Société'

export type PipelineStage = 'nouveau' | 'qualification' | 'proposition' | 'negociation' | 'gagne' | 'perdu'

export interface ExtraPhone {
  label: string
  number: string
}

export interface ExtraEmail {
  label: string
  email: string
}

export interface Birthday {
  label: string
  date: string
}

export interface ClientTag {
  id: string
  name: string
  color: string
  created_at: string
}

export interface Client {
  id: string
  company_name: string | null
  client_type: ClientType
  civility: Civility | null
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  mobile: string | null
  address_line1: string
  address_line2: string | null
  postal_code: string
  city: string
  country: string
  latitude: number | null
  longitude: number | null
  geographic_zone: GeographicZone | null
  code_bip: string | null
  code_interne: string | null
  contract_type: ContractType
  contract_start_date: string | null
  contract_end_date: string | null
  eligible_tax_credit: boolean
  tax_credit_percentage: number
  siret: string | null
  tva_number: string | null
  payment_terms_days: number
  default_payment_method: string | null
  extra_phones: ExtraPhone[]
  extra_emails: ExtraEmail[]
  sms_consent: boolean
  newsletter_consent: boolean
  birthdays: Birthday[]
  contract_hours: Record<string, number>
  notes: string | null
  assigned_commercial_id: string | null
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface Prospect {
  id: string
  company_name: string | null
  client_type: ClientType
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  mobile: string | null
  address_line1: string | null
  address_line2: string | null
  postal_code: string | null
  city: string | null
  country: string | null
  latitude: number | null
  longitude: number | null
  geographic_zone: GeographicZone | null
  source: string | null
  estimated_value: number | null
  probability: number | null
  pipeline_stage: PipelineStage
  assigned_commercial_id: string | null
  converted_to_client_id: string | null
  converted_at: string | null
  last_activity_at: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface Supplier {
  id: string
  company_name: string
  contact_first_name: string | null
  contact_last_name: string | null
  email: string | null
  phone: string | null
  mobile: string | null
  address_line1: string | null
  postal_code: string | null
  city: string | null
  category: string | null
  siret: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}
