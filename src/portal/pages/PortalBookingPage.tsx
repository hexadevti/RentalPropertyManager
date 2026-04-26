import { useEffect, useMemo, useState } from 'react'
import { fetchPortalProperty, checkPropertyAvailability, submitBookingRequest } from '../portalApi'
import { usePortalAuth } from '../PortalAuthContext'
import type { PortalTenant, PortalProperty } from '../types'
import { ArrowLeft, CheckCircle, WarningCircle, UserCirclePlus, CalendarBlank } from '@phosphor-icons/react'
import { PhoneInput } from '@/components/ui/phone-input'

interface PortalBookingPageProps {
  tenant: PortalTenant
  propertyId: string
  bookingMode?: 'daily' | 'monthly'
  onBack: () => void
  onSuccess: () => void
  onLogin: () => void
  onRegister: () => void
  onMyBookings: (email: string) => void
}

type AvailStatus = 'idle' | 'checking' | 'available' | 'unavailable' | 'error'

export function PortalBookingPage({ tenant, propertyId, bookingMode = 'daily', onBack, onSuccess, onLogin, onRegister, onMyBookings }: PortalBookingPageProps) {
  const { portalUser, isLoading: authLoading } = usePortalAuth()
  const isMonthlyFlow = bookingMode === 'monthly'
  const [property, setProperty] = useState<PortalProperty | null>(null)
  const [isLoadingProperty, setIsLoadingProperty] = useState(true)
  const [propertyLoadError, setPropertyLoadError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  // Form state
  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [estimatedMoveIn, setEstimatedMoveIn] = useState('')
  const [desiredMonths, setDesiredMonths] = useState<number | ''>('')
  const [guestsCount, setGuestsCount] = useState(1)
  const [notes, setNotes] = useState('')
  const [availStatus, setAvailStatus] = useState<AvailStatus>('idle')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Pre-fill from portal user
  useEffect(() => {
    if (portalUser) {
      setGuestName(portalUser.name)
      setGuestEmail(portalUser.email)
      setGuestPhone(portalUser.phone ?? '')
    }
  }, [portalUser])

  const loadProperty = async () => {
    setIsLoadingProperty(true)
    setPropertyLoadError(null)
    try {
      const result = await fetchPortalProperty(tenant.id, propertyId)
      setProperty(result)
      if (!result) setPropertyLoadError('Nao foi possivel carregar o anuncio.')
    } catch {
      setProperty(null)
      setPropertyLoadError('Nao foi possivel carregar o anuncio.')
    } finally {
      setIsLoadingProperty(false)
    }
  }

  useEffect(() => {
    void loadProperty()
  }, [tenant.id, propertyId])

  // Check availability when dates change
  useEffect(() => {
    if (isMonthlyFlow) { setAvailStatus('idle'); return }
    if (!checkIn || !checkOut) { setAvailStatus('idle'); return }
    if (checkOut <= checkIn) { setAvailStatus('idle'); return }

    setAvailStatus('checking')
    const timeout = setTimeout(async () => {
      try {
        const ok = await checkPropertyAvailability(
          tenant.id,
          propertyId,
          new Date(checkIn),
          new Date(checkOut),
        )
        setAvailStatus(ok ? 'available' : 'unavailable')
      } catch {
        setAvailStatus('error')
      }
    }, 500)
    return () => clearTimeout(timeout)
  }, [tenant.id, propertyId, checkIn, checkOut, isMonthlyFlow])

  const today = new Date().toISOString().slice(0, 10)

  const bookingSummary = useMemo(() => {
    if (isMonthlyFlow) return null
    if (!property || !checkIn || !checkOut || checkOut <= checkIn) return null

    const checkInDate = new Date(`${checkIn}T00:00:00`)
    const checkOutDate = new Date(`${checkOut}T00:00:00`)
    const nights = Math.round((checkOutDate.getTime() - checkInDate.getTime()) / 86400000)
    if (!Number.isFinite(nights) || nights <= 0) return null

    const nightlyRate = property.pricePerNight > 0
      ? property.pricePerNight
      : property.pricePerMonth > 0
        ? property.pricePerMonth / 30
        : 0

    if (nightlyRate <= 0) return { nights, total: null as number | null, mode: 'none' as const }

    return {
      nights,
      total: nightlyRate * nights,
      mode: property.pricePerNight > 0 ? 'nightly' as const : 'monthly-proportional' as const,
    }
  }, [property, checkIn, checkOut, isMonthlyFlow])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    const resolvedGuestName = (portalUser?.name ?? guestName).trim()
    const resolvedGuestEmail = (portalUser?.email ?? guestEmail).trim()
    const resolvedGuestPhone = (portalUser?.phone ?? guestPhone).trim()

    if (isMonthlyFlow) {
      if (!estimatedMoveIn) { setFormError('Informe a data estimada de entrada.'); return }
    } else {
      if (!checkIn || !checkOut) { setFormError('Informe as datas de entrada e saída.'); return }
      if (checkOut <= checkIn) { setFormError('A data de saída deve ser após a entrada.'); return }
      if (availStatus === 'unavailable') { setFormError('As datas selecionadas não estão disponíveis.'); return }
    }
    if (!resolvedGuestName || !resolvedGuestEmail) { setFormError('Nome e e-mail são obrigatórios.'); return }
    if (!resolvedGuestPhone) { setFormError('Informe seu telefone para contato sobre a reserva.'); return }
    if (resolvedGuestPhone.toUpperCase() === 'LEGACY-PHONE-REQUIRED') {
      setFormError('Informe um telefone válido para contato sobre a reserva.')
      return
    }

    setIsSubmitting(true)
    const result = await submitBookingRequest({
      tenantId: tenant.id,
      propertyId,
      guestId: portalUser?.id,
      portalUserId: portalUser?.authUserId ? portalUser.id : undefined,
      guestName: resolvedGuestName,
      guestEmail: resolvedGuestEmail,
      guestPhone: resolvedGuestPhone,
      requestType: isMonthlyFlow ? 'monthly' : 'short-term',
      checkIn: isMonthlyFlow ? undefined : checkIn,
      checkOut: isMonthlyFlow ? undefined : checkOut,
      estimatedMoveIn: isMonthlyFlow ? estimatedMoveIn : undefined,
      desiredMonths: isMonthlyFlow && desiredMonths ? desiredMonths : undefined,
      brokerContactRequested: isMonthlyFlow,
      guestsCount,
      notes: notes.trim() || undefined,
    })
    setIsSubmitting(false)

    if (!result) {
      setFormError('Erro ao enviar solicitação. Tente novamente.')
      return
    }

    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 max-w-sm w-full space-y-5">
          <div className="text-center space-y-3">
            <CheckCircle size={52} weight="fill" className="text-green-500 mx-auto" />
            <h2 className="text-xl font-bold text-gray-900">Solicitação enviada!</h2>
            <p className="text-sm text-gray-500">
              {isMonthlyFlow
                ? 'Recebemos seu interesse em aluguel mensal. Um corretor entrará em contato em breve pelo e-mail ou telefone informado.'
                : 'Sua solicitação foi recebida e está aguardando confirmação. Entraremos em contato pelo e-mail ou telefone informado.'}
            </p>
          </div>

          {/* Registration nudge (only shown to guests without account) */}
          {!portalUser && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
              <div className="flex items-start gap-2">
                <UserCirclePlus size={20} className="text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-blue-900">Acompanhe suas reservas</p>
                  <p className="text-xs text-blue-700 mt-0.5">
                    Crie uma conta gratuita para ver e gerenciar todas as suas reservas neste portal sem precisar informar o e-mail toda vez.
                  </p>
                </div>
              </div>
              <button
                onClick={onRegister}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
              >
                Criar conta
              </button>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <button
              onClick={() => onMyBookings((portalUser?.email ?? guestEmail).trim())}
              className="w-full flex items-center justify-center gap-2 border border-gray-300 hover:border-gray-400 text-gray-700 font-semibold py-2.5 rounded-xl text-sm transition-colors"
            >
              <CalendarBlank size={16} />
              Ver minhas reservas
            </button>
            <button
              onClick={onSuccess}
              className="w-full text-gray-500 hover:text-gray-700 text-sm py-2 transition-colors"
            >
              Voltar ao início
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (isLoadingProperty || authLoading) {
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
          <p className="text-gray-500">{propertyLoadError ?? 'Anuncio nao encontrado.'}</p>
          <div className="mt-3 flex items-center justify-center gap-4">
            {propertyLoadError && (
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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <button onClick={onBack} className="text-gray-500 hover:text-gray-800">
            <ArrowLeft size={20} />
          </button>
          <h1 className="font-bold text-gray-900">{isMonthlyFlow ? 'Alugar por mês' : 'Solicitar reserva'}</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        {property && (
          <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-6 flex items-center gap-3">
            {property.coverPhotoUrl ? (
              <img
                src={property.coverPhotoUrl}
                alt={property.name}
                className="w-16 h-16 rounded-xl object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">🏠</span>
              </div>
            )}
            <div>
              <p className="font-semibold text-gray-900">{property.name}</p>
              {(property.city || property.address) && (
                <p className="text-xs text-gray-500">{property.city ?? property.address}</p>
              )}
            </div>
          </div>
        )}

        <form onSubmit={e => void handleSubmit(e)} className="space-y-6">
          {/* Dates */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
            <h3 className="font-semibold text-gray-900">{isMonthlyFlow ? 'Entrada estimada' : 'Datas'}</h3>
            {isMonthlyFlow ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Data estimada para entrada *</label>
                    <input
                      type="date"
                      value={estimatedMoveIn}
                      min={today}
                      onChange={e => setEstimatedMoveIn(e.target.value)}
                      required
                      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Prazo desejado (meses)</label>
                    <input
                      type="number"
                      min={1}
                      value={desiredMonths}
                      onChange={e => setDesiredMonths(e.target.value ? Math.max(1, parseInt(e.target.value) || 1) : '')}
                      placeholder="Ex.: 12"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                </div>
                <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2.5">
                  <p className="text-sm text-emerald-900">
                    Um corretor entrará em contato para apresentar as opções e alinhar os próximos passos da locação mensal.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Check-in *</label>
                    <input
                      type="date"
                      value={checkIn}
                      min={today}
                      onChange={e => setCheckIn(e.target.value)}
                      required
                      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Check-out *</label>
                    <input
                      type="date"
                      value={checkOut}
                      min={checkIn || today}
                      onChange={e => setCheckOut(e.target.value)}
                      required
                      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Availability indicator */}
                {availStatus === 'checking' && (
                  <p className="text-xs text-gray-500 flex items-center gap-1.5">
                    <span className="inline-block w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                    Verificando disponibilidade...
                  </p>
                )}
                {availStatus === 'available' && (
                  <p className="text-xs text-green-600 flex items-center gap-1.5">
                    <CheckCircle size={14} weight="fill" />
                    Datas disponíveis
                  </p>
                )}
                {availStatus === 'unavailable' && (
                  <p className="text-xs text-red-600 flex items-center gap-1.5">
                    <WarningCircle size={14} weight="fill" />
                    Datas indisponíveis. Escolha outro período.
                  </p>
                )}

                {bookingSummary && (
                  <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2.5 space-y-1.5">
                    <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide">Resumo da reserva</p>
                    <p className="text-sm text-blue-900">
                      {bookingSummary.nights} {bookingSummary.nights === 1 ? 'diária' : 'diárias'}
                    </p>
                    {bookingSummary.total !== null ? (
                      <p className="text-sm font-semibold text-blue-900">
                        Valor estimado: R$ {bookingSummary.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    ) : (
                      <p className="text-sm text-blue-900">Valor estimado indisponível para este imóvel.</p>
                    )}
                    {bookingSummary.mode === 'monthly-proportional' && (
                      <p className="text-xs text-blue-700">
                        Estimativa calculada de forma proporcional ao valor mensal.
                      </p>
                    )}
                  </div>
                )}
              </>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Número de hóspedes *
              </label>
              <input
                type="number"
                value={guestsCount}
                min={1}
                max={property?.capacity ?? 99}
                onChange={e => setGuestsCount(Math.max(1, parseInt(e.target.value) || 1))}
                required
                className="w-32 border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {property && (
                <span className="text-xs text-gray-400 ml-2">
                  Capacidade máxima: {property.capacity}
                </span>
              )}
            </div>
          </div>

          {/* Guest info */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Seus dados</h3>
              {!portalUser && (
                <button
                  type="button"
                  onClick={onLogin}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Entrar para preencher automaticamente
                </button>
              )}
            </div>

            {portalUser ? (
              <div className="rounded-lg border border-green-100 bg-green-50 p-3 text-sm text-green-900 space-y-1">
                <p><strong>Nome:</strong> {portalUser.name}</p>
                <p><strong>E-mail:</strong> {portalUser.email}</p>
                <p><strong>Telefone:</strong> {portalUser.phone || 'Nao informado'}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Nome *</label>
                  <input
                    type="text"
                    value={guestName}
                    onChange={e => setGuestName(e.target.value)}
                    required
                    placeholder="Seu nome completo"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">E-mail *</label>
                  <input
                    type="email"
                    value={guestEmail}
                    onChange={e => setGuestEmail(e.target.value)}
                    required
                    placeholder="seu@email.com"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Telefone *
                  </label>
                  <PhoneInput
                    value={guestPhone}
                    onValueChange={setGuestPhone}
                    required
                    placeholder="11 99999-0000"
                    className="focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
            <h3 className="font-semibold text-gray-900">Observações (opcional)</h3>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Descreva suas necessidades ou perguntas para o proprietário..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {formError && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex items-start gap-2">
              <WarningCircle size={16} weight="fill" className="flex-shrink-0 mt-0.5" />
              {formError}
            </div>
          )}

          {/* Registration nudge for guests without account */}
          {!portalUser && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex items-start gap-3">
              <UserCirclePlus size={20} className="text-blue-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700">
                  <strong>Quer acompanhar sua reserva?</strong> Crie uma conta gratuita para ver o status, receber atualizações e cancelar se necessário.
                </p>
                <div className="flex items-center gap-3 mt-2">
                  <button
                    type="button"
                    onClick={onRegister}
                    className="text-sm text-blue-600 font-semibold hover:underline"
                  >
                    Criar conta
                  </button>
                  <span className="text-gray-300">·</span>
                  <button
                    type="button"
                    onClick={onLogin}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Já tenho conta
                  </button>
                </div>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || (!isMonthlyFlow && availStatus === 'unavailable')}
            className={`w-full disabled:opacity-50 text-white font-semibold py-3.5 rounded-xl text-sm transition-colors ${isMonthlyFlow ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {isSubmitting ? 'Enviando...' : isMonthlyFlow ? 'Solicitar contato do corretor' : 'Enviar solicitação de reserva'}
          </button>

          <p className="text-xs text-gray-400 text-center">
            {isMonthlyFlow
              ? 'Ao solicitar contato, um corretor fará o atendimento para concluir a proposta de locação mensal.'
              : 'Ao enviar, você concorda que a reserva está sujeita à aprovação do proprietário. Nenhum pagamento é cobrado agora.'}
          </p>
        </form>
      </main>
    </div>
  )
}
