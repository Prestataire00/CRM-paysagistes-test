// ---------------------------------------------------------------------------
// CSV Import / Export utilities
// ---------------------------------------------------------------------------

export interface CsvColumn<T> {
  header: string
  accessor: (row: T) => string | number | null | undefined
}

export interface CsvImportError {
  row: number
  field: string
  message: string
}

export interface CsvImportResult<T> {
  valid: T[]
  errors: CsvImportError[]
  total: number
}

// ---------------------------------------------------------------------------
// Export CSV — BOM UTF-8 for French Excel compatibility
// ---------------------------------------------------------------------------
export function exportToCsv<T>(
  filename: string,
  columns: CsvColumn<T>[],
  rows: T[],
): void {
  const escapeField = (value: string | number | null | undefined): string => {
    if (value == null) return ''
    const str = String(value)
    if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes(';')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  const separator = ';' // French Excel default
  const header = columns.map((c) => escapeField(c.header)).join(separator)
  const body = rows
    .map((row) => columns.map((c) => escapeField(c.accessor(row))).join(separator))
    .join('\r\n')

  const csv = `${header}\r\n${body}`
  const bom = '\uFEFF'
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8' })

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// ---------------------------------------------------------------------------
// Parse CSV file — handles RFC 4180 quoting
// ---------------------------------------------------------------------------
export function parseCsvFile(file: File): Promise<string[][]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        let text = e.target?.result as string
        // Strip BOM
        if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)

        const rows = parseCsvText(text)
        resolve(rows)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('Erreur de lecture du fichier'))
    reader.readAsText(file, 'utf-8')
  })
}

function parseCsvText(text: string): string[][] {
  const rows: string[][] = []
  let current: string[] = []
  let field = ''
  let inQuotes = false

  // Detect separator (semicolon or comma)
  const firstLine = text.split('\n')[0] ?? ''
  const sep = firstLine.includes(';') ? ';' : ','

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const next = text[i + 1]

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        field += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === sep) {
        current.push(field.trim())
        field = ''
      } else if (ch === '\r' && next === '\n') {
        current.push(field.trim())
        field = ''
        if (current.some((f) => f !== '')) rows.push(current)
        current = []
        i++
      } else if (ch === '\n') {
        current.push(field.trim())
        field = ''
        if (current.some((f) => f !== '')) rows.push(current)
        current = []
      } else {
        field += ch
      }
    }
  }

  // Last field
  current.push(field.trim())
  if (current.some((f) => f !== '')) rows.push(current)

  return rows
}

// ---------------------------------------------------------------------------
// Parse Clients CSV — maps headers to ClientCsvRow
// ---------------------------------------------------------------------------
export interface ClientCsvRow {
  first_name: string
  last_name: string
  company_name: string
  email: string
  phone: string
  mobile: string
  address_line1: string
  postal_code: string
  city: string
  country: string
  client_type: string
  contract_type: string
  notes: string
}

const HEADER_MAP: Record<string, keyof ClientCsvRow> = {
  'prénom': 'first_name',
  'prenom': 'first_name',
  'first_name': 'first_name',
  'nom': 'last_name',
  'last_name': 'last_name',
  'société': 'company_name',
  'societe': 'company_name',
  'entreprise': 'company_name',
  'company_name': 'company_name',
  'email': 'email',
  'e-mail': 'email',
  'téléphone': 'phone',
  'telephone': 'phone',
  'phone': 'phone',
  'tel': 'phone',
  'mobile': 'mobile',
  'portable': 'mobile',
  'adresse': 'address_line1',
  'address': 'address_line1',
  'address_line1': 'address_line1',
  'code postal': 'postal_code',
  'cp': 'postal_code',
  'postal_code': 'postal_code',
  'ville': 'city',
  'city': 'city',
  'pays': 'country',
  'country': 'country',
  'type': 'client_type',
  'client_type': 'client_type',
  'type client': 'client_type',
  'contrat': 'contract_type',
  'contract_type': 'contract_type',
  'type contrat': 'contract_type',
  'notes': 'notes',
  'commentaire': 'notes',
  'remarques': 'notes',
}

const VALID_CLIENT_TYPES = ['particulier', 'professionnel', 'copropriete', 'collectivite']
const VALID_CONTRACT_TYPES = ['ponctuel', 'annuel', 'trimestriel', 'mensuel']

export function parseClientsCsv(rows: string[][]): CsvImportResult<ClientCsvRow> {
  if (rows.length < 2) {
    return { valid: [], errors: [{ row: 0, field: '', message: 'Le fichier est vide ou ne contient que l\'en-tête' }], total: 0 }
  }

  // Map header row to field names
  const headers = rows[0].map((h) => {
    const normalized = h.toLowerCase().trim()
    return HEADER_MAP[normalized] ?? null
  })

  const valid: ClientCsvRow[] = []
  const errors: CsvImportError[] = []

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    const record: Record<string, string> = {}

    for (let j = 0; j < headers.length; j++) {
      const field = headers[j]
      if (field) {
        record[field] = row[j] ?? ''
      }
    }

    const rowErrors: CsvImportError[] = []

    if (!record.first_name) rowErrors.push({ row: i + 1, field: 'Prénom', message: 'Prénom requis' })
    if (!record.last_name) rowErrors.push({ row: i + 1, field: 'Nom', message: 'Nom requis' })
    if (!record.address_line1) rowErrors.push({ row: i + 1, field: 'Adresse', message: 'Adresse requise' })
    if (!record.postal_code) rowErrors.push({ row: i + 1, field: 'Code postal', message: 'Code postal requis' })
    if (!record.city) rowErrors.push({ row: i + 1, field: 'Ville', message: 'Ville requise' })

    // Normalize client_type
    const clientType = (record.client_type || 'particulier').toLowerCase().trim()
    if (!VALID_CLIENT_TYPES.includes(clientType)) {
      rowErrors.push({ row: i + 1, field: 'Type', message: `Type invalide: ${record.client_type}. Valeurs acceptées: ${VALID_CLIENT_TYPES.join(', ')}` })
    }

    // Normalize contract_type
    const contractType = (record.contract_type || 'ponctuel').toLowerCase().trim()
    if (!VALID_CONTRACT_TYPES.includes(contractType)) {
      rowErrors.push({ row: i + 1, field: 'Contrat', message: `Type de contrat invalide: ${record.contract_type}. Valeurs acceptées: ${VALID_CONTRACT_TYPES.join(', ')}` })
    }

    if (rowErrors.length > 0) {
      errors.push(...rowErrors)
    } else {
      valid.push({
        first_name: record.first_name ?? '',
        last_name: record.last_name ?? '',
        company_name: record.company_name ?? '',
        email: record.email ?? '',
        phone: record.phone ?? '',
        mobile: record.mobile ?? '',
        address_line1: record.address_line1 ?? '',
        postal_code: record.postal_code ?? '',
        city: record.city ?? '',
        country: record.country || 'France',
        client_type: clientType,
        contract_type: contractType,
        notes: record.notes ?? '',
      })
    }
  }

  return { valid, errors, total: rows.length - 1 }
}
