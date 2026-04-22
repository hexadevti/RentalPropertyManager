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
  try {
    if (window.top && window.top !== window.self) {
      window.top.location.replace(window.location.href)
    }
  } catch (error) {
    console.error('Failed to promote OAuth callback to top window:', error)
  }
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary FallbackComponent={ErrorFallback}>
    <App />
   </ErrorBoundary>
)
