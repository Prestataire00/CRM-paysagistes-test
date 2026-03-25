import { useState, useMemo, useEffect, useRef } from 'react'
import { useParams, useSearchParams, Link } from 'react-router'
import {
  ArrowLeft,
  Clock,
  MapPin,
  Phone,
  Navigation,
  CheckCircle2,
  Camera,
  PenTool,
  MessageSquare,
  AlertCircle,
  User,
  Loader2,
} from 'lucide-react'
import { useAuth } from '../../../contexts/AuthContext'
import {
  useChantier,
  useUpdateChantierTasks,
  useSlotEmargements,
  useSignEmargement,
  useUpdateChantierNotes,
  useUploadChantierPhoto,
  useUploadClientSignature,
} from '../../../queries/usePlanning'
import { useToast } from '../../../components/feedback/ToastProvider'
import type { ChantierTask, SignatureType } from '../../../types'
import { supabase } from '../../../lib/supabase'
import { SignaturePad } from '../components/SignaturePad'
import { SatisfactionWidget } from '../../planning/components/SatisfactionWidget'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clientDisplayName(client?: {
  first_name: string
  last_name: string
  company_name: string | null
}): string {
  if (!client) return 'Client inconnu'
  if (client.company_name) return client.company_name
  return `${client.first_name} ${client.last_name}`
}

function formatTime(t: string | null | undefined): string {
  if (!t) return '--:--'
  return t.slice(0, 5)
}

function durationMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return (eh * 60 + em) - (sh * 60 + sm)
}

function formatDuration(minutes: number): string {
  if (minutes <= 0) return '0h00'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}h${m.toString().padStart(2, '0')}`
}

function getStorageUrl(path: string): string {
  const { data } = supabase.storage.from('documents').getPublicUrl(path)
  return data.publicUrl
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function InterventionSkeleton() {
  return (
    <div className="max-w-lg mx-auto pb-8 px-4 pt-4 animate-pulse">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-slate-200" />
        <div className="flex-1">
          <div className="h-5 w-32 bg-slate-200 rounded mb-1" />
          <div className="h-3 w-24 bg-slate-200 rounded" />
        </div>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-12 h-12 rounded-full bg-slate-200" />
          <div className="flex-1">
            <div className="h-5 w-40 bg-slate-200 rounded mb-2" />
            <div className="h-4 w-56 bg-slate-200 rounded mb-1" />
            <div className="h-4 w-32 bg-slate-200 rounded" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="h-12 bg-slate-200 rounded-xl" />
          <div className="h-12 bg-slate-200 rounded-xl" />
        </div>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
        <div className="h-4 w-32 bg-slate-200 rounded mb-4" />
        <div className="space-y-3">
          <div className="h-16 bg-slate-200 rounded-xl" />
          <div className="h-16 bg-slate-200 rounded-xl" />
        </div>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
        <div className="h-4 w-24 bg-slate-200 rounded mb-4" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-slate-200 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MobileInterventionPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const slotId = searchParams.get('slot')
  const { user } = useAuth()
  const toast = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingPhotoType, setPendingPhotoType] = useState<'avant' | 'apres'>('avant')

  // Queries
  const { data: chantier, isLoading, isError } = useChantier(id)
  const updateTasksMutation = useUpdateChantierTasks()
  const notesMutation = useUpdateChantierNotes()
  const photoMutation = useUploadChantierPhoto()
  const signatureMutation = useUploadClientSignature()

  // Emargement
  const { data: emargements = [] } = useSlotEmargements(slotId ?? undefined)
  const signMutation = useSignEmargement()

  // Local state
  const [showComment, setShowComment] = useState(false)
  const [comment, setComment] = useState('')
  const [showSignaturePad, setShowSignaturePad] = useState(false)

  // Initialize comment from chantier data
  useEffect(() => {
    if (chantier?.completion_notes) setComment(chantier.completion_notes)
  }, [chantier?.completion_notes])

  // Derive data
  const client = chantier?.client
  const tasks: ChantierTask[] = chantier?.tasks ?? []

  const address = useMemo(() => {
    if (!chantier) return ''
    return [chantier.address_line1, chantier.city].filter(Boolean).join(', ')
  }, [chantier])

  const clientPhone = client?.phone || client?.mobile || null

  const timeRange = useMemo(() => {
    if (!chantier) return ''
    return `${formatTime(chantier.scheduled_start_time)} - ${formatTime(chantier.scheduled_end_time)}`
  }, [chantier])

  const duration = useMemo(() => {
    if (!chantier) return ''
    if (chantier.scheduled_start_time && chantier.scheduled_end_time)
      return formatDuration(durationMinutes(chantier.scheduled_start_time, chantier.scheduled_end_time))
    if (chantier.estimated_duration_minutes)
      return formatDuration(chantier.estimated_duration_minutes)
    return ''
  }, [chantier])

  // Task completion
  const completedTasks = tasks.filter((t) => t.is_completed).length
  const allTasksDone = tasks.length > 0 && completedTasks === tasks.length

  const toggleTask = (task: ChantierTask) => {
    if (!chantier) return
    const newCompleted = !task.is_completed
    updateTasksMutation.mutate(
      {
        chantierId: chantier.id,
        tasks: [{
          id: task.id,
          is_completed: newCompleted,
          completed_by: newCompleted ? (user?.id ?? null) : null,
        }],
      },
      {
        onSuccess: () => toast.success(newCompleted ? 'Tache terminee' : 'Tache rouverte', task.title),
        onError: () => toast.error('Erreur', 'Impossible de mettre a jour la tache.'),
      },
    )
  }

  // Emargement
  const myArrivee = emargements.find((e) => e.profile_id === user?.id && e.signature_type === 'arrivee')
  const myDepart = emargements.find((e) => e.profile_id === user?.id && e.signature_type === 'depart')

  const handleSign = async (type: SignatureType) => {
    if (!slotId || !user) return

    let latitude: number | null = null
    let longitude: number | null = null
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
      })
      latitude = position.coords.latitude
      longitude = position.coords.longitude
    } catch {
      // GPS not available — proceed without
    }

    signMutation.mutate(
      {
        planning_slot_id: slotId,
        profile_id: user.id,
        signature_type: type,
        latitude,
        longitude,
      },
      {
        onSuccess: () => toast.success(type === 'arrivee' ? 'Arrivee pointee' : 'Depart pointe'),
        onError: (err) => toast.error('Erreur', (err as Error).message),
      },
    )
  }

  // Compress image before upload (max 1200px, 0.8 quality)
  const compressImage = (file: File): Promise<File> => {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        const MAX = 1200
        let w = img.width
        let h = img.height
        if (w > MAX || h > MAX) {
          const ratio = Math.min(MAX / w, MAX / h)
          w = Math.round(w * ratio)
          h = Math.round(h * ratio)
        }
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, w, h)
        canvas.toBlob(
          (blob) => {
            resolve(blob ? new File([blob], file.name, { type: 'image/jpeg' }) : file)
          },
          'image/jpeg',
          0.8,
        )
      }
      img.onerror = () => resolve(file)
      img.src = URL.createObjectURL(file)
    })
  }

  // Photo
  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !chantier) return
    const compressed = await compressImage(file)
    photoMutation.mutate(
      { chantierId: chantier.id, file: compressed, photoType: pendingPhotoType },
      {
        onSuccess: () => toast.success(pendingPhotoType === 'avant' ? 'Photo avant ajoutee' : 'Photo apres ajoutee'),
        onError: () => toast.error('Erreur', 'Impossible d\'envoyer la photo'),
      },
    )
    e.target.value = ''
  }

  const openCamera = (type: 'avant' | 'apres') => {
    setPendingPhotoType(type)
    // Small delay so state is set before input click
    setTimeout(() => fileInputRef.current?.click(), 50)
  }

  // Comment save
  const handleSaveComment = () => {
    if (!chantier) return
    notesMutation.mutate(
      { chantierId: chantier.id, notes: comment },
      {
        onSuccess: () => toast.success('Commentaire sauvegarde'),
        onError: () => toast.error('Erreur', 'Impossible de sauvegarder'),
      },
    )
  }

  // Client signature
  const handleSignatureConfirm = (blob: Blob) => {
    if (!chantier) return
    signatureMutation.mutate(
      { chantierId: chantier.id, blob },
      {
        onSuccess: () => {
          toast.success('Signature enregistree')
          setShowSignaturePad(false)
        },
        onError: () => toast.error('Erreur', 'Impossible d\'enregistrer la signature'),
      },
    )
  }

  const hasClientSignature = !!chantier?.client_signature_url

  // Photos list
  const photos: string[] = chantier?.completion_photos ?? []

  if (isLoading) return <InterventionSkeleton />

  if (isError || !chantier) {
    return (
      <div className="max-w-lg mx-auto pb-8 px-4 pt-4">
        <div className="flex items-center gap-3 mb-6">
          <Link
            to="/m/schedule"
            className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center active:bg-slate-50"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </Link>
          <h1 className="text-lg font-bold text-slate-900">Intervention</h1>
        </div>
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-red-300 mx-auto mb-3" />
          <p className="font-medium text-red-600 mb-1">Intervention introuvable</p>
          <p className="text-sm text-slate-500">Verifiez l'identifiant ou revenez au planning.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto pb-8 px-4 pt-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          to="/m/schedule"
          className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center active:bg-slate-50"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-slate-900">Intervention</h1>
          <p className="text-xs text-slate-500">{chantier.reference}</p>
        </div>
      </div>

      {/* Client Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-4">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
            <User className="w-6 h-6 text-primary-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-slate-900">
              {clientDisplayName(client)}
            </h2>
            {address && (
              <div className="flex items-center gap-1.5 text-sm text-slate-600 mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                {address}
              </div>
            )}
            {timeRange && (
              <div className="flex items-center gap-1.5 text-sm text-slate-600 mt-0.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {timeRange}
                {duration && <span className="text-slate-400">({duration})</span>}
              </div>
            )}
          </div>
        </div>

        {/* Quick action buttons */}
        <div className="grid grid-cols-2 gap-2">
          {clientPhone ? (
            <a
              href={`tel:${clientPhone}`}
              className="flex items-center justify-center gap-2 py-3.5 bg-emerald-50 text-emerald-700 rounded-xl text-sm font-semibold active:bg-emerald-100 transition-colors"
            >
              <Phone className="w-5 h-5" />
              Appeler
            </a>
          ) : (
            <div className="flex items-center justify-center gap-2 py-3.5 bg-slate-50 text-slate-400 rounded-xl text-sm font-semibold cursor-not-allowed">
              <Phone className="w-5 h-5" />
              Pas de tel.
            </div>
          )}
          <a
            href={address ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}` : '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 py-3.5 bg-blue-50 text-blue-700 rounded-xl text-sm font-semibold active:bg-blue-100 transition-colors"
          >
            <Navigation className="w-5 h-5" />
            Itineraire
          </a>
        </div>

        {/* Notes */}
        {chantier.description && (
          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 mb-1">
              <AlertCircle className="w-3.5 h-3.5" />
              Notes
            </div>
            <p className="text-sm text-amber-800">{chantier.description}</p>
          </div>
        )}
      </div>

      {/* Emargement — Real GPS sign-in/out */}
      {slotId ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            Pointage
          </h3>

          <div className="space-y-3">
            {/* Arrivée */}
            {myArrivee ? (
              <div className="flex items-center gap-4 p-4 rounded-xl border-2 border-emerald-200 bg-emerald-50">
                <div className="w-14 h-14 rounded-xl bg-emerald-500 text-white flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <div className="flex-1">
                  <p className="text-base font-semibold text-emerald-700">Arrivee</p>
                  <p className="text-xs text-emerald-600">
                    Pointe a {new Date(myArrivee.signed_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    {myArrivee.latitude && (
                      <span className="ml-1.5 inline-flex items-center gap-0.5">
                        <MapPin className="w-3 h-3" /> GPS
                      </span>
                    )}
                  </p>
                </div>
              </div>
            ) : (
              <button
                onClick={() => handleSign('arrivee')}
                disabled={signMutation.isPending}
                className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-primary-300 bg-primary-50 active:scale-[0.98] transition-all"
              >
                <div className="w-14 h-14 rounded-xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0">
                  {signMutation.isPending ? (
                    <Loader2 className="w-7 h-7 animate-spin" />
                  ) : (
                    <MapPin className="w-7 h-7" />
                  )}
                </div>
                <div className="flex-1 text-left">
                  <p className="text-base font-semibold text-slate-900">Pointer arrivee</p>
                  <p className="text-xs text-slate-500">Appuyer pour enregistrer votre arrivee</p>
                </div>
              </button>
            )}

            {/* Départ */}
            {myDepart ? (
              <div className="flex items-center gap-4 p-4 rounded-xl border-2 border-blue-200 bg-blue-50">
                <div className="w-14 h-14 rounded-xl bg-blue-500 text-white flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <div className="flex-1">
                  <p className="text-base font-semibold text-blue-700">Depart</p>
                  <p className="text-xs text-blue-600">
                    Pointe a {new Date(myDepart.signed_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    {myDepart.latitude && (
                      <span className="ml-1.5 inline-flex items-center gap-0.5">
                        <MapPin className="w-3 h-3" /> GPS
                      </span>
                    )}
                  </p>
                </div>
              </div>
            ) : myArrivee ? (
              <button
                onClick={() => handleSign('depart')}
                disabled={signMutation.isPending}
                className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-primary-300 bg-primary-50 active:scale-[0.98] transition-all"
              >
                <div className="w-14 h-14 rounded-xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0">
                  {signMutation.isPending ? (
                    <Loader2 className="w-7 h-7 animate-spin" />
                  ) : (
                    <Navigation className="w-7 h-7" />
                  )}
                </div>
                <div className="flex-1 text-left">
                  <p className="text-base font-semibold text-slate-900">Pointer depart</p>
                  <p className="text-xs text-slate-500">Appuyer pour enregistrer votre depart</p>
                </div>
              </button>
            ) : (
              <div className="flex items-center gap-4 p-4 rounded-xl border-2 border-slate-200 bg-slate-50 opacity-50">
                <div className="w-14 h-14 rounded-xl bg-slate-300 text-white flex items-center justify-center flex-shrink-0">
                  <Navigation className="w-7 h-7" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-base font-semibold text-slate-400">Pointer depart</p>
                  <p className="text-xs text-slate-400">Pointez d'abord votre arrivee</p>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
          <p className="text-xs text-amber-700">Pointage indisponible — acces via le planning uniquement</p>
        </div>
      )}

      {/* Task Checklist */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-slate-400" />
            Taches ({completedTasks}/{tasks.length})
          </h3>
          {tasks.length > 0 && (
            <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${(completedTasks / tasks.length) * 100}%` }}
              />
            </div>
          )}
        </div>

        {tasks.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-4">Aucune tache definie</p>
        )}

        <div className="space-y-2">
          {tasks.map((task) => (
            <button
              key={task.id}
              onClick={() => toggleTask(task)}
              disabled={updateTasksMutation.isPending}
              className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all active:scale-[0.98] ${
                task.is_completed
                  ? 'border-emerald-200 bg-emerald-50'
                  : 'border-slate-200 bg-white'
              } ${updateTasksMutation.isPending ? 'opacity-60' : ''}`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  task.is_completed
                    ? 'bg-emerald-500 text-white'
                    : 'border-2 border-slate-300'
                }`}
              >
                {task.is_completed && <CheckCircle2 className="w-5 h-5" />}
              </div>
              <span
                className={`text-sm font-medium text-left ${
                  task.is_completed
                    ? 'text-emerald-700 line-through'
                    : 'text-slate-900'
                }`}
              >
                {task.title}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Comment Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-4">
        <button
          onClick={() => setShowComment(!showComment)}
          className="w-full flex items-center gap-3 py-2"
        >
          <MessageSquare className="w-5 h-5 text-slate-400" />
          <span className="text-sm font-medium text-slate-700">
            {comment ? 'Commentaire' : 'Ajouter un commentaire'}
          </span>
        </button>
        {showComment && (
          <div className="mt-3">
            <textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Remarques sur l'intervention..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
            <button
              onClick={handleSaveComment}
              disabled={notesMutation.isPending}
              className="mt-2 w-full py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium active:bg-primary-700 transition-colors disabled:opacity-60"
            >
              {notesMutation.isPending ? 'Sauvegarde...' : 'Sauvegarder'}
            </button>
          </div>
        )}
      </div>

      {/* Photo Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-4">
        <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <Camera className="w-4 h-4 text-slate-400" />
          Photos avant / apres
        </h3>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handlePhotoChange}
        />
        <div className="grid grid-cols-2 gap-2 mb-3">
          <button
            onClick={() => openCamera('avant')}
            disabled={photoMutation.isPending}
            className="flex items-center justify-center gap-2 py-3.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-semibold active:bg-slate-200 transition-colors border border-slate-200 disabled:opacity-60"
          >
            {photoMutation.isPending && pendingPhotoType === 'avant' ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Camera className="w-5 h-5" />
            )}
            Photo avant
          </button>
          <button
            onClick={() => openCamera('apres')}
            disabled={photoMutation.isPending}
            className="flex items-center justify-center gap-2 py-3.5 bg-primary-50 text-primary-700 rounded-xl text-sm font-semibold active:bg-primary-100 transition-colors border border-primary-200 disabled:opacity-60"
          >
            {photoMutation.isPending && pendingPhotoType === 'apres' ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Camera className="w-5 h-5" />
            )}
            Photo apres
          </button>
        </div>

        {/* Grouped gallery */}
        {photos.length > 0 && (() => {
          const avantPhotos = photos.filter(p => p.includes('/avant_'))
          const apresPhotos = photos.filter(p => p.includes('/apres_'))
          const otherPhotos = photos.filter(p => !p.includes('/avant_') && !p.includes('/apres_'))
          return (
            <div className="space-y-3">
              {avantPhotos.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1.5">Avant ({avantPhotos.length})</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {avantPhotos.map((path, i) => (
                      <div key={i} className="aspect-square rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
                        <img src={getStorageUrl(path)} alt={`Avant ${i + 1}`} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {apresPhotos.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-primary-600 mb-1.5">Apres ({apresPhotos.length})</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {apresPhotos.map((path, i) => (
                      <div key={i} className="aspect-square rounded-lg overflow-hidden bg-slate-100 border border-primary-200">
                        <img src={getStorageUrl(path)} alt={`Apres ${i + 1}`} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {otherPhotos.length > 0 && (
                <div className="grid grid-cols-3 gap-1.5">
                  {otherPhotos.map((path, i) => (
                    <div key={i} className="aspect-square rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
                      <img src={getStorageUrl(path)} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })()}
      </div>

      {/* Signature Button */}
      {hasClientSignature ? (
        <div className="flex items-center justify-center gap-3 py-5 rounded-xl bg-emerald-50 border-2 border-emerald-200 text-emerald-700 text-lg font-bold">
          <CheckCircle2 className="w-6 h-6" />
          Signature enregistree
        </div>
      ) : (
        <button
          onClick={() => setShowSignaturePad(true)}
          disabled={!allTasksDone || signatureMutation.isPending}
          className={`w-full flex items-center justify-center gap-3 py-5 rounded-xl text-lg font-bold transition-all active:scale-[0.98] ${
            allTasksDone
              ? 'bg-primary-600 text-white active:bg-primary-700'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          }`}
        >
          {signatureMutation.isPending ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <PenTool className="w-6 h-6" />
          )}
          Signature client
        </button>
      )}

      {/* Satisfaction — visible once intervention is complete */}
      {chantier?.status === 'terminee' && (
        <div className="mt-4">
          <SatisfactionWidget
            chantierId={chantier.id}
            existingRating={chantier.satisfaction_rating}
            existingComment={chantier.satisfaction_comment}
          />
        </div>
      )}

      {/* Signature Pad Modal */}
      {showSignaturePad && (
        <SignaturePad
          onConfirm={handleSignatureConfirm}
          onCancel={() => setShowSignaturePad(false)}
        />
      )}
    </div>
  )
}
