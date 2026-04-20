import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bug, ArrowsClockwise } from '@phosphor-icons/react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthContext'
import type { BugReport, BugReportAttachment, BugReportStatus } from '@/types'
import { BugAttachmentPreview } from '@/components/BugAttachmentPreview'

const statusLabels: Record<BugReportStatus, string> = {
  open: 'Aberto',
  'in-review': 'Em análise',
  resolved: 'Resolvido',
  dismissed: 'Descartado',
}

function statusClass(status: BugReportStatus) {
  switch (status) {
    case 'open': return 'border-red-200 bg-red-50 text-red-700'
    case 'in-review': return 'border-amber-200 bg-amber-50 text-amber-700'
    case 'resolved': return 'border-emerald-200 bg-emerald-50 text-emerald-700'
    case 'dismissed': return 'border-muted bg-muted text-muted-foreground'
  }
}

function mapBugReport(row: any): BugReport {
  return {
    id: row.id,
    tenantId: row.tenant_id || undefined,
    reporterAuthUserId: row.reporter_auth_user_id || undefined,
    reporterLogin: row.reporter_login,
    reporterEmail: row.reporter_email || undefined,
    screen: row.screen,
    screenLabel: row.screen_label,
    recordId: row.record_id || undefined,
    recordLabel: row.record_label || undefined,
    description: row.description,
    status: row.status,
    resolutionNotes: row.resolution_notes || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapAttachment(row: any): BugReportAttachment {
  return {
    id: row.id,
    bugReportId: row.bug_report_id,
    fileName: row.file_name,
    filePath: row.file_path,
    fileSize: row.file_size || undefined,
    mimeType: row.mime_type || undefined,
    createdAt: row.created_at,
  }
}

export default function MyBugReportsView() {
  const { currentUser } = useAuth()
  const [reports, setReports] = useState<BugReport[]>([])
  const [attachments, setAttachments] = useState<BugReportAttachment[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<BugReportStatus | 'all'>('all')
  const [search, setSearch] = useState('')

  const loadReports = useCallback(async () => {
    if (!currentUser?.id) {
      setReports([])
      setAttachments([])
      return
    }

    setIsLoading(true)
    const { data, error } = await supabase
      .from('bug_reports')
      .select('*')
      .eq('reporter_auth_user_id', currentUser.id)
      .order('created_at', { ascending: false })

    if (error) {
      toast.error(error.message || 'Falha ao carregar bugs reportados.')
      setReports([])
      setAttachments([])
      setIsLoading(false)
      return
    }

    const loadedReports = (data || []).map(mapBugReport)
    setReports(loadedReports)

    const reportIds = loadedReports.map((report) => report.id)
    if (reportIds.length === 0) {
      setAttachments([])
      setIsLoading(false)
      return
    }

    const { data: attachmentRows, error: attachmentError } = await supabase
      .from('bug_report_attachments')
      .select('*')
      .in('bug_report_id', reportIds)
      .order('created_at', { ascending: true })

    if (attachmentError) {
      console.warn('Failed to load bug attachments:', attachmentError)
      setAttachments([])
    } else {
      setAttachments((attachmentRows || []).map(mapAttachment))
    }

    setIsLoading(false)
  }, [currentUser?.id])

  useEffect(() => {
    void loadReports()
  }, [loadReports])

  const attachmentsByReport = useMemo(() => {
    const grouped = new Map<string, BugReportAttachment[]>()
    attachments.forEach((attachment) => {
      grouped.set(attachment.bugReportId, [...(grouped.get(attachment.bugReportId) || []), attachment])
    })
    return grouped
  }, [attachments])

  const filteredReports = reports.filter((report) => {
    if (statusFilter !== 'all' && report.status !== statusFilter) return false
    const term = search.trim().toLowerCase()
    if (!term) return true
    return [
      report.screenLabel,
      report.recordLabel || '',
      report.description,
      statusLabels[report.status],
    ].some((value) => value.toLowerCase().includes(term))
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Bugs reportados</h2>
          <p className="text-muted-foreground mt-1">
            Acompanhe o status das solicitações reportadas para o seu tenant.
          </p>
        </div>
        <Button variant="outline" onClick={() => void loadReports()} disabled={isLoading} className="gap-2">
          <ArrowsClockwise size={16} />
          {isLoading ? 'Atualizando...' : 'Atualizar'}
        </Button>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por tela, registro, descrição ou status..."
        />
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as BugReportStatus | 'all')}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {Object.entries(statusLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filteredReports.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Bug size={64} weight="duotone" className="text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum bug reportado</h3>
            <p className="text-sm text-muted-foreground text-center">
              Quando alguém reportar um bug, ele aparecerá aqui com o status atual.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredReports.map((report) => {
            const reportAttachments = attachmentsByReport.get(report.id) || []
            return (
              <Card key={report.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Bug size={18} weight="duotone" />
                        {report.screenLabel}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {format(new Date(report.createdAt), 'dd/MM/yyyy HH:mm')}
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className={statusClass(report.status)}>
                      {statusLabels[report.status]}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {report.recordLabel && (
                    <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
                      <strong>Registro:</strong> {report.recordLabel}
                    </div>
                  )}

                  <p className="text-sm text-muted-foreground line-clamp-4 whitespace-pre-wrap">
                    {report.description}
                  </p>

                  {report.resolutionNotes && (
                    <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
                      <p className="font-medium mb-1">Atualização</p>
                      <p className="text-muted-foreground whitespace-pre-wrap">{report.resolutionNotes}</p>
                    </div>
                  )}

                  {reportAttachments.length > 0 && (
                    <div className="grid gap-3">
                      {reportAttachments.map((attachment) => (
                        <BugAttachmentPreview key={attachment.id} attachment={attachment} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
