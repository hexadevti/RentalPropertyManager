export type PropertyType = 'room' | 'apartment' | 'house'
export type RentalDuration = 'short-term' | 'long-term'
export type PropertyStatus = 'available' | 'occupied' | 'maintenance'
export type TransactionType = 'income' | 'expense'
export type TaskPriority = 'low' | 'medium' | 'high'
export type TaskStatus = 'pending' | 'in-progress' | 'completed'
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
  assignee?: string
  propertyId?: string
  createdAt: string
}

export interface ServiceProvider {
  id: string
  name: string
  service: string
  contact: string
  email?: string
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
  propertyIds: string[]
  rentalType: RentalType
  startDate: string
  endDate: string
  closeDate?: string
  paymentDueDay: number
  monthlyAmount: number
  specialPaymentCondition?: string
  status: ContractStatus
  notes?: string
  templateId?: string
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
export type UserStatus = 'pending' | 'approved' | 'rejected'

export interface UserProfile {
  githubLogin: string
  role: UserRole
  status: UserStatus
  email: string
  avatarUrl: string
  createdAt: string
  updatedAt: string
}

export type TemplateType = 'monthly' | 'short-term'

export interface ContractTemplate {
  id: string
  name: string
  type: TemplateType
  content: string
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
