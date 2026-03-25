import { useState } from 'react'
import { Link } from 'react-router'
import { supabase } from '../../../lib/supabase'
import { ArrowLeft } from 'lucide-react'
import { Logo } from '../../../components/brand/Logo'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    setIsSubmitting(false)
    if (resetError) {
      setError(resetError.message)
    } else {
      setSent(true)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <Logo size="lg" showText className="mb-5" />
          <h1 className="text-2xl font-bold text-slate-900">Mot de passe oublié</h1>
          <p className="text-slate-500 mt-1">Entrez votre email pour réinitialiser</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="bg-primary-50 text-primary-700 text-sm rounded-lg p-4 border border-primary-200">
                Un email de réinitialisation a été envoyé à <strong>{email}</strong>.
              </div>
              <Link to="/login" className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700">
                <ArrowLeft className="w-4 h-4" /> Retour à la connexion
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3 border border-red-200">{error}</div>
              )}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                {isSubmitting ? 'Envoi...' : 'Envoyer le lien'}
              </button>
              <div className="text-center">
                <Link to="/login" className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700">
                  <ArrowLeft className="w-4 h-4" /> Retour
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
