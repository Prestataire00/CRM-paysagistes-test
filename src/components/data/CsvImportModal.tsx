import { useState, useCallback, useRef } from 'react'
import { Upload, FileText, AlertTriangle, CheckCircle2, X, Loader2 } from 'lucide-react'
import { Modal, ModalHeader, ModalFooter } from '../feedback/Modal'
import type { CsvImportError } from '../../utils/csv'

type Step = 'upload' | 'preview' | 'importing' | 'done'

interface CsvImportModalProps {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  headers: string[]
  onImport: (rows: string[][]) => Promise<{ inserted: number; errors: string[] }>
  parseRows: (rows: string[][]) => { valid: unknown[]; errors: CsvImportError[]; total: number }
}

export function CsvImportModal({
  open,
  onClose,
  title = 'Importer un fichier CSV',
  description,
  headers,
  onImport,
  parseRows,
}: CsvImportModalProps) {
  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [rawRows, setRawRows] = useState<string[][]>([])
  const [validCount, setValidCount] = useState(0)
  const [parseErrors, setParseErrors] = useState<CsvImportError[]>([])
  const [importResult, setImportResult] = useState<{ inserted: number; errors: string[] } | null>(null)
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const reset = useCallback(() => {
    setStep('upload')
    setFile(null)
    setRawRows([])
    setValidCount(0)
    setParseErrors([])
    setImportResult(null)
    setImporting(false)
  }, [])

  const handleClose = useCallback(() => {
    reset()
    onClose()
  }, [reset, onClose])

  const handleFileSelect = useCallback(
    async (selectedFile: File) => {
      const { parseCsvFile } = await import('../../utils/csv')
      setFile(selectedFile)
      try {
        const rows = await parseCsvFile(selectedFile)
        setRawRows(rows)
        const result = parseRows(rows)
        setValidCount(result.valid.length)
        setParseErrors(result.errors)
        setStep('preview')
      } catch {
        setParseErrors([{ row: 0, field: '', message: 'Erreur lors de la lecture du fichier CSV' }])
      }
    },
    [parseRows],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const droppedFile = e.dataTransfer.files[0]
      if (droppedFile?.name.endsWith('.csv')) {
        handleFileSelect(droppedFile)
      }
    },
    [handleFileSelect],
  )

  const handleImport = useCallback(async () => {
    setImporting(true)
    setStep('importing')
    try {
      const result = await onImport(rawRows)
      setImportResult(result)
      setStep('done')
    } catch (err) {
      setImportResult({ inserted: 0, errors: [(err as Error).message] })
      setStep('done')
    } finally {
      setImporting(false)
    }
  }, [onImport, rawRows])

  return (
    <Modal open={open} onClose={handleClose} size="lg">
      <ModalHeader
        title={title}
        description={description}
        onClose={handleClose}
      />

      <div className="px-6 pb-4">
        {/* Step: Upload */}
        {step === 'upload' && (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:border-green-400 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-700">
              Glissez un fichier CSV ici ou cliquez pour sélectionner
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Colonnes attendues : {headers.join(', ')}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleFileSelect(f)
              }}
            />
          </div>
        )}

        {/* Step: Preview */}
        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-slate-500" />
              <div>
                <p className="text-sm font-medium text-slate-700">{file?.name}</p>
                <p className="text-xs text-slate-400">
                  {rawRows.length - 1} ligne(s) détectée(s) · {validCount} valide(s)
                </p>
              </div>
            </div>

            {/* Preview table - first 5 rows */}
            <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-48">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    {rawRows[0]?.map((h, i) => (
                      <th key={i} className="px-3 py-2 text-left font-medium text-slate-500">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rawRows.slice(1, 6).map((row, i) => (
                    <tr key={i}>
                      {row.map((cell, j) => (
                        <td key={j} className="px-3 py-1.5 text-slate-600 whitespace-nowrap">
                          {cell || <span className="text-slate-300">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Errors */}
            {parseErrors.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <p className="text-sm font-medium text-amber-800">
                    {parseErrors.length} erreur(s) de validation
                  </p>
                </div>
                <ul className="text-xs text-amber-700 space-y-1 max-h-24 overflow-y-auto">
                  {parseErrors.slice(0, 10).map((err, i) => (
                    <li key={i}>
                      Ligne {err.row} — {err.field}: {err.message}
                    </li>
                  ))}
                  {parseErrors.length > 10 && (
                    <li className="font-medium">… et {parseErrors.length - 10} autre(s)</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Step: Importing */}
        {step === 'importing' && (
          <div className="flex flex-col items-center py-8">
            <Loader2 className="w-10 h-10 text-green-500 animate-spin mb-3" />
            <p className="text-sm text-slate-600">Import en cours…</p>
          </div>
        )}

        {/* Step: Done */}
        {step === 'done' && importResult && (
          <div className="space-y-3">
            {importResult.inserted > 0 ? (
              <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg p-4">
                <CheckCircle2 className="w-6 h-6 text-green-500 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-green-800">
                    {importResult.inserted} enregistrement(s) importé(s) avec succès
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
                <X className="w-6 h-6 text-red-500 shrink-0" />
                <p className="text-sm font-medium text-red-800">Aucun enregistrement importé</p>
              </div>
            )}
            {importResult.errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <ul className="text-xs text-red-700 space-y-1">
                  {importResult.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      <ModalFooter>
        {step === 'preview' && (
          <>
            <button
              onClick={reset}
              className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              Annuler
            </button>
            <button
              onClick={handleImport}
              disabled={validCount === 0 || importing}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              Importer {validCount} ligne(s)
            </button>
          </>
        )}
        {step === 'done' && (
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
          >
            Fermer
          </button>
        )}
      </ModalFooter>
    </Modal>
  )
}
