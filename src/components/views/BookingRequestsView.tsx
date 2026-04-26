import { useEffect, useState, useCallback, useMemo } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { useLanguage } from '@/lib/LanguageContext'
import { fetchTenantBookingRequests, updateBookingRequestStatus, deleteBookingRequest } from '@/portal/portalApi'
import type { BookingRequest, BookingRequestStatus } from '@/portal/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { MagnifyingGlass, Calendar, User, Envelope, Phone, CheckCircle, XCircle, Clock, ArrowsClockwise, Trash, PencilSimple } from '@phosphor-icons/react'
import { format, parseISO } from 'date-fns'
import { enUS, ptBR } from 'date-fns/locale'

const STATUS_VARIANTS: Record<BookingRequestStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'secondary',
  approved: 'default',
  rejected: 'destructive',
  cancelled: 'outline',
}

type RequestWithProperty = BookingRequest & { propertyName?: string }

export default function BookingRequestsView() {
  const { currentTenantId } = useAuth()
  const { t, language } = useLanguage()
  const [requests, setRequests] = useState<RequestWithProperty[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<BookingRequestStatus | 'all'>('all')
  const [selectedRequest, setSelectedRequest] = useState<RequestWithProperty | null>(null)
  const [adminNotes, setAdminNotes] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const statusLabels: Record<BookingRequestStatus, string> = useMemo(() => ({
    pending: t.booking_requests_view.status_labels.pending,
    approved: t.booking_requests_view.status_labels.approved,
    rejected: t.booking_requests_view.status_labels.rejected,
    cancelled: t.booking_requests_view.status_labels.cancelled,
  }), [t])

  const requestTypeLabels: Record<BookingRequest['requestType'], string> = useMemo(() => ({
    'short-term': t.booking_requests_view.request_type_labels.short_term,
    monthly: t.booking_requests_view.request_type_labels.monthly,
  }), [t])

  const loadRequests = useCallback(async () => {
    if (!currentTenantId) return
    setIsLoading(true)
    const data = await fetchTenantBookingRequests(currentTenantId)
    setRequests(data)
    setIsLoading(false)
  }, [currentTenantId])

  useEffect(() => { void loadRequests() }, [loadRequests])

  const openRequest = (req: RequestWithProperty) => {
    setSelectedRequest(req)
    setAdminNotes(req.adminNotes ?? '')
  }

  const handleStatusUpdate = async (newStatus: BookingRequestStatus) => {
    if (!selectedRequest) return
    setIsUpdating(true)
    const ok = await updateBookingRequestStatus(selectedRequest.id, newStatus, adminNotes || undefined)
    setIsUpdating(false)

    if (ok) {
      toast.success(
        t.booking_requests_view.toast_status_updated.replace('{status}', statusLabels[newStatus].toLowerCase())
      )
      setSelectedRequest(null)
      await loadRequests()
    } else {
      toast.error(t.booking_requests_view.toast_update_error)
    }
  }

  const handleDeleteRequestById = async (requestId: string) => {
    if (!currentTenantId) {
      toast.error(t.booking_requests_view.toast_tenant_missing)
      return
    }

    const confirmed = window.confirm(t.booking_requests_view.confirm_delete)
    if (!confirmed) return

    setIsDeleting(true)
    const result = await deleteBookingRequest(currentTenantId, requestId)
    setIsDeleting(false)

    if (!result.ok) {
      toast.error(result.error || t.booking_requests_view.toast_delete_error)
      return
    }

    toast.success(t.booking_requests_view.toast_delete_success)
    if (selectedRequest?.id === requestId) {
      setSelectedRequest(null)
    }
    await loadRequests()
  }

  const filtered = requests.filter(r => {
    if (filterStatus !== 'all' && r.status !== filterStatus) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      return (
        r.guestName.toLowerCase().includes(q) ||
        r.guestEmail.toLowerCase().includes(q) ||
        (r.propertyName?.toLowerCase().includes(q) ?? false)
      )
    }
    return true
  })

  const pendingCount = requests.filter(r => r.status === 'pending').length
  const dateLocale = language === 'en' ? enUS : ptBR
  const dateFormat = language === 'en' ? 'MM/dd/yyyy' : 'dd/MM/yyyy'
  const dateTimeFormat = language === 'en' ? "MM/dd/yyyy 'at' HH:mm" : "dd/MM/yyyy 'às' HH:mm"

  const formatDate = (d: string | null) => {
    if (!d) return '-'
    try { return format(parseISO(d), dateFormat, { locale: dateLocale }) } catch { return d }
  }

  const formatDateTime = (d: string) => {
    try { return format(parseISO(d), dateTimeFormat, { locale: dateLocale }) } catch { return d }
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t.booking_requests_view.title}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {t.booking_requests_view.description}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {pendingCount} {pendingCount === 1 ? t.booking_requests_view.pending_badge_one : t.booking_requests_view.pending_badge_other}
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={() => void loadRequests()} disabled={isLoading}>
            <ArrowsClockwise size={14} className={isLoading ? 'animate-spin' : ''} />
            {t.booking_requests_view.refresh}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <MagnifyingGlass size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t.booking_requests_view.search_placeholder}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['all', 'pending', 'approved', 'rejected', 'cancelled'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterStatus === s
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              {s === 'all' ? t.booking_requests_view.filter_all : statusLabels[s]}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Calendar size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">{t.booking_requests_view.empty_title}</p>
            {filterStatus !== 'all' && (
              <p className="text-sm mt-1">{t.booking_requests_view.empty_filtered_hint}</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(req => (
            <Card
              key={req.id}
              className="hover:shadow-md transition-shadow"
            >
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-foreground truncate">
                      {req.guestName}
                    </span>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {requestTypeLabels[req.requestType]}
                    </Badge>
                    <Badge variant={STATUS_VARIANTS[req.status]} className="text-xs shrink-0">
                      {statusLabels[req.status]}
                    </Badge>
                  </div>
                  {req.propertyName && (
                    <p className="text-xs text-muted-foreground">
                      {t.booking_requests_view.property_label}: <span className="font-medium">{req.propertyName}</span>
                    </p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                    {req.requestType === 'monthly' ? (
                      <span className="flex items-center gap-1">
                        <Calendar size={11} />
                        {t.booking_requests_view.estimated_move_in}: {formatDate(req.estimatedMoveIn)}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <Calendar size={11} />
                        {formatDate(req.checkIn)} → {formatDate(req.checkOut)}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <User size={11} />
                      {req.guestsCount} {req.guestsCount === 1 ? t.booking_requests_view.guest_one : t.booking_requests_view.guest_other}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-xs text-muted-foreground">
                    {formatDateTime(req.createdAt)}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openRequest(req)}
                    disabled={isDeleting}
                  >
                    <PencilSimple size={14} />
                    {t.booking_requests_view.edit}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => void handleDeleteRequestById(req.id)}
                    disabled={isDeleting}
                  >
                    <Trash size={14} />
                    {isDeleting ? t.booking_requests_view.deleting : t.booking_requests_view.delete}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={!!selectedRequest} onOpenChange={open => !open && setSelectedRequest(null)}>
        <DialogContent className="max-w-lg">
          {selectedRequest && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {t.booking_requests_view.dialog_title}
                  <Badge variant={STATUS_VARIANTS[selectedRequest.status]} className="text-xs">
                    {statusLabels[selectedRequest.status]}
                  </Badge>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-1">
                {/* Property */}
                {selectedRequest.propertyName && (
                  <div className="bg-muted/50 rounded-lg p-3 text-sm">
                    <span className="font-medium">{t.booking_requests_view.property_label}:</span> {selectedRequest.propertyName}
                    <span className="mx-2 text-muted-foreground">·</span>
                    <span className="font-medium">{t.booking_requests_view.type_label}:</span> {requestTypeLabels[selectedRequest.requestType]}
                  </div>
                )}

                {/* Guest */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">{t.booking_requests_view.guest_section}</p>
                  <div className="grid grid-cols-1 gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <User size={14} className="text-muted-foreground" />
                      <span>{selectedRequest.guestName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Envelope size={14} className="text-muted-foreground" />
                      <a href={`mailto:${selectedRequest.guestEmail}`} className="text-blue-600 hover:underline">
                        {selectedRequest.guestEmail}
                      </a>
                    </div>
                    {selectedRequest.guestPhone && (
                      <div className="flex items-center gap-2">
                        <Phone size={14} className="text-muted-foreground" />
                        <span>{selectedRequest.guestPhone}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Request timing */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                    {selectedRequest.requestType === 'monthly'
                      ? t.booking_requests_view.monthly_timing_section
                      : t.booking_requests_view.timing_section}
                  </p>
                  <div className="flex items-center gap-3 text-sm">
                    {selectedRequest.requestType === 'monthly' ? (
                      <span className="flex items-center gap-1.5">
                        <Calendar size={14} className="text-muted-foreground" />
                        {t.booking_requests_view.estimated_move_in}: {formatDate(selectedRequest.estimatedMoveIn)}
                      </span>
                    ) : (
                      <>
                        <span className="flex items-center gap-1.5">
                          <Calendar size={14} className="text-muted-foreground" />
                          {formatDate(selectedRequest.checkIn)}
                        </span>
                        <span className="text-muted-foreground">→</span>
                        <span>{formatDate(selectedRequest.checkOut)}</span>
                        <span className="text-muted-foreground">·</span>
                      </>
                    )}
                    <span className="flex items-center gap-1">
                      <User size={13} className="text-muted-foreground" />
                      {selectedRequest.guestsCount} {selectedRequest.guestsCount === 1 ? t.booking_requests_view.guest_one : t.booking_requests_view.guest_other}
                    </span>
                  </div>
                  {selectedRequest.requestType === 'monthly' && (
                    <div className="text-xs text-muted-foreground space-y-1">
                      {selectedRequest.desiredMonths && (
                        <p>
                          {t.booking_requests_view.desired_term}: {selectedRequest.desiredMonths} {selectedRequest.desiredMonths === 1 ? t.booking_requests_view.month_one : t.booking_requests_view.month_other}
                        </p>
                      )}
                      {selectedRequest.brokerContactRequested && (
                        <p>{t.booking_requests_view.broker_contact_requested}</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Guest notes */}
                {selectedRequest.notes && (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                      {t.booking_requests_view.guest_notes_title}
                    </p>
                    <p className="text-sm text-foreground bg-muted/50 rounded-lg p-3 whitespace-pre-line">
                      {selectedRequest.notes}
                    </p>
                  </div>
                )}

                {/* Admin notes */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                    {t.booking_requests_view.admin_notes_label}
                  </label>
                  <Textarea
                    value={adminNotes}
                    onChange={e => setAdminNotes(e.target.value)}
                    placeholder={t.booking_requests_view.admin_notes_placeholder}
                    rows={2}
                    className="text-sm resize-none"
                    disabled={isUpdating}
                  />
                </div>

                <p className="text-xs text-muted-foreground">
                  {t.booking_requests_view.received_at.replace('{date}', formatDateTime(selectedRequest.createdAt))}
                </p>
              </div>

              <DialogFooter className="gap-2 flex-wrap">
                {selectedRequest.status === 'pending' && (
                  <>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => void handleStatusUpdate('rejected')}
                      disabled={isUpdating || isDeleting}
                    >
                      <XCircle size={14} />
                      {t.booking_requests_view.reject}
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => void handleStatusUpdate('approved')}
                      disabled={isUpdating || isDeleting}
                    >
                      <CheckCircle size={14} />
                      {t.booking_requests_view.approve}
                    </Button>
                  </>
                )}
                {selectedRequest.status === 'approved' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleStatusUpdate('cancelled')}
                    disabled={isUpdating || isDeleting}
                  >
                    <XCircle size={14} />
                    {t.booking_requests_view.cancel_booking}
                  </Button>
                )}
                {(selectedRequest.status === 'rejected' || selectedRequest.status === 'cancelled') && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleStatusUpdate('pending')}
                    disabled={isUpdating || isDeleting}
                  >
                    <Clock size={14} />
                    {t.booking_requests_view.reopen_pending}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedRequest(null)}
                  disabled={isUpdating || isDeleting}
                >
                  {t.booking_requests_view.close}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
