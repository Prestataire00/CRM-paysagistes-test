import { Link } from 'react-router'
import { ArrowLeft } from 'lucide-react'

export function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="text-center">
        <p className="text-7xl font-bold text-primary-600 mb-2">404</p>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Page introuvable</h1>
        <p className="text-slate-500 mb-6">
          La page que vous recherchez n'existe pas ou a ete deplacee.
        </p>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour au tableau de bord
        </Link>
      </div>
    </div>
  )
}
