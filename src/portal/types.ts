export interface PortalTenant {
  id: string
  name: string
  slug: string
  portalEnabled: boolean
}

export interface PortalProperty {
  id: string
  tenantId: string
  name: string
  type: 'room' | 'apartment' | 'house'
  capacity: number
  pricePerNight: number
  pricePerMonth: number
  address: string | null
  city: string | null
  description: string
  coverPhotoUrl: string | null
  photos: PortalPropertyPhoto[]
}

export interface PortalPropertyPhoto {
  id: string
  filePath: string
  url: string
  isCover: boolean
  sortOrder: number
}

export interface PortalUser {
  id: string
  authUserId: string | null
  tenantId: string
  name: string
  email: string
  phone: string | null
  status: 'active' | 'blocked'
  createdAt: string
}

export type BookingRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

export interface BookingRequest {
  id: string
  tenantId: string
  propertyId: string
  guestId: string | null
  portalUserId: string | null
  guestName: string
  guestEmail: string
  guestPhone: string | null
  requestType: 'short-term' | 'monthly'
  checkIn: string | null
  checkOut: string | null
  estimatedMoveIn: string | null
  desiredMonths: number | null
  brokerContactRequested: boolean
  guestsCount: number
  notes: string | null
  status: BookingRequestStatus
  adminNotes: string | null
  createdAt: string
  updatedAt: string
}

export type PortalPage =
  | 'home'
  | 'property'
  | 'login'
  | 'register'
  | 'booking'
  | 'my-bookings'

export interface GuestBooking {
  id: string
  propertyId: string
  guestId: string | null
  propertyName: string | null
  coverPhotoUrl: string | null
  guestName: string
  requestType: 'short-term' | 'monthly'
  checkIn: string | null
  checkOut: string | null
  estimatedMoveIn: string | null
  desiredMonths: number | null
  brokerContactRequested: boolean
  guestsCount: number
  notes: string | null
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  adminNotes: string | null
  createdAt: string
  updatedAt: string
}
