import { z } from 'zod'

const phoneRegex = /^(\+33|0)[1-9]\d{8}$/

const extraPhoneSchema = z.object({
  label: z.string().min(1, 'Label requis'),
  number: z.string().regex(phoneRegex, 'Numéro invalide').or(z.literal('')),
})

const extraEmailSchema = z.object({
  label: z.string().min(1, 'Label requis'),
  email: z.string().email('Email invalide').or(z.literal('')),
})

const birthdaySchema = z.object({
  label: z.string().min(1, 'Label requis'),
  date: z.string().min(1, 'Date requise'),
})

// Coerce to number, fallback to 0
const coerceNum = z.union([z.number(), z.string(), z.undefined()]).transform(v => Number(v) || 0)

export const clientFormSchema = z.object({
  // Section 1: Identification
  company_name: z.string().optional().or(z.literal('')),
  client_type: z.enum(['particulier', 'professionnel', 'copropriete', 'collectivite']),
  contract_type: z.enum(['ponctuel', 'annuel', 'trimestriel', 'mensuel']),
  geographic_zone: z.enum(['zone_1', 'zone_2', 'zone_3', 'zone_4', 'zone_5']).nullable().optional(),
  code_bip: z.string().optional().or(z.literal('')),
  code_interne: z.string().optional().or(z.literal('')),

  // Section 2: Identité du contact
  civility: z.enum(['M', 'Mme', 'Société']).nullable().optional(),
  first_name: z.string().min(2, 'Minimum 2 caractères'),
  last_name: z.string().min(2, 'Minimum 2 caractères'),

  // Section 3: Adresse
  address_line1: z.string().min(1, 'Adresse requise'),
  address_line2: z.string().optional().or(z.literal('')),
  postal_code: z.string().regex(/^\d{5}$/, 'Code postal invalide (5 chiffres)'),
  city: z.string().min(1, 'Ville requise'),
  country: z.string().min(1, 'Pays requis'),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),

  // Section 4: Coordonnées
  phone: z.string().regex(phoneRegex, 'Numéro invalide').or(z.literal('')).optional(),
  mobile: z.string().regex(phoneRegex, 'Numéro invalide').or(z.literal('')).optional(),
  extra_phones: z.array(extraPhoneSchema).optional().default([]),
  email: z.string().email('Email invalide').or(z.literal('')).optional(),
  extra_emails: z.array(extraEmailSchema).optional().default([]),
  sms_consent: z.boolean().default(false),
  newsletter_consent: z.boolean().default(false),

  // Section 5: Infos personnelles
  birthdays: z.array(birthdaySchema).optional().default([]),
  notes: z.string().optional().or(z.literal('')),

  // Section 6: Contrat & facturation
  contract_start_date: z.string().optional().or(z.literal('')),
  contract_end_date: z.string().optional().or(z.literal('')),
  eligible_tax_credit: z.boolean().default(false),
  tax_credit_percentage: coerceNum.default(50),
  payment_terms_days: coerceNum.default(30),
  siret: z.string().optional().or(z.literal('')),
  tva_number: z.string().optional().or(z.literal('')),
  default_payment_method: z.enum(['virement', 'cheque', 'carte_bancaire', 'prelevement', 'especes']).nullable().optional(),
  contract_hours: z.record(z.string(), coerceNum).optional().default({}),

  // Section 7: Tags & attribution
  assigned_commercial_id: z.string().nullable().optional(),
})

export type ClientFormData = z.infer<typeof clientFormSchema>
