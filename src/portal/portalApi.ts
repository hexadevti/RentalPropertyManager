import { supabase } from '@/lib/supabase'
import type { PortalTenant, PortalProperty, PortalPropertyPhoto, PortalUser, BookingRequest, BookingRequestStatus, GuestBooking } from './types'

const LEGACY_PHONE_PLACEHOLDER = 'LEGACY-PHONE-REQUIRED'

function sanitizePortalPhone(phone: string | null | undefined): string | null {
  const normalized = (phone || '').trim()
  if (!normalized) return null
  if (normalized.toUpperCase() === LEGACY_PHONE_PLACEHOLDER) return null
  return normalized
}

// ─── Tenant ─────────────────────────────────────────────────────────────────

export async function fetchPortalTenant(slug: string): Promise<PortalTenant | null> {
  const { data, error } = await supabase
    .from('tenants')
    .select('id, name, slug, portal_enabled')
    .eq('slug', slug)
    .eq('portal_enabled', true)
    .maybeSingle()

  if (error || !data) return null

  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    portalEnabled: data.portal_enabled,
  }
}

// ─── Properties ─────────────────────────────────────────────────────────────

export async function fetchPortalProperties(tenantId: string): Promise<PortalProperty[]> {
  const { data: props, error } = await supabase
    .from('properties')
    .select('id, tenant_id, name, type, capacity, price_per_night, price_per_month, address, city, description')
    .eq('tenant_id', tenantId)
    .order('name')

  if (error || !props) return []

  // Fetch cover photos for all properties in one query
  const propertyIds = props.map(p => p.id)
  const { data: photos } = await supabase
    .from('property_photos')
    .select('id, property_id, file_path, is_cover, sort_order')
    .eq('tenant_id', tenantId)
    .in('property_id', propertyIds)
    .order('sort_order')

  const photoPaths = Array.from(new Set((photos || []).map((photo) => photo.file_path).filter(Boolean)))
  const signedUrlsByPath = await createSignedUrlsByPath(photoPaths)

  const photosByProperty = (photos || []).reduce<Record<string, PortalPropertyPhoto[]>>((acc, photo) => {
    if (!acc[photo.property_id]) acc[photo.property_id] = []
    acc[photo.property_id].push({
      id: photo.id,
      filePath: photo.file_path,
      url: signedUrlsByPath.get(photo.file_path) || '',
      isCover: photo.is_cover,
      sortOrder: photo.sort_order,
    })
    return acc
  }, {})

  return props.map(p => {
    const propertyPhotos = photosByProperty[p.id] || []
    const cover = propertyPhotos.find(ph => ph.isCover) || propertyPhotos[0] || null

    return {
      id: p.id,
      tenantId: p.tenant_id,
      name: p.name,
      type: p.type as PortalProperty['type'],
      capacity: p.capacity,
      pricePerNight: p.price_per_night,
      pricePerMonth: p.price_per_month,
      address: p.address,
      city: p.city,
      description: p.description,
      coverPhotoUrl: cover?.url || null,
      photos: propertyPhotos,
    }
  })
}

export async function fetchPortalProperty(tenantId: string, propertyId: string): Promise<PortalProperty | null> {
  const { data, error } = await supabase
    .from('properties')
    .select('id, tenant_id, name, type, capacity, price_per_night, price_per_month, address, city, description')
    .eq('tenant_id', tenantId)
    .eq('id', propertyId)
    .maybeSingle()

  if (error || !data) return null

  const { data: photos } = await supabase
    .from('property_photos')
    .select('id, property_id, file_path, is_cover, sort_order')
    .eq('tenant_id', tenantId)
    .eq('property_id', propertyId)
    .order('sort_order')

  const photoPaths = Array.from(new Set((photos || []).map((photo) => photo.file_path).filter(Boolean)))
  const signedUrlsByPath = await createSignedUrlsByPath(photoPaths)

  const propertyPhotos: PortalPropertyPhoto[] = (photos || []).map(ph => ({
    id: ph.id,
    filePath: ph.file_path,
    url: signedUrlsByPath.get(ph.file_path) || '',
    isCover: ph.is_cover,
    sortOrder: ph.sort_order,
  }))

  const cover = propertyPhotos.find(ph => ph.isCover) || propertyPhotos[0] || null

  return {
    id: data.id,
    tenantId: data.tenant_id,
    name: data.name,
    type: data.type as PortalProperty['type'],
    capacity: data.capacity,
    pricePerNight: data.price_per_night,
    pricePerMonth: data.price_per_month,
    address: data.address,
    city: data.city,
    description: data.description,
    coverPhotoUrl: cover?.url || null,
    photos: propertyPhotos,
  }
}

async function createSignedUrlsByPath(paths: string[]) {
  const urlMap = new Map<string, string>()
  if (!paths.length) return urlMap

  for (const path of paths) {
    const { data } = supabase.storage
      .from('property-images')
      .getPublicUrl(path)

    if (!data?.publicUrl) continue
    urlMap.set(path, data.publicUrl)
  }

  return urlMap
}

// ─── Availability ────────────────────────────────────────────────────────────

export async function checkPropertyAvailability(
  tenantId: string,
  propertyId: string,
  checkIn: Date,
  checkOut: Date,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('check_portal_property_availability', {
    p_tenant_id: tenantId,
    p_property_id: propertyId,
    p_check_in: checkIn.toISOString().slice(0, 10),
    p_check_out: checkOut.toISOString().slice(0, 10),
  })

  if (error) return false
  return data === true
}

// ─── Portal users ────────────────────────────────────────────────────────────

export async function fetchPortalUser(tenantId: string, authUserId: string): Promise<PortalUser | null> {
  const { data, error } = await supabase
    .from('portal_users')
    .select('id, auth_user_id, tenant_id, name, email, phone, status, created_at')
    .eq('tenant_id', tenantId)
    .eq('auth_user_id', authUserId)
    .maybeSingle()

  if (error || !data) return null

  return {
    id: data.id,
    authUserId: data.auth_user_id,
    tenantId: data.tenant_id,
    name: data.name,
    email: data.email,
    phone: sanitizePortalPhone(data.phone),
    status: data.status,
    createdAt: data.created_at,
  }
}

export async function createPortalUser(params: {
  tenantId: string
  authUserId: string
  name: string
  email: string
  phone: string
}): Promise<PortalUser | null> {
  const normalizedPhone = sanitizePortalPhone(params.phone)
  if (!normalizedPhone) return null

  const { data, error } = await supabase
    .from('portal_users')
    .insert({
      tenant_id: params.tenantId,
      auth_user_id: params.authUserId,
      name: params.name,
      email: params.email,
      phone: normalizedPhone,
    })
    .select()
    .single()

  if (error || !data) return null

  return {
    id: data.id,
    authUserId: data.auth_user_id,
    tenantId: data.tenant_id,
    name: data.name,
    email: data.email,
    phone: sanitizePortalPhone(data.phone),
    status: data.status,
    createdAt: data.created_at,
  }
}

export async function portalGuestSignUp(params: {
  tenantId: string
  name: string
  email: string
  phone: string
  password: string
}): Promise<PortalUser | null> {
  const normalizedPhone = sanitizePortalPhone(params.phone)
  if (!normalizedPhone) return null

  const { data, error } = await supabase.rpc('portal_guest_sign_up', {
    p_tenant_id: params.tenantId,
    p_name: params.name.trim(),
    p_email: params.email.trim().toLowerCase(),
    p_phone: normalizedPhone,
    p_password: params.password,
  })

  if (error) throw new Error(error.message)
  if (!data || !(data as any[]).length) return null

  const row = (data as any[])[0]
  return {
    id: row.id,
    authUserId: null,
    tenantId: row.tenant_id,
    name: row.name,
    email: row.email,
    phone: sanitizePortalPhone(row.phone),
    status: 'active',
    createdAt: row.created_at,
  }
}

export async function portalGuestSignIn(params: {
  tenantId: string
  email: string
  password: string
}): Promise<PortalUser | null> {
  const { data, error } = await supabase.rpc('portal_guest_sign_in', {
    p_tenant_id: params.tenantId,
    p_email: params.email.trim().toLowerCase(),
    p_password: params.password,
  })

  if (error) throw new Error(error.message)
  if (!data || !(data as any[]).length) return null

  const row = (data as any[])[0]
  return {
    id: row.id,
    authUserId: null,
    tenantId: row.tenant_id,
    name: row.name,
    email: row.email,
    phone: sanitizePortalPhone(row.phone),
    status: 'active',
    createdAt: row.created_at,
  }
}

export async function portalGuestResetPassword(params: {
  tenantId: string
  email: string
  phone: string
  newPassword: string
}): Promise<boolean> {
  const normalizedPhone = sanitizePortalPhone(params.phone)
  if (!normalizedPhone) return false

  const { data, error } = await supabase.rpc('portal_guest_reset_password', {
    p_tenant_id: params.tenantId,
    p_email: params.email.trim().toLowerCase(),
    p_phone: normalizedPhone,
    p_new_password: params.newPassword,
  })

  if (error) throw new Error(error.message)
  return data === true
}

// ─── Booking requests ────────────────────────────────────────────────────────

export async function submitBookingRequest(params: {
  tenantId: string
  propertyId: string
  guestId?: string
  portalUserId?: string
  guestName: string
  guestEmail: string
  guestPhone: string
  requestType?: 'short-term' | 'monthly'
  checkIn?: string
  checkOut?: string
  estimatedMoveIn?: string
  desiredMonths?: number
  brokerContactRequested?: boolean
  guestsCount: number
  notes?: string
}): Promise<BookingRequest | null> {
  const normalizedPhone = sanitizePortalPhone(params.guestPhone)
  if (!normalizedPhone) return null

  const requestType = params.requestType ?? 'short-term'
  if (requestType === 'short-term' && (!params.checkIn || !params.checkOut)) return null
  if (requestType === 'monthly' && !params.estimatedMoveIn) return null

  const { data, error } = await supabase
    .from('booking_requests')
    .insert({
      tenant_id: params.tenantId,
      property_id: params.propertyId,
      guest_id: params.guestId || null,
      portal_user_id: params.portalUserId || null,
      guest_name: params.guestName,
      guest_email: params.guestEmail,
      guest_phone: normalizedPhone,
      request_type: requestType,
      check_in: requestType === 'short-term' ? params.checkIn : null,
      check_out: requestType === 'short-term' ? params.checkOut : null,
      estimated_move_in: requestType === 'monthly' ? params.estimatedMoveIn : null,
      desired_months: requestType === 'monthly' ? params.desiredMonths ?? null : null,
      broker_contact_requested: requestType === 'monthly' ? Boolean(params.brokerContactRequested) : false,
      guests_count: params.guestsCount,
      notes: params.notes || null,
    })
    .select()
    .single()

  if (error || !data) return null
  return mapBookingRequest(data)
}

export async function fetchTenantBookingRequests(tenantId: string): Promise<(BookingRequest & { propertyName?: string })[]> {
  const { data, error } = await supabase
    .from('booking_requests')
    .select('*, properties(name)')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  if (error || !data) return []

  return data.map(row => ({
    ...mapBookingRequest(row),
    propertyName: (row as any).properties?.name,
  }))
}

export async function updateBookingRequestStatus(
  id: string,
  status: BookingRequestStatus,
  adminNotes?: string,
): Promise<boolean> {
  if (status === 'approved') {
    const { data, error } = await supabase.rpc('approve_booking_request_and_create_contract', {
      p_booking_request_id: id,
      p_admin_notes: adminNotes ?? null,
    })

    if (error) return false
    return data === true
  }

  const { error } = await supabase
    .from('booking_requests')
    .update({ status, admin_notes: adminNotes ?? null })
    .eq('id', id)

  return !error
}

export async function deleteBookingRequest(tenantId: string, id: string): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase
    .from('booking_requests')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .select('id')

  if (error) {
    return { ok: false, error: error.message }
  }

  if (!data || data.length === 0) {
    return { ok: false, error: 'Sem permissao para excluir ou solicitacao nao encontrada.' }
  }

  return { ok: true }
}

function mapBookingRequest(row: any): BookingRequest {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    propertyId: row.property_id,
    guestId: row.guest_id ?? null,
    portalUserId: row.portal_user_id,
    guestName: row.guest_name,
    guestEmail: row.guest_email,
    guestPhone: sanitizePortalPhone(row.guest_phone),
    requestType: row.request_type === 'monthly' ? 'monthly' : 'short-term',
    checkIn: row.check_in,
    checkOut: row.check_out,
    estimatedMoveIn: row.estimated_move_in,
    desiredMonths: row.desired_months,
    brokerContactRequested: Boolean(row.broker_contact_requested),
    guestsCount: row.guests_count,
    notes: row.notes,
    status: row.status,
    adminNotes: row.admin_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// ─── Guest booking lookup (no account required) ──────────────────────────────

export async function fetchGuestBookings(tenantId: string, guestEmail: string, guestPhone?: string | null): Promise<GuestBooking[]> {
  const { data, error } = await supabase.rpc('fetch_guest_bookings', {
    p_tenant_id: tenantId,
    p_guest_email: guestEmail.trim().toLowerCase(),
    p_guest_phone: (guestPhone || '').trim() || null,
  })

  if (error || !data) return []

  const coverPaths = Array.from(
    new Set((data as any[]).map((row) => row.cover_file_path).filter(Boolean)),
  )
  const signedCoverUrlsByPath = await createSignedUrlsByPath(coverPaths)

  return (data as any[]).map(row => ({
    id: row.id,
    propertyId: row.property_id,
    guestId: row.guest_id ?? null,
    propertyName: row.property_name ?? null,
    coverPhotoUrl: row.cover_file_path ? signedCoverUrlsByPath.get(row.cover_file_path) || null : null,
    guestName: row.guest_name,
    requestType: row.request_type === 'monthly' ? 'monthly' : 'short-term',
    checkIn: row.check_in,
    checkOut: row.check_out,
    estimatedMoveIn: row.estimated_move_in,
    desiredMonths: row.desired_months,
    brokerContactRequested: Boolean(row.broker_contact_requested),
    guestsCount: row.guests_count,
    notes: row.notes,
    status: row.status as GuestBooking['status'],
    adminNotes: row.admin_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))
}

export async function fetchLoggedGuestBookings(tenantId: string, guestId: string): Promise<GuestBooking[]> {
  const { data, error } = await supabase.rpc('fetch_logged_guest_bookings', {
    p_tenant_id: tenantId,
    p_guest_id: guestId,
  })

  if (error || !data) return []

  const coverPaths = Array.from(
    new Set((data as any[]).map((row) => row.cover_file_path).filter(Boolean)),
  )
  const signedCoverUrlsByPath = await createSignedUrlsByPath(coverPaths)

  return (data as any[]).map(row => ({
    id: row.id,
    propertyId: row.property_id,
    guestId: row.guest_id ?? null,
    propertyName: row.property_name ?? null,
    coverPhotoUrl: row.cover_file_path ? signedCoverUrlsByPath.get(row.cover_file_path) || null : null,
    guestName: row.guest_name,
    requestType: row.request_type === 'monthly' ? 'monthly' : 'short-term',
    checkIn: row.check_in,
    checkOut: row.check_out,
    estimatedMoveIn: row.estimated_move_in,
    desiredMonths: row.desired_months,
    brokerContactRequested: Boolean(row.broker_contact_requested),
    guestsCount: row.guests_count,
    notes: row.notes,
    status: row.status as GuestBooking['status'],
    adminNotes: row.admin_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))
}

export async function cancelGuestBooking(bookingId: string, guestEmail: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('cancel_booking_by_email', {
    p_booking_id: bookingId,
    p_guest_email: guestEmail.trim().toLowerCase(),
  })

  if (error) return false
  return data === true
}

export async function cancelGuestBookingForLoggedUser(tenantId: string, guestId: string, bookingId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('cancel_booking_for_logged_guest', {
    p_tenant_id: tenantId,
    p_guest_id: guestId,
    p_booking_id: bookingId,
  })

  if (error) return false
  return data === true
}
