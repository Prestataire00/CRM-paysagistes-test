import { brand } from '../../../config/brand'
import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router'
import { useAuth } from '../../../contexts/AuthContext'
import { Role } from '../../../types'
import { Logo } from '../../../components/brand/Logo'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    const { error: signInError, role } = await signIn(email, password)
    setIsSubmitting(false)

    if (signInError) {
      setError(signInError)
      return
    }

    // Redirect based on role
    if (from) {
      navigate(from, { replace: true })
    } else if (role === Role.JARDINIER) {
      navigate('/m/schedule', { replace: true })
    } else if (role === Role.FACTURATION) {
      navigate('/billing/invoices', { replace: true })
    } else {
      navigate('/dashboard', { replace: true })
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <Logo size="lg" showText className="mb-5" />
          <h1 className="text-2xl font-bold text-slate-900">{`CRM ${brand.name}`}</h1>
          <p className="text-slate-500 mt-1">Connectez-vous à votre espace</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3 border border-red-200">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="votre@email.fr"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? 'Connexion...' : 'Se connecter'}
          </button>

          <div className="text-center">
            <a href="/forgot-password" className="text-sm text-primary-600 hover:text-primary-700">
              Mot de passe oublié ?
            </a>
          </div>
        </form>
      </div>
    </div>
  )
}
