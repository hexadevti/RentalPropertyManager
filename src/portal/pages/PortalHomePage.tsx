import { useEffect, useState } from 'react'
import { fetchPortalProperties } from '../portalApi'
import { usePortalAuth } from '../PortalAuthContext'
import type { PortalTenant, PortalProperty } from '../types'
import { MapPin, Users, Moon, Calendar } from '@phosphor-icons/react'

interface PortalHomePageProps {
  tenant: PortalTenant
  onViewProperty: (id: string) => void
  onLogin: () => void
  onMyBookings: () => void
}

const TYPE_LABELS: Record<string, string> = {
  room: 'Quarto',
  apartment: 'Apartamento',
  house: 'Casa',
}

export function PortalHomePage({ tenant, onViewProperty, onLogin, onMyBookings }: PortalHomePageProps) {
  const { portalUser, isLoading: authLoading, signOut } = usePortalAuth()
  const [properties, setProperties] = useState<PortalProperty[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [searchCity, setSearchCity] = useState('')

  const loadProperties = async () => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const props = await fetchPortalProperties(tenant.id)
      setProperties(props)
    } catch {
      setProperties([])
      setLoadError('Nao foi possivel carregar os anuncios agora.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadProperties()
  }, [tenant.id])

  const filtered = searchCity.trim()
    ? properties.filter(p =>
        p.city?.toLowerCase().includes(searchCity.toLowerCase()) ||
        p.name.toLowerCase().includes(searchCity.toLowerCase()),
      )
    : properties

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{tenant.name}</h1>
            <p className="text-xs text-gray-500">Imóveis para alugar</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onMyBookings}
              className="text-sm text-gray-600 hover:text-blue-700 font-medium transition-colors"
            >
              Minhas reservas
            </button>
            {!authLoading && (
              portalUser ? (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-700 hidden sm:block">
                    Olá, {portalUser.name.split(' ')[0]}
                  </span>
                  <button
                    onClick={() => void signOut()}
                    className="text-sm text-gray-500 hover:text-gray-800 underline"
                  >
                    Sair
                  </button>
                </div>
              ) : (
                <button
                  onClick={onLogin}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  Entrar / Cadastrar
                </button>
              )
            )}
          </div>
        </div>
      </header>

      {/* Hero / Search */}
      <div className="bg-gradient-to-br from-blue-700 to-blue-900 text-white py-12 px-4">
        <div className="max-w-2xl mx-auto text-center space-y-4">
          <h2 className="text-2xl sm:text-3xl font-bold">Encontre o imóvel ideal</h2>
          <p className="text-blue-100 text-sm sm:text-base">
            Veja as propriedades disponíveis e solicite uma reserva com facilidade.
          </p>
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar por cidade ou nome..."
              value={searchCity}
              onChange={e => setSearchCity(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white text-slate-900 placeholder:text-slate-500 border border-white/70 text-sm shadow-lg outline-none focus:border-white focus:ring-2 focus:ring-white/70 pr-10"
            />
            {searchCity && (
              <button
                onClick={() => setSearchCity('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg leading-none"
              >
                ×
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Property grid */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl overflow-hidden shadow-sm animate-pulse">
                <div className="h-52 bg-gray-200" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                  <div className="h-3 bg-gray-200 rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <p className="text-lg font-medium">
              {loadError ? 'Nao foi possivel carregar os anuncios' : 'Nenhuma propriedade encontrada'}
            </p>
            <div className="mt-2 flex items-center justify-center gap-4">
              {loadError && (
                <button
                  onClick={() => void loadProperties()}
                  className="text-blue-600 hover:underline text-sm"
                >
                  Tentar novamente
                </button>
              )}
              {searchCity && (
                <button
                  onClick={() => setSearchCity('')}
                  className="text-blue-600 hover:underline text-sm"
                >
                  Limpar busca
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-6">
              {filtered.length} {filtered.length === 1 ? 'propriedade' : 'propriedades'} disponíveis
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map(property => (
                <PropertyCard
                  key={property.id}
                  property={property}
                  onClick={() => onViewProperty(property.id)}
                />
              ))}
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-6 mt-10">
        <p className="text-center text-xs text-gray-400">
          Portal de reservas · {tenant.name}
        </p>
      </footer>
    </div>
  )
}

function PropertyCard({ property, onClick }: { property: PortalProperty; onClick: () => void }) {
  const hasNightPrice = property.pricePerNight > 0
  const hasMonthlyPrice = property.pricePerMonth > 0

  return (
    <button
      onClick={onClick}
      className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow text-left group w-full"
    >
      {/* Photo */}
      <div className="relative h-52 overflow-hidden bg-gray-100">
        {property.coverPhotoUrl ? (
          <img
            src={property.coverPhotoUrl}
            alt={property.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
            <span className="text-4xl text-gray-300">🏠</span>
          </div>
        )}
        <span className="absolute top-3 left-3 bg-white/90 text-gray-700 text-xs font-medium px-2 py-1 rounded-full">
          {TYPE_LABELS[property.type] ?? property.type}
        </span>
      </div>

      {/* Info */}
      <div className="p-4 space-y-2">
        <h3 className="font-semibold text-gray-900 text-base leading-tight line-clamp-1">
          {property.name}
        </h3>

        {(property.city || property.address) && (
          <div className="flex items-center gap-1 text-gray-500 text-xs">
            <MapPin size={13} weight="fill" />
            <span className="line-clamp-1">{property.city ?? property.address}</span>
          </div>
        )}

        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <Users size={13} />
            {property.capacity} {property.capacity === 1 ? 'hóspede' : 'hóspedes'}
          </span>
        </div>

        {/* Price */}
        <div className="pt-1 flex flex-wrap gap-2">
          {hasNightPrice && (
            <div className="flex items-center gap-1 text-sm font-semibold text-gray-800">
              <Moon size={13} className="text-blue-500" />
              R$ {property.pricePerNight.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}/noite
            </div>
          )}
          {hasMonthlyPrice && (
            <div className="flex items-center gap-1 text-sm font-semibold text-gray-800">
              <Calendar size={13} className="text-green-500" />
              R$ {property.pricePerMonth.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}/mês
            </div>
          )}
        </div>
      </div>

      <div className="px-4 pb-4">
        <span className="text-blue-600 text-sm font-medium group-hover:underline">
          Ver detalhes →
        </span>
      </div>
    </button>
  )
}
