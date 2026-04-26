import { useEffect, useState } from 'react'
import { fetchLoggedGuestBookings, cancelGuestBookingForLoggedUser } from '../portalApi'
import { usePortalAuth } from '../PortalAuthContext'
import type { PortalTenant, GuestBooking } from '../types'
import { ArrowLeft, CalendarBlank, House, XCircle } from '@phosphor-icons/react'

interface PortalMyBookingsPageProps {
  tenant: PortalTenant
  onBack: () => void
  onLogin: () => void
  onRegister: () => void
}

type PageState = 'results' | 'loading' | 'error'

const STATUS_LABEL: Record<GuestBooking['status'], string> = {
  pending:   'Aguardando confirmação',
  approved:  'Confirmada',
  rejected:  'Recusada',
  cancelled: 'Cancelada',
}

const STATUS_COLOR: Record<GuestBooking['status'], string> = {
  pending:   'bg-yellow-50 text-yellow-700 border-yellow-200',
  approved:  'bg-green-50 text-green-700 border-green-200',
  rejected:  'bg-red-50 text-red-700 border-red-200',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
}

function formatDate(iso: string | null) {
  if (!iso) return '-'
  const [year, month, day] = iso.slice(0, 10).split('-')
  return `${day}/${month}/${year}`
}

function nightsBetween(checkIn: string | null, checkOut: string | null) {
  if (!checkIn || !checkOut) return 0
  const a = new Date(`${checkIn}T00:00:00`)
  const b = new Date(`${checkOut}T00:00:00`)
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000))
}

export function PortalMyBookingsPage({ tenant, onBack, onLogin, onRegister }: PortalMyBookingsPageProps) {
  const { portalUser, isLoading: authLoading } = usePortalAuth()
  const [pageState, setPageState] = useState<PageState>('loading')
  const [bookings, setBookings] = useState<GuestBooking[]>([])
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [cancelError, setCancelError] = useState<string | null>(null)

  async function doSearch(guestId: string) {
    setPageState('loading')
    setCancelError(null)
    try {
      const results = await fetchLoggedGuestBookings(tenant.id, guestId)
      setBookings(results)
      setPageState('results')
    } catch {
      setPageState('error')
    }
  }

  useEffect(() => {
    if (authLoading) return
    if (!portalUser?.id) {
      setPageState('results')
      setBookings([])
      return
    }
    void doSearch(portalUser.id)
  }, [authLoading, portalUser?.id, tenant.id])

  const handleCancel = async (booking: GuestBooking) => {
    if (!window.confirm('Tem certeza que deseja cancelar esta solicitação de reserva?')) return
    setCancellingId(booking.id)
    setCancelError(null)
    try {
      if (!portalUser?.id) {
        setCancelError('Sessao de usuario invalida. Entre novamente no portal.')
        return
      }

      const ok = await cancelGuestBookingForLoggedUser(tenant.id, portalUser.id, booking.id)
      if (ok) {
        setBookings(prev =>
          prev.map(b => b.id === booking.id ? { ...b, status: 'cancelled' as const } : b),
        )
      } else {
        setCancelError('Não foi possível cancelar esta reserva. Ela pode já ter sido confirmada ou cancelada.')
      }
    } catch {
      setCancelError('Erro ao tentar cancelar. Tente novamente.')
    } finally {
      setCancellingId(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button
            onClick={onBack}
            className="text-gray-500 hover:text-gray-800 transition-colors"
            aria-label="Voltar"
          >
            <ArrowLeft size={22} />
          </button>
          <h1 className="text-lg font-bold text-gray-900">Minhas reservas</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {!authLoading && !portalUser && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 text-center space-y-3">
            <h2 className="font-semibold text-gray-900">Entre para ver suas solicitações</h2>
            <p className="text-sm text-gray-500">
              Suas solicitações aparecem automaticamente quando você está logado no portal.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={onLogin}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
              >
                Entrar
              </button>
              <button
                onClick={onRegister}
                className="text-blue-600 hover:underline text-sm font-medium"
              >
                Criar conta
              </button>
            </div>
          </div>
        )}

        {/* Loading */}
        {pageState === 'loading' && (
          <div className="flex justify-center py-10">
            <div className="h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Error */}
        {pageState === 'error' && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
            Erro ao buscar reservas. Tente novamente.
          </div>
        )}

        {/* Results */}
        {portalUser && pageState === 'results' && (
          <div className="space-y-4">
            {cancelError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
                {cancelError}
              </div>
            )}

            {bookings.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center space-y-2">
                <CalendarBlank size={36} className="text-gray-300 mx-auto" />
                <p className="text-gray-500 text-sm">
                  Nenhuma solicitacao encontrada para sua conta.
                </p>
                <p className="text-gray-400 text-xs">
                  As solicitacoes exibidas aqui sao apenas as vinculadas ao usuario logado.
                </p>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-500">
                  {bookings.length} {bookings.length === 1 ? 'solicitacao encontrada' : 'solicitacoes encontradas'} para sua conta
                </p>
                {bookings.map(booking => {
                  const nights = nightsBetween(booking.checkIn, booking.checkOut)
                  const isMonthly = booking.requestType === 'monthly'
                  const isCancelling = cancellingId === booking.id
                  const currentStatus = booking.status
                  const coverPhotoUrl = booking.coverPhotoUrl

                  return (
                    <div
                      key={booking.id}
                      className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-3"
                    >
                      {/* Property + status */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          {coverPhotoUrl ? (
                            <img
                              src={coverPhotoUrl}
                              alt={booking.propertyName ?? 'Imóvel'}
                              className="h-12 w-16 rounded-md object-cover border border-gray-200 shrink-0"
                            />
                          ) : (
                            <div className="h-12 w-16 rounded-md border border-gray-200 bg-gray-100 flex items-center justify-center shrink-0">
                              <House size={18} className="text-gray-400" />
                            </div>
                          )}
                          <span className="font-semibold text-gray-900 truncate text-sm">
                            {booking.propertyName ?? 'Imóvel'}
                          </span>
                          <span className="text-[11px] border border-gray-200 rounded-full px-2 py-0.5 text-gray-500 shrink-0">
                            {isMonthly ? 'Aluguel mensal' : 'Reserva por diária'}
                          </span>
                        </div>
                        <span className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_COLOR[currentStatus]}`}>
                          {STATUS_LABEL[currentStatus]}
                        </span>
                      </div>

                      {/* Dates */}
                      {isMonthly ? (
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <div>
                            <span className="text-xs text-gray-400 block">Entrada estimada</span>
                            <span className="font-medium">{formatDate(booking.estimatedMoveIn)}</span>
                          </div>
                          {booking.desiredMonths && (
                            <div>
                              <span className="text-xs text-gray-400 block">Prazo desejado</span>
                              <span className="font-medium">{booking.desiredMonths} {booking.desiredMonths === 1 ? 'mês' : 'meses'}</span>
                            </div>
                          )}
                          <div className="ml-auto text-xs text-gray-400">
                            {booking.guestsCount} {booking.guestsCount === 1 ? 'hóspede' : 'hóspedes'}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <div>
                            <span className="text-xs text-gray-400 block">Entrada</span>
                            <span className="font-medium">{formatDate(booking.checkIn)}</span>
                          </div>
                          <div className="text-gray-300">→</div>
                          <div>
                            <span className="text-xs text-gray-400 block">Saída</span>
                            <span className="font-medium">{formatDate(booking.checkOut)}</span>
                          </div>
                          <div className="ml-auto text-xs text-gray-400">
                            {nights} {nights === 1 ? 'noite' : 'noites'} · {booking.guestsCount} {booking.guestsCount === 1 ? 'hóspede' : 'hóspedes'}
                          </div>
                        </div>
                      )}

                      {/* Admin notes (feedback) */}
                      {booking.adminNotes && (
                        <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-600">
                          <span className="font-medium">Mensagem do proprietário: </span>
                          {booking.adminNotes}
                        </div>
                      )}

                      {/* Cancel action */}
                      {currentStatus === 'pending' && (
                        <button
                          onClick={() => void handleCancel(booking)}
                          disabled={isCancelling}
                          className="flex items-center gap-1.5 text-sm text-red-600 hover:text-red-800 disabled:opacity-50 transition-colors"
                        >
                          <XCircle size={16} />
                          {isCancelling ? 'Cancelando...' : 'Solicitar cancelamento'}
                        </button>
                      )}
                    </div>
                  )
                })}
              </>
            )}
          </div>
        )}

      </main>
    </div>
  )
}
