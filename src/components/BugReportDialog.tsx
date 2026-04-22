import { useMemo, useState } from 'react'
import type { ClipboardEvent, FormEvent } from 'react'
import { Bug, UploadSimple } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/lib/AuthContext'
import { useLanguage } from '@/lib/LanguageContext'
import { useKV } from '@/lib/useSupabaseKV'
import { supabase } from '@/lib/supabase'
import type { Appointment, Contract, ContractTemplate, Document, Guest, Inspection, Owner, Property, ServiceProvider, Task, Transaction } from '@/types'

const BUG_DOCS_BUCKET = 'bug-docs'

type BugReportDialogProps = {
  activeTab: string
  activeTabLabel: string
  tabTitleMap: Record<string, string>
}

type RecordOption = {
  id: string
  label: string
}

const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

function sanitizeFileName(fileName: string) {
  return fileName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
}

function isUuid(value: string | null | undefined) {
  if (!value) return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export function BugReportDialog({ activeTab, activeTabLabel, tabTitleMap }: BugReportDialogProps) {
  const { currentUser, currentTenantId } = useAuth()
  const { t } = useLanguage()
  const [properties] = useKV<Property[]>('properties', [])
  const [owners] = useKV<Owner[]>('owners', [])
  const [transactions] = useKV<Transaction[]>('transactions', [])
  const [tasks] = useKV<Task[]>('tasks', [])
  const [guests] = useKV<Guest[]>('guests', [])
  const [contracts] = useKV<Contract[]>('contracts', [])
  const [documents] = useKV<Document[]>('documents', [])
  const [inspections] = useKV<Inspection[]>('inspections', [])
  const [templates] = useKV<ContractTemplate[]>('contract-templates', [])
  const [providers] = useKV<ServiceProvider[]>('service-providers', [])
  const [appointments] = useKV<Appointment[]>('appointments', [])

  const [open, setOpen] = useState(false)
  const [screen, setScreen] = useState(activeTab)
  const [recordId, setRecordId] = useState('none')
  const [description, setDescription] = useState('')
  const [printFile, setPrintFile] = useState<File | null>(null)
  const [printPreviewUrl, setPrintPreviewUrl] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const screenOptions = useMemo(() => {
    const entries = Object.entries(tabTitleMap)
    if (!entries.some(([key]) => key === activeTab)) {
      entries.unshift([activeTab, activeTabLabel])
    }
    return entries.map(([value, label]) => ({ value, label }))
  }, [activeTab, activeTabLabel, tabTitleMap])

  const recordOptionsByScreen = useMemo<Record<string, RecordOption[]>>(() => ({
    properties: (properties || []).map((item) => ({ id: item.id, label: item.name })),
    owners: (owners || []).map((item) => ({ id: item.id, label: item.name })),
    finances: (transactions || []).map((item) => ({ id: item.id, label: `${item.description} - ${item.date}` })),
    tasks: (tasks || []).map((item) => ({ id: item.id, label: item.title })),
    guests: (guests || []).map((item) => ({ id: item.id, label: item.name })),
    contracts: (contracts || []).map((item) => ({ id: item.id, label: `${item.startDate} - ${item.endDate}` })),
    documents: (documents || []).map((item) => ({ id: item.id, label: item.name })),
    inspections: (inspections || []).map((item) => ({ id: item.id, label: item.title })),
    templates: (templates || []).map((item) => ({ id: item.id, label: item.name })),
    providers: (providers || []).map((item) => ({ id: item.id, label: item.name })),
    appointments: (appointments || []).map((item) => ({ id: item.id, label: item.title })),
  }), [appointments, contracts, documents, guests, inspections, owners, properties, providers, tasks, templates, transactions])

  const recordOptions = recordOptionsByScreen[screen] || []
  const selectedScreenLabel = screenOptions.find((item) => item.value === screen)?.label || screen
  const selectedRecord = recordOptions.find((item) => item.id === recordId)

  const resetForm = () => {
    setScreen(activeTab)
    setRecordId('none')
    setDescription('')
    setPrintFile(null)
    if (printPreviewUrl) URL.revokeObjectURL(printPreviewUrl)
    setPrintPreviewUrl(null)
    setIsSubmitting(false)
  }

  const setSelectedPrint = (file: File | null) => {
    if (printPreviewUrl) URL.revokeObjectURL(printPreviewUrl)
    setPrintFile(file)
    setPrintPreviewUrl(file?.type.startsWith('image/') ? URL.createObjectURL(file) : null)
  }

  const handlePaste = (event: ClipboardEvent<HTMLFormElement>) => {
    const imageItem = Array.from(event.clipboardData.items)
      .find((item) => item.type.startsWith('image/'))
    const pastedFile = imageItem?.getAsFile()
    if (!pastedFile) return

    const extension = pastedFile.type.split('/')[1] || 'png'
    const namedFile = new File(
      [pastedFile],
      `print-colado-${new Date().toISOString().replace(/[:.]/g, '-')}.${extension}`,
      { type: pastedFile.type }
    )
    setSelectedPrint(namedFile)
    toast.success(t.bug_report_dialog.pasted_success)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (nextOpen) {
      setScreen(activeTab)
      setRecordId('none')
      return
    }
    resetForm()
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!currentTenantId || !currentUser) {
      toast.error(t.bug_report_dialog.session_error)
      return
    }
    if (!description.trim()) {
      toast.error(t.bug_report_dialog.description_required)
      return
    }

    setIsSubmitting(true)
    const reportId = createId()
    const now = new Date().toISOString()

    const { error: reportError } = await supabase
      .from('bug_reports')
      .insert({
        id: reportId,
        tenant_id: currentTenantId,
        reporter_auth_user_id: isUuid(currentUser.id) ? currentUser.id : null,
        reporter_login: currentUser.login,
        reporter_email: currentUser.email || null,
        screen,
        screen_label: selectedScreenLabel,
        record_id: recordId === 'none' ? null : recordId,
        record_label: selectedRecord?.label || null,
        description: description.trim(),
        status: 'open',
        created_at: now,
        updated_at: now,
      })

    if (reportError) {
      setIsSubmitting(false)
      toast.error(reportError.message || t.bug_report_dialog.create_error)
      return
    }

    if (printFile) {
      const attachmentId = createId()
      const safeFileName = sanitizeFileName(printFile.name)
      const filePath = `${currentTenantId}/${reportId}/${attachmentId}-${safeFileName}`
      const { error: uploadError } = await supabase.storage
        .from(BUG_DOCS_BUCKET)
        .upload(filePath, printFile, {
          cacheControl: '3600',
          upsert: false,
          contentType: printFile.type || undefined,
        })

      if (uploadError) {
        setIsSubmitting(false)
        toast.error(`${t.bug_report_dialog.upload_partial_error_prefix} ${uploadError.message}`)
        setOpen(false)
        resetForm()
        return
      }

      const { error: attachmentError } = await supabase
        .from('bug_report_attachments')
        .insert({
          id: attachmentId,
          bug_report_id: reportId,
          file_name: printFile.name,
          file_path: filePath,
          file_size: printFile.size,
          mime_type: printFile.type || null,
        })

      if (attachmentError) {
        toast.error(`${t.bug_report_dialog.attachment_partial_error_prefix} ${attachmentError.message}`)
      }
    }

    toast.success(t.bug_report_dialog.created_success)
    setOpen(false)
    resetForm()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Bug size={16} weight="duotone" />
          {t.bug_report_dialog.trigger_label}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t.bug_report_dialog.title}</DialogTitle>
          <DialogDescription>
            {t.bug_report_dialog.description}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} onPaste={handlePaste} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="bug-screen">{t.bug_report_dialog.screen}</Label>
              <Select
                value={screen}
                onValueChange={(value) => {
                  setScreen(value)
                  setRecordId('none')
                }}
              >
                <SelectTrigger id="bug-screen">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {screenOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bug-record">{t.bug_report_dialog.related_record}</Label>
              <Select value={recordId} onValueChange={setRecordId} disabled={recordOptions.length === 0}>
                <SelectTrigger id="bug-record">
                  <SelectValue placeholder={t.bug_report_dialog.select_record} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t.bug_report_dialog.no_specific_record}</SelectItem>
                  {recordOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bug-description">{t.bug_report_dialog.problem_description}</Label>
            <Textarea
              id="bug-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={5}
              placeholder={t.bug_report_dialog.problem_placeholder}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bug-print">{t.bug_report_dialog.screenshot_optional}</Label>
            <Input
              id="bug-print"
              type="file"
              accept="image/*,.pdf"
              onChange={(event) => setSelectedPrint(event.target.files?.[0] || null)}
            />
            <p className="text-xs text-muted-foreground">
              {t.bug_report_dialog.screenshot_hint}
            </p>
            {printPreviewUrl && (
              <div className="overflow-hidden rounded-lg border border-border bg-muted/30">
                <img src={printPreviewUrl} alt={t.bug_report_dialog.screenshot_preview_alt} className="max-h-72 w-full object-contain" />
              </div>
            )}
            {printFile && !printPreviewUrl && (
              <p className="text-sm text-muted-foreground">{t.bug_report_dialog.selected_file}: {printFile.name}</p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
              {t.bug_report_dialog.cancel}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              <UploadSimple size={16} />
              {isSubmitting ? t.bug_report_dialog.submitting : t.bug_report_dialog.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
