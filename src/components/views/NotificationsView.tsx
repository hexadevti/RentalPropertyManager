import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useKV } from '@/lib/useSupabaseKV'
import { useLanguage } from '@/lib/LanguageContext'
import { useAuth } from '@/lib/AuthContext'
import { AI_PLAN_UPGRADE_MESSAGE, hasAiFeatures } from '@/lib/usagePlans'
import { useDateFormat } from '@/lib/DateFormatContext'
import {
  buildDefaultNotificationConditions,
  DEFAULT_NOTIFICATION_DAYS_BEFORE,
  filterTemplatesForEventType,
  getNotificationEventTypeForTrigger,
  NOTIFICATION_EVENT_TYPES,
  NOTIFICATION_EVENT_TYPE_TRIGGERS,
  NOTIFICATION_TIMED_TRIGGERS,
} from '@/lib/notifications/catalog'
import {
  collectNotificationPreviewRows,
  getNotificationValueByPath,
  isHtmlTemplateContent,
  normalizeNotificationEditorContent,
  renderNotificationTemplateContent,
} from '@/lib/notifications/template'
import { DEFAULT_EMAIL_FOOTER, DEFAULT_EMAIL_HEADER } from '@/lib/notifications/email-master-defaults'
import { supabase } from '@/lib/supabase'
import RichTextEditor, { plainTextToHTML, type RichTextEditorHandle } from '@/components/RichTextEditor'
import { toast } from 'sonner'
import { TEMPLATE_LANGUAGES } from '@/types'
import {
  ArrowsClockwise,
  Bell,
  CaretDown,
  Copy,
  EnvelopeSimple,
  MagnifyingGlass,
  Pencil,
  Plus,
  Trash,
  XCircle,
} from '@phosphor-icons/react'
import type {
  Appointment,
  BugReport,
  Contract,
  Guest,
  Inspection,
  NotificationChannel,
  NotificationEventType,
  NotificationRule,
  NotificationTemplate,
  NotificationTemplateContentType,
  NotificationTrigger,
  Owner,
  Property,
  ServiceProvider,
  Task,
  TaskAssigneeType,
  TemplateLanguage,
  UserRole,
} from '@/types'

type RecipientOption = {
  id: string
  authUserId: string | null
  githubLogin: string
  email: string
  role: UserRole
  status: string
  avatarUrl: string
  createdAt: string
  updatedAt: string
  tenantId: string
}

type PreviewRow = {
  path: string
  value: string
}

type DeliveryRow = {
  id: string
  rule_id: string | null
  channel: string
  recipient_login: string | null
  recipient_destination: string
  subject: string | null
  status: string
  attempts: number
  max_attempts: number
  next_attempt_at: string
  sent_at: string | null
  last_error: string | null
  created_at: string
  payload: Record<string, unknown>
}

type DeliveryStatusFilter = 'all' | 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled'
type DeliveryChannelFilter = 'all' | 'email' | 'sms' | 'whatsapp'
type VariableEditorTarget = 'template' | 'master-header' | 'master-footer'
type MasterTemplateSection = 'header' | 'footer'

type MasterTemplateConfig = {
  channel: NotificationChannel
  headerContent: string
  footerContent: string
}

type NotificationConditionForm = {
  trigger: NotificationTrigger
  enabled: boolean
  daysBefore?: number
  emailTemplateId?: string
  smsTemplateId?: string
  whatsappTemplateId?: string
}

type NotificationRuleForm = {
  id: string
  groupId: string
  name: string
  eventType: NotificationEventType
  channels: NotificationChannel[]
  recipientRoles: UserRole[]
  recipientUserIds: string[]
  sendToTaskAssignee: boolean
  sendToEventRecipient: boolean
  conditions: NotificationConditionForm[]
  createdAt: string
  updatedAt: string
}

type NotificationRuleGroup = {
  groupId: string
  eventType: NotificationEventType
  name: string
  channels: NotificationChannel[]
  recipientRoles: UserRole[]
  recipientUserIds: string[]
  sendToTaskAssignee: boolean
  sendToEventRecipient: boolean
  conditions: NotificationConditionForm[]
  createdAt: string
  updatedAt: string
}

const CHANNELS: NotificationChannel[] = ['email', 'sms', 'whatsapp']
const USER_ROLES: UserRole[] = ['admin', 'guest']
const NO_PREVIEW_ITEM_VALUE = '__none__'
const NO_TEMPLATE_VALUE = '__none__'

function normalizeRuleNameKey(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

function DeliveryStatusBadge({ status, t }: { status: string; t: { status_pending: string; status_processing: string; status_sent: string; status_failed: string; status_cancelled: string } }) {
  const classes: Record<string, string> = {
    pending: 'border-amber-200 bg-amber-50 text-amber-700',
    processing: 'border-blue-200 bg-blue-50 text-blue-700',
    sent: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    failed: 'border-red-200 bg-red-50 text-red-700',
    cancelled: 'border-muted bg-muted text-muted-foreground',
  }
  const labels: Record<string, string> = {
    pending: t.status_pending,
    processing: t.status_processing,
    sent: t.status_sent,
    failed: t.status_failed,
    cancelled: t.status_cancelled,
  }
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${classes[status] ?? ''}`}>
      {labels[status] ?? status}
    </span>
  )
}

export default function NotificationsView() {
  const { t, language } = useLanguage()
  const { currentTenantId, tenantUsagePlan } = useAuth()
  const { formatDate, formatDateTime } = useDateFormat()
  const [rules, setRules] = useKV<NotificationRule[]>('notification-rules', [])
  const [templates, setTemplates] = useKV<NotificationTemplate[]>('notification-templates', [])
  const [appointments] = useKV<Appointment[]>('appointments', [])
  const [contracts] = useKV<Contract[]>('contracts', [])
  const [tasks] = useKV<Task[]>('tasks', [])
  const [inspections] = useKV<Inspection[]>('inspections', [])
  const [owners] = useKV<Owner[]>('owners', [])
  const [guests] = useKV<Guest[]>('guests', [])
  const [serviceProviders] = useKV<ServiceProvider[]>('service-providers', [])
  const [properties] = useKV<Property[]>('properties', [])
  const [previewBugReports, setPreviewBugReports] = useState<BugReport[]>([])
  const [recipientOptions, setRecipientOptions] = useState<RecipientOption[]>([])
  const [activeTab, setActiveTab] = useState<'rules' | 'templates' | 'queue'>('rules')

  // --- queue state ---
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([])
  const [queueLoading, setQueueLoading] = useState(false)
  const [queueStatusFilter, setQueueStatusFilter] = useState<DeliveryStatusFilter>('all')
  const [queueChannelFilter, setQueueChannelFilter] = useState<DeliveryChannelFilter>('all')
  const [queueRecipientSearch, setQueueRecipientSearch] = useState('')
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false)
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false)
  const [variableDialogOpen, setVariableDialogOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<NotificationRuleGroup | null>(null)
  const [editingTemplate, setEditingTemplate] = useState<NotificationTemplate | null>(null)
  const [templateSearch, setTemplateSearch] = useState('')
  const defaultTemplateLanguage = (TEMPLATE_LANGUAGES.some((item) => item.code === language) ? language : 'pt') as TemplateLanguage
  const [languageFilter, setLanguageFilter] = useState<TemplateLanguage | 'all'>(defaultTemplateLanguage)
  const [pendingTemplateTranslation, setPendingTemplateTranslation] = useState<{
    sourceTemplate: NotificationTemplate
    targetLanguage: TemplateLanguage
  } | null>(null)
  const [isTemplateTranslating, setIsTemplateTranslating] = useState(false)
  const [selectedPreviewEventType, setSelectedPreviewEventType] = useState<NotificationEventType>('tasks')
  const [selectedPreviewItemIds, setSelectedPreviewItemIds] = useState<Record<NotificationEventType, string>>({
    appointments: NO_PREVIEW_ITEM_VALUE,
    contracts: NO_PREVIEW_ITEM_VALUE,
    tasks: NO_PREVIEW_ITEM_VALUE,
    inspections: NO_PREVIEW_ITEM_VALUE,
    bugs: NO_PREVIEW_ITEM_VALUE,
    'user-access': NO_PREVIEW_ITEM_VALUE,
  })
  const [templateEditorTab, setTemplateEditorTab] = useState<'template' | 'preview'>('template')
  const [xpathInput, setXpathInput] = useState('')
  const [xpathFilter, setXpathFilter] = useState('')
  const [variableEditorTarget, setVariableEditorTarget] = useState<VariableEditorTarget>('template')
  const xpathFilterInputRef = useRef<HTMLInputElement | null>(null)
  const editorRef = useRef<RichTextEditorHandle | null>(null)
  const masterHeaderEditorRef = useRef<RichTextEditorHandle | null>(null)
  const masterFooterEditorRef = useRef<RichTextEditorHandle | null>(null)
  const [ruleForm, setRuleForm] = useState<NotificationRuleForm>({
    id: '',
    groupId: '',
    name: '',
    eventType: 'tasks',
    channels: ['email'],
    recipientRoles: ['admin'],
    recipientUserIds: [],
    sendToTaskAssignee: false,
    sendToEventRecipient: false,
    conditions: buildDefaultNotificationConditions('tasks'),
    createdAt: '',
    updatedAt: '',
  })
  const [templateForm, setTemplateForm] = useState<NotificationTemplate>({
    id: '',
    name: '',
    channel: 'email',
    eventType: 'general',
    contentType: 'html',
    language: defaultTemplateLanguage,
    translationGroupId: '',
    description: '',
    subject: '',
    content: '',
    createdAt: '',
    updatedAt: '',
  })
  const [masterTemplateChannel, setMasterTemplateChannel] = useState<NotificationChannel>('email')
  const [masterTemplateForm, setMasterTemplateForm] = useState<MasterTemplateConfig>({
    channel: 'email',
    headerContent: '',
    footerContent: '',
  })
  const [masterTemplateSaving, setMasterTemplateSaving] = useState(false)
  const [masterTemplateEditorOpen, setMasterTemplateEditorOpen] = useState(false)
  const [masterTemplateEditorSection, setMasterTemplateEditorSection] = useState<MasterTemplateSection>('header')
  const [masterTemplatesOpen, setMasterTemplatesOpen] = useState(false)

  const loadRecipients = useCallback(async () => {
    if (!currentTenantId) {
      setRecipientOptions([])
      return
    }

    const { data, error } = await supabase
      .from('user_profiles')
      .select('tenant_id, auth_user_id, github_login, email, role, status, avatar_url, created_at, updated_at')
      .eq('tenant_id', currentTenantId)
      .order('created_at', { ascending: true })

    if (error) {
      toast.error(t.notifications_view.messages.recipients_load_error)
      setRecipientOptions([])
      return
    }

    setRecipientOptions((data || []).map((row: any) => ({
      id: row.auth_user_id || `login:${row.github_login}`,
      authUserId: row.auth_user_id || null,
      githubLogin: row.github_login,
      email: row.email || '',
      role: row.role,
      status: row.status,
      avatarUrl: row.avatar_url || '',
      createdAt: row.created_at || '',
      updatedAt: row.updated_at || '',
      tenantId: row.tenant_id,
    })))
  }, [currentTenantId, t.notifications_view.messages.recipients_load_error])

  useEffect(() => {
    void loadRecipients()
  }, [loadRecipients])

  const loadPreviewBugReports = useCallback(async () => {
    if (!currentTenantId) {
      setPreviewBugReports([])
      return
    }

    const { data, error } = await supabase
      .from('bug_reports')
      .select('id, tenant_id, reporter_auth_user_id, reporter_login, reporter_email, screen, screen_label, record_id, record_label, description, status, resolution_notes, created_at, updated_at')
      .eq('tenant_id', currentTenantId)
      .order('created_at', { ascending: false })
      .limit(30)

    if (error) {
      console.warn('Failed to load preview bug reports:', error)
      setPreviewBugReports([])
      return
    }

    setPreviewBugReports((data || []).map((row: any) => ({
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
    })))
  }, [currentTenantId])

  useEffect(() => {
    void loadPreviewBugReports()
  }, [loadPreviewBugReports])

  const loadMasterTemplate = useCallback(async (channel: NotificationChannel) => {
    if (!currentTenantId) {
      setMasterTemplateForm({ channel, headerContent: '', footerContent: '' })
      return
    }

    const { data, error } = await supabase
      .from('notification_master_templates')
      .select('channel, header_content, footer_content')
      .eq('tenant_id', currentTenantId)
      .eq('channel', channel)
      .maybeSingle()

    if (error) {
      console.warn('Failed to load notification master template:', error)
      setMasterTemplateForm({ channel, headerContent: '', footerContent: '' })
      return
    }

    setMasterTemplateForm({
      channel,
      headerContent: data?.header_content || '',
      footerContent: data?.footer_content || '',
    })
  }, [currentTenantId])

  useEffect(() => {
    void loadMasterTemplate(masterTemplateChannel)
  }, [loadMasterTemplate, masterTemplateChannel])

  const handleLoadDefaultEmailTemplate = () => {
    if (!window.confirm(t.notifications_view.template.load_default_email_confirm)) return
    const lang = language === 'en' ? 'en' : 'pt'
    setMasterTemplateForm((current) => ({
      ...current,
      headerContent: DEFAULT_EMAIL_HEADER[lang],
      footerContent: DEFAULT_EMAIL_FOOTER[lang],
    }))
  }

  const handleSaveMasterTemplate = async () => {
    if (!currentTenantId) return

    setMasterTemplateSaving(true)
    const now = new Date().toISOString()

    const { error } = await supabase
      .from('notification_master_templates')
      .upsert({
        tenant_id: currentTenantId,
        channel: masterTemplateForm.channel,
        header_content: masterTemplateForm.headerContent,
        footer_content: masterTemplateForm.footerContent,
        created_at: now,
        updated_at: now,
      }, { onConflict: 'tenant_id,channel' })

    setMasterTemplateSaving(false)

    if (error) {
      toast.error(t.notifications_view.messages.master_template_save_error)
      console.warn('Failed to save notification master template:', error)
      return
    }

    toast.success(t.notifications_view.messages.master_template_saved)
  }

  const resetRuleForm = () => {
    setEditingRule(null)
    setRuleForm({
      id: '',
      groupId: '',
      name: '',
      eventType: 'tasks',
      channels: ['email'],
      recipientRoles: ['admin'],
      recipientUserIds: [],
      sendToTaskAssignee: false,
      sendToEventRecipient: false,
      conditions: buildDefaultNotificationConditions('tasks'),
      createdAt: '',
      updatedAt: '',
    })
  }

  const resetTemplateForm = () => {
    setEditingTemplate(null)
    setTemplateEditorTab('template')
    setXpathInput('')
    setXpathFilter('')
    setSelectedPreviewEventType('tasks')
    setSelectedPreviewItemIds({
      appointments: NO_PREVIEW_ITEM_VALUE,
      contracts: NO_PREVIEW_ITEM_VALUE,
      tasks: NO_PREVIEW_ITEM_VALUE,
      inspections: NO_PREVIEW_ITEM_VALUE,
      bugs: NO_PREVIEW_ITEM_VALUE,
      'user-access': NO_PREVIEW_ITEM_VALUE,
    })
    setTemplateForm({
      id: '',
      name: '',
      channel: 'email',
      eventType: 'general',
      contentType: 'html',
      language: defaultTemplateLanguage,
      translationGroupId: '',
      description: '',
      subject: '',
      content: '',
      createdAt: '',
      updatedAt: '',
    })
  }

  const templateOptionsByChannel = useMemo(() => ({
    email: filterTemplatesForEventType(templates || [], ruleForm.eventType, 'email'),
    sms: filterTemplatesForEventType(templates || [], ruleForm.eventType, 'sms'),
    whatsapp: filterTemplatesForEventType(templates || [], ruleForm.eventType, 'whatsapp'),
  }), [ruleForm.eventType, templates])

  const getLanguageLabel = useCallback((code: TemplateLanguage) => {
    const found = TEMPLATE_LANGUAGES.find((item) => item.code === code)
    return found ? found.nativeName : code.toUpperCase()
  }, [])

  const getLanguagesAvailableForGroup = useCallback((translationGroupId: string): TemplateLanguage[] => (
    (templates || [])
      .filter((template) => template.translationGroupId === translationGroupId)
      .map((template) => template.language)
  ), [templates])

  const translateTemplateValue = useCallback(async (
    value: string,
    fromLanguage: TemplateLanguage,
    toLanguage: TemplateLanguage
  ) => {
    if (!hasAiFeatures(tenantUsagePlan?.planCode)) {
      throw new Error(AI_PLAN_UPGRADE_MESSAGE)
    }

    if (!value.trim()) return value

    const { data, error } = await supabase.functions.invoke('ai-assistant', {
      body: {
        action: 'translate-template',
        content: value,
        fromLanguage,
        toLanguage,
      },
    })

    if (error) {
      throw new Error(error.message || t.notifications_view.messages.template_translation_error)
    }

    if (data?.error) {
      throw new Error(data.error)
    }

    return String(data?.translatedContent || '')
  }, [t.notifications_view.messages.template_translation_error, tenantUsagePlan?.planCode])

  const notificationGroups = useMemo<NotificationRuleGroup[]>(() => {
    const grouped = new Map<string, NotificationRuleGroup>()

    for (const rule of (rules || [])) {
      const eventType = rule.eventType || getNotificationEventTypeForTrigger(rule.trigger)
      if (!eventType) continue

      const groupId = `${eventType}:${normalizeRuleNameKey(rule.name)}`
      const existing = grouped.get(groupId)
      const conditionFromRule: NotificationConditionForm = {
        trigger: rule.trigger,
        enabled: rule.isActive,
        daysBefore: rule.daysBefore,
        emailTemplateId: rule.emailTemplateId,
        smsTemplateId: rule.smsTemplateId,
        whatsappTemplateId: rule.whatsappTemplateId,
      }

      if (!existing) {
        grouped.set(groupId, {
          groupId,
          eventType,
          name: rule.name,
          channels: [...rule.channels],
          recipientRoles: [...rule.recipientRoles],
          recipientUserIds: [...rule.recipientUserIds],
          sendToTaskAssignee: rule.sendToTaskAssignee ?? false,
          sendToEventRecipient: rule.sendToEventRecipient ?? false,
          conditions: [conditionFromRule],
          createdAt: rule.createdAt,
          updatedAt: rule.updatedAt,
        })
        continue
      }

      existing.channels = Array.from(new Set([...existing.channels, ...rule.channels]))
      existing.recipientRoles = Array.from(new Set([...existing.recipientRoles, ...rule.recipientRoles]))
      existing.recipientUserIds = Array.from(new Set([...existing.recipientUserIds, ...rule.recipientUserIds]))
      existing.sendToTaskAssignee = existing.sendToTaskAssignee || (rule.sendToTaskAssignee ?? false)
      existing.sendToEventRecipient = existing.sendToEventRecipient || (rule.sendToEventRecipient ?? false)
      existing.conditions.push(conditionFromRule)
      existing.updatedAt = existing.updatedAt > rule.updatedAt ? existing.updatedAt : rule.updatedAt
    }

    return Array.from(grouped.values())
      .map((group) => {
        const byTrigger = new Map(group.conditions.map((condition) => [condition.trigger, condition]))
        return {
          ...group,
          conditions: NOTIFICATION_EVENT_TYPE_TRIGGERS[group.eventType].map((trigger) => byTrigger.get(trigger) || {
            trigger,
            enabled: false,
            daysBefore: DEFAULT_NOTIFICATION_DAYS_BEFORE[trigger],
            emailTemplateId: undefined,
            smsTemplateId: undefined,
            whatsappTemplateId: undefined,
          }),
        }
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }, [rules])

  const filteredTemplates = useMemo(() => {
    const query = templateSearch.trim().toLowerCase()
    const byLanguage = (templates || []).filter((template) => (
      languageFilter === 'all' || template.language === languageFilter
    ))
    if (!query) return byLanguage
    return byLanguage.filter((template) => (
      template.name.toLowerCase().includes(query)
      || template.channel.toLowerCase().includes(query)
      || (template.description || '').toLowerCase().includes(query)
      || (template.eventType || 'general').toLowerCase().includes(query)
      || (template.contentType || 'html').toLowerCase().includes(query)
      || (template.subject || '').toLowerCase().includes(query)
    ))
  }, [languageFilter, templateSearch, templates])

  const previewAppointmentOptions = useMemo(
    () => (appointments || []).map((appointment) => ({
      id: appointment.id,
      label: `${appointment.title} - ${appointment.date}${appointment.time ? ` ${appointment.time}` : ''}`,
    })),
    [appointments]
  )

  const previewContractOptions = useMemo(
    () => (contracts || []).map((contract) => ({
      id: contract.id,
      label: `${contract.id} - ${contract.status} - ${contract.endDate}`,
    })),
    [contracts]
  )

  const previewTaskOptions = useMemo(
    () => (tasks || []).map((task) => {
      const property = (properties || []).find((item) => item.id === task.propertyId)
      const dueDate = task.dueDate ? formatDate(task.dueDate) : '-'
      return {
        id: task.id,
        label: `${task.title} - ${dueDate}${property ? ` - ${property.name}` : ''}`,
      }
    }),
    [formatDate, properties, tasks]
  )

  const previewInspectionOptions = useMemo(
    () => (inspections || []).map((inspection) => ({
      id: inspection.id,
      label: `${inspection.title} - ${formatDate(inspection.scheduledDate)}`,
    })),
    [formatDate, inspections]
  )

  const previewBugOptions = useMemo(
    () => previewBugReports.map((report) => ({
      id: report.id,
      label: `${report.screenLabel} - ${report.status}`,
    })),
    [previewBugReports]
  )

  const previewUserOptions = useMemo(
    () => recipientOptions.map((recipient) => ({
      id: recipient.id,
      label: `${recipient.githubLogin} - ${t.roles[recipient.role]} - ${recipient.status === 'pending' ? t.userManagement.pending : recipient.status === 'approved' ? t.userManagement.approved : t.userManagement.blocked}`,
    })),
    [recipientOptions, t.roles, t.userManagement.approved, t.userManagement.blocked, t.userManagement.pending]
  )

  const selectedPreviewValue = selectedPreviewItemIds[selectedPreviewEventType] || NO_PREVIEW_ITEM_VALUE

  const selectedPreviewAppointment = useMemo(() => {
    if (selectedPreviewItemIds.appointments === NO_PREVIEW_ITEM_VALUE) return null
    return (appointments || []).find((appointment) => appointment.id === selectedPreviewItemIds.appointments) || null
  }, [appointments, selectedPreviewItemIds.appointments])

  const selectedPreviewContract = useMemo(() => {
    if (selectedPreviewItemIds.contracts === NO_PREVIEW_ITEM_VALUE) return null
    return (contracts || []).find((contract) => contract.id === selectedPreviewItemIds.contracts) || null
  }, [contracts, selectedPreviewItemIds.contracts])

  const selectedPreviewTask = useMemo(() => {
    if (selectedPreviewItemIds.tasks === NO_PREVIEW_ITEM_VALUE) return null
    return (tasks || []).find((task) => task.id === selectedPreviewItemIds.tasks) || null
  }, [selectedPreviewItemIds.tasks, tasks])

  const selectedPreviewTaskAssignee = useMemo(() => {
    if (!selectedPreviewTask?.assigneeType || !selectedPreviewTask.assigneeId) {
      return selectedPreviewTask?.assigneeName
        ? {
            id: null,
            type: null,
            name: selectedPreviewTask.assigneeName,
            email: null,
            phone: null,
          }
        : null
    }

    const assigneeType = selectedPreviewTask.assigneeType as TaskAssigneeType
    if (assigneeType === 'owner') {
      const owner = (owners || []).find((item) => item.id === selectedPreviewTask.assigneeId)
      return owner
        ? {
            id: owner.id,
            type: assigneeType,
            name: owner.name,
            email: owner.email || null,
            phone: owner.phone || null,
          }
        : {
            id: selectedPreviewTask.assigneeId,
            type: assigneeType,
            name: selectedPreviewTask.assigneeName || '',
            email: null,
            phone: null,
          }
    }

    if (assigneeType === 'guest') {
      const guest = (guests || []).find((item) => item.id === selectedPreviewTask.assigneeId)
      return guest
        ? {
            id: guest.id,
            type: assigneeType,
            name: guest.name,
            email: guest.email || null,
            phone: guest.phone || null,
          }
        : {
            id: selectedPreviewTask.assigneeId,
            type: assigneeType,
            name: selectedPreviewTask.assigneeName || '',
            email: null,
            phone: null,
          }
    }

    const serviceProvider = (serviceProviders || []).find((item) => item.id === selectedPreviewTask.assigneeId)
    return serviceProvider
      ? {
          id: serviceProvider.id,
          type: assigneeType,
          name: serviceProvider.name,
          email: serviceProvider.email || null,
          phone: serviceProvider.phone || serviceProvider.contact || null,
        }
      : {
          id: selectedPreviewTask.assigneeId,
          type: assigneeType,
          name: selectedPreviewTask.assigneeName || '',
          email: null,
          phone: null,
        }
  }, [guests, owners, selectedPreviewTask, serviceProviders])

  const selectedPreviewTaskProperty = useMemo(() => {
    if (!selectedPreviewTask?.propertyId) return null
    return (properties || []).find((property) => property.id === selectedPreviewTask.propertyId) || null
  }, [properties, selectedPreviewTask])

  const selectedPreviewInspection = useMemo(() => {
    if (selectedPreviewItemIds.inspections === NO_PREVIEW_ITEM_VALUE) return null
    return (inspections || []).find((inspection) => inspection.id === selectedPreviewItemIds.inspections) || null
  }, [inspections, selectedPreviewItemIds.inspections])

  const selectedPreviewInspectionProperty = useMemo(() => {
    if (!selectedPreviewInspection?.propertyId) return null
    return (properties || []).find((property) => property.id === selectedPreviewInspection.propertyId) || null
  }, [properties, selectedPreviewInspection])

  const selectedPreviewBug = useMemo(() => {
    if (selectedPreviewItemIds.bugs === NO_PREVIEW_ITEM_VALUE) return null
    return previewBugReports.find((report) => report.id === selectedPreviewItemIds.bugs) || null
  }, [previewBugReports, selectedPreviewItemIds.bugs])

  const selectedPreviewUser = useMemo(() => {
    if (selectedPreviewItemIds['user-access'] === NO_PREVIEW_ITEM_VALUE) return null
    return recipientOptions.find((recipient) => recipient.id === selectedPreviewItemIds['user-access']) || null
  }, [recipientOptions, selectedPreviewItemIds])

  const previewOptionsByEventType = useMemo<Record<NotificationEventType, Array<{ id: string; label: string }>>>(() => ({
    appointments: previewAppointmentOptions,
    contracts: previewContractOptions,
    tasks: previewTaskOptions,
    inspections: previewInspectionOptions,
    bugs: previewBugOptions,
    'user-access': previewUserOptions,
  }), [previewAppointmentOptions, previewBugOptions, previewContractOptions, previewInspectionOptions, previewTaskOptions, previewUserOptions])

  const notificationPreviewContext = useMemo(() => {
    const fallbackTrigger = NOTIFICATION_EVENT_TYPE_TRIGGERS[selectedPreviewEventType][0]
    const firstEnabledCondition = ruleForm.eventType === selectedPreviewEventType
      ? (ruleForm.conditions.find((condition) => condition.enabled) || ruleForm.conditions[0])
      : undefined
    const previewTrigger = firstEnabledCondition?.trigger || fallbackTrigger

    const previewUserPayload = selectedPreviewUser
      ? {
          id: selectedPreviewUser.id,
          authUserId: selectedPreviewUser.authUserId,
          githubLogin: selectedPreviewUser.githubLogin,
          email: selectedPreviewUser.email,
          role: selectedPreviewUser.role,
          status: selectedPreviewUser.status,
          avatarUrl: selectedPreviewUser.avatarUrl,
          tenantId: selectedPreviewUser.tenantId,
          createdAt: selectedPreviewUser.createdAt,
          updatedAt: selectedPreviewUser.updatedAt,
        }
      : null

    const previewAppointmentPayload = selectedPreviewAppointment
      ? {
          id: selectedPreviewAppointment.id,
          title: selectedPreviewAppointment.title,
          description: selectedPreviewAppointment.description,
          date: selectedPreviewAppointment.date,
          time: selectedPreviewAppointment.time,
          status: selectedPreviewAppointment.status,
          serviceProviderId: selectedPreviewAppointment.serviceProviderId,
          contractId: selectedPreviewAppointment.contractId,
          guestId: selectedPreviewAppointment.guestId,
          propertyId: selectedPreviewAppointment.propertyId,
          notes: selectedPreviewAppointment.notes,
          completionNotes: selectedPreviewAppointment.completionNotes,
          completedAt: selectedPreviewAppointment.completedAt,
          createdAt: selectedPreviewAppointment.createdAt,
        }
      : null

    const previewContractPayload = selectedPreviewContract
      ? {
          id: selectedPreviewContract.id,
          guestId: selectedPreviewContract.guestId,
          propertyIds: selectedPreviewContract.propertyIds,
          rentalType: selectedPreviewContract.rentalType,
          startDate: selectedPreviewContract.startDate,
          endDate: selectedPreviewContract.endDate,
          closeDate: selectedPreviewContract.closeDate,
          paymentDueDay: selectedPreviewContract.paymentDueDay,
          monthlyAmount: selectedPreviewContract.monthlyAmount,
          specialPaymentCondition: selectedPreviewContract.specialPaymentCondition,
          status: selectedPreviewContract.status,
          notes: selectedPreviewContract.notes,
          templateId: selectedPreviewContract.templateId,
          createdAt: selectedPreviewContract.createdAt,
        }
      : null

    const previewInspectionPayload = selectedPreviewInspection
      ? {
          id: selectedPreviewInspection.id,
          propertyId: selectedPreviewInspection.propertyId,
          contractId: selectedPreviewInspection.contractId,
          parentInspectionId: selectedPreviewInspection.parentInspectionId,
          title: selectedPreviewInspection.title,
          type: selectedPreviewInspection.type,
          status: selectedPreviewInspection.status,
          inspectorName: selectedPreviewInspection.inspectorName,
          scheduledDate: selectedPreviewInspection.scheduledDate,
          completedDate: selectedPreviewInspection.completedDate,
          summary: selectedPreviewInspection.summary,
          createdAt: selectedPreviewInspection.createdAt,
          updatedAt: selectedPreviewInspection.updatedAt,
        }
      : null

    const previewBugPayload = selectedPreviewBug
      ? {
          id: selectedPreviewBug.id,
          tenantId: selectedPreviewBug.tenantId,
          reporterAuthUserId: selectedPreviewBug.reporterAuthUserId,
          reporterLogin: selectedPreviewBug.reporterLogin,
          reporterEmail: selectedPreviewBug.reporterEmail,
          screen: selectedPreviewBug.screen,
          screenLabel: selectedPreviewBug.screenLabel,
          recordId: selectedPreviewBug.recordId,
          recordLabel: selectedPreviewBug.recordLabel,
          description: selectedPreviewBug.description,
          status: selectedPreviewBug.status,
          resolutionNotes: selectedPreviewBug.resolutionNotes,
          createdAt: selectedPreviewBug.createdAt,
          updatedAt: selectedPreviewBug.updatedAt,
        }
      : null

    return {
      notification: {
        ruleName: ruleForm.name || t.notifications_view.preview.default_rule_name,
        trigger: t.notifications_view.triggers[previewTrigger],
        eventType: selectedPreviewEventType,
        channel: t.notifications_view.channels[templateForm.channel],
        subject: templateForm.subject || t.notifications_view.preview.default_subject,
        recipientCount: ruleForm.recipientUserIds.length + ruleForm.recipientRoles.length + (ruleForm.sendToTaskAssignee ? 1 : 0) + (ruleForm.sendToEventRecipient ? 1 : 0),
        notificationRecipient: selectedPreviewUser
          ? {
              login: selectedPreviewUser.githubLogin,
              name: selectedPreviewUser.githubLogin,
              email: selectedPreviewUser.email,
              authUserId: selectedPreviewUser.authUserId,
            }
          : null,
        invite: previewUserPayload
          ? {
              acceptUrl: `https://rpm.example.com/?invite=${previewUserPayload.id}`,
              expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
              email: previewUserPayload.email,
              login: previewUserPayload.githubLogin,
              role: previewUserPayload.role,
              message: 'Bem-vindo ao tenant. Use este link para concluir seu acesso.',
            }
          : null,
        passwordReset: previewUserPayload
          ? {
              resetUrl: `https://rpm.example.com/auth/callback?mode=reset-password&token=${previewUserPayload.id}`,
              email: previewUserPayload.email,
              login: previewUserPayload.githubLogin,
              message: 'Crie uma nova senha para voltar a acessar o sistema.',
            }
          : null,
        appointment: previewAppointmentPayload,
        contract: previewContractPayload,
        task: selectedPreviewTask
          ? {
              ...selectedPreviewTask,
              assignee: selectedPreviewTaskAssignee,
            }
          : null,
        property: selectedPreviewEventType === 'inspections' ? selectedPreviewInspectionProperty : selectedPreviewTaskProperty,
        inspection: previewInspectionPayload,
        bug: previewBugPayload,
        user: previewUserPayload,
        group: previewUserPayload
          ? {
              role: previewUserPayload.role,
              label: t.roles[previewUserPayload.role],
            }
          : null,
        access: previewUserPayload
          ? {
              status: previewUserPayload.status,
              isApproved: previewUserPayload.status === 'approved',
              isPending: previewUserPayload.status === 'pending',
              isBlocked: previewUserPayload.status === 'blocked',
              isRejected: false,
            }
          : null,
        changes: previewUserPayload
          ? {
              previousRole: previewUserPayload.role === 'admin' ? 'guest' : 'admin',
              currentRole: previewUserPayload.role,
              previousStatus: previewUserPayload.status === 'approved' ? 'pending' : 'approved',
              currentStatus: previewUserPayload.status,
            }
          : null,
        appointmentId: previewAppointmentPayload?.id || null,
        title: previewAppointmentPayload?.title || previewInspectionPayload?.title || previewContractPayload?.id || null,
        date: previewAppointmentPayload?.date || null,
        time: previewAppointmentPayload?.time || null,
        status: previewAppointmentPayload?.status || previewContractPayload?.status || previewInspectionPayload?.status || previewBugPayload?.status || null,
        contractId: previewAppointmentPayload?.contractId || previewInspectionPayload?.contractId || previewContractPayload?.id || null,
        guestId: previewAppointmentPayload?.guestId || previewContractPayload?.guestId || null,
        paymentDueDay: previewContractPayload?.paymentDueDay || null,
        monthlyAmount: previewContractPayload?.monthlyAmount || null,
        startDate: previewContractPayload?.startDate || null,
        endDate: previewContractPayload?.endDate || null,
        inspectionId: previewInspectionPayload?.id || null,
        screen: previewBugPayload?.screen || null,
        screenLabel: previewBugPayload?.screenLabel || null,
        recordId: previewBugPayload?.recordId || null,
        recordLabel: previewBugPayload?.recordLabel || null,
        reporterLogin: previewBugPayload?.reporterLogin || null,
      },
    }
  }, [ruleForm.conditions, ruleForm.eventType, ruleForm.name, ruleForm.recipientRoles.length, ruleForm.recipientUserIds.length, ruleForm.sendToEventRecipient, ruleForm.sendToTaskAssignee, selectedPreviewAppointment, selectedPreviewBug, selectedPreviewContract, selectedPreviewEventType, selectedPreviewInspection, selectedPreviewInspectionProperty, selectedPreviewTask, selectedPreviewTaskAssignee, selectedPreviewTaskProperty, selectedPreviewUser, t.notifications_view.channels, t.notifications_view.preview.default_rule_name, t.notifications_view.preview.default_subject, t.notifications_view.triggers, t.roles, templateForm.channel, templateForm.subject])

  const xpathPreviewRows = useMemo(() => {
    const rows: PreviewRow[] = []
    collectNotificationPreviewRows(notificationPreviewContext.notification, '', rows)
    return rows
  }, [notificationPreviewContext])

  const filteredXPathPreviewRows = useMemo(() => {
    const query = xpathFilter.trim().toLowerCase()
    if (!query) return xpathPreviewRows
    return xpathPreviewRows.filter((row) => row.path.toLowerCase().includes(query) || row.value.toLowerCase().includes(query))
  }, [xpathFilter, xpathPreviewRows])

  const xpathPreview = useMemo(() => {
    const trimmedXPath = xpathInput.trim()
    if (!trimmedXPath) return ''
    const normalizedPath = trimmedXPath.startsWith('notification.')
      ? trimmedXPath.slice('notification.'.length)
      : trimmedXPath
    return getNotificationValueByPath(notificationPreviewContext.notification, normalizedPath) || t.notifications_view.variable_help.value_preview_placeholder
  }, [notificationPreviewContext, t.notifications_view.variable_help.value_preview_placeholder, xpathInput])

  const previewHtml = useMemo(() => {
    const content = templateForm.content || ''
    if (!content) return ''
    return renderNotificationTemplateContent(content, notificationPreviewContext.notification)
  }, [notificationPreviewContext, templateForm.content])

  const resolveRecipientLabel = useCallback((recipientId: string) => {
    const option = recipientOptions.find((recipient) => recipient.id === recipientId)
    return option?.githubLogin || recipientId
  }, [recipientOptions])

  const resolveEventTypeLabel = useCallback((eventType: NotificationEventType) => {
    switch (eventType) {
      case 'appointments':
        return t.notifications_view.rule.event_type_appointments
      case 'contracts':
        return t.notifications_view.rule.event_type_contracts
      case 'tasks':
        return t.notifications_view.rule.event_type_tasks
      case 'inspections':
        return t.notifications_view.rule.event_type_inspections
      case 'bugs':
        return t.notifications_view.rule.event_type_bugs
      case 'user-access':
        return t.notifications_view.rule.event_type_user_access
    }
  }, [t.notifications_view.rule.event_type_appointments, t.notifications_view.rule.event_type_bugs, t.notifications_view.rule.event_type_contracts, t.notifications_view.rule.event_type_inspections, t.notifications_view.rule.event_type_tasks, t.notifications_view.rule.event_type_user_access])

  const resolveTemplateEventTypeLabel = useCallback((eventType?: NotificationTemplate['eventType']) => {
    if (!eventType || eventType === 'general') return t.notifications_view.template.event_type_general
    return resolveEventTypeLabel(eventType)
  }, [resolveEventTypeLabel, t.notifications_view.template.event_type_general])

  const resolveTemplateContentTypeLabel = useCallback((contentType?: NotificationTemplateContentType) => {
    return contentType === 'html'
      ? t.notifications_view.template.content_type_html
      : t.notifications_view.template.content_type_text
  }, [t.notifications_view.template.content_type_html, t.notifications_view.template.content_type_text])

  const formatTemplateOptionLabel = useCallback((template: NotificationTemplate) => (
    `${template.name} (${getLanguageLabel(template.language)})`
  ), [getLanguageLabel])

  const resolveTemplateLabelById = useCallback((templateId?: string) => {
    if (!templateId) return t.notifications_view.rule.none
    const template = (templates || []).find((item) => item.id === templateId)
    return template ? formatTemplateOptionLabel(template) : t.notifications_view.rule.none
  }, [formatTemplateOptionLabel, t.notifications_view.rule.none, templates])

  const handleRuleEventTypeChange = (eventType: NotificationEventType) => {
    setRuleForm((current) => ({
      ...current,
      eventType,
      sendToTaskAssignee: eventType === 'tasks' ? current.sendToTaskAssignee : false,
      sendToEventRecipient: eventType === 'user-access' ? current.sendToEventRecipient : false,
      conditions: buildDefaultNotificationConditions(eventType),
    }))
  }

  const toggleChannel = (channel: NotificationChannel, checked: boolean) => {
    setRuleForm((current) => {
      const nextChannels = checked
        ? Array.from(new Set([...current.channels, channel]))
        : current.channels.filter((item) => item !== channel)

      return {
        ...current,
        channels: nextChannels,
        conditions: current.conditions.map((condition) => ({
          ...condition,
          ...(checked ? {} : {
            ...(channel === 'email' ? { emailTemplateId: undefined } : {}),
            ...(channel === 'sms' ? { smsTemplateId: undefined } : {}),
            ...(channel === 'whatsapp' ? { whatsappTemplateId: undefined } : {}),
          }),
        })),
      }
    })
  }

  const toggleCondition = (trigger: NotificationTrigger, checked: boolean) => {
    setRuleForm((current) => ({
      ...current,
      conditions: current.conditions.map((condition) => (
        condition.trigger === trigger ? { ...condition, enabled: checked } : condition
      )),
    }))
  }

  const setConditionDaysBefore = (trigger: NotificationTrigger, rawValue: string) => {
    const parsedValue = Number(rawValue)
    const nextDaysBefore = Number.isFinite(parsedValue) && parsedValue >= 0
      ? Math.floor(parsedValue)
      : 0

    setRuleForm((current) => ({
      ...current,
      conditions: current.conditions.map((condition) => (
        condition.trigger === trigger
          ? { ...condition, daysBefore: nextDaysBefore }
          : condition
      )),
    }))
  }

  const setConditionTemplate = (
    trigger: NotificationTrigger,
    channel: NotificationChannel,
    templateId: string | undefined
  ) => {
    setRuleForm((current) => ({
      ...current,
      conditions: current.conditions.map((condition) => {
        if (condition.trigger !== trigger) return condition
        return {
          ...condition,
          ...(channel === 'email' ? { emailTemplateId: templateId } : {}),
          ...(channel === 'sms' ? { smsTemplateId: templateId } : {}),
          ...(channel === 'whatsapp' ? { whatsappTemplateId: templateId } : {}),
        }
      }),
    }))
  }

  const toggleRole = (role: UserRole, checked: boolean) => {
    setRuleForm((current) => ({
      ...current,
      recipientRoles: checked
        ? Array.from(new Set([...current.recipientRoles, role]))
        : current.recipientRoles.filter((item) => item !== role),
    }))
  }

  const toggleRecipient = (recipientId: string, checked: boolean) => {
    setRuleForm((current) => ({
      ...current,
      recipientUserIds: checked
        ? Array.from(new Set([...current.recipientUserIds, recipientId]))
        : current.recipientUserIds.filter((item) => item !== recipientId),
    }))
  }

  const openEditRule = (ruleGroup: NotificationRuleGroup) => {
    setEditingRule(ruleGroup)
    setRuleForm({
      id: ruleGroup.groupId,
      groupId: ruleGroup.groupId,
      name: ruleGroup.name,
      eventType: ruleGroup.eventType,
      channels: [...ruleGroup.channels],
      recipientRoles: [...ruleGroup.recipientRoles],
      recipientUserIds: [...ruleGroup.recipientUserIds],
      sendToTaskAssignee: ruleGroup.sendToTaskAssignee,
      sendToEventRecipient: ruleGroup.sendToEventRecipient,
      conditions: ruleGroup.conditions.map((condition) => ({ ...condition })),
      createdAt: ruleGroup.createdAt,
      updatedAt: ruleGroup.updatedAt,
    })
    setRuleDialogOpen(true)
  }

  const openEditTemplate = (template: NotificationTemplate) => {
    setEditingTemplate(template)
    setTemplateForm({
      ...template,
      subject: template.subject || '',
      description: template.description || '',
      content: template.contentType === 'html'
        ? normalizeNotificationEditorContent(template.content, plainTextToHTML)
        : template.content,
    })
    setTemplateDialogOpen(true)
  }

  const translationSources = useMemo(() => {
    if (!editingTemplate || !templateForm.translationGroupId) return []
    return (templates || []).filter((template) => (
      template.translationGroupId === templateForm.translationGroupId
      && template.language !== templateForm.language
    ))
  }, [editingTemplate, templateForm.language, templateForm.translationGroupId, templates])

  const handleSaveRule = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!ruleForm.channels.length) {
      toast.error(t.notifications_view.messages.channels_required)
      return
    }

    if (!ruleForm.recipientRoles.length && !ruleForm.recipientUserIds.length && !ruleForm.sendToTaskAssignee && !ruleForm.sendToEventRecipient) {
      toast.error(t.notifications_view.messages.recipients_required)
      return
    }

    const enabledConditions = ruleForm.conditions.filter((condition) => condition.enabled)
    if (!enabledConditions.length) {
      toast.error(t.notifications_view.messages.conditions_required)
      return
    }

    for (const condition of enabledConditions) {
      for (const channel of ruleForm.channels) {
        const templateId = channel === 'email'
          ? condition.emailTemplateId
          : channel === 'sms'
            ? condition.smsTemplateId
            : condition.whatsappTemplateId

        if (!templateId) {
          toast.error(t.notifications_view.messages.condition_template_required)
          return
        }
      }
    }

    const now = new Date().toISOString()
    const normalizedNameKey = normalizeRuleNameKey(ruleForm.name)
    const groupId = `${ruleForm.eventType}:${normalizedNameKey}`
    const previousGroupId = editingRule?.groupId || null
    const baseCreatedAt = editingRule?.createdAt || now

    const nextRules: NotificationRule[] = enabledConditions.map((condition) => ({
      id: `${ruleForm.eventType}:${normalizedNameKey}:${condition.trigger}`,
      groupId,
      eventType: ruleForm.eventType,
      name: ruleForm.name,
      trigger: condition.trigger,
      channels: [...ruleForm.channels],
      emailTemplateId: ruleForm.channels.includes('email') ? condition.emailTemplateId : undefined,
      smsTemplateId: ruleForm.channels.includes('sms') ? condition.smsTemplateId : undefined,
      whatsappTemplateId: ruleForm.channels.includes('whatsapp') ? condition.whatsappTemplateId : undefined,
      recipientRoles: [...ruleForm.recipientRoles],
      recipientUserIds: [...ruleForm.recipientUserIds],
      sendToTaskAssignee: ruleForm.eventType === 'tasks' ? ruleForm.sendToTaskAssignee : false,
      sendToEventRecipient: ruleForm.eventType === 'user-access' ? ruleForm.sendToEventRecipient : false,
      daysBefore: NOTIFICATION_TIMED_TRIGGERS.has(condition.trigger)
        ? (typeof condition.daysBefore === 'number' ? condition.daysBefore : DEFAULT_NOTIFICATION_DAYS_BEFORE[condition.trigger] || 0)
        : undefined,
      isActive: condition.enabled,
      createdAt: baseCreatedAt,
      updatedAt: now,
    }))

    const currentRules = rules || []
    const withoutCurrentGroup = currentRules.filter((item) => {
      const itemEventType = item.eventType || getNotificationEventTypeForTrigger(item.trigger)
      const itemGroupId = `${itemEventType}:${normalizeRuleNameKey(item.name)}`
      if (itemGroupId === groupId) return false
      if (previousGroupId && itemGroupId === previousGroupId) return false
      return true
    })

    if (currentTenantId) {
      const previousGroupRules = currentRules.filter((item) => {
        const itemEventType = item.eventType || getNotificationEventTypeForTrigger(item.trigger)
        const itemGroupId = `${itemEventType}:${normalizeRuleNameKey(item.name)}`
        if (itemGroupId === groupId) return true
        if (previousGroupId && itemGroupId === previousGroupId) return true
        return false
      })

      const nextRuleIds = new Set(nextRules.map((rule) => rule.id))
      const idsToDelete = previousGroupRules
        .map((rule) => rule.id)
        .filter((id) => !nextRuleIds.has(id))

      if (idsToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('notification_rules')
          .delete()
          .eq('tenant_id', currentTenantId)
          .in('id', idsToDelete)

        if (deleteError) {
          toast.error(deleteError.message)
          return
        }
      }

      const rows = nextRules.map((rule) => ({
        tenant_id: currentTenantId,
        id: rule.id,
        name: rule.name,
        trigger: rule.trigger,
        event_type: rule.eventType,
        channels: rule.channels || [],
        email_template_id: rule.emailTemplateId || null,
        sms_template_id: rule.smsTemplateId || null,
        whatsapp_template_id: rule.whatsappTemplateId || null,
        recipient_roles: rule.recipientRoles || [],
        recipient_user_ids: rule.recipientUserIds || [],
        send_to_task_assignee: rule.sendToTaskAssignee ?? false,
        send_to_event_recipient: rule.sendToEventRecipient ?? false,
        days_before: typeof rule.daysBefore === 'number' ? rule.daysBefore : null,
        is_active: rule.isActive ?? true,
        created_at: rule.createdAt,
        updated_at: rule.updatedAt,
      }))

      const { error: upsertError } = await supabase
        .from('notification_rules')
        .upsert(rows, { onConflict: 'tenant_id,id' })

      if (upsertError) {
        toast.error(upsertError.message)
        return
      }
    }

    setRules([...withoutCurrentGroup, ...nextRules])

    toast.success(editingRule ? t.notifications_view.messages.rule_updated : t.notifications_view.messages.rule_created)
    setRuleDialogOpen(false)
    resetRuleForm()
  }

  const handleDeleteRule = async (groupId: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este registro?')) return

    if (currentTenantId) {
      const idsToDelete = (rules || [])
        .filter((item) => {
          const itemEventType = item.eventType || getNotificationEventTypeForTrigger(item.trigger)
          return `${itemEventType}:${normalizeRuleNameKey(item.name)}` === groupId
        })
        .map((item) => item.id)

      if (idsToDelete.length > 0) {
        const { error } = await supabase
          .from('notification_rules')
          .delete()
          .eq('tenant_id', currentTenantId)
          .in('id', idsToDelete)

        if (error) {
          toast.error(error.message)
          return
        }
      }
    }

    setRules((currentRules) => (currentRules || []).filter((item) => {
      const itemEventType = item.eventType || getNotificationEventTypeForTrigger(item.trigger)
      return `${itemEventType}:${normalizeRuleNameKey(item.name)}` !== groupId
    }))
    toast.success(t.notifications_view.messages.rule_deleted)
  }

  const handleSaveTemplate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const now = new Date().toISOString()
    const nextId = editingTemplate?.id || Date.now().toString()
    const nextTemplate: NotificationTemplate = {
      ...templateForm,
      id: nextId,
      eventType: templateForm.eventType || 'general',
      contentType: templateForm.contentType || 'html',
      language: templateForm.language || defaultTemplateLanguage,
      translationGroupId: templateForm.translationGroupId || editingTemplate?.translationGroupId || nextId,
      content: templateForm.contentType === 'html'
        ? normalizeNotificationEditorContent(templateForm.content, plainTextToHTML)
        : templateForm.content,
      subject: templateForm.channel === 'email' ? templateForm.subject || '' : undefined,
      createdAt: editingTemplate?.createdAt || now,
      updatedAt: now,
    }

    setTemplates((currentTemplates) => {
      if (editingTemplate) {
        return (currentTemplates || []).map((item) => item.id === editingTemplate.id ? nextTemplate : item)
      }
      return [...(currentTemplates || []), nextTemplate]
    })

    toast.success(editingTemplate ? t.notifications_view.messages.template_updated : t.notifications_view.messages.template_created)
    setTemplateDialogOpen(false)
    resetTemplateForm()
  }

  const handleDeleteTemplate = (templateId: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este registro?')) return
    setTemplates((currentTemplates) => (currentTemplates || []).filter((item) => item.id !== templateId))
    setRules((currentRules) => (currentRules || []).map((rule) => ({
      ...rule,
      emailTemplateId: rule.emailTemplateId === templateId ? undefined : rule.emailTemplateId,
      smsTemplateId: rule.smsTemplateId === templateId ? undefined : rule.smsTemplateId,
      whatsappTemplateId: rule.whatsappTemplateId === templateId ? undefined : rule.whatsappTemplateId,
      updatedAt: rule.emailTemplateId === templateId || rule.smsTemplateId === templateId || rule.whatsappTemplateId === templateId
        ? new Date().toISOString()
        : rule.updatedAt,
    })))
    toast.success(t.notifications_view.messages.template_deleted)
  }

  const handleDuplicateTemplate = (template: NotificationTemplate) => {
    const duplicateId = Date.now().toString()
    const duplicatedTemplate: NotificationTemplate = {
      ...template,
      id: duplicateId,
      translationGroupId: duplicateId,
      name: `${template.name} (${t.notifications_view.template.duplicate_suffix})`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    setTemplates((currentTemplates) => [...(currentTemplates || []), duplicatedTemplate])
    toast.success(t.notifications_view.messages.template_duplicated)
  }

  const handleAddTemplateTranslation = (template: NotificationTemplate, targetLanguage: TemplateLanguage) => {
    const alreadyExists = (templates || []).some((item) => (
      item.translationGroupId === template.translationGroupId && item.language === targetLanguage
    ))

    if (alreadyExists) {
      toast.error(t.notifications_view.messages.template_translation_exists.replace('{language}', getLanguageLabel(targetLanguage)))
      return
    }

    const newTemplate: NotificationTemplate = {
      ...template,
      id: Date.now().toString(),
      language: targetLanguage,
      name: `${template.name} (${getLanguageLabel(targetLanguage)})`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    setTemplates((currentTemplates) => [...(currentTemplates || []), newTemplate])
    toast.success(t.notifications_view.messages.template_translation_created.replace('{language}', getLanguageLabel(targetLanguage)))
  }

  const handleAddTemplateTranslationWithAI = async (template: NotificationTemplate, targetLanguage: TemplateLanguage) => {
    setIsTemplateTranslating(true)

    try {
      const alreadyExists = (templates || []).some((item) => (
        item.translationGroupId === template.translationGroupId && item.language === targetLanguage
      ))

      if (alreadyExists) {
        toast.error(t.notifications_view.messages.template_translation_exists.replace('{language}', getLanguageLabel(targetLanguage)))
        setPendingTemplateTranslation(null)
        return
      }

      const [content, subject, description] = await Promise.all([
        translateTemplateValue(template.content, template.language, targetLanguage),
        template.subject ? translateTemplateValue(template.subject, template.language, targetLanguage) : Promise.resolve(template.subject || ''),
        template.description ? translateTemplateValue(template.description, template.language, targetLanguage) : Promise.resolve(template.description || ''),
      ])

      const newTemplate: NotificationTemplate = {
        ...template,
        id: Date.now().toString(),
        language: targetLanguage,
        name: `${template.name} (${getLanguageLabel(targetLanguage)})`,
        content,
        subject,
        description,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      setTemplates((currentTemplates) => [...(currentTemplates || []), newTemplate])
      setPendingTemplateTranslation(null)
      toast.success(t.notifications_view.messages.template_translation_created_ai.replace('{language}', getLanguageLabel(targetLanguage)))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.notifications_view.messages.template_translation_error)
    } finally {
      setIsTemplateTranslating(false)
    }
  }

  const handleTranslateTemplateFrom = async (sourceTemplate: NotificationTemplate) => {
    setIsTemplateTranslating(true)

    try {
      const [content, subject, description] = await Promise.all([
        translateTemplateValue(sourceTemplate.content, sourceTemplate.language, templateForm.language),
        sourceTemplate.subject ? translateTemplateValue(sourceTemplate.subject, sourceTemplate.language, templateForm.language) : Promise.resolve(sourceTemplate.subject || ''),
        sourceTemplate.description ? translateTemplateValue(sourceTemplate.description, sourceTemplate.language, templateForm.language) : Promise.resolve(sourceTemplate.description || ''),
      ])

      setTemplateForm((current) => ({
        ...current,
        content,
        subject,
        description,
      }))

      toast.success(t.notifications_view.messages.template_translation_applied.replace('{language}', getLanguageLabel(sourceTemplate.language)))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.notifications_view.messages.template_translation_error)
    } finally {
      setIsTemplateTranslating(false)
    }
  }

  const getEditorHandle = (target: VariableEditorTarget) => {
    if (target === 'template') return editorRef.current
    if (target === 'master-header') return masterHeaderEditorRef.current
    return masterFooterEditorRef.current
  }

  const restoreEditorFocus = (target: VariableEditorTarget) => {
    setTimeout(() => {
      getEditorHandle(target)?.focusAtLastSelection()
    }, 80)
  }

  const openVariableHelpFor = (target: VariableEditorTarget) => {
    setVariableEditorTarget(target)
    getEditorHandle(target)?.captureCurrentSelection()
    setVariableDialogOpen(true)
  }

  const handleInsertToken = (token: string) => {
    setVariableDialogOpen(false)
    if (variableEditorTarget === 'template') {
      if (templateForm.contentType === 'html' && editorRef.current) {
        editorRef.current.insertTokenAtCursor(token)
      } else {
        setTemplateForm((current) => ({
          ...current,
          content: current.contentType === 'html'
            ? `${current.content || '<p></p>'}<p>${token}</p>`
            : `${current.content}${current.content ? '\n' : ''}${token}`,
        }))
      }
    } else if (getEditorHandle(variableEditorTarget)) {
      getEditorHandle(variableEditorTarget)?.insertTokenAtCursor(token)
    } else {
      const field = variableEditorTarget === 'master-header' ? 'headerContent' : 'footerContent'
      const currentValue = variableEditorTarget === 'master-header'
        ? masterTemplateForm.headerContent
        : masterTemplateForm.footerContent
      const nextValue = `${currentValue || '<p></p>'}<p>${token}</p>`
      setMasterTemplateForm((current) => ({
        ...current,
        [field]: nextValue,
      }))
    }

    toast.success(`${t.notifications_view.messages.token_inserted}: ${token}`)
    restoreEditorFocus(variableEditorTarget)
  }

  const handleCopyXPathToken = async () => {
    const trimmedXPath = xpathInput.trim()
    if (!trimmedXPath) {
      toast.error(t.notifications_view.messages.xpath_required)
      return
    }

    const token = `{{${trimmedXPath}}}`
    try {
      await navigator.clipboard.writeText(token)
      toast.success(`${t.notifications_view.messages.xpath_copied}: ${token}`)
    } catch {
      toast.error(t.notifications_view.messages.xpath_copy_error)
    }
  }

  const masterHeaderPreviewHtml = useMemo(() => {
    if (!masterTemplateForm.headerContent) return ''
    return renderNotificationTemplateContent(masterTemplateForm.headerContent, notificationPreviewContext.notification)
  }, [masterTemplateForm.headerContent, notificationPreviewContext])

  const masterFooterPreviewHtml = useMemo(() => {
    if (!masterTemplateForm.footerContent) return ''
    return renderNotificationTemplateContent(masterTemplateForm.footerContent, notificationPreviewContext.notification)
  }, [masterTemplateForm.footerContent, notificationPreviewContext])

  const openMasterTemplateEditor = (section: MasterTemplateSection) => {
    setMasterTemplateEditorSection(section)
    setMasterTemplateEditorOpen(true)
  }

  const masterTemplateCards = useMemo(() => ([
    {
      id: 'master-header',
      section: 'header' as const,
      title: t.notifications_view.template.master_header_label,
      previewHtml: masterHeaderPreviewHtml,
      rawContent: masterTemplateForm.headerContent,
      target: 'master-header' as const,
    },
    {
      id: 'master-footer',
      section: 'footer' as const,
      title: t.notifications_view.template.master_footer_label,
      previewHtml: masterFooterPreviewHtml,
      rawContent: masterTemplateForm.footerContent,
      target: 'master-footer' as const,
    },
  ]), [
    masterFooterPreviewHtml,
    masterHeaderPreviewHtml,
    masterTemplateForm.footerContent,
    masterTemplateForm.headerContent,
    t.notifications_view.template.master_footer_label,
    t.notifications_view.template.master_header_label,
  ])

  const handleToggleRuleStatus = (groupId: string, trigger: NotificationTrigger, checked: boolean) => {
    const now = new Date().toISOString()
    setRules((currentRules) => (currentRules || []).map((rule) => {
      const ruleEventType = rule.eventType || getNotificationEventTypeForTrigger(rule.trigger)
      return `${ruleEventType}:${normalizeRuleNameKey(rule.name)}` === groupId && rule.trigger === trigger
        ? { ...rule, isActive: checked, updatedAt: now }
        : rule
    }))
  }

  const loadDeliveries = useCallback(async () => {
    if (!currentTenantId) {
      setDeliveries([])
      return
    }
    setQueueLoading(true)
    try {
      let query = supabase
        .from('notification_deliveries')
        .select('id, rule_id, channel, recipient_login, recipient_destination, subject, status, attempts, max_attempts, next_attempt_at, sent_at, last_error, created_at, payload')
        .eq('tenant_id', currentTenantId)
        .order('created_at', { ascending: false })
        .limit(200)

      if (queueStatusFilter !== 'all') query = query.eq('status', queueStatusFilter)
      if (queueChannelFilter !== 'all') query = query.eq('channel', queueChannelFilter)
      if (queueRecipientSearch.trim()) {
        query = query.or(
          `recipient_destination.ilike.%${queueRecipientSearch.trim()}%,recipient_login.ilike.%${queueRecipientSearch.trim()}%`
        )
      }

      const { data, error } = await query
      if (error) {
        console.warn('Failed to load notification deliveries:', error)
        setDeliveries([])
      } else {
        setDeliveries((data || []) as DeliveryRow[])
      }
    } finally {
      setQueueLoading(false)
    }
  }, [currentTenantId, queueChannelFilter, queueRecipientSearch, queueStatusFilter])

  useEffect(() => {
    if (activeTab === 'queue') {
      void loadDeliveries()
    }
  }, [activeTab, loadDeliveries])

  const handleRetryDelivery = async (deliveryId: string) => {
    const { error } = await supabase
      .from('notification_deliveries')
      .update({ status: 'pending', next_attempt_at: new Date().toISOString(), last_error: null })
      .eq('id', deliveryId)

    if (error) {
      toast.error(t.notifications_view.messages.delivery_retry_error)
    } else {
      toast.success(t.notifications_view.messages.delivery_retried)
      void loadDeliveries()
    }
  }

  const handleCancelDelivery = async (deliveryId: string) => {
    const { error } = await supabase
      .from('notification_deliveries')
      .update({ status: 'cancelled' })
      .eq('id', deliveryId)

    if (error) {
      toast.error(t.notifications_view.messages.delivery_cancel_error)
    } else {
      toast.success(t.notifications_view.messages.delivery_cancelled)
      void loadDeliveries()
    }
  }

  const queueStats = useMemo(() => {
    const counts = { total: deliveries.length, pending: 0, processing: 0, sent: 0, failed: 0, cancelled: 0 }
    for (const d of deliveries) {
      if (d.status === 'pending') counts.pending++
      else if (d.status === 'processing') counts.processing++
      else if (d.status === 'sent') counts.sent++
      else if (d.status === 'failed') counts.failed++
      else if (d.status === 'cancelled') counts.cancelled++
    }
    return counts
  }, [deliveries])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold">{t.notifications_view.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t.notifications_view.subtitle}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:flex">
          <Card className="min-w-[150px]">
            <CardContent className="flex items-center gap-3 p-4">
              <Bell size={24} className="text-primary" />
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{t.notifications_view.stats.rules}</p>
                <p className="text-2xl font-bold">{notificationGroups.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="min-w-[150px]">
            <CardContent className="flex items-center gap-3 p-4">
              <EnvelopeSimple size={24} className="text-primary" />
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{t.notifications_view.stats.templates}</p>
                <p className="text-2xl font-bold">{(templates || []).length}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'rules' | 'templates' | 'queue')}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="rules">{t.notifications_view.sections.rules}</TabsTrigger>
            <TabsTrigger value="templates">{t.notifications_view.sections.templates}</TabsTrigger>
            <TabsTrigger value="queue">{t.notifications_view.sections.queue}</TabsTrigger>
          </TabsList>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => {
              resetTemplateForm()
              setTemplateDialogOpen(true)
            }}>
              <Plus size={16} className="mr-2" />
              {t.notifications_view.actions.new_template}
            </Button>
            <Button type="button" onClick={() => {
              resetRuleForm()
              setRuleDialogOpen(true)
            }}>
              <Plus size={16} className="mr-2" />
              {t.notifications_view.actions.new_rule}
            </Button>
          </div>
        </div>

        <TabsContent value="rules" className="mt-6 space-y-4">
          {notificationGroups.length === 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t.notifications_view.empty.rules_title}</CardTitle>
                <CardDescription>{t.notifications_view.empty.rules_description}</CardDescription>
              </CardHeader>
            </Card>
          )}

          <div className="grid gap-4 xl:grid-cols-2">
            {notificationGroups.map((ruleGroup) => (
              <Card key={ruleGroup.groupId}>
                <CardHeader className="gap-3">
                  <div>
                    <CardTitle className="text-lg">{ruleGroup.name}</CardTitle>
                    <CardDescription>{resolveEventTypeLabel(ruleGroup.eventType)}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {ruleGroup.channels.map((channel) => (
                      <Badge key={channel} variant="secondary">{t.notifications_view.channels[channel]}</Badge>
                    ))}
                  </div>

                  <div className="space-y-2 text-sm">
                    <p>
                      <span className="font-medium">{t.notifications_view.rule.recipient_groups_label}:</span>{' '}
                      {ruleGroup.recipientRoles.length > 0
                        ? ruleGroup.recipientRoles.map((role) => t.roles[role]).join(', ')
                        : t.notifications_view.rule.none}
                    </p>
                    <p>
                      <span className="font-medium">{t.notifications_view.rule.recipient_users_label}:</span>{' '}
                      {ruleGroup.recipientUserIds.length > 0
                        ? ruleGroup.recipientUserIds.map(resolveRecipientLabel).join(', ')
                        : t.notifications_view.rule.none}
                    </p>
                    {ruleGroup.eventType === 'tasks' && (
                      <p>
                        <span className="font-medium">{t.notifications_view.rule.task_assignee_label}:</span>{' '}
                        {ruleGroup.sendToTaskAssignee
                          ? t.notifications_view.rule.task_assignee_enabled
                          : t.notifications_view.rule.task_assignee_disabled}
                      </p>
                    )}
                    {ruleGroup.eventType === 'user-access' && (
                      <p>
                        <span className="font-medium">{t.notifications_view.rule.event_recipient_label}:</span>{' '}
                        {ruleGroup.sendToEventRecipient
                          ? t.notifications_view.rule.event_recipient_enabled
                          : t.notifications_view.rule.event_recipient_disabled}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 rounded-md border p-3">
                    <p className="text-sm font-medium">{t.notifications_view.rule.conditions_label}</p>
                    <div className="space-y-3">
                      {ruleGroup.conditions.map((condition) => {
                        const templateSummary = [
                          condition.emailTemplateId ? `${t.notifications_view.channels.email}: ${resolveTemplateLabelById(condition.emailTemplateId)}` : '',
                          condition.smsTemplateId ? `${t.notifications_view.channels.sms}: ${resolveTemplateLabelById(condition.smsTemplateId)}` : '',
                          condition.whatsappTemplateId ? `${t.notifications_view.channels.whatsapp}: ${resolveTemplateLabelById(condition.whatsappTemplateId)}` : '',
                        ].filter(Boolean).join(' | ')

                        return (
                          <div key={condition.trigger} className="rounded-md border p-2">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-medium">{t.notifications_view.triggers[condition.trigger]}</p>
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={condition.enabled}
                                  onCheckedChange={(checked) => handleToggleRuleStatus(ruleGroup.groupId, condition.trigger, checked)}
                                />
                                <span className="text-xs text-muted-foreground">
                                  {condition.enabled ? t.notifications_view.status.active : t.notifications_view.status.inactive}
                                </span>
                              </div>
                            </div>
                            {typeof condition.daysBefore === 'number' && NOTIFICATION_TIMED_TRIGGERS.has(condition.trigger) && (
                              <p className="mt-2 text-xs text-muted-foreground">
                                {t.notifications_view.rule.days_before_badge.replace('{days}', String(condition.daysBefore))}
                              </p>
                            )}
                            <p className="mt-2 text-xs text-muted-foreground">
                              <span className="font-medium">{t.notifications_view.rule.templates_label}:</span>{' '}
                              {templateSummary || t.notifications_view.rule.none}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => openEditRule(ruleGroup)}>
                      <Pencil size={16} className="mr-2" />
                      {t.notifications_view.actions.edit}
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => handleDeleteRule(ruleGroup.groupId)}>
                      <Trash size={16} className="mr-2" />
                      {t.notifications_view.actions.delete}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="templates" className="mt-6 space-y-4">
          <Card>
            <button
              type="button"
              className="flex w-full items-center justify-between p-6 text-left"
              onClick={() => setMasterTemplatesOpen((open) => !open)}
            >
              <div>
                <p className="text-lg font-semibold leading-none tracking-tight">{t.notifications_view.template.master_title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t.notifications_view.template.master_description}</p>
              </div>
              <CaretDown
                size={18}
                className={`shrink-0 text-muted-foreground transition-transform duration-200 ${masterTemplatesOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {masterTemplatesOpen && (
              <CardContent className="space-y-4 pt-0">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div className="max-w-xs flex-1 space-y-1">
                    <Label>{t.notifications_view.template.master_channel_label}</Label>
                    <Select
                      value={masterTemplateChannel}
                      onValueChange={(value) => setMasterTemplateChannel(value as NotificationChannel)}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="email">{t.notifications_view.channels.email}</SelectItem>
                        <SelectItem value="sms">{t.notifications_view.channels.sms}</SelectItem>
                        <SelectItem value="whatsapp">{t.notifications_view.channels.whatsapp}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {masterTemplateChannel === 'email' && (
                    <Button type="button" variant="outline" onClick={handleLoadDefaultEmailTemplate}>
                      {t.notifications_view.template.load_default_email}
                    </Button>
                  )}
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  {masterTemplateCards.map((masterCard) => (
                    <Card key={masterCard.id}>
                      <CardHeader>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <CardTitle className="text-lg">{masterCard.title}</CardTitle>
                            <CardDescription>{t.notifications_view.template.master_description}</CardDescription>
                          </div>
                          <div className="flex flex-wrap justify-end gap-2">
                            <Badge variant="secondary">{t.notifications_view.channels[masterTemplateChannel]}</Badge>
                            <Badge variant="outline">{t.notifications_view.template.content_type_html}</Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
                          {!masterCard.rawContent && (
                            <p>{t.notifications_view.template.preview_empty}</p>
                          )}
                          {masterCard.rawContent && !masterCard.previewHtml && (
                            <p>{t.notifications_view.template.preview_unavailable}</p>
                          )}
                          {masterCard.rawContent && masterCard.previewHtml && (
                            <div className="line-clamp-4" dangerouslySetInnerHTML={{ __html: masterCard.previewHtml }} />
                          )}
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button type="button" variant="outline" size="sm" onClick={() => openVariableHelpFor(masterCard.target)}>
                            {t.notifications_view.actions.open_variable_help}
                          </Button>
                          <Button type="button" variant="outline" size="sm" onClick={() => openMasterTemplateEditor(masterCard.section)}>
                            <Pencil size={16} className="mr-2" />
                            {t.notifications_view.actions.edit}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative max-w-md flex-1">
              <MagnifyingGlass size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={templateSearch}
                onChange={(event) => setTemplateSearch(event.target.value)}
                placeholder={t.notifications_view.template.search_placeholder}
                className="pl-9"
              />
            </div>
            <div className="w-full sm:w-52">
              <Select value={languageFilter} onValueChange={(value) => setLanguageFilter(value as TemplateLanguage | 'all')}>
                <SelectTrigger>
                  <SelectValue placeholder={t.notifications_view.template.language_filter_label} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.notifications_view.template.all_languages}</SelectItem>
                  {TEMPLATE_LANGUAGES.map((templateLanguage) => (
                    <SelectItem key={templateLanguage.code} value={templateLanguage.code}>
                      {templateLanguage.nativeName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {filteredTemplates.length === 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{templates.length === 0 ? t.notifications_view.empty.templates_title : t.notifications_view.empty.templates_search_title}</CardTitle>
                <CardDescription>{templates.length === 0 ? t.notifications_view.empty.templates_description : t.notifications_view.empty.templates_search_description}</CardDescription>
              </CardHeader>
            </Card>
          )}

          <div className="grid gap-4 xl:grid-cols-2">
            {filteredTemplates.map((template) => (
              <Card key={template.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg">{template.name}</CardTitle>
                      <CardDescription>{template.description || template.subject || t.notifications_view.template.no_subject}</CardDescription>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      <Badge variant="secondary">{t.notifications_view.channels[template.channel]}</Badge>
                      <Badge variant="outline">{getLanguageLabel(template.language)}</Badge>
                      <Badge variant="outline">{resolveTemplateEventTypeLabel(template.eventType)}</Badge>
                      <Badge variant="outline">{resolveTemplateContentTypeLabel(template.contentType)}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
                    <div className="line-clamp-4" dangerouslySetInnerHTML={{ __html: template.content || '<p></p>' }} />
                  </div>
                  <div className="flex justify-end gap-2">
                    {(() => {
                      const usedLanguages = getLanguagesAvailableForGroup(template.translationGroupId)
                      const availableToAdd = TEMPLATE_LANGUAGES.filter((item) => !usedLanguages.includes(item.code))

                      if (availableToAdd.length === 0) return null

                      return (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button type="button" variant="outline" size="sm">
                              {t.notifications_view.template.add_translation}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {availableToAdd.map((item) => (
                              <DropdownMenuItem
                                key={item.code}
                                onClick={() => setPendingTemplateTranslation({
                                  sourceTemplate: template,
                                  targetLanguage: item.code,
                                })}
                              >
                                {item.nativeName}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )
                    })()}
                    <Button type="button" variant="outline" size="sm" onClick={() => handleDuplicateTemplate(template)}>
                      <Copy size={16} className="mr-2" />
                      {t.notifications_view.actions.duplicate}
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => openEditTemplate(template)}>
                      <Pencil size={16} className="mr-2" />
                      {t.notifications_view.actions.edit}
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => handleDeleteTemplate(template.id)}>
                      <Trash size={16} className="mr-2" />
                      {t.notifications_view.actions.delete}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="queue" className="mt-6 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t.notifications_view.queue.status_label}</Label>
                <Select value={queueStatusFilter} onValueChange={(v) => setQueueStatusFilter(v as DeliveryStatusFilter)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t.notifications_view.queue.all}</SelectItem>
                    <SelectItem value="pending">{t.notifications_view.queue.status_pending}</SelectItem>
                    <SelectItem value="processing">{t.notifications_view.queue.status_processing}</SelectItem>
                    <SelectItem value="sent">{t.notifications_view.queue.status_sent}</SelectItem>
                    <SelectItem value="failed">{t.notifications_view.queue.status_failed}</SelectItem>
                    <SelectItem value="cancelled">{t.notifications_view.queue.status_cancelled}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t.notifications_view.queue.channel_label}</Label>
                <Select value={queueChannelFilter} onValueChange={(v) => setQueueChannelFilter(v as DeliveryChannelFilter)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t.notifications_view.queue.all}</SelectItem>
                    <SelectItem value="email">{t.notifications_view.channels.email}</SelectItem>
                    <SelectItem value="sms">{t.notifications_view.channels.sms}</SelectItem>
                    <SelectItem value="whatsapp">{t.notifications_view.channels.whatsapp}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t.notifications_view.queue.recipient_label}</Label>
                <div className="relative">
                  <MagnifyingGlass size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={queueRecipientSearch}
                    onChange={(e) => setQueueRecipientSearch(e.target.value)}
                    placeholder={t.notifications_view.queue.recipient_placeholder}
                    className="pl-8"
                  />
                </div>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => void loadDeliveries()} disabled={queueLoading} className="gap-2 shrink-0">
              <ArrowsClockwise size={14} className={queueLoading ? 'animate-spin' : ''} />
              {t.common.refresh}
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {([
              { key: 'stat_total', count: queueStats.total, cls: 'text-foreground' },
              { key: 'stat_pending', count: queueStats.pending, cls: 'text-amber-600' },
              { key: 'stat_processing', count: queueStats.processing, cls: 'text-blue-600' },
              { key: 'stat_sent', count: queueStats.sent, cls: 'text-emerald-600' },
              { key: 'stat_failed', count: queueStats.failed, cls: 'text-destructive' },
              { key: 'stat_cancelled', count: queueStats.cancelled, cls: 'text-muted-foreground' },
            ] as const).map(({ key, count, cls }) => (
              <Card key={key}>
                <CardContent className="p-3 text-center">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">{t.notifications_view.queue[key]}</p>
                  <p className={`text-2xl font-bold ${cls}`}>{count}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {deliveries.length === 0 && !queueLoading ? (
            <Card>
              <CardHeader>
                <CardTitle>{t.notifications_view.queue.empty_title}</CardTitle>
                <CardDescription>{t.notifications_view.queue.empty_description}</CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3">{t.notifications_view.queue.col_recipient}</th>
                    <th className="px-4 py-3">{t.notifications_view.queue.col_channel}</th>
                    <th className="px-4 py-3">{t.notifications_view.queue.col_trigger}</th>
                    <th className="px-4 py-3">{t.notifications_view.queue.col_status}</th>
                    <th className="px-4 py-3">{t.notifications_view.queue.col_attempts}</th>
                    <th className="px-4 py-3">{t.notifications_view.queue.col_sent_at}</th>
                    <th className="px-4 py-3">{t.notifications_view.queue.col_error}</th>
                    <th className="px-4 py-3">{t.notifications_view.queue.col_created}</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {deliveries.map((delivery) => {
                    const trigger = (delivery.payload?.trigger as string) || '-'
                    const triggerLabel = (t.notifications_view.triggers as Record<string, string>)[trigger] || trigger
                    return (
                      <tr key={delivery.id} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="px-4 py-3">
                          <div className="font-medium">{delivery.recipient_login || delivery.recipient_destination}</div>
                          {delivery.recipient_login && (
                            <div className="text-xs text-muted-foreground">{delivery.recipient_destination}</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="secondary">{t.notifications_view.channels[delivery.channel as NotificationChannel] ?? delivery.channel}</Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{triggerLabel}</td>
                        <td className="px-4 py-3">
                          <DeliveryStatusBadge status={delivery.status} t={t.notifications_view.queue} />
                        </td>
                        <td className="px-4 py-3 tabular-nums">{delivery.attempts}/{delivery.max_attempts}</td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                          {delivery.sent_at ? formatDateTime(delivery.sent_at) : '-'}
                        </td>
                        <td className="max-w-[200px] truncate px-4 py-3 text-xs text-muted-foreground" title={delivery.last_error ?? undefined}>
                          {delivery.last_error || '-'}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatDateTime(delivery.created_at)}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            {delivery.status === 'failed' && (
                              <Button type="button" variant="outline" size="sm" onClick={() => void handleRetryDelivery(delivery.id)}>
                                <ArrowsClockwise size={13} className="mr-1" />
                                {t.notifications_view.queue.retry}
                              </Button>
                            )}
                            {(delivery.status === 'pending' || delivery.status === 'failed') && (
                              <Button type="button" variant="outline" size="sm" onClick={() => void handleCancelDelivery(delivery.id)}>
                                <XCircle size={13} className="mr-1" />
                                {t.notifications_view.queue.cancel}
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={ruleDialogOpen} onOpenChange={(open) => {
        setRuleDialogOpen(open)
        if (!open) resetRuleForm()
      }}>
        <DialogContent className="flex flex-col p-0 gap-0 overflow-hidden max-h-[92vh] sm:max-w-4xl">
          <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <DialogTitle>{editingRule ? t.notifications_view.actions.edit_rule : t.notifications_view.actions.new_rule}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveRule} className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="rule-name">{t.notifications_view.rule.name_label}</Label>
                <Input
                  id="rule-name"
                  value={ruleForm.name}
                  onChange={(event) => setRuleForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder={t.notifications_view.rule.name_placeholder}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{t.notifications_view.rule.event_type_label}</Label>
                <Select value={ruleForm.eventType} onValueChange={(value) => handleRuleEventTypeChange(value as NotificationEventType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NOTIFICATION_EVENT_TYPES.map((eventType) => (
                      <SelectItem key={eventType} value={eventType}>{resolveEventTypeLabel(eventType)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t.notifications_view.rule.channels_label}</CardTitle>
                  <CardDescription>{t.notifications_view.rule.channels_description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    {CHANNELS.map((channel) => (
                      <label key={channel} className="flex cursor-pointer items-center gap-3 rounded-md border p-3">
                        <Checkbox
                          checked={ruleForm.channels.includes(channel)}
                          onCheckedChange={(checked) => toggleChannel(channel, checked === true)}
                        />
                        <span className="font-medium">{t.notifications_view.channels[channel]}</span>
                      </label>
                    ))}
                  </div>

                  <div className="space-y-3">
                    <p className="text-sm font-medium">{t.notifications_view.rule.conditions_label}</p>
                    <p className="text-xs text-muted-foreground">{t.notifications_view.rule.conditions_description}</p>
                    {ruleForm.conditions.map((condition) => (
                      <div key={condition.trigger} className="space-y-3 rounded-md border p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium">{t.notifications_view.triggers[condition.trigger]}</p>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={condition.enabled}
                              onCheckedChange={(checked) => toggleCondition(condition.trigger, checked)}
                            />
                            <span className="text-xs text-muted-foreground">
                              {condition.enabled ? t.notifications_view.status.active : t.notifications_view.status.inactive}
                            </span>
                          </div>
                        </div>

                        {condition.enabled && NOTIFICATION_TIMED_TRIGGERS.has(condition.trigger) && (
                          <div className="space-y-1">
                            <Label>{t.notifications_view.rule.days_before_label}</Label>
                            <Input
                              type="number"
                              min={0}
                              step={1}
                              value={typeof condition.daysBefore === 'number' ? String(condition.daysBefore) : String(DEFAULT_NOTIFICATION_DAYS_BEFORE[condition.trigger] || 0)}
                              onChange={(event) => setConditionDaysBefore(condition.trigger, event.target.value)}
                            />
                          </div>
                        )}

                        {condition.enabled && ruleForm.channels.includes('email') && (
                          <div className="space-y-1">
                            <Label>{t.notifications_view.rule.email_template_label}</Label>
                            <Select
                              value={condition.emailTemplateId || NO_TEMPLATE_VALUE}
                              onValueChange={(value) => setConditionTemplate(condition.trigger, 'email', value === NO_TEMPLATE_VALUE ? undefined : value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={t.notifications_view.rule.select_template_placeholder} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={NO_TEMPLATE_VALUE}>{t.notifications_view.rule.no_template}</SelectItem>
                                {templateOptionsByChannel.email.map((template) => (
                                  <SelectItem key={template.id} value={template.id}>{formatTemplateOptionLabel(template)}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {condition.enabled && ruleForm.channels.includes('sms') && (
                          <div className="space-y-1">
                            <Label>{t.notifications_view.rule.sms_template_label}</Label>
                            <Select
                              value={condition.smsTemplateId || NO_TEMPLATE_VALUE}
                              onValueChange={(value) => setConditionTemplate(condition.trigger, 'sms', value === NO_TEMPLATE_VALUE ? undefined : value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={t.notifications_view.rule.select_template_placeholder} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={NO_TEMPLATE_VALUE}>{t.notifications_view.rule.no_template}</SelectItem>
                                {templateOptionsByChannel.sms.map((template) => (
                                  <SelectItem key={template.id} value={template.id}>{formatTemplateOptionLabel(template)}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {condition.enabled && ruleForm.channels.includes('whatsapp') && (
                          <div className="space-y-1">
                            <Label>{t.notifications_view.rule.whatsapp_template_label}</Label>
                            <Select
                              value={condition.whatsappTemplateId || NO_TEMPLATE_VALUE}
                              onValueChange={(value) => setConditionTemplate(condition.trigger, 'whatsapp', value === NO_TEMPLATE_VALUE ? undefined : value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={t.notifications_view.rule.select_template_placeholder} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={NO_TEMPLATE_VALUE}>{t.notifications_view.rule.no_template}</SelectItem>
                                {templateOptionsByChannel.whatsapp.map((template) => (
                                  <SelectItem key={template.id} value={template.id}>{formatTemplateOptionLabel(template)}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t.notifications_view.rule.recipients_label}</CardTitle>
                  <CardDescription>{t.notifications_view.rule.recipients_description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {ruleForm.eventType === 'tasks' && (
                    <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
                      <Checkbox
                        checked={ruleForm.sendToTaskAssignee}
                        onCheckedChange={(checked) => setRuleForm((current) => ({
                          ...current,
                          sendToTaskAssignee: checked === true,
                        }))}
                      />
                      <div className="min-w-0">
                        <p className="font-medium">{t.notifications_view.rule.task_assignee_label}</p>
                        <p className="text-xs text-muted-foreground">{t.notifications_view.rule.task_assignee_description}</p>
                      </div>
                    </label>
                  )}
                  {ruleForm.eventType === 'user-access' && (
                    <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
                      <Checkbox
                        checked={ruleForm.sendToEventRecipient}
                        onCheckedChange={(checked) => setRuleForm((current) => ({
                          ...current,
                          sendToEventRecipient: checked === true,
                        }))}
                      />
                      <div className="min-w-0">
                        <p className="font-medium">{t.notifications_view.rule.event_recipient_label}</p>
                        <p className="text-xs text-muted-foreground">{t.notifications_view.rule.event_recipient_description}</p>
                      </div>
                    </label>
                  )}
                  <div className="space-y-3">
                    <p className="text-sm font-medium">{t.notifications_view.rule.recipient_groups_label}</p>
                    {USER_ROLES.map((role) => (
                      <label key={role} className="flex cursor-pointer items-center gap-3 rounded-md border p-3">
                        <Checkbox
                          checked={ruleForm.recipientRoles.includes(role)}
                          onCheckedChange={(checked) => toggleRole(role, checked === true)}
                        />
                        <span>{t.roles[role]}</span>
                      </label>
                    ))}
                  </div>

                  <div className="space-y-3">
                    <p className="text-sm font-medium">{t.notifications_view.rule.recipient_users_label}</p>
                    <div className="max-h-56 space-y-2 overflow-y-auto rounded-md border p-2">
                      {recipientOptions.length === 0 && (
                        <p className="px-2 py-3 text-sm text-muted-foreground">{t.notifications_view.rule.no_users_available}</p>
                      )}
                      {recipientOptions.map((recipient) => (
                        <label key={recipient.id} className="flex cursor-pointer items-start gap-3 rounded-md p-2 hover:bg-muted/40">
                          <Checkbox
                            checked={ruleForm.recipientUserIds.includes(recipient.id)}
                            onCheckedChange={(checked) => toggleRecipient(recipient.id, checked === true)}
                          />
                          <div className="min-w-0">
                            <p className="font-medium leading-none">{recipient.githubLogin}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{recipient.email || t.notifications_view.rule.no_email}</p>
                          </div>
                          <Badge variant="outline" className="ml-auto">{t.roles[recipient.role]}</Badge>
                        </label>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t shrink-0 bg-background">
              <Button type="button" variant="outline" onClick={() => setRuleDialogOpen(false)}>
                {t.notifications_view.actions.cancel}
              </Button>
              <Button type="submit">{editingRule ? t.common.update : t.common.create}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={templateDialogOpen} onOpenChange={(open) => {
        setTemplateDialogOpen(open)
        if (!open) resetTemplateForm()
      }}>
        <DialogContent className="flex flex-col p-0 gap-0 overflow-hidden max-h-[96vh] w-[min(96vw,1280px)] max-w-none">
          <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <DialogTitle>{editingTemplate ? t.notifications_view.actions.edit_template : t.notifications_view.actions.new_template}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveTemplate} className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_180px_180px_180px_180px]">
              <div className="space-y-2">
                <Label htmlFor="template-name">{t.notifications_view.template.name_label}</Label>
                <Input
                  id="template-name"
                  value={templateForm.name}
                  onChange={(event) => setTemplateForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder={t.notifications_view.template.name_placeholder}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="template-channel">{t.notifications_view.template.channel_label}</Label>
                <Select
                  value={templateForm.channel}
                  onValueChange={(value) => setTemplateForm((current) => ({ ...current, channel: value as NotificationChannel }))}
                >
                  <SelectTrigger id="template-channel">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHANNELS.map((channel) => (
                      <SelectItem key={channel} value={channel}>{t.notifications_view.channels[channel]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="template-event-type">{t.notifications_view.template.event_type_label}</Label>
                <Select
                  value={templateForm.eventType}
                  onValueChange={(value) => setTemplateForm((current) => ({ ...current, eventType: value as NotificationTemplate['eventType'] }))}
                >
                  <SelectTrigger id="template-event-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">{t.notifications_view.template.event_type_general}</SelectItem>
                    {NOTIFICATION_EVENT_TYPES.map((eventType) => (
                      <SelectItem key={eventType} value={eventType}>{resolveEventTypeLabel(eventType)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="template-language">{t.notifications_view.template.language_label}</Label>
                <Select
                  value={templateForm.language}
                  onValueChange={(value) => setTemplateForm((current) => ({ ...current, language: value as TemplateLanguage }))}
                >
                  <SelectTrigger id="template-language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_LANGUAGES.map((templateLanguage) => (
                      <SelectItem key={templateLanguage.code} value={templateLanguage.code}>
                        {templateLanguage.nativeName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="template-content-type">{t.notifications_view.template.content_type_label}</Label>
                <Select
                  value={templateForm.contentType}
                  onValueChange={(value) => setTemplateForm((current) => ({ ...current, contentType: value as NotificationTemplateContentType }))}
                >
                  <SelectTrigger id="template-content-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="html">{t.notifications_view.template.content_type_html}</SelectItem>
                    <SelectItem value="text">{t.notifications_view.template.content_type_text}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-description">{t.notifications_view.template.description_label}</Label>
              <Textarea
                id="template-description"
                value={templateForm.description || ''}
                onChange={(event) => setTemplateForm((current) => ({ ...current, description: event.target.value }))}
                placeholder={t.notifications_view.template.description_placeholder}
                rows={2}
              />
            </div>

            {templateForm.channel === 'email' && (
              <div className="space-y-2">
                <Label htmlFor="template-subject">{t.notifications_view.template.subject_label}</Label>
                <Input
                  id="template-subject"
                  value={templateForm.subject || ''}
                  onChange={(event) => setTemplateForm((current) => ({ ...current, subject: event.target.value }))}
                  placeholder={t.notifications_view.template.subject_placeholder}
                />
              </div>
            )}

            <Tabs value={templateEditorTab} onValueChange={(value) => setTemplateEditorTab(value as 'template' | 'preview')}>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[180px_minmax(0,360px)_minmax(0,360px)]">
                    <div className="space-y-1">
                      <Label htmlFor="preview-event-type">{t.notifications_view.template.preview_event_type_label}</Label>
                      <Select value={selectedPreviewEventType} onValueChange={(value) => setSelectedPreviewEventType(value as NotificationEventType)}>
                        <SelectTrigger id="preview-event-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {NOTIFICATION_EVENT_TYPES.map((eventType) => (
                            <SelectItem key={eventType} value={eventType}>{resolveEventTypeLabel(eventType)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="preview-item">{t.notifications_view.template.preview_item_label}</Label>
                      <Select
                        value={selectedPreviewValue}
                        onValueChange={(value) => setSelectedPreviewItemIds((current) => ({ ...current, [selectedPreviewEventType]: value }))}
                      >
                        <SelectTrigger id="preview-item">
                          <SelectValue placeholder={t.notifications_view.template.preview_item_placeholder} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NO_PREVIEW_ITEM_VALUE}>
                            {selectedPreviewEventType === 'user-access'
                              ? t.notifications_view.template.preview_user_none
                              : t.notifications_view.template.preview_item_none}
                          </SelectItem>
                          {(previewOptionsByEventType[selectedPreviewEventType] || []).map((option) => (
                            <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>{t.notifications_view.template.editor_label}</Label>
                      <TabsList>
                        <TabsTrigger value="template">{t.notifications_view.template.tab_template}</TabsTrigger>
                        <TabsTrigger value="preview">{t.notifications_view.template.tab_preview}</TabsTrigger>
                      </TabsList>
                    </div>
                  </div>

                  <div className="flex w-full flex-col gap-2 lg:w-auto lg:flex-row">
                    {translationSources.length > 0 && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full lg:w-auto"
                            disabled={isTemplateTranslating}
                          >
                            {t.notifications_view.template.translate_from}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {translationSources.map((sourceTemplate) => (
                            <DropdownMenuItem
                              key={sourceTemplate.id}
                              onClick={() => void handleTranslateTemplateFrom(sourceTemplate)}
                            >
                              {getLanguageLabel(sourceTemplate.language)}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}

                    <Button
                      type="button"
                      className="w-full shrink-0 lg:w-auto"
                      onClick={() => openVariableHelpFor('template')}
                    >
                      {t.notifications_view.actions.open_variable_help}
                    </Button>
                  </div>
                </div>

                <TabsContent value="template" className="mt-3">
                  <div className="h-[50vh]">
                    {templateForm.contentType === 'html' ? (
                      <RichTextEditor
                        ref={editorRef}
                        content={templateForm.content}
                        onChange={(html) => setTemplateForm((current) => ({ ...current, content: html }))}
                        tokenPreviewResolver={(token) => {
                          const normalizedPath = token.startsWith('notification.')
                            ? token.slice('notification.'.length)
                            : token
                          return getNotificationValueByPath(notificationPreviewContext.notification, normalizedPath)
                        }}
                      />
                    ) : (
                      <Textarea
                        value={templateForm.content}
                        onChange={(event) => setTemplateForm((current) => ({ ...current, content: event.target.value }))}
                        className="h-full min-h-[50vh] resize-none font-mono text-sm"
                        placeholder="{{trigger}}"
                      />
                    )}
                  </div>
                </TabsContent>
                <TabsContent value="preview" className="mt-3">
                  <div className="h-[50vh] overflow-auto rounded-md border bg-white p-4 text-sm leading-relaxed text-foreground [&_p]:my-1 [&_strong]:font-bold [&_em]:italic [&_u]:underline [&_[style*='text-align:center']]:text-center [&_[style*='text-align:right']]:text-right [&_[style*='text-align:justify']]:text-justify">
                    {!templateForm.content && (
                      <p className="text-muted-foreground">{t.notifications_view.template.preview_empty}</p>
                    )}
                    {templateForm.content && !previewHtml && (
                      <p className="text-muted-foreground">{t.notifications_view.template.preview_unavailable}</p>
                    )}
                    {templateForm.content && previewHtml && (
                      isHtmlTemplateContent(previewHtml)
                        ? <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
                        : <pre className="whitespace-pre-wrap font-mono text-xs">{previewHtml}</pre>
                    )}
                  </div>
                </TabsContent>
              </Tabs>

            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t shrink-0 bg-background">
              <Button type="button" variant="outline" onClick={() => setTemplateDialogOpen(false)}>
                {t.notifications_view.actions.cancel}
              </Button>
              <Button type="submit">{editingTemplate ? t.common.update : t.common.create}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={masterTemplateEditorOpen} onOpenChange={setMasterTemplateEditorOpen}>
        <DialogContent className="flex flex-col p-0 gap-0 overflow-hidden max-h-[96vh] w-[min(96vw,1280px)] max-w-none">
          <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <DialogTitle>
              {masterTemplateEditorSection === 'header'
                ? t.notifications_view.template.master_header_label
                : t.notifications_view.template.master_footer_label}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[180px_minmax(0,360px)]">
                <div className="space-y-1">
                  <Label htmlFor="master-preview-event-type">{t.notifications_view.template.preview_event_type_label}</Label>
                  <Select value={selectedPreviewEventType} onValueChange={(value) => setSelectedPreviewEventType(value as NotificationEventType)}>
                    <SelectTrigger id="master-preview-event-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {NOTIFICATION_EVENT_TYPES.map((eventType) => (
                        <SelectItem key={eventType} value={eventType}>{resolveEventTypeLabel(eventType)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="master-preview-item">{t.notifications_view.template.preview_item_label}</Label>
                  <Select
                    value={selectedPreviewValue}
                    onValueChange={(value) => setSelectedPreviewItemIds((current) => ({ ...current, [selectedPreviewEventType]: value }))}
                  >
                    <SelectTrigger id="master-preview-item">
                      <SelectValue placeholder={t.notifications_view.template.preview_item_placeholder} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_PREVIEW_ITEM_VALUE}>
                        {selectedPreviewEventType === 'user-access'
                          ? t.notifications_view.template.preview_user_none
                          : t.notifications_view.template.preview_item_none}
                      </SelectItem>
                      {(previewOptionsByEventType[selectedPreviewEventType] || []).map((option) => (
                        <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                type="button"
                className="w-full shrink-0 lg:w-auto"
                onClick={() => openVariableHelpFor(masterTemplateEditorSection === 'header' ? 'master-header' : 'master-footer')}
              >
                {t.notifications_view.actions.open_variable_help}
              </Button>
            </div>

            <div className="h-[50vh]">
              {masterTemplateEditorSection === 'header' ? (
                <RichTextEditor
                  ref={masterHeaderEditorRef}
                  content={masterTemplateForm.headerContent || '<p></p>'}
                  onChange={(html) => setMasterTemplateForm((current) => ({ ...current, channel: masterTemplateChannel, headerContent: html }))}
                  tokenPreviewResolver={(token) => {
                    const normalizedPath = token.startsWith('notification.')
                      ? token.slice('notification.'.length)
                      : token
                    return getNotificationValueByPath(notificationPreviewContext.notification, normalizedPath)
                  }}
                />
              ) : (
                <RichTextEditor
                  ref={masterFooterEditorRef}
                  content={masterTemplateForm.footerContent || '<p></p>'}
                  onChange={(html) => setMasterTemplateForm((current) => ({ ...current, channel: masterTemplateChannel, footerContent: html }))}
                  tokenPreviewResolver={(token) => {
                    const normalizedPath = token.startsWith('notification.')
                      ? token.slice('notification.'.length)
                      : token
                    return getNotificationValueByPath(notificationPreviewContext.notification, normalizedPath)
                  }}
                />
              )}
            </div>

            <div className="h-[50vh] overflow-auto rounded-md border bg-white p-4 text-sm leading-relaxed text-foreground [&_p]:my-1 [&_strong]:font-bold [&_em]:italic [&_u]:underline [&_[style*='text-align:center']]:text-center [&_[style*='text-align:right']]:text-right [&_[style*='text-align:justify']]:text-justify">
              {masterTemplateEditorSection === 'header' && !masterTemplateForm.headerContent && (
                <p className="text-muted-foreground">{t.notifications_view.template.preview_empty}</p>
              )}
              {masterTemplateEditorSection === 'header' && masterTemplateForm.headerContent && !masterHeaderPreviewHtml && (
                <p className="text-muted-foreground">{t.notifications_view.template.preview_unavailable}</p>
              )}
              {masterTemplateEditorSection === 'header' && masterTemplateForm.headerContent && masterHeaderPreviewHtml && (
                <div dangerouslySetInnerHTML={{ __html: masterHeaderPreviewHtml }} />
              )}
              {masterTemplateEditorSection === 'footer' && !masterTemplateForm.footerContent && (
                <p className="text-muted-foreground">{t.notifications_view.template.preview_empty}</p>
              )}
              {masterTemplateEditorSection === 'footer' && masterTemplateForm.footerContent && !masterFooterPreviewHtml && (
                <p className="text-muted-foreground">{t.notifications_view.template.preview_unavailable}</p>
              )}
              {masterTemplateEditorSection === 'footer' && masterTemplateForm.footerContent && masterFooterPreviewHtml && (
                <div dangerouslySetInnerHTML={{ __html: masterFooterPreviewHtml }} />
              )}
            </div>

          </div>
          <div className="flex justify-end gap-2 px-6 py-4 border-t shrink-0 bg-background">
            <Button type="button" variant="outline" onClick={() => setMasterTemplateEditorOpen(false)}>
              {t.notifications_view.actions.cancel}
            </Button>
            <Button type="button" onClick={() => void handleSaveMasterTemplate()} disabled={masterTemplateSaving}>
              {t.notifications_view.template.save_master}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={variableDialogOpen} onOpenChange={(open) => {
        setVariableDialogOpen(open)
        if (open) {
          getEditorHandle(variableEditorTarget)?.captureCurrentSelection()
          setTimeout(() => {
            xpathFilterInputRef.current?.focus()
          }, 50)
        } else {
          setXpathInput('')
          restoreEditorFocus(variableEditorTarget)
        }
      }}>
        <DialogContent
          className="max-h-[85vh] overflow-y-hidden p-0 sm:max-w-3xl"
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          <DialogHeader className="border-b bg-background px-6 pb-3 pt-6 pr-12">
            <DialogTitle>{t.notifications_view.variable_help.title}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[calc(85vh-76px)] space-y-3 overflow-y-auto px-6 pb-6">
            <div className="rounded-md border bg-muted/30 p-3 text-sm leading-relaxed">
              {t.notifications_view.variable_help.description}
            </div>

            <div className="grid gap-3 rounded-md border p-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t.notifications_view.variable_help.xpath_label}</Label>
                  <Input
                    value={xpathInput}
                    onChange={(event) => setXpathInput(event.target.value)}
                    placeholder={t.notifications_view.variable_help.xpath_placeholder}
                  />
                  <p className="text-xs text-muted-foreground">{t.notifications_view.variable_help.token_hint}</p>
                </div>

                <div className="space-y-2">
                  <Label>{t.notifications_view.variable_help.value_preview_label}</Label>
                  <div className="max-h-32 overflow-auto rounded border bg-muted/40 px-3 py-2">
                    <p className="whitespace-pre-wrap break-all font-mono text-xs">{xpathPreview || t.notifications_view.variable_help.value_preview_placeholder}</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Button type="button" variant="outline" size="sm" onClick={() => void handleCopyXPathToken()}>
                  {t.notifications_view.variable_help.copy_xpath}
                </Button>
                <Button type="button" size="sm" onClick={() => handleInsertToken(`{{${xpathInput.trim()}}}`)}>
                  {t.notifications_view.variable_help.insert_template}
                </Button>
              </div>
            </div>

            <div className="rounded-md border p-3">
              <p className="mb-2 text-sm font-medium">{t.notifications_view.variable_help.paths_title}</p>
              <div className="relative mb-3">
                <MagnifyingGlass size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={xpathFilterInputRef}
                  value={xpathFilter}
                  onChange={(event) => setXpathFilter(event.target.value)}
                  placeholder={t.notifications_view.variable_help.paths_filter_placeholder}
                  className="pl-9"
                />
              </div>

              {xpathPreviewRows.length === 0 && (
                <p className="text-sm text-muted-foreground">{t.notifications_view.variable_help.no_paths_available}</p>
              )}
              {xpathPreviewRows.length > 0 && filteredXPathPreviewRows.length === 0 && (
                <p className="text-sm text-muted-foreground">{t.notifications_view.variable_help.no_paths_found}</p>
              )}

              {filteredXPathPreviewRows.length > 0 && (
                <div className="max-h-64 space-y-2 overflow-auto">
                  {filteredXPathPreviewRows.map((row) => (
                    <button
                      key={row.path}
                      type="button"
                      className="block w-full rounded border bg-muted/20 px-2 py-1 text-left transition-colors hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-primary"
                      title={t.notifications_view.variable_help.use_xpath_title}
                      onClick={() => setXpathInput(row.path)}
                      onDoubleClick={() => {
                        setXpathInput(row.path)
                        handleInsertToken(`{{${row.path}}}`)
                      }}
                    >
                      <p className="break-all font-mono text-xs font-semibold">{row.path}</p>
                      <p className="whitespace-pre-wrap break-all font-mono text-xs text-muted-foreground">{row.value || t.notifications_view.variable_help.empty_value}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {pendingTemplateTranslation && (
        <Dialog open onOpenChange={(open) => {
          if (!open && !isTemplateTranslating) {
            setPendingTemplateTranslation(null)
          }
        }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>
                {t.notifications_view.template.translation_create_title.replace(
                  '{language}',
                  getLanguageLabel(pendingTemplateTranslation.targetLanguage)
                )}
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              {t.notifications_view.template.translation_create_description.replace(
                '{language}',
                getLanguageLabel(pendingTemplateTranslation.sourceTemplate.language)
              )}
            </p>
            <div className="mt-2 flex flex-col gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={isTemplateTranslating}
                onClick={() => {
                  handleAddTemplateTranslation(
                    pendingTemplateTranslation.sourceTemplate,
                    pendingTemplateTranslation.targetLanguage
                  )
                  setPendingTemplateTranslation(null)
                }}
              >
                {t.notifications_view.template.translation_copy_content}
              </Button>
              <Button
                type="button"
                disabled={isTemplateTranslating}
                onClick={() => void handleAddTemplateTranslationWithAI(
                  pendingTemplateTranslation.sourceTemplate,
                  pendingTemplateTranslation.targetLanguage
                )}
              >
                {isTemplateTranslating
                  ? t.notifications_view.template.translation_with_ai_loading
                  : t.notifications_view.template.translation_with_ai}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
