export type PropertyType = 'room' | 'apartment' | 'house'
export type RentalDuration = 'short-term' | 'long-term'
export type PropertyStatus = 'available' | 'occupied' | 'maintenance'
export type TransactionType = 'income' | 'expense'
export type TaskPriority = 'low' | 'medium' | 'high'
export type TaskStatus = 'pending' | 'in-progress' | 'completed'
export type DocumentCategory = 'contract' | 'receipt' | 'insurance' | 'tax' | 'other'
export type RentalType = 'short-term' | 'monthly'
export type ContractStatus = 'active' | 'expired' | 'cancelled'

export interface Property {
  id: string
  name: string
  type: PropertyType
  capacity: number
  pricePerNight: number
  pricePerMonth: number
  status: PropertyStatus
  description: string
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

export interface Booking {
  id: string
  propertyId: string
  guestName: string
  checkIn: string
  checkOut: string
  totalAmount: number
  platform?: string
  status: 'confirmed' | 'cancelled'
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

export interface Document {
  id: string
  name: string
  category: DocumentCategory
  uploadDate: string
  notes?: string
  propertyId?: string
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
  document: string
  address?: string
  nationality?: string
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
  paymentDueDay: number
  monthlyAmount: number
  status: ContractStatus
  notes?: string
  createdAt: string
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
