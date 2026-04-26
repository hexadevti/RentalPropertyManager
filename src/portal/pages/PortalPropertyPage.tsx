import { useEffect, useState } from 'react'
import { fetchPortalProperty } from '../portalApi'
import { usePortalAuth } from '../PortalAuthContext'
import type { PortalTenant, PortalProperty } from '../types'
import { ArrowLeft, MapPin, Users, Moon, Calendar, Images } from '@phosphor-icons/react'

interface PortalPropertyPageProps {
  tenant: PortalTenant
  propertyId: string
  onBack: () => void
  onBook: (propertyId: string, bookingMode?: 'daily' | 'monthly') => void
  onLogin: () => void
}

const TYPE_LABELS: Record<string, string> = {
  room: 'Quarto',
  apartment: 'Apartamento',
  house: 'Casa',
}

export function PortalPropertyPage({ tenant, propertyId, onBack, onBook, onLogin }: PortalPropertyPageProps) {
  const { portalUser, isLoading: authLoading } = usePortalAuth()
  const [property, setProperty] = useState<PortalProperty | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [activePhotoIdx, setActivePhotoIdx] = useState(0)

  const loadProperty = async () => {
    setIsLoading(true)
    setLoadError(null)
    setActivePhotoIdx(0)
    try {
      const result = await fetchPortalProperty(tenant.id, propertyId)
      setProperty(result)
      if (!result) {
        setLoadError('Nao foi possivel carregar este anuncio agora.')
      }
    } catch {
      setProperty(null)
      setLoadError('Nao foi possivel carregar este anuncio agora.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadProperty()
  }, [tenant.id, propertyId])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="h-10 w-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!property) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-gray-500">{loadError ?? 'Propriedade não encontrada.'}</p>
          <div className="mt-3 flex items-center justify-center gap-4">
            {loadError && (
              <button
                onClick={() => void loadProperty()}
                className="text-blue-600 hover:underline text-sm"
              >
                Tentar novamente
              </button>
            )}
            <button onClick={onBack} className="text-blue-600 hover:underline text-sm">
              ← Voltar
            </button>
          </div>
        </div>
      </div>
    )
  }

  const allPhotos = property.photos
  const displayPhotos = allPhotos.length > 0 ? allPhotos : []
  const activePhoto = displayPhotos[activePhotoIdx] ?? null
  const hasNightPrice = property.pricePerNight > 0
  const hasMonthlyPrice = property.pricePerMonth > 0

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Voltar</span>
          </button>
          <h1 className="font-semibold text-gray-900 truncate max-w-xs sm:max-w-sm">{property.name}</h1>
          <div className="w-16" />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Photo gallery */}
        {displayPhotos.length > 0 ? (
          <div className="space-y-2">
            <div className="relative rounded-2xl overflow-hidden bg-gray-100 h-72 sm:h-96">
              <img
                src={activePhoto?.url || ''}
                alt={property.name}
                className="w-full h-full object-cover"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
              {displayPhotos.length > 1 && (
                <>
                  <button
                    onClick={() => setActivePhotoIdx(i => (i - 1 + displayPhotos.length) % displayPhotos.length)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 shadow text-gray-700"
                  >
                    ‹
                  </button>
                  <button
                    onClick={() => setActivePhotoIdx(i => (i + 1) % displayPhotos.length)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 shadow text-gray-700"
                  >
                    ›
                  </button>
                  <span className="absolute bottom-3 right-3 bg-black/50 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                    <Images size={12} />
                    {activePhotoIdx + 1}/{displayPhotos.length}
                  </span>
                </>
              )}
            </div>
            {displayPhotos.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {displayPhotos.map((photo, i) => (
                  <button
                    key={photo.id}
                    onClick={() => setActivePhotoIdx(i)}
                    className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                      i === activePhotoIdx ? 'border-blue-600' : 'border-transparent'
                    }`}
                  >
                    <img
                      src={photo.url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 h-72 flex items-center justify-center">
            <span className="text-6xl">🏠</span>
          </div>
        )}

        {/* Info + booking card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Left: details */}
          <div className="md:col-span-2 space-y-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-blue-100 text-blue-700 text-xs font-medium px-2.5 py-1 rounded-full">
                  {TYPE_LABELS[property.type] ?? property.type}
                </span>
              </div>
              <h2 className="text-2xl font-bold text-gray-900">{property.name}</h2>
            </div>

            <div className="flex flex-wrap gap-4 text-sm text-gray-600">
              {(property.city || property.address) && (
                <div className="flex items-center gap-1.5">
                  <MapPin size={15} weight="fill" className="text-gray-400" />
                  <span>{[property.city, property.address].filter(Boolean).join(', ')}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <Users size={15} className="text-gray-400" />
                <span>Até {property.capacity} {property.capacity === 1 ? 'hóspede' : 'hóspedes'}</span>
              </div>
            </div>

            {property.description && (
              <div className="prose prose-sm max-w-none text-gray-700">
                <h3 className="text-base font-semibold text-gray-900 mb-1">Descrição</h3>
                <p className="whitespace-pre-line leading-relaxed">{property.description}</p>
              </div>
            )}
          </div>

          {/* Right: pricing + booking CTA */}
          <div className="md:col-span-1">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4 sticky top-20">
              <h3 className="font-semibold text-gray-900">Reservar</h3>

              {hasNightPrice && (
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-gray-600">
                    <Moon size={14} className="text-blue-500" /> Por noite
                  </span>
                  <span className="font-bold text-gray-900">
                    R$ {property.pricePerNight.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
              {hasMonthlyPrice && (
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-gray-600">
                    <Calendar size={14} className="text-green-500" /> Por mês
                  </span>
                  <span className="font-bold text-gray-900">
                    R$ {property.pricePerMonth.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              {!authLoading && (
                portalUser ? (
                  <div className="space-y-2">
                    <button
                      onClick={() => onBook(property.id, 'daily')}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
                    >
                      Solicitar reserva
                    </button>
                    {hasMonthlyPrice && (
                      <button
                        onClick={() => onBook(property.id, 'monthly')}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
                      >
                        Alugar por mês
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <button
                      onClick={() => onBook(property.id, 'daily')}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
                    >
                      Solicitar reserva
                    </button>
                    {hasMonthlyPrice && (
                      <button
                        onClick={() => onBook(property.id, 'monthly')}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
                      >
                        Alugar por mês
                      </button>
                    )}
                    <p className="text-xs text-gray-500 text-center">
                      Você pode solicitar como visitante ou{' '}
                      <button onClick={onLogin} className="text-blue-600 hover:underline">
                        entrar na sua conta
                      </button>
                    </p>
                  </div>
                )
              )}

              <p className="text-xs text-gray-400 text-center">
                Sujeito à aprovação do proprietário
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-gray-200 py-6 mt-10">
        <p className="text-center text-xs text-gray-400">Portal de reservas · {tenant.name}</p>
      </footer>
    </div>
  )
}
