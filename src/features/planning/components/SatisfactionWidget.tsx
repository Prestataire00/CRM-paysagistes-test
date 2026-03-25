import { useState } from 'react'
import { Star, Send, CheckCircle2 } from 'lucide-react'
import { supabase } from '../../../lib/supabase'

interface SatisfactionWidgetProps {
  chantierId: string
  existingRating?: number | null
  existingComment?: string | null
  onSaved?: () => void
}

export function SatisfactionWidget({ chantierId, existingRating, existingComment, onSaved }: SatisfactionWidgetProps) {
  const [rating, setRating] = useState<number>(existingRating ?? 0)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment] = useState(existingComment ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(!!existingRating)

  const handleSubmit = async () => {
    if (rating === 0) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('chantiers')
        .update({
          satisfaction_rating: rating,
          satisfaction_comment: comment || null,
          satisfaction_date: new Date().toISOString(),
        })
        .eq('id', chantierId)

      if (!error) {
        setSaved(true)
        onSaved?.()
      }
    } finally {
      setSaving(false)
    }
  }

  if (saved && existingRating) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span className="text-sm font-semibold text-emerald-800">Avis client enregistré</span>
        </div>
        <div className="flex items-center gap-1 mt-2">
          {[1, 2, 3, 4, 5].map(i => (
            <Star key={i} className={`w-5 h-5 ${i <= (existingRating ?? 0) ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`} />
          ))}
          <span className="ml-2 text-sm text-slate-600">{existingRating}/5</span>
        </div>
        {existingComment && <p className="text-sm text-slate-600 mt-2 italic">"{existingComment}"</p>}
      </div>
    )
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-slate-900 mb-3">Satisfaction client</h3>

      {/* Stars */}
      <div className="flex items-center gap-1 mb-3">
        {[1, 2, 3, 4, 5].map(i => (
          <button
            key={i}
            type="button"
            onClick={() => { setRating(i); setSaved(false) }}
            onMouseEnter={() => setHoverRating(i)}
            onMouseLeave={() => setHoverRating(0)}
            className="p-0.5 transition-transform hover:scale-110"
          >
            <Star className={`w-7 h-7 transition-colors ${
              i <= (hoverRating || rating)
                ? 'text-amber-400 fill-amber-400'
                : 'text-slate-200 hover:text-slate-300'
            }`} />
          </button>
        ))}
        {rating > 0 && (
          <span className="ml-2 text-sm font-medium text-slate-600">
            {rating === 5 ? 'Excellent' : rating === 4 ? 'Très bien' : rating === 3 ? 'Correct' : rating === 2 ? 'Moyen' : 'Insatisfait'}
          </span>
        )}
      </div>

      {/* Comment */}
      <textarea
        value={comment}
        onChange={e => setComment(e.target.value)}
        placeholder="Commentaire du client (optionnel)..."
        rows={2}
        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none mb-3"
      />

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={rating === 0 || saving || saved}
        className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {saved ? <CheckCircle2 className="w-4 h-4" /> : <Send className="w-4 h-4" />}
        {saving ? 'Enregistrement...' : saved ? 'Enregistré' : 'Enregistrer l\'avis'}
      </button>
    </div>
  )
}
