import { useEffect, useState } from 'react'
import { fetchPortalTenant } from './portalApi'
import { PortalAuthProvider } from './PortalAuthContext'
import { PortalHomePage } from './pages/PortalHomePage'
import { PortalPropertyPage } from './pages/PortalPropertyPage'
import { PortalAuthPage } from './pages/PortalAuthPage'
import { PortalBookingPage } from './pages/PortalBookingPage'
import { PortalMyBookingsPage } from './pages/PortalMyBookingsPage'
import type { PortalTenant, PortalPage } from './types'

interface PortalAppProps {
  slug: string
}

type BookingMode = 'daily' | 'monthly'

/** Parses the portal sub-route from the current pathname.
 *  e.g. /my-tenant → 'home'
 *       /my-tenant/property/apt-1 → 'property' with propertyId='apt-1'
 *       /my-tenant/login → 'login'
 */
function parsePortalRoute(slug: string): {
  page: PortalPage
  propertyId?: string
  email?: string
  bookingMode?: BookingMode
} {
  const pathname = window.location.pathname
  const searchParams = new URLSearchParams(window.location.search)
  // Remove leading slash and the slug prefix
  const rest = pathname.replace(new RegExp(`^\\/${slug}\\/?`), '')
  const segments = rest.split('/').filter(Boolean)

  if (segments[0] === 'property' && segments[1]) {
    return { page: 'property', propertyId: segments[1] }
  }
  if (segments[0] === 'login') return { page: 'login' }
  if (segments[0] === 'register') return { page: 'register' }
  if (segments[0] === 'booking' && segments[1]) {
    const modeParam = searchParams.get('mode')
    return {
      page: 'booking',
      propertyId: segments[1],
      bookingMode: modeParam === 'monthly' ? 'monthly' : 'daily',
    }
  }
  if (segments[0] === 'minhas-reservas') return { page: 'my-bookings' }
  return { page: 'home' }
}

export function PortalApp({ slug }: PortalAppProps) {
  const [tenant, setTenant] = useState<PortalTenant | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [route, setRoute] = useState(() => parsePortalRoute(slug))
  const [myBookingsEmail, setMyBookingsEmail] = useState('')

  const navigate = (page: PortalPage, propertyId?: string, bookingMode?: BookingMode) => {
    let path = `/${slug}`
    if (page === 'property' && propertyId) path += `/property/${propertyId}`
    else if (page === 'login') path += '/login'
    else if (page === 'register') path += '/register'
    else if (page === 'booking' && propertyId) {
      path += `/booking/${propertyId}`
      if (bookingMode === 'monthly') path += '?mode=monthly'
    }
    else if (page === 'my-bookings') path += '/minhas-reservas'

    window.history.pushState({}, '', path)
    setRoute({ page, propertyId, bookingMode })
  }

  const navigateToMyBookings = (email: string) => {
    setMyBookingsEmail(email)
    navigate('my-bookings')
  }

  // Handle browser back/forward
  useEffect(() => {
    const onPop = () => setRoute(parsePortalRoute(slug))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [slug])

  useEffect(() => {
    setIsLoading(true)
    fetchPortalTenant(slug).then(t => {
      setTenant(t)
      setIsLoading(false)
    })
  }, [slug])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="h-10 w-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-500 text-sm">Carregando portal...</p>
        </div>
      </div>
    )
  }

  if (!tenant) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Portal não encontrado</h1>
          <p className="text-gray-500">
            O endereço <span className="font-mono text-gray-700">/{slug}</span> não corresponde a um portal ativo.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div data-portal-reservas="true">
      <PortalAuthProvider tenant={tenant}>
      {route.page === 'home' && (
        <PortalHomePage
          tenant={tenant}
          onViewProperty={id => navigate('property', id)}
          onLogin={() => navigate('login')}
          onMyBookings={() => navigateToMyBookings('')}
        />
      )}
      {route.page === 'property' && route.propertyId && (
        <PortalPropertyPage
          tenant={tenant}
          propertyId={route.propertyId}
          onBack={() => navigate('home')}
          onBook={(id, mode) => navigate('booking', id, mode)}
          onLogin={() => navigate('login')}
        />
      )}
      {route.page === 'login' && (
        <PortalAuthPage
          tenant={tenant}
          mode="login"
          onSuccess={() => navigate('home')}
          onSwitchToRegister={() => navigate('register')}
          onBack={() => navigate('home')}
        />
      )}
      {route.page === 'register' && (
        <PortalAuthPage
          tenant={tenant}
          mode="register"
          onSuccess={() => navigate('home')}
          onSwitchToLogin={() => navigate('login')}
          onBack={() => navigate('home')}
        />
      )}
      {route.page === 'booking' && route.propertyId && (
        <PortalBookingPage
          tenant={tenant}
          propertyId={route.propertyId}
          bookingMode={route.bookingMode}
          onBack={() => navigate('property', route.propertyId)}
          onSuccess={() => navigate('home')}
          onLogin={() => navigate('login')}
          onRegister={() => navigate('register')}
          onMyBookings={navigateToMyBookings}
        />
      )}
      {route.page === 'my-bookings' && (
        <PortalMyBookingsPage
          tenant={tenant}
          onBack={() => navigate('home')}
          onLogin={() => navigate('login')}
          onRegister={() => navigate('register')}
        />
      )}
      </PortalAuthProvider>
    </div>
  )
}
