import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from "react-error-boundary";

import App from './App.tsx'
import { PortalApp } from './portal/PortalApp.tsx'
import { ErrorFallback } from './ErrorFallback.tsx'

import "./main.css"
import "./styles/theme.css"
import "./index.css"

// Segments that are reserved for the admin app / auth flows
const RESERVED_FIRST_SEGMENTS = new Set(['auth', 'mobile'])

const pathname = window.location.pathname
const firstSegment = pathname.split('/').filter(Boolean)[0] ?? ''
const isPortalRoute = firstSegment !== '' && !RESERVED_FIRST_SEGMENTS.has(firstSegment)

const searchParams = new URLSearchParams(window.location.search)
const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
const hasOAuthCallback =
  searchParams.has('code')
  || searchParams.has('error')
  || hashParams.has('access_token')
  || hashParams.has('refresh_token')
  || hashParams.has('error')

// For admin routes only: redirect OAuth callbacks to /auth/callback.
// Portal routes handle OAuth inline via PortalAuthContext + onAuthStateChange.
if (hasOAuthCallback && !isPortalRoute) {
  const callbackUrl = new URL(window.location.href)
  if (callbackUrl.pathname !== '/auth/callback') {
    callbackUrl.pathname = '/auth/callback'
    window.location.replace(callbackUrl.toString())
  }
}

const rootElement = document.getElementById('root')!

if (isPortalRoute) {
  createRoot(rootElement).render(
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <PortalApp slug={firstSegment} />
    </ErrorBoundary>
  )
} else {
  createRoot(rootElement).render(
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <App />
    </ErrorBoundary>
  )
}
