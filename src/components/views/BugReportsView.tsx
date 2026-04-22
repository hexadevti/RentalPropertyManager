import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bug, ArrowsClockwise } from '@phosphor-icons/react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { supabase } from '@/lib/supabase'
import { useLanguageOptional } from '@/lib/LanguageContext'
import type { BugReport, BugReportAttachment, BugReportStatus } from '@/types'
import { BugAttachmentPreview } from '@/components/BugAttachmentPreview'

type TenantOption = {
  id: string
  name: string
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

export default function BugReportsView() {
  const { t } = useLanguageOptional()
  const [reports, setReports] = useState<BugReport[]>([])
  const [attachments, setAttachments] = useState<BugReportAttachment[]>([])
  const [tenants, setTenants] = useState<TenantOption[]>([])
  const [statusFilter, setStatusFilter] = useState<BugReportStatus | 'active' | 'all'>('active')
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({})

  const statusLabels: Record<BugReportStatus, string> = {
    open: t.bug_reports_view.status.open,
    'in-review': t.bug_reports_view.status.in_review,
    resolved: t.bug_reports_view.status.resolved,
    dismissed: t.bug_reports_view.status.dismissed,
  }

  const loadData = useCallback(async () => {
    setIsLoading(true)
    const [
      { data: bugRows, error: bugError },
      { data: tenantRows },
    ] = await Promise.all([
      supabase
        .from('bug_reports')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase
        .from('tenants')
        .select('id, name')
        .order('name', { ascending: true }),
    ])

    if (bugError) {
      toast.error(bugError.message || t.bug_reports_view.load_error)
      setReports([])
      setAttachments([])
      setIsLoading(false)
      return
    }

    const loadedReports = (bugRows || []).map(mapBugReport)
    setReports(loadedReports)
    setTenants((tenantRows || []) as TenantOption[])
    setNotesDraft(Object.fromEntries(loadedReports.map((report) => [report.id, report.resolutionNotes || ''])))

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
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const attachmentsByReport = useMemo(() => {
    const grouped = new Map<string, BugReportAttachment[]>()
    attachments.forEach((attachment) => {
      grouped.set(attachment.bugReportId, [...(grouped.get(attachment.bugReportId) || []), attachment])
    })
    return grouped
  }, [attachments])

  const tenantNameById = useMemo(() => {
    return new Map(tenants.map((tenant) => [tenant.id, tenant.name]))
  }, [tenants])

  const filteredReports = reports.filter((report) => {
    if (statusFilter === 'active' && !['open', 'in-review'].includes(report.status)) return false
    if (statusFilter !== 'all' && statusFilter !== 'active' && report.status !== statusFilter) return false
    const term = search.trim().toLowerCase()
    if (!term) return true
    return [
      report.reporterLogin,
      report.reporterEmail || '',
      report.screenLabel,
      report.recordLabel || '',
      report.description,
      report.tenantId ? tenantNameById.get(report.tenantId) || '' : '',
    ].some((value) => value.toLowerCase().includes(term))
  })

  const updateReport = async (report: BugReport, status: BugReportStatus) => {
    setSavingId(report.id)
    const resolutionNotes = notesDraft[report.id]?.trim() || null
    const { error } = await supabase
      .from('bug_reports')
      .update({
        status,
        resolution_notes: resolutionNotes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', report.id)

    setSavingId(null)

    if (error) {
      toast.error(error.message || t.bug_reports_view.update_error)
      return
    }

    setReports((current) => current.map((item) => (
      item.id === report.id
        ? { ...item, status, resolutionNotes: resolutionNotes || undefined, updatedAt: new Date().toISOString() }
        : item
    )))
    toast.success(t.bug_reports_view.updated_success)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t.bug_reports_view.title}</h2>
          <p className="text-muted-foreground mt-1">
            {t.bug_reports_view.subtitle}
          </p>
        </div>
        <Button variant="outline" onClick={() => void loadData()} disabled={isLoading} className="gap-2">
          <ArrowsClockwise size={16} />
          {isLoading ? t.bug_reports_view.refreshing : t.common.refresh}
        </Button>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t.bug_reports_view.search_placeholder}
        />
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as BugReportStatus | 'active' | 'all')}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.bug_reports_view.filter_all_status}</SelectItem>
            <SelectItem value="active">{t.bug_reports_view.filter_active}</SelectItem>
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
            <h3 className="text-lg font-semibold mb-2">{t.bug_reports_view.no_results}</h3>
            <p className="text-sm text-muted-foreground">{t.bug_reports_view.no_results_hint}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredReports.map((report) => {
            const reportAttachments = attachmentsByReport.get(report.id) || []
            return (
              <Card key={report.id}>
                <CardHeader>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <CardTitle className="flex flex-wrap items-center gap-2">
                        <Bug size={18} weight="duotone" />
                        {report.screenLabel}
                        <Badge variant="outline" className={statusClass(report.status)}>
                          {statusLabels[report.status]}
                        </Badge>
                      </CardTitle>
                      <CardDescription className="mt-2">
                        {report.reporterLogin} {report.reporterEmail ? `- ${report.reporterEmail}` : ''}
                        {' | '}
                        {report.tenantId ? tenantNameById.get(report.tenantId) || report.tenantId : t.bug_reports_view.no_tenant}
                        {' | '}
                        {format(new Date(report.createdAt), 'dd/MM/yyyy HH:mm')}
                      </CardDescription>
                    </div>
                    <div className="min-w-[220px]">
                      <Select
                        value={report.status}
                        onValueChange={(value) => void updateReport(report, value as BugReportStatus)}
                        disabled={savingId === report.id}
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
                  {report.recordLabel && (
                    <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
                      <strong>{t.bug_reports_view.record_label}:</strong> {report.recordLabel}
                    </div>
                  )}

                  <div className="rounded-lg border border-border p-3 text-sm whitespace-pre-wrap">
                    {report.description}
                  </div>

                  <div className="space-y-2">
                    <Label>{t.bug_reports_view.notes_label}</Label>
                    <Textarea
                      value={notesDraft[report.id] || ''}
                      onChange={(event) => setNotesDraft((current) => ({ ...current, [report.id]: event.target.value }))}
                      rows={3}
                      placeholder={t.bug_reports_view.notes_placeholder}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={savingId === report.id}
                      onClick={() => void updateReport(report, report.status)}
                    >
                      {t.bug_reports_view.save_notes}
                    </Button>
                  </div>

                  {reportAttachments.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">{t.bug_reports_view.attachments}</p>
                      <div className="grid gap-3 md:grid-cols-2">
                        {reportAttachments.map((attachment) => (
                          <BugAttachmentPreview key={attachment.id} attachment={attachment} />
                        ))}
                      </div>
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
