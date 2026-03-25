// Service for Pappers API — French company data
// Docs: https://www.pappers.fr/api/documentation

const PAPPERS_API_URL = 'https://api.pappers.fr/v2'

function getApiKey(): string {
  const key = import.meta.env.VITE_PAPPERS_API_KEY
  if (!key) throw new Error('Clé API Pappers manquante (VITE_PAPPERS_API_KEY)')
  return key
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface PappersCompanyResult {
  siren: string
  siret: string
  nom_entreprise: string
  forme_juridique: string | null
  adresse: string | null
  code_postal: string | null
  ville: string | null
  numero_tva: string | null
}

interface PappersSiege {
  siret?: string
  adresse_ligne_1?: string
  code_postal?: string
  ville?: string
}

interface PappersRawResult {
  siren?: string
  nom_entreprise?: string
  forme_juridique?: string
  numero_tva_intracommunautaire?: string
  siege?: PappersSiege
}

// ---------------------------------------------------------------------------
// Map raw API response to our type
// ---------------------------------------------------------------------------
function mapResult(raw: PappersRawResult): PappersCompanyResult {
  return {
    siren: raw.siren ?? '',
    siret: raw.siege?.siret ?? '',
    nom_entreprise: raw.nom_entreprise ?? '',
    forme_juridique: raw.forme_juridique ?? null,
    adresse: raw.siege?.adresse_ligne_1 ?? null,
    code_postal: raw.siege?.code_postal ?? null,
    ville: raw.siege?.ville ?? null,
    numero_tva: raw.numero_tva_intracommunautaire ?? null,
  }
}

// ---------------------------------------------------------------------------
// Search companies by name
// ---------------------------------------------------------------------------
export async function searchCompanies(
  query: string,
): Promise<PappersCompanyResult[]> {
  if (!query || query.length < 3) return []

  const params = new URLSearchParams({
    api_token: getApiKey(),
    q: query,
    par_page: '5',
  })

  const res = await fetch(`${PAPPERS_API_URL}/recherche?${params}`)

  if (!res.ok) {
    if (res.status === 401) throw new Error('Clé API Pappers invalide')
    if (res.status === 429) throw new Error('Limite API Pappers atteinte')
    throw new Error(`Erreur Pappers ${res.status}`)
  }

  const data = await res.json()
  return (data.resultats ?? []).map(mapResult)
}

// ---------------------------------------------------------------------------
// Get company by SIRET
// ---------------------------------------------------------------------------
export async function getCompanyBySiret(
  siret: string,
): Promise<PappersCompanyResult | null> {
  if (!siret || siret.length < 9) return null

  const params = new URLSearchParams({
    api_token: getApiKey(),
    siret,
  })

  const res = await fetch(`${PAPPERS_API_URL}/entreprise?${params}`)

  if (!res.ok) {
    if (res.status === 404) return null
    throw new Error(`Erreur Pappers ${res.status}`)
  }

  const data = await res.json()
  return mapResult(data)
}
