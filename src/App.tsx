import { RouterProvider } from 'react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'
import { AuthProvider } from './contexts/AuthContext'
import { SyncProvider } from './contexts/SyncContext'
import { EntityProvider } from './contexts/EntityContext'
import { ToastProvider } from './components/feedback/ToastProvider'
import { router } from './router'

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SyncProvider>
          <EntityProvider>
            <ToastProvider>
              <RouterProvider router={router} />
            </ToastProvider>
          </EntityProvider>
        </SyncProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
