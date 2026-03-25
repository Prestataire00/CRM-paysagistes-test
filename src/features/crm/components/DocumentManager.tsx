import { useState, useRef, useCallback } from 'react'
import {
  Upload,
  FileText,
  Image,
  FileSpreadsheet,
  File,
  Download,
  Trash2,
  Loader2,
} from 'lucide-react'
import { useToast } from '../../../components/feedback/ToastProvider'
import { getSignedUrl } from '../../../services/document.service'
import type { Document as CrmDocument, DocumentType } from '../../../types'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface DocumentManagerProps {
  documents: CrmDocument[]
  isLoading: boolean
  onUpload: (file: File, type: DocumentType) => Promise<void>
  onDelete?: (id: string) => void
  uploading: boolean
}

// ---------------------------------------------------------------------------
// Document type labels
// ---------------------------------------------------------------------------
const documentTypeLabels: Record<DocumentType, string> = {
  devis: 'Devis',
  facture: 'Facture',
  attestation_fiscale: 'Attestation fiscale',
  contrat: 'Contrat',
  photo: 'Photo',
  signature: 'Signature',
  rapport: 'Rapport',
  autre: 'Autre',
}

// ---------------------------------------------------------------------------
// File icon by MIME type
// ---------------------------------------------------------------------------
function getFileIcon(mimeType: string | null) {
  if (!mimeType) return File
  if (mimeType.startsWith('image/')) return Image
  if (mimeType === 'application/pdf') return FileText
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return FileSpreadsheet
  return File
}

// ---------------------------------------------------------------------------
// Format file size
// ---------------------------------------------------------------------------
function formatFileSize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

// ---------------------------------------------------------------------------
// Accepted file extensions
// ---------------------------------------------------------------------------
const ACCEPTED_TYPES = '.pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.txt'
const MAX_SIZE = 10 * 1024 * 1024 // 10 MB

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function DocumentManager({
  documents,
  isLoading,
  onUpload,
  onDelete,
  uploading,
}: DocumentManagerProps) {
  const toast = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedType, setSelectedType] = useState<DocumentType>('autre')
  const [dragOver, setDragOver] = useState(false)

  const handleFileSelect = useCallback(
    async (file: File) => {
      if (file.size > MAX_SIZE) {
        toast.error('Fichier trop volumineux', 'La taille maximale est de 10 Mo.')
        return
      }
      try {
        await onUpload(file, selectedType)
        toast.success('Document importé', `${file.name} a été ajouté.`)
      } catch (err) {
        toast.error('Erreur', (err as Error).message)
      }
    },
    [onUpload, selectedType, toast],
  )

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFileSelect(file)
      // Reset input so the same file can be re-uploaded
      e.target.value = ''
    },
    [handleFileSelect],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const file = e.dataTransfer.files?.[0]
      if (file) handleFileSelect(file)
    },
    [handleFileSelect],
  )

  const handleDownload = useCallback(
    async (doc: CrmDocument) => {
      try {
        const url = await getSignedUrl(doc.file_url)
        window.open(url, '_blank')
      } catch {
        toast.error('Erreur', 'Impossible de télécharger le document.')
      }
    },
    [toast],
  )

  const handleDelete = useCallback(
    (id: string) => {
      if (onDelete) onDelete(id)
    },
    [onDelete],
  )

  return (
    <div className="space-y-4">
      {/* Upload zone */}
      <div
        className={`relative rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
          dragOver
            ? 'border-primary-400 bg-primary-50'
            : 'border-slate-200 hover:border-slate-300 bg-white'
        }`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          onChange={handleInputChange}
          className="hidden"
        />

        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
            <p className="text-sm text-slate-600">Import en cours...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <Upload className="w-8 h-8 text-slate-400" />
            <div>
              <p className="text-sm text-slate-600">
                Glissez un fichier ici ou{' '}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-primary-600 font-medium hover:underline"
                >
                  parcourez
                </button>
              </p>
              <p className="text-xs text-slate-400 mt-1">
                PDF, images, Word, Excel — 10 Mo max
              </p>
            </div>

            {/* Document type selector */}
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-slate-500">Type :</span>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value as DocumentType)}
                className="text-xs px-2 py-1 border border-slate-200 rounded-md text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                {Object.entries(documentTypeLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Documents list */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
        </div>
      )}

      {!isLoading && documents.length === 0 && (
        <div className="text-center py-8">
          <FileText className="w-10 h-10 text-slate-200 mx-auto mb-2" />
          <p className="text-sm text-slate-400">Aucun document</p>
        </div>
      )}

      {documents.length > 0 && (
        <div className="space-y-2">
          {documents.map((doc) => {
            const Icon = getFileIcon(doc.mime_type)
            return (
              <div
                key={doc.id}
                className="flex items-center justify-between gap-3 px-4 py-3 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon className="w-5 h-5 text-slate-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{doc.name}</p>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span>{documentTypeLabels[doc.document_type] ?? doc.document_type}</span>
                      {doc.file_size && (
                        <>
                          <span>&middot;</span>
                          <span>{formatFileSize(doc.file_size)}</span>
                        </>
                      )}
                      <span>&middot;</span>
                      <span>{new Date(doc.created_at).toLocaleDateString('fr-FR')}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleDownload(doc)}
                    className="p-1.5 rounded-md hover:bg-slate-100 transition-colors"
                    title="Télécharger"
                  >
                    <Download className="w-4 h-4 text-slate-500" />
                  </button>
                  {onDelete && (
                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="p-1.5 rounded-md hover:bg-red-50 transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
