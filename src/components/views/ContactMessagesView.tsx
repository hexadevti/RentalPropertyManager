import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowsClockwise, ChatCircleDots } from '@phosphor-icons/react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { supabase } from '@/lib/supabase'
import { useLanguage } from '@/lib/LanguageContext'
import type { ContactMessage, ContactMessageStatus } from '@/types'

function statusClass(status: ContactMessageStatus) {
  switch (status) {
    case 'open': return 'border-red-200 bg-red-50 text-red-700'
    case 'in-review': return 'border-amber-200 bg-amber-50 text-amber-700'
    case 'answered': return 'border-emerald-200 bg-emerald-50 text-emerald-700'
    case 'archived': return 'border-muted bg-muted text-muted-foreground'
  }
}

function mapContactMessage(row: any): ContactMessage {
  return {
    id: row.id,
    tenantId: row.tenant_id || undefined,
    senderAuthUserId: row.sender_auth_user_id || undefined,
    senderLogin: row.sender_login,
    senderEmail: row.sender_email || undefined,
    subject: row.subject,
    description: row.description,
    currentUrl: row.current_url || undefined,
    status: row.status,
    adminNotes: row.admin_notes || undefined,
    emailSentAt: row.email_sent_at || undefined,
    deliveryError: row.delivery_error || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export default function ContactMessagesView() {
  const { t } = useLanguage()
  const [messages, setMessages] = useState<ContactMessage[]>([])
  const [statusFilter, setStatusFilter] = useState<ContactMessageStatus | 'active' | 'all'>('active')
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({})

  const statusLabels: Record<ContactMessageStatus, string> = {
    open: t.contact_messages_view.status.open,
    'in-review': t.contact_messages_view.status.in_review,
    answered: t.contact_messages_view.status.answered,
    archived: t.contact_messages_view.status.archived,
  }

  const loadMessages = useCallback(async () => {
    setIsLoading(true)
    const { data, error } = await supabase
      .from('contact_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(300)

    if (error) {
      toast.error(error.message || t.contact_messages_view.load_error)
      setMessages([])
      setNotesDraft({})
    } else {
      const loadedMessages = (data || []).map(mapContactMessage)
      setMessages(loadedMessages)
      setNotesDraft(Object.fromEntries(loadedMessages.map((message) => [message.id, message.adminNotes || ''])))
    }

    setIsLoading(false)
  }, [t.contact_messages_view.load_error])

  useEffect(() => {
    void loadMessages()
  }, [loadMessages])

  const filteredMessages = useMemo(() => {
    return messages.filter((message) => {
      if (statusFilter === 'active' && !['open', 'in-review'].includes(message.status)) return false
      if (statusFilter !== 'all' && statusFilter !== 'active' && message.status !== statusFilter) return false

      const term = search.trim().toLowerCase()
      if (!term) return true
      return [
        message.senderLogin,
        message.senderEmail || '',
        message.subject,
        message.description,
        message.currentUrl || '',
      ].some((value) => value.toLowerCase().includes(term))
    })
  }, [messages, search, statusFilter])

  const updateMessage = async (message: ContactMessage, status: ContactMessageStatus) => {
    setSavingId(message.id)
    const adminNotes = notesDraft[message.id]?.trim() || null
    const { error } = await supabase
      .from('contact_messages')
      .update({
        status,
        admin_notes: adminNotes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', message.id)

    setSavingId(null)

    if (error) {
      toast.error(error.message || t.contact_messages_view.update_error)
      return
    }

    setMessages((current) => current.map((item) => (
      item.id === message.id
        ? { ...item, status, adminNotes: adminNotes || undefined, updatedAt: new Date().toISOString() }
        : item
    )))
    toast.success(t.contact_messages_view.updated_success)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t.contact_messages_view.title}</h2>
          <p className="text-muted-foreground mt-1">{t.contact_messages_view.subtitle}</p>
        </div>
        <Button variant="outline" onClick={() => void loadMessages()} disabled={isLoading} className="gap-2">
          <ArrowsClockwise size={16} />
          {isLoading ? t.contact_messages_view.refreshing : t.common.refresh}
        </Button>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t.contact_messages_view.search_placeholder}
        />
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as ContactMessageStatus | 'active' | 'all')}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.contact_messages_view.filter_all_status}</SelectItem>
            <SelectItem value="active">{t.contact_messages_view.filter_active}</SelectItem>
            {Object.entries(statusLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filteredMessages.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <ChatCircleDots size={64} weight="duotone" className="text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">{t.contact_messages_view.no_results}</h3>
            <p className="text-sm text-muted-foreground">{t.contact_messages_view.no_results_hint}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredMessages.map((message) => (
            <Card key={message.id}>
              <CardHeader>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <CardTitle className="flex flex-wrap items-center gap-2">
                      <ChatCircleDots size={18} weight="duotone" />
                      {message.subject}
                      <Badge variant="outline" className={statusClass(message.status)}>
                        {statusLabels[message.status]}
                      </Badge>
                    </CardTitle>
                    <CardDescription className="mt-2">
                      {message.senderLogin} {message.senderEmail ? `- ${message.senderEmail}` : ''}
                      {' | '}
                      {format(new Date(message.createdAt), 'dd/MM/yyyy HH:mm')}
                    </CardDescription>
                  </div>
                  <div className="min-w-[220px]">
                    <Select
                      value={message.status}
                      onValueChange={(value) => void updateMessage(message, value as ContactMessageStatus)}
                      disabled={savingId === message.id}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(statusLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-border p-3 text-sm whitespace-pre-wrap">
                  {message.description}
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
                    <p><strong>{t.contact_messages_view.email_sent_at}:</strong> {message.emailSentAt ? format(new Date(message.emailSentAt), 'dd/MM/yyyy HH:mm') : t.contact_messages_view.not_sent}</p>
                    <p><strong>{t.contact_messages_view.current_url}:</strong> {message.currentUrl || '-'}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
                    <p><strong>{t.contact_messages_view.delivery_error}:</strong> {message.deliveryError || '-'}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{t.contact_messages_view.notes_label}</Label>
                  <Textarea
                    value={notesDraft[message.id] || ''}
                    onChange={(event) => setNotesDraft((current) => ({ ...current, [message.id]: event.target.value }))}
                    rows={3}
                    placeholder={t.contact_messages_view.notes_placeholder}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={savingId === message.id}
                    onClick={() => void updateMessage(message, message.status)}
                  >
                    {t.contact_messages_view.save_notes}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
