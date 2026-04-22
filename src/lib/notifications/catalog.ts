import type {
  NotificationEventType,
  NotificationTemplate,
  NotificationTrigger,
} from '@/types'

export const NOTIFICATION_EVENT_TYPES: NotificationEventType[] = [
  'appointments',
  'contracts',
  'tasks',
  'inspections',
  'bugs',
  'user-access',
]

export const NOTIFICATION_EVENT_TYPE_TRIGGERS: Record<NotificationEventType, NotificationTrigger[]> = {
  appointments: [
    'appointment-items',
  ],
  contracts: [
    'contract-created',
    'contract-expiration',
    'contract-payment-day',
  ],
  tasks: [
    'task-created',
    'task-due-tomorrow',
    'task-due-today',
    'task-overdue-open',
    'task-resolved',
  ],
  inspections: [
    'inspection',
  ],
  bugs: [
    'bug',
  ],
  'user-access': [
    'user-created',
    'user-role-changed',
    'user-access-approved',
    'user-access-rejected',
  ],
}

export const ALL_NOTIFICATION_TRIGGERS = Object.values(NOTIFICATION_EVENT_TYPE_TRIGGERS).flat()

export const NOTIFICATION_TIMED_TRIGGERS = new Set<NotificationTrigger>([
  'appointment-items',
  'contract-expiration',
  'contract-payment-day',
  'task-due-tomorrow',
  'task-due-today',
  'task-overdue-open',
  'inspection',
])

export const DEFAULT_NOTIFICATION_DAYS_BEFORE: Partial<Record<NotificationTrigger, number>> = {
  'appointment-items': 0,
  'contract-expiration': 0,
  'contract-payment-day': 0,
  'task-due-tomorrow': 1,
  'task-due-today': 0,
  'task-overdue-open': 0,
  inspection: 0,
}

export function getNotificationEventTypeForTrigger(trigger: NotificationTrigger): NotificationEventType | null {
  if (NOTIFICATION_EVENT_TYPE_TRIGGERS.appointments.includes(trigger)) return 'appointments'
  if (NOTIFICATION_EVENT_TYPE_TRIGGERS.contracts.includes(trigger)) return 'contracts'
  if (NOTIFICATION_EVENT_TYPE_TRIGGERS.tasks.includes(trigger)) return 'tasks'
  if (NOTIFICATION_EVENT_TYPE_TRIGGERS.inspections.includes(trigger)) return 'inspections'
  if (NOTIFICATION_EVENT_TYPE_TRIGGERS.bugs.includes(trigger)) return 'bugs'
  if (NOTIFICATION_EVENT_TYPE_TRIGGERS['user-access'].includes(trigger)) return 'user-access'
  return null
}

export function buildDefaultNotificationConditions(eventType: NotificationEventType) {
  return NOTIFICATION_EVENT_TYPE_TRIGGERS[eventType].map((trigger, index) => ({
    trigger,
    enabled: index === 0,
    daysBefore: DEFAULT_NOTIFICATION_DAYS_BEFORE[trigger],
    emailTemplateId: undefined,
    smsTemplateId: undefined,
    whatsappTemplateId: undefined,
  }))
}

export function filterTemplatesForEventType(
  templates: NotificationTemplate[],
  eventType: NotificationEventType,
  channel?: NotificationTemplate['channel']
) {
  return templates.filter((template) => {
    if (channel && template.channel !== channel) return false
    return template.eventType === 'general' || template.eventType === eventType
  })
}
