import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import HtmlEditorWithPreview from '@/components/HtmlEditorWithPreview'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useKV } from '@/lib/useSupabaseKV'
import { useLanguage } from '@/lib/LanguageContext'
import { useAuth } from '@/lib/AuthContext'
import { useDateFormat } from '@/lib/DateFormatContext'
import { supabase } from '@/lib/supabase'
import RichTextEditor, { plainTextToHTML, type RichTextEditorHandle } from '@/components/RichTextEditor'
import { toast } from 'sonner'
import {
  ArrowsClockwise,
  Bell,
  Bug,
  CalendarCheck,
  CheckSquare,
  Copy,
  EnvelopeSimple,
  Files,
  MagnifyingGlass,
  Pencil,
  Plus,
  Trash,
  WhatsappLogo,
  XCircle,
} from '@phosphor-icons/react'
import type {
  NotificationChannel,
  NotificationRule,
  NotificationTemplate,
  NotificationTrigger,
  Property,
  Task,
  UserRole,
} from '@/types'

type RecipientOption = {
  id: string
  githubLogin: string
  email: string
  role: UserRole
  status: string
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

type MasterTemplateConfig = {
  channel: NotificationChannel
  headerContent: string
  footerContent: string
}

type TaskConditionForm = {
  trigger: NotificationTrigger
  enabled: boolean
  emailTemplateId?: string
  smsTemplateId?: string
  whatsappTemplateId?: string
}

type TaskNotificationForm = {
  id: string
  groupId: string
  name: string
  eventType: 'tasks'
  channels: NotificationChannel[]
  recipientRoles: UserRole[]
  recipientUserIds: string[]
  conditions: TaskConditionForm[]
  createdAt: string
  updatedAt: string
}

type TaskNotificationGroup = {
  groupId: string
  name: string
  channels: NotificationChannel[]
  recipientRoles: UserRole[]
  recipientUserIds: string[]
  conditions: TaskConditionForm[]
  createdAt: string
  updatedAt: string
}

const CHANNELS: NotificationChannel[] = ['email', 'sms', 'whatsapp']
const TRIGGERS: NotificationTrigger[] = [
  'task-created',
  'task-due-tomorrow',
  'task-due-today',
  'task-overdue-open',
  'task-resolved',
]
const REMINDER_TRIGGERS = new Set<NotificationTrigger>([
  'task-due-tomorrow',
  'task-due-today',
  'task-overdue-open',
])
const USER_ROLES: UserRole[] = ['admin', 'guest']
const NO_PREVIEW_TASK_VALUE = '__none__'
const NO_TEMPLATE_VALUE = '__none__'

function normalizeRuleNameKey(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

function buildDefaultTaskConditions(): TaskConditionForm[] {
  return TRIGGERS.map((trigger, index) => ({
    trigger,
    enabled: index === 0,
    emailTemplateId: undefined,
    smsTemplateId: undefined,
    whatsappTemplateId: undefined,
  }))
}

function isHTML(content: string) {
  return /<[a-z][\s\S]*>/i.test(content)
}

function normalizeEditorContent(content: string) {
  return isHTML(content) ? content : plainTextToHTML(content)
}

function stringifyPreviewValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function collectPreviewRows(
  value: unknown,
  basePath: string,
  rows: PreviewRow[],
  depth = 0,
  maxDepth = 5
) {
  if (rows.length >= 300) return

  if (value === null || value === undefined || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    rows.push({ path: basePath, value: stringifyPreviewValue(value) })
    return
  }

  if (depth >= maxDepth) {
    rows.push({ path: basePath, value: stringifyPreviewValue(value) })
    return
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      rows.push({ path: basePath, value: '[]' })
      return
    }

    value.forEach((item, index) => {
      const nextPath = basePath ? `${basePath}{${index + 1}}` : `{${index + 1}}`
      collectPreviewRows(item, nextPath, rows, depth + 1, maxDepth)
    })
    return
  }

  const record = value as Record<string, unknown>
  const keys = Object.keys(record)
  if (keys.length === 0) {
    rows.push({ path: basePath, value: '{}' })
    return
  }

  keys.forEach((key) => {
    const nextPath = basePath ? `${basePath}.${key}` : key
    collectPreviewRows(record[key], nextPath, rows, depth + 1, maxDepth)
  })
}

function getValueByPath(source: unknown, path: string): string | null {
  if (!path) return null

  const result = path.split('.').reduce<unknown>((current, segment) => {
    if (!segment) return current
    if (current === null || current === undefined) return null

    const arrayMatch = segment.match(/^(.*)\{(\d+)\}$/)
    if (arrayMatch) {
      const [, key, position] = arrayMatch
      const keyedValue = key ? (current as Record<string, unknown>)[key] : current
      if (!Array.isArray(keyedValue)) return null
      return keyedValue[Number(position) - 1]
    }

    if (typeof current !== 'object') return null
    return (current as Record<string, unknown>)[segment]
  }, source)

  if (result === null || result === undefined) return null
  return stringifyPreviewValue(result)
}

function renderNotificationTemplate(
  content: string,
  notificationContext: Record<string, unknown>
) {
  return content.replace(/{{\s*([^{}]+?)\s*}}/g, (_match, tokenPath: string) => {
    const trimmedToken = tokenPath.trim()
    const normalizedPath = trimmedToken.startsWith('notification.')
      ? trimmedToken.slice('notification.'.length)
      : trimmedToken

    return getValueByPath(notificationContext, normalizedPath) ?? ''
  })
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
  const { t } = useLanguage()
  const { currentTenantId } = useAuth()
  const { formatDate, formatDateTime } = useDateFormat()
  const [rules, setRules] = useKV<NotificationRule[]>('notification-rules', [])
  const [templates, setTemplates] = useKV<NotificationTemplate[]>('notification-templates', [])
  const [tasks] = useKV<Task[]>('tasks', [])
  const [properties] = useKV<Property[]>('properties', [])
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
  const [editingRule, setEditingRule] = useState<TaskNotificationGroup | null>(null)
  const [editingTemplate, setEditingTemplate] = useState<NotificationTemplate | null>(null)
  const [templateSearch, setTemplateSearch] = useState('')
  const [selectedPreviewEventType, setSelectedPreviewEventType] = useState<'tasks'>('tasks')
  const [selectedPreviewTaskId, setSelectedPreviewTaskId] = useState(NO_PREVIEW_TASK_VALUE)
  const [templateEditorTab, setTemplateEditorTab] = useState<'template' | 'preview'>('template')
  const [xpathInput, setXpathInput] = useState('')
  const [xpathFilter, setXpathFilter] = useState('')
  const xpathFilterInputRef = useRef<HTMLInputElement | null>(null)
  const editorRef = useRef<RichTextEditorHandle | null>(null)
  const [ruleForm, setRuleForm] = useState<TaskNotificationForm>({
    id: '',
    groupId: '',
    name: '',
    eventType: 'tasks',
    channels: ['email'],
    recipientRoles: ['admin'],
    recipientUserIds: [],
    conditions: buildDefaultTaskConditions(),
    createdAt: '',
    updatedAt: '',
  })
  const [templateForm, setTemplateForm] = useState<NotificationTemplate>({
    id: '',
    name: '',
    channel: 'email',
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

  const loadRecipients = useCallback(async () => {
    if (!currentTenantId) {
      setRecipientOptions([])
      return
    }

    const { data, error } = await supabase
      .from('user_profiles')
      .select('auth_user_id, github_login, email, role, status')
      .eq('tenant_id', currentTenantId)
      .order('created_at', { ascending: true })

    if (error) {
      toast.error(t.notifications_view.messages.recipients_load_error)
      setRecipientOptions([])
      return
    }

    setRecipientOptions((data || []).map((row: any) => ({
      id: row.auth_user_id || `login:${row.github_login}`,
      githubLogin: row.github_login,
      email: row.email || '',
      role: row.role,
      status: row.status,
    })))
  }, [currentTenantId, t.notifications_view.messages.recipients_load_error])

  useEffect(() => {
    void loadRecipients()
  }, [loadRecipients])

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
      conditions: buildDefaultTaskConditions(),
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
    setSelectedPreviewTaskId(NO_PREVIEW_TASK_VALUE)
    setTemplateForm({
      id: '',
      name: '',
      channel: 'email',
      subject: '',
      content: '',
      createdAt: '',
      updatedAt: '',
    })
  }

  const templateOptionsByChannel = useMemo(() => ({
    email: (templates || []).filter((template) => template.channel === 'email'),
    sms: (templates || []).filter((template) => template.channel === 'sms'),
    whatsapp: (templates || []).filter((template) => template.channel === 'whatsapp'),
  }), [templates])

  const taskNotificationGroups = useMemo<TaskNotificationGroup[]>(() => {
    const grouped = new Map<string, TaskNotificationGroup>()

    for (const rule of (rules || [])) {
      if (!TRIGGERS.includes(rule.trigger)) continue

      const groupId = normalizeRuleNameKey(rule.name)
      const existing = grouped.get(groupId)
      const conditionFromRule: TaskConditionForm = {
        trigger: rule.trigger,
        enabled: rule.isActive,
        emailTemplateId: rule.emailTemplateId,
        smsTemplateId: rule.smsTemplateId,
        whatsappTemplateId: rule.whatsappTemplateId,
      }

      if (!existing) {
        grouped.set(groupId, {
          groupId,
          name: rule.name,
          channels: [...rule.channels],
          recipientRoles: [...rule.recipientRoles],
          recipientUserIds: [...rule.recipientUserIds],
          conditions: [conditionFromRule],
          createdAt: rule.createdAt,
          updatedAt: rule.updatedAt,
        })
        continue
      }

      existing.channels = Array.from(new Set([...existing.channels, ...rule.channels]))
      existing.recipientRoles = Array.from(new Set([...existing.recipientRoles, ...rule.recipientRoles]))
      existing.recipientUserIds = Array.from(new Set([...existing.recipientUserIds, ...rule.recipientUserIds]))
      existing.conditions.push(conditionFromRule)
      existing.updatedAt = existing.updatedAt > rule.updatedAt ? existing.updatedAt : rule.updatedAt
    }

    return Array.from(grouped.values())
      .map((group) => {
        const byTrigger = new Map(group.conditions.map((condition) => [condition.trigger, condition]))
        return {
          ...group,
          conditions: TRIGGERS.map((trigger) => byTrigger.get(trigger) || {
            trigger,
            enabled: false,
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
    if (!query) return templates || []
    return (templates || []).filter((template) => (
      template.name.toLowerCase().includes(query)
      || template.channel.toLowerCase().includes(query)
      || (template.subject || '').toLowerCase().includes(query)
    ))
  }, [templateSearch, templates])

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

  const selectedPreviewTask = useMemo(() => {
    if (selectedPreviewTaskId === NO_PREVIEW_TASK_VALUE) return null
    return (tasks || []).find((task) => task.id === selectedPreviewTaskId) || null
  }, [selectedPreviewTaskId, tasks])

  const selectedPreviewTaskProperty = useMemo(() => {
    if (!selectedPreviewTask?.propertyId) return null
    return (properties || []).find((property) => property.id === selectedPreviewTask.propertyId) || null
  }, [properties, selectedPreviewTask])

  const notificationPreviewContext = useMemo(() => {
    const firstEnabledCondition = ruleForm.conditions.find((condition) => condition.enabled) || ruleForm.conditions[0]
    return {
      notification: {
        ruleName: ruleForm.name || t.notifications_view.preview.default_rule_name,
        trigger: t.notifications_view.triggers[firstEnabledCondition?.trigger || 'task-created'],
        eventType: selectedPreviewEventType,
        channel: t.notifications_view.channels[templateForm.channel],
        subject: templateForm.subject || t.notifications_view.preview.default_subject,
        recipientCount: ruleForm.recipientUserIds.length + ruleForm.recipientRoles.length,
        task: selectedPreviewTask,
        property: selectedPreviewTaskProperty,
      },
    }
  }, [ruleForm.conditions, ruleForm.name, ruleForm.recipientRoles.length, ruleForm.recipientUserIds.length, selectedPreviewEventType, selectedPreviewTask, selectedPreviewTaskProperty, t.notifications_view.channels, t.notifications_view.preview.default_rule_name, t.notifications_view.preview.default_subject, t.notifications_view.triggers, templateForm.channel, templateForm.subject])

  const xpathPreviewRows = useMemo(() => {
    const rows: PreviewRow[] = []
    collectPreviewRows(notificationPreviewContext.notification, '', rows)
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
    return getValueByPath(notificationPreviewContext.notification, normalizedPath) || t.notifications_view.variable_help.value_preview_placeholder
  }, [notificationPreviewContext, t.notifications_view.variable_help.value_preview_placeholder, xpathInput])

  const previewHtml = useMemo(() => {
    const content = templateForm.content || ''
    if (!content) return ''
    return renderNotificationTemplate(content, notificationPreviewContext.notification)
  }, [notificationPreviewContext, templateForm.content])

  const resolveRecipientLabel = useCallback((recipientId: string) => {
    const option = recipientOptions.find((recipient) => recipient.id === recipientId)
    return option?.githubLogin || recipientId
  }, [recipientOptions])

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

  const openEditRule = (ruleGroup: TaskNotificationGroup) => {
    setEditingRule(ruleGroup)
    setRuleForm({
      id: ruleGroup.groupId,
      groupId: ruleGroup.groupId,
      name: ruleGroup.name,
      eventType: 'tasks',
      channels: [...ruleGroup.channels],
      recipientRoles: [...ruleGroup.recipientRoles],
      recipientUserIds: [...ruleGroup.recipientUserIds],
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
      content: normalizeEditorContent(template.content),
    })
    setTemplateDialogOpen(true)
  }

  const handleSaveRule = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!ruleForm.channels.length) {
      toast.error(t.notifications_view.messages.channels_required)
      return
    }

    if (!ruleForm.recipientRoles.length && !ruleForm.recipientUserIds.length) {
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
    const groupId = normalizeRuleNameKey(ruleForm.name)
    const previousGroupId = editingRule ? normalizeRuleNameKey(editingRule.name) : null
    const baseCreatedAt = editingRule?.createdAt || now

    const nextRules: NotificationRule[] = enabledConditions.map((condition) => ({
      id: `${groupId}:${condition.trigger}`,
      groupId,
      eventType: 'tasks',
      name: ruleForm.name,
      trigger: condition.trigger,
      channels: [...ruleForm.channels],
      emailTemplateId: ruleForm.channels.includes('email') ? condition.emailTemplateId : undefined,
      smsTemplateId: ruleForm.channels.includes('sms') ? condition.smsTemplateId : undefined,
      whatsappTemplateId: ruleForm.channels.includes('whatsapp') ? condition.whatsappTemplateId : undefined,
      recipientRoles: [...ruleForm.recipientRoles],
      recipientUserIds: [...ruleForm.recipientUserIds],
      daysBefore: REMINDER_TRIGGERS.has(condition.trigger)
        ? (condition.trigger === 'task-due-tomorrow' ? 1 : 0)
        : undefined,
      isActive: condition.enabled,
      createdAt: baseCreatedAt,
      updatedAt: now,
    }))

    const currentRules = rules || []
    const withoutCurrentGroup = currentRules.filter((item) => {
      const itemGroupId = normalizeRuleNameKey(item.name)
      if (itemGroupId === groupId) return false
      if (previousGroupId && itemGroupId === previousGroupId) return false
      return true
    })

    if (currentTenantId) {
      const previousGroupRules = currentRules.filter((item) => {
        const itemGroupId = normalizeRuleNameKey(item.name)
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
        channels: rule.channels || [],
        email_template_id: rule.emailTemplateId || null,
        sms_template_id: rule.smsTemplateId || null,
        whatsapp_template_id: rule.whatsappTemplateId || null,
        recipient_roles: rule.recipientRoles || [],
        recipient_user_ids: rule.recipientUserIds || [],
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

  const handleDeleteRule = (groupId: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este registro?')) return
    setRules((currentRules) => (currentRules || []).filter((item) => normalizeRuleNameKey(item.name) !== groupId))
    toast.success(t.notifications_view.messages.rule_deleted)
  }

  const handleSaveTemplate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const now = new Date().toISOString()
    const nextTemplate: NotificationTemplate = {
      ...templateForm,
      id: editingTemplate?.id || Date.now().toString(),
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
    const duplicatedTemplate: NotificationTemplate = {
      ...template,
      id: Date.now().toString(),
      name: `${template.name} (${t.notifications_view.template.duplicate_suffix})`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    setTemplates((currentTemplates) => [...(currentTemplates || []), duplicatedTemplate])
    toast.success(t.notifications_view.messages.template_duplicated)
  }

  const restoreEditorFocus = () => {
    setTimeout(() => {
      editorRef.current?.focusAtLastSelection()
    }, 80)
  }

  const handleInsertToken = (token: string) => {
    setVariableDialogOpen(false)
    if (editorRef.current) {
      editorRef.current.insertTokenAtCursor(token)
    } else {
      setTemplateForm((current) => ({
        ...current,
        content: `${current.content || '<p></p>'}<p>${token}</p>`,
      }))
    }
    toast.success(`${t.notifications_view.messages.token_inserted}: ${token}`)
    restoreEditorFocus()
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

  const handleToggleRuleStatus = (groupId: string, trigger: NotificationTrigger, checked: boolean) => {
    const now = new Date().toISOString()
    setRules((currentRules) => (currentRules || []).map((rule) => {
      return normalizeRuleNameKey(rule.name) === groupId && rule.trigger === trigger
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
                <p className="text-2xl font-bold">{taskNotificationGroups.length}</p>
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
          {taskNotificationGroups.length === 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t.notifications_view.empty.rules_title}</CardTitle>
                <CardDescription>{t.notifications_view.empty.rules_description}</CardDescription>
              </CardHeader>
            </Card>
          )}

          <div className="grid gap-4 xl:grid-cols-2">
            {taskNotificationGroups.map((ruleGroup) => (
              <Card key={ruleGroup.groupId}>
                <CardHeader className="gap-3">
                  <div>
                    <CardTitle className="text-lg">{ruleGroup.name}</CardTitle>
                    <CardDescription>{t.notifications_view.rule.event_type_tasks}</CardDescription>
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
                  </div>

                  <div className="space-y-2 rounded-md border p-3">
                    <p className="text-sm font-medium">{t.notifications_view.rule.conditions_label}</p>
                    <div className="space-y-3">
                      {ruleGroup.conditions.map((condition) => {
                        const templateSummary = [
                          condition.emailTemplateId ? `Email: ${(templates || []).find((template) => template.id === condition.emailTemplateId)?.name || t.notifications_view.rule.none}` : '',
                          condition.smsTemplateId ? `SMS: ${(templates || []).find((template) => template.id === condition.smsTemplateId)?.name || t.notifications_view.rule.none}` : '',
                          condition.whatsappTemplateId ? `WhatsApp: ${(templates || []).find((template) => template.id === condition.whatsappTemplateId)?.name || t.notifications_view.rule.none}` : '',
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
            <CardHeader>
              <CardTitle>{t.notifications_view.template.master_title}</CardTitle>
              <CardDescription>{t.notifications_view.template.master_description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-w-xs space-y-1">
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

              <div className="space-y-2">
                <Label>{t.notifications_view.template.master_header_label}</Label>
                <HtmlEditorWithPreview
                  value={masterTemplateForm.headerContent}
                  onChange={(value) => setMasterTemplateForm((current) => ({ ...current, channel: masterTemplateChannel, headerContent: value }))}
                  placeholder="<p>Header...</p>"
                  rows={5}
                />
              </div>

              <div className="space-y-2">
                <Label>{t.notifications_view.template.master_footer_label}</Label>
                <HtmlEditorWithPreview
                  value={masterTemplateForm.footerContent}
                  onChange={(value) => setMasterTemplateForm((current) => ({ ...current, channel: masterTemplateChannel, footerContent: value }))}
                  placeholder="<p>Footer...</p>"
                  rows={5}
                />
              </div>

              <div className="flex justify-end">
                <Button type="button" onClick={() => void handleSaveMasterTemplate()} disabled={masterTemplateSaving}>
                  {t.notifications_view.template.save_master}
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="relative max-w-md">
            <MagnifyingGlass size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={templateSearch}
              onChange={(event) => setTemplateSearch(event.target.value)}
              placeholder={t.notifications_view.template.search_placeholder}
              className="pl-9"
            />
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
                      <CardDescription>{template.subject || t.notifications_view.template.no_subject}</CardDescription>
                    </div>
                    <Badge variant="secondary">{t.notifications_view.channels[template.channel]}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
                    <div className="line-clamp-4" dangerouslySetInnerHTML={{ __html: template.content || '<p></p>' }} />
                  </div>
                  <div className="flex justify-end gap-2">
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
                    const triggerLabel = TRIGGERS.includes(trigger as NotificationTrigger)
                      ? t.notifications_view.triggers[trigger as NotificationTrigger]
                      : trigger
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
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editingRule ? t.notifications_view.actions.edit_rule : t.notifications_view.actions.new_rule}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveRule} className="space-y-6">
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
                <div className="flex h-10 items-center rounded-md border bg-muted/30 px-3 text-sm font-medium">
                  {t.notifications_view.rule.event_type_tasks}
                </div>
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
                                  <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>
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
                                  <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>
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
                                  <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>
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

            <div className="flex justify-end gap-2">
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
        <DialogContent className="w-[min(96vw,1280px)] max-w-none max-h-[96vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? t.notifications_view.actions.edit_template : t.notifications_view.actions.new_template}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveTemplate} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-[1fr_220px]">
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

            <Dialog open={variableDialogOpen} onOpenChange={(open) => {
              setVariableDialogOpen(open)
              if (open) {
                editorRef.current?.captureCurrentSelection()
                setTimeout(() => {
                  xpathFilterInputRef.current?.focus()
                }, 50)
              } else {
                setXpathInput('')
                restoreEditorFocus()
              }
            }}>
              <Tabs value={templateEditorTab} onValueChange={(value) => setTemplateEditorTab(value as 'template' | 'preview')}>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div className="grid gap-3 md:grid-cols-[180px_minmax(0,360px)_minmax(0,360px)]">
                    <div className="space-y-1">
                      <Label htmlFor="preview-event-type">{t.notifications_view.template.preview_event_type_label}</Label>
                      <Select value={selectedPreviewEventType} onValueChange={(value) => setSelectedPreviewEventType(value as 'tasks')}>
                        <SelectTrigger id="preview-event-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="tasks">{t.notifications_view.template.preview_event_type_tasks}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="preview-item">{t.notifications_view.template.preview_item_label}</Label>
                      <Select value={selectedPreviewTaskId} onValueChange={setSelectedPreviewTaskId}>
                        <SelectTrigger id="preview-item">
                          <SelectValue placeholder={t.notifications_view.template.preview_item_placeholder} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NO_PREVIEW_TASK_VALUE}>{t.notifications_view.template.preview_item_none}</SelectItem>
                          {previewTaskOptions.map((option) => (
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

                  <Button
                    type="button"
                    className="shrink-0"
                    onMouseDown={() => editorRef.current?.captureCurrentSelection()}
                    onClick={() => setVariableDialogOpen(true)}
                  >
                    {t.notifications_view.actions.open_variable_help}
                  </Button>
                </div>

                <TabsContent value="template" className="mt-3">
                  <div className="h-[50vh]">
                    <RichTextEditor
                      ref={editorRef}
                      content={templateForm.content}
                      onChange={(html) => setTemplateForm((current) => ({ ...current, content: html }))}
                      tokenPreviewResolver={(token) => {
                        const normalizedPath = token.startsWith('notification.')
                          ? token.slice('notification.'.length)
                          : token
                        return getValueByPath(notificationPreviewContext.notification, normalizedPath)
                      }}
                    />
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
                      isHTML(previewHtml)
                        ? <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
                        : <pre className="whitespace-pre-wrap font-mono text-xs">{previewHtml}</pre>
                    )}
                  </div>
                </TabsContent>
              </Tabs>

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

                    <div className="flex flex-wrap gap-2">
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

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setTemplateDialogOpen(false)}>
                {t.notifications_view.actions.cancel}
              </Button>
              <Button type="submit">{editingTemplate ? t.common.update : t.common.create}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}