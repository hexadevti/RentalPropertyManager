import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from "react-error-boundary";

import App from './App.tsx'
import { ErrorFallback } from './ErrorFallback.tsx'

import "./main.css"
import "./styles/theme.css"
import "./index.css"

const searchParams = new URLSearchParams(window.location.search)
const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
const hasOAuthCallback =
  searchParams.has('code')
  || searchParams.has('error')
  || hashParams.has('access_token')
  || hashParams.has('refresh_token')
  || hashParams.has('error')

if (hasOAuthCallback) {
  const callbackUrl = new URL(window.location.href)
  if (callbackUrl.pathname !== '/auth/callback') {
    callbackUrl.pathname = '/auth/callback'
    window.location.replace(callbackUrl.toString())
  }
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary FallbackComponent={ErrorFallback}>
    <App />
   </ErrorBoundary>
)
