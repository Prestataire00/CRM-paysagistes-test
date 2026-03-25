import { Component, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  featureName?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.featureName ? `:${this.props.featureName}` : ''}]`, error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <AlertTriangle className="w-12 h-12 text-amber-400" />
          <h2 className="text-lg font-semibold text-slate-900">
            {this.props.featureName
              ? `Erreur dans ${this.props.featureName}`
              : 'Une erreur est survenue'}
          </h2>
          <p className="text-sm text-red-600 max-w-md text-center font-mono bg-red-50 p-3 rounded-lg">
            {this.state.error?.message}
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700"
            >
              <RefreshCw className="w-4 h-4" />
              Réessayer
            </button>
            <a
              href="/dashboard"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
            >
              <Home className="w-4 h-4" />
              Accueil
            </a>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * Route error element for React Router errorElement prop
 */
export function RouteErrorFallback() {
  return (
    <div className="flex flex-col items-center justify-center py-20 space-y-4">
      <AlertTriangle className="w-12 h-12 text-amber-400" />
      <h2 className="text-lg font-semibold text-slate-900">Page introuvable ou erreur</h2>
      <p className="text-sm text-slate-500">La page demandée a rencontré un problème.</p>
      <div className="flex gap-3">
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700"
        >
          <RefreshCw className="w-4 h-4" />
          Recharger
        </button>
        <a
          href="/dashboard"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
        >
          <Home className="w-4 h-4" />
          Accueil
        </a>
      </div>
    </div>
  )
}
