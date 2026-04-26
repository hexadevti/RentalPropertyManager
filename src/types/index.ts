export type PropertyType = 'room' | 'apartment' | 'house' | 'parking'
export type RentalDuration = 'short-term' | 'long-term'
export type PropertyStatus = 'available' | 'occupied' | 'maintenance'
export type TransactionType = 'income' | 'expense'
export type TaskPriority = 'low' | 'medium' | 'high'
export type TaskStatus = 'pending' | 'in-progress' | 'completed'
export type TaskAssigneeType = 'owner' | 'guest' | 'service-provider'
export type RentalType = 'short-term' | 'monthly'
export type ContractStatus = 'active' | 'expired' | 'cancelled'
export type InspectionType = 'check-in' | 'check-out' | 'maintenance' | 'periodic'
export type InspectionStatus = 'draft' | 'in-progress' | 'assessed'
export type InspectionItemCondition = 'excellent' | 'good' | 'attention' | 'damaged' | 'na'

export interface GuestDocument {
  type: string
  number: string
}

export interface GuestRelatedPerson {
  id: string
  name: string
  email: string
  phone: string
  documents: GuestDocument[]
  address?: string
  nationality?: string
  maritalStatus?: string
  profession?: string
  dateOfBirth?: string
  notes?: string
}

export type Sponsor = GuestRelatedPerson
export type Dependent = GuestRelatedPerson

export interface Owner {
  id: string
  name: string
  email: string
  phone: string
  documents: GuestDocument[]
  nationality?: string
  maritalStatus?: string
  profession?: string
  address?: string
  notes?: string
  createdAt: string
}

export type ICalProvider = 'airbnb' | 'booking' | 'vrbo' | 'expedia' | 'other'

export interface PropertyICalFeed {
  id: string
  provider: ICalProvider
  label: string
  url: string
}

export interface Property {
  id: string
  name: string
  type: PropertyType
  capacity: number
  pricePerNight: number
  pricePerMonth: number
  status: PropertyStatus
  address?: string
  city?: string
  conservationState?: string
  environments?: string[]
  furnitureItems?: string[]
  inspectionItems?: string[]
  description: string
  ownerIds: string[]
  photos?: PropertyPhoto[]
  icalFeeds?: PropertyICalFeed[]
  createdAt: string
}

export interface PropertyPhoto {
  id: string
  fileName: string
  filePath: string
  fileSize?: number
  mimeType?: string
  isCover: boolean
  sortOrder: number
  createdAt: string
}

export interface Transaction {
  id: string
  type: TransactionType
  amount: number
  category: string
  description: string
  date: string
  propertyId?: string
  contractId?: string
  serviceProviderId?: string
  createdAt: string
}

export interface Task {
  id: string
  title: string
  description: string
  dueDate: string
  priority: TaskPriority
  status: TaskStatus
  assigneeName?: string
  assigneeType?: TaskAssigneeType
  assigneeId?: string
  propertyId?: string
  createdAt: string
  updatedAt?: string
}

export interface ServiceProvider {
  id: string
  name: string
  service: string
  contact: string
  phone?: string
  email?: string
  document?: string
  address?: string
  notes?: string
  createdAt?: string
}

export interface Guest {
  id: string
  name: string
  email: string
  phone: string
  documents: GuestDocument[]
  sponsors?: Sponsor[]
  dependents?: Dependent[]
  address?: string
  nationality?: string
  maritalStatus?: string
  profession?: string
  dateOfBirth?: string
  notes?: string
  createdAt: string
}

export interface Contract {
  id: string
  guestId: string
  bookingRequestId?: string
  propertyIds: string[]
  rentalType: RentalType
  startDate: string
  endDate: string
  closeDate?: string
  paymentDueDay: number
  monthlyAmount: number
  contractAmount: number
  specialPaymentCondition?: string
  status: ContractStatus
  notes?: string
  templateId?: string
  icalUid?: string
  createdAt: string
}

export interface InspectionAreaItem {
  id: string
  label: string
  condition: InspectionItemCondition
  notes?: string
}

export interface InspectionArea {
  id: string
  name: string
  notes?: string
  items: InspectionAreaItem[]
}

export interface Inspection {
  id: string
  title: string
  propertyId: string
  contractId: string
  parentInspectionId?: string
  type: InspectionType
  status: InspectionStatus
  inspectorName: string
  scheduledDate: string
  completedDate?: string
  summary?: string
  areas: InspectionArea[]
  createdAt: string
  updatedAt: string
}

export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled'

export interface Appointment {
  id: string
  title: string
  description?: string
  date: string
  time: string
  status: AppointmentStatus
  serviceProviderId?: string
  contractId?: string
  guestId?: string
  propertyId?: string
  notes?: string
  completionNotes?: string
  completedAt?: string
  createdAt: string
}

export interface Tenant {
  id: string
  name: string
  createdAt: string
}

export type UserRole = 'admin' | 'guest'
export type UserStatus = 'pending' | 'approved' | 'blocked'
export type AccessRoleId =
  | 'tenant'
  | 'properties'
  | 'owners'
  | 'finances'
  | 'calendar'
  | 'tasks'
  | 'reports'
  | 'guests'
  | 'contracts'
  | 'documents'
  | 'ai-assistant'
  | 'inspections'
  | 'templates'
  | 'notifications'
  | 'providers'
  | 'appointments'
  | 'users-permissions'
  | 'access-profiles'
  | 'audit-logs'
  | 'my-bug-reports'
    | 'portal-bookings'
  export type AccessLevel = 'none' | 'read' | 'write'
export type TemplateLanguage = 'pt' | 'en' | 'es' | 'fr' | 'de' | 'it' | 'nl' | 'ar' | 'zh' | 'ja' | 'pl' | 'ru'

export const ACCESS_ROLES: { id: AccessRoleId; label: string; description: string }[] = [
  { id: 'tenant', label: 'Tenant', description: 'Acesso ao gerenciamento de tenant' },
  { id: 'properties', label: 'Propriedades', description: 'Acesso a propriedades' },
  { id: 'owners', label: 'Proprietarios', description: 'Acesso a proprietarios' },
  { id: 'finances', label: 'Financas', description: 'Acesso a financas' },
  { id: 'calendar', label: 'Calendario', description: 'Acesso ao calendario' },
  { id: 'tasks', label: 'Tarefas', description: 'Acesso a tarefas' },
  { id: 'reports', label: 'Relatorios', description: 'Acesso a relatorios' },
  { id: 'guests', label: 'Hospedes', description: 'Acesso a hospedes' },
  { id: 'contracts', label: 'Contratos', description: 'Acesso a contratos' },
  { id: 'documents', label: 'Documentos', description: 'Acesso a documentos' },
  { id: 'ai-assistant', label: 'Assistente IA', description: 'Acesso ao assistente IA' },
  { id: 'inspections', label: 'Vistorias', description: 'Acesso a vistorias' },
  { id: 'templates', label: 'Templates', description: 'Acesso a templates de contrato' },
  { id: 'notifications', label: 'Notificacoes', description: 'Acesso a notificacoes' },
  { id: 'providers', label: 'Prestadores', description: 'Acesso a prestadores' },
  { id: 'appointments', label: 'Compromissos', description: 'Acesso a compromissos' },
  { id: 'users-permissions', label: 'Usuarios e Permissoes', description: 'Acesso a usuarios e permissoes' },
  { id: 'access-profiles', label: 'Perfis de Acesso', description: 'Acesso ao gerenciamento de perfis de acesso' },
  { id: 'audit-logs', label: 'Log de Auditoria', description: 'Acesso ao log de auditoria' },
  { id: 'my-bug-reports', label: 'Bugs Reportados', description: 'Acesso à lista de bugs reportados pelo usuário' },
  { id: 'portal-bookings', label: 'Solicitações de Reserva', description: 'Acesso às solicitações de reserva do portal' },
]

export const TEMPLATE_LANGUAGES: { code: TemplateLanguage; nativeName: string }[] = [
  { code: 'pt', nativeName: 'Português' },
  { code: 'en', nativeName: 'English' },
  { code: 'es', nativeName: 'Español' },
  { code: 'fr', nativeName: 'Français' },
  { code: 'de', nativeName: 'Deutsch' },
  { code: 'it', nativeName: 'Italiano' },
  { code: 'nl', nativeName: 'Nederlands' },
  { code: 'ar', nativeName: 'العربية' },
  { code: 'zh', nativeName: '中文' },
  { code: 'ja', nativeName: '日本語' },
  { code: 'pl', nativeName: 'Polski' },
  { code: 'ru', nativeName: 'Русский' },
]

export interface UserProfile {
  githubLogin: string
  role: UserRole
  status: UserStatus
  email: string
  phone?: string | null
  avatarUrl: string
  accessProfileId?: string | null
  accessProfileName?: string | null
  createdAt: string
  updatedAt: string
}

export interface AccessProfile {
  id: string
  tenantId: string
  name: string
  description?: string
  isSystem: boolean
  createdAt: string
  updatedAt: string
}

export interface AccessProfileRole {
  tenantId: string
  accessProfileId: string
  accessRoleId: AccessRoleId
  accessLevel: AccessLevel
  createdAt: string
  updatedAt: string
}

export type TemplateType = 'monthly' | 'short-term'

export interface ContractTemplate {
  id: string
  name: string
  type: TemplateType
  language: TemplateLanguage
  translationGroupId: string
  content: string
  createdAt: string
  updatedAt: string
}

export type NotificationChannel = 'email' | 'sms' | 'whatsapp'
export type NotificationTrigger =
  | 'appointment-items'
  | 'contract-expiration'
  | 'contract-payment-day'
  | 'task-created'
  | 'task-due-tomorrow'
  | 'task-due-today'
  | 'task-overdue-open'
  | 'task-resolved'
  | 'contract-created'
  | 'inspection'
  | 'bug'
  | 'user-created'
  | 'user-role-changed'
  | 'user-access-approved'
  | 'user-access-invite'
  | 'user-password-reset'
  | 'user-access-rejected'

export type NotificationEventType = 'appointments' | 'contracts' | 'tasks' | 'inspections' | 'bugs' | 'user-access'
export type NotificationTemplateEventType = NotificationEventType | 'general'
export type NotificationTemplateContentType = 'html' | 'text'

export interface NotificationTemplate {
  id: string
  name: string
  channel: NotificationChannel
  eventType: NotificationTemplateEventType
  contentType: NotificationTemplateContentType
  language: TemplateLanguage
  translationGroupId: string
  description?: string
  subject?: string
  content: string
  createdAt: string
  updatedAt: string
}

export interface NotificationRule {
  id: string
  name: string
  trigger: NotificationTrigger
  eventType: NotificationEventType
  groupId?: string
  channels: NotificationChannel[]
  emailTemplateId?: string
  smsTemplateId?: string
  whatsappTemplateId?: string
  recipientRoles: UserRole[]
  recipientUserIds: string[]
  sendToTaskAssignee?: boolean
  sendToEventRecipient?: boolean
  daysBefore?: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type DocumentCategory = 'contract' | 'receipt' | 'insurance' | 'tax' | 'other'
export type DocumentRelationType = 'general' | 'property' | 'contract' | 'guest' | 'owner'

export interface Document {
  id: string
  name: string
  category: DocumentCategory
  notes?: string
  propertyId?: string
  relationType?: DocumentRelationType
  relationId?: string
  fileName?: string
  filePath?: string
  fileSize?: number
  mimeType?: string
  uploadDate: string
}

export type BugReportStatus = 'open' | 'in-review' | 'resolved' | 'dismissed'

export interface BugReport {
  id: string
  tenantId?: string
  reporterAuthUserId?: string
  reporterLogin: string
  reporterEmail?: string
  screen: string
  screenLabel: string
  recordId?: string
  recordLabel?: string
  description: string
  status: BugReportStatus
  resolutionNotes?: string
  createdAt: string
  updatedAt: string
}

export interface BugReportAttachment {
  id: string
  bugReportId: string
  fileName: string
  filePath: string
  fileSize?: number
  mimeType?: string
  createdAt: string
}

export type ContactMessageStatus = 'open' | 'in-review' | 'answered' | 'archived'

export interface ContactMessage {
  id: string
  tenantId?: string
  senderAuthUserId?: string
  senderLogin: string
  senderEmail?: string
  subject: string
  description: string
  currentUrl?: string
  status: ContactMessageStatus
  adminNotes?: string
  emailSentAt?: string
  deliveryError?: string
  createdAt: string
  updatedAt: string
}

export type TenantUserInvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired'

export interface TenantUserInvitation {
  id: string
  tenantId: string
  invitedProfileId?: string
  invitedByAuthUserId?: string
  claimedAuthUserId?: string
  email: string
  login?: string
  role: UserRole
  message?: string
  status: TenantUserInvitationStatus
  sentAt?: string
  acceptedAt?: string
  expiresAt: string
  deliveryError?: string
  createdAt: string
  updatedAt: string
}
