import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { ErrorBoundary } from './components/Modals/ErrorBoundary'
import { PWAProvider } from './contexts/PWAContext'
import './index.css'
import './i18n/config'

import { toast } from 'sonner'
import { QueryCache } from '@tanstack/react-query'
import type { AppError } from './types/error'

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      const appError = error as AppError;
      // Only show toast for non-upstream errors to avoid double notifications (pill already shows upstream errors)
      if (appError.isUpstream === false || appError.code === 'NETWORK_ERROR') {
        toast.error(appError.message || 'Something went wrong');
      }
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 10000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <PWAProvider>
          <App />
        </PWAProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
