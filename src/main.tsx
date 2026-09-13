import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HelmetProvider } from 'react-helmet-async'
import { ThemeProvider } from 'next-themes'
import App from './App'
import { ErrorBoundary } from './components/Modals/ErrorBoundary'
import { TooltipProvider } from '@/components/ui/tooltip'
import './index.css'

import { toast } from 'sonner'
import { QueryCache } from '@tanstack/react-query'
import { AppErrorCode, type AppError } from './types/error'
import i18n from './i18n/config'
import { TRANSIT_REFRESH_MS } from './config/constants'

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      const appError = error as AppError;
      // Do not show toast for 404 (Not Found) or upstream errors to avoid double notifications (UI component renders inline error state)
      if (appError.status === 404) return;
      if (appError.isUpstream === false || appError.code === 'NETWORK_ERROR') {
        toast.error(i18n.t(appError.code === AppErrorCode.NETWORK_ERROR ? 'errors.network' : 'errors.generic'));
      }
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: TRANSIT_REFRESH_MS,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <HelmetProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange
          >
            <TooltipProvider delay={300}>
              <App />
            </TooltipProvider>
          </ThemeProvider>
        </HelmetProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
