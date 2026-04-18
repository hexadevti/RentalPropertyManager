import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { supabase } from '@/lib/supabase'
import { getSupabaseAuthState, subscribeSupabaseAuthState } from '@/lib/supabaseAuthState'

const cache = new Map<string, unknown>()
const subscribers = new Map<string, Set<(value: unknown) => void>>()
const inflightLoads = new Map<string, Promise<unknown>>()

let cachedTenantId: string | null | undefined = undefined

const COLLECTION_KEYS = new Set([
  'appointments',
  'contract-templates',
  'contracts',
  'documents',
  'guests',
  'owners',
  'properties',
  'service-providers',
  'tasks',
  'transactions',
])

function isSettingKey(key: string) {
  return key === 'app-language'
    || key === 'app-currency'
    || key.startsWith('pinned-items-')
    || key.startsWith('sidebar-collapsed-')
}

function isCollectionKey(key: string) {
  return COLLECTION_KEYS.has(key)
}

function normalizeSettingKey(key: string) {
  if (key.startsWith('pinned-items-')) return 'pinned-items'
  if (key.startsWith('sidebar-collapsed-')) return 'sidebar-collapsed'
  return key
}

function notifySubscribers(key: string, value: unknown) {
  const keySubscribers = subscribers.get(key)
  if (!keySubscribers) return
  for (const callback of keySubscribers) {
    callback(value)
  }
}

function subscribeToKey(key: string, callback: (value: unknown) => void) {
  const currentSubscribers = subscribers.get(key) ?? new Set<(value: unknown) => void>()
  currentSubscribers.add(callback)
  subscribers.set(key, currentSubscribers)

  return () => {
    const set = subscribers.get(key)
    if (!set) return
    set.delete(callback)
    if (set.size === 0) subscribers.delete(key)
  }
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

async function getAuthUserId() {
  const authState = getSupabaseAuthState()
  if (authState.userId && isUuid(authState.userId)) return authState.userId
  if (import.meta.env.VITE_DEV_MODE !== 'true') return null
  try {
    const devUser = localStorage.getItem('dev-mode-user')
    if (!devUser) return null
    const devUserId = (JSON.parse(devUser) as { id: string }).id
    return isUuid(devUserId) ? devUserId : null
  } catch {}
  return null
}

async function getTenantId(): Promise<string | null> {
  if (cachedTenantId !== undefined) return cachedTenantId

  const authState = getSupabaseAuthState()
  if (authState.isAuthenticated && authState.isApproved) {
    cachedTenantId = authState.tenantId ?? null
    return cachedTenantId
  }

  if (import.meta.env.VITE_DEV_MODE === 'true') {
    cachedTenantId = import.meta.env.VITE_DEV_TENANT_ID || 'dev-tenant'
    return cachedTenantId
  }

  cachedTenantId = null

  return cachedTenantId
}

async function loadUserSetting<T>(key: string, defaultValue: T): Promise<T> {
  const authUserId = await getAuthUserId()
  if (!authUserId) return defaultValue

  const { data, error } = await supabase
    .from('user_settings')
    .select('value')
    .eq('auth_user_id', authUserId)
    .eq('key', normalizeSettingKey(key))
    .maybeSingle<{ value: T }>()

  if (error) {
    console.error(`Failed to load setting "${key}"`, error)
    return defaultValue
  }

  return (data?.value ?? defaultValue) as T
}

async function persistUserSetting<T>(key: string, value: T) {
  const authUserId = await getAuthUserId()
  if (!authUserId) return

  const { error } = await supabase
    .from('user_settings')
    .upsert(
      { auth_user_id: authUserId, key: normalizeSettingKey(key), value },
      { onConflict: 'auth_user_id,key' }
    )

  if (error) throw error
}

async function loadExistingIds(table: string, tenantId: string) {
  const { data, error } = await supabase
    .from(table)
    .select('id')
    .eq('tenant_id', tenantId)

  if (error) throw error
  return (data || []).map((row) => row.id)
}

async function replaceSimpleRows(table: string, rows: any[]) {
  const tenantId = await getTenantId()
  if (!tenantId) return

  const existingIds = await loadExistingIds(table, tenantId)
  const nextIds = rows.map((row) => row.id)
  const removedIds = existingIds.filter((id) => !nextIds.includes(id))

  if (removedIds.length > 0) {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq('tenant_id', tenantId)
      .in('id', removedIds)

    if (error) throw error
  }

  if (rows.length > 0) {
    const { error } = await supabase
      .from(table)
      .upsert(rows, { onConflict: 'tenant_id,id' })

    if (error) throw error
  }
}

async function loadOwners() {
  const tenantId = await getTenantId()
  if (!tenantId) return []

  const { data, error } = await supabase
    .from('owners')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true })

  if (error) throw error

  return (data || []).map((owner) => {
    let documents: { type: string; number: string }[] = []
    const raw = owner.document as string | null
    if (raw && raw.trimStart().startsWith('[')) {
      try { documents = JSON.parse(raw) } catch { documents = [] }
    } else if (raw) {
      documents = [{ type: owner.document_type || '', number: raw }]
    }
    return {
      id: owner.id,
      name: owner.name,
      email: owner.email,
      phone: owner.phone,
      documents,
      nationality: owner.nationality || undefined,
      maritalStatus: owner.marital_status || undefined,
      profession: owner.profession || undefined,
      address: owner.address || undefined,
      notes: owner.notes || undefined,
      createdAt: owner.created_at,
    }
  })
}

async function loadProperties() {
  const tenantId = await getTenantId()
  if (!tenantId) return []

  const [
    { data: properties, error: propertiesError },
    { data: propertyOwners, error: ownersError },
    { data: propertyFurniture, error: furnitureError },
  ] = await Promise.all([
    supabase
      .from('properties')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true }),
    supabase
      .from('property_owners')
      .select('property_id, owner_id')
      .eq('tenant_id', tenantId),
    supabase
      .from('property_furniture')
      .select('property_id, item_order, item_name')
      .eq('tenant_id', tenantId)
      .order('property_id', { ascending: true })
      .order('item_order', { ascending: true }),
  ])

  if (propertiesError) throw propertiesError
  if (ownersError) throw ownersError
  if (furnitureError) throw furnitureError

  const ownerMap = new Map<string, string[]>()
  for (const row of propertyOwners || []) {
    ownerMap.set(row.property_id, [...(ownerMap.get(row.property_id) || []), row.owner_id])
  }

  const furnitureMap = new Map<string, string[]>()
  for (const row of propertyFurniture || []) {
    const currentItems = furnitureMap.get(row.property_id) || []
    currentItems.push(row.item_name)
    furnitureMap.set(row.property_id, currentItems)
  }

  return (properties || []).map((property) => ({
    id: property.id,
    name: property.name,
    type: property.type,
    capacity: property.capacity,
    pricePerNight: property.price_per_night,
    pricePerMonth: property.price_per_month,
    status: property.status,
    address: property.address || undefined,
    city: property.city || undefined,
    conservationState: property.conservation_state || undefined,
    furnitureItems: furnitureMap.get(property.id) || [],
    description: property.description,
    ownerIds: ownerMap.get(property.id) || [],
    createdAt: property.created_at,
  }))
}

async function loadGuests() {
  const tenantId = await getTenantId()
  if (!tenantId) return []

  const { data, error } = await supabase
    .from('guests')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true })

  if (error) throw error

  return (data || []).map((guest) => {
    let documents: { type: string; number: string }[] = []
    const raw = guest.document as string | null
    if (raw && raw.trimStart().startsWith('[')) {
      try { documents = JSON.parse(raw) } catch { documents = [] }
    } else if (raw) {
      documents = [{ type: guest.document_type || '', number: raw }]
    }
    return {
      id: guest.id,
      name: guest.name,
      email: guest.email,
      phone: guest.phone,
      documents,
      address: guest.address || undefined,
      nationality: guest.nationality || undefined,
      maritalStatus: guest.marital_status || undefined,
      profession: guest.profession || undefined,
      dateOfBirth: guest.date_of_birth || undefined,
      notes: guest.notes || undefined,
      createdAt: guest.created_at,
    }
  })
}

async function loadContracts() {
  const tenantId = await getTenantId()
  if (!tenantId) return []

  const [{ data: contracts, error: contractsError }, { data: contractProperties, error: propertiesError }] = await Promise.all([
    supabase
      .from('contracts')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true }),
    supabase
      .from('contract_properties')
      .select('contract_id, property_id')
      .eq('tenant_id', tenantId),
  ])

  if (contractsError) throw contractsError
  if (propertiesError) throw propertiesError

  const propertyMap = new Map<string, string[]>()
  for (const row of contractProperties || []) {
    propertyMap.set(row.contract_id, [...(propertyMap.get(row.contract_id) || []), row.property_id])
  }

  return (contracts || []).map((contract) => ({
    id: contract.id,
    guestId: contract.guest_id,
    propertyIds: propertyMap.get(contract.id) || [],
    rentalType: contract.rental_type,
    startDate: contract.start_date,
    endDate: contract.end_date,
    closeDate: contract.close_date || undefined,
    paymentDueDay: contract.payment_due_day,
    monthlyAmount: contract.monthly_amount,
    specialPaymentCondition: contract.special_payment_condition || undefined,
    status: contract.status,
    notes: contract.notes || undefined,
    templateId: contract.template_id || undefined,
    createdAt: contract.created_at,
  }))
}

async function loadServiceProviders() {
  const tenantId = await getTenantId()
  if (!tenantId) return []

  const { data, error } = await supabase
    .from('service_providers')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true })

  if (error) throw error

  return (data || []).map((provider) => ({
    id: provider.id,
    name: provider.name,
    service: provider.service,
    contact: provider.contact,
    email: provider.email || undefined,
  }))
}

async function loadTransactions() {
  const tenantId = await getTenantId()
  if (!tenantId) return []

  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true })

  if (error) throw error

  return (data || []).map((transaction) => ({
    id: transaction.id,
    type: transaction.type,
    amount: transaction.amount,
    category: transaction.category,
    description: transaction.description,
    date: transaction.date,
    propertyId: transaction.property_id || undefined,
    contractId: transaction.contract_id || undefined,
    serviceProviderId: transaction.service_provider_id || undefined,
    createdAt: transaction.created_at,
  }))
}

async function loadTasks() {
  const tenantId = await getTenantId()
  if (!tenantId) return []

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true })

  if (error) throw error

  return (data || []).map((task) => ({
    id: task.id,
    title: task.title,
    description: task.description,
    dueDate: task.due_date,
    priority: task.priority,
    status: task.status,
    assignee: task.assignee || undefined,
    propertyId: task.property_id || undefined,
    createdAt: task.created_at,
  }))
}

async function loadAppointments() {
  const tenantId = await getTenantId()
  if (!tenantId) return []

  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true })

  if (error) throw error

  return (data || []).map((appointment) => ({
    id: appointment.id,
    title: appointment.title,
    description: appointment.description || undefined,
    date: appointment.date,
    time: appointment.time,
    status: appointment.status,
    serviceProviderId: appointment.service_provider_id || undefined,
    contractId: appointment.contract_id || undefined,
    guestId: appointment.guest_id || undefined,
    propertyId: appointment.property_id || undefined,
    notes: appointment.notes || undefined,
    completionNotes: appointment.completion_notes || undefined,
    completedAt: appointment.completed_at || undefined,
    createdAt: appointment.created_at,
  }))
}

async function loadTemplates() {
  const tenantId = await getTenantId()
  if (!tenantId) return []

  const { data, error } = await supabase
    .from('contract_templates')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true })

  if (error) throw error

  return (data || []).map((template) => ({
    id: template.id,
    name: template.name,
    type: template.type,
    content: template.content,
    createdAt: template.created_at,
    updatedAt: template.updated_at,
  }))
}

async function loadDocuments() {
  const tenantId = await getTenantId()
  if (!tenantId) return []

  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('upload_date', { ascending: true })

  if (error) throw error

  return (data || []).map((document) => ({
    id: document.id,
    name: document.name,
    category: document.category,
    notes: document.notes || undefined,
    propertyId: document.property_id || undefined,
    uploadDate: document.upload_date,
  }))
}

async function loadCollection(key: string) {
  switch (key) {
    case 'owners': return loadOwners()
    case 'properties': return loadProperties()
    case 'guests': return loadGuests()
    case 'contracts': return loadContracts()
    case 'service-providers': return loadServiceProviders()
    case 'transactions': return loadTransactions()
    case 'tasks': return loadTasks()
    case 'appointments': return loadAppointments()
    case 'contract-templates': return loadTemplates()
    case 'documents': return loadDocuments()
    default: return []
  }
}

async function loadValue<T>(key: string, defaultValue: T): Promise<T> {
  if (cache.has(key)) {
    return cache.get(key) as T
  }

  const inflight = inflightLoads.get(key)
  if (inflight) {
    return (await inflight) as T
  }

  const request = (async () => {
    try {
      const resolved = isSettingKey(key)
        ? await loadUserSetting<T>(key, defaultValue)
        : isCollectionKey(key)
        ? await loadCollection(key)
        : defaultValue

      cache.set(key, resolved)
      return resolved as T
    } catch (error) {
      console.error(`Failed to load key "${key}" from Supabase`, error)
      cache.set(key, defaultValue)
      return defaultValue
    }
  })()

  inflightLoads.set(key, request)

  try {
    return await request
  } finally {
    inflightLoads.delete(key)
  }
}

async function persistOwners(value: any[]) {
  const tenantId = await getTenantId()
  if (!tenantId) return

  await replaceSimpleRows('owners', value.map((owner) => ({
    tenant_id: tenantId,
    id: owner.id,
    name: owner.name,
    email: owner.email,
    phone: owner.phone,
    document: JSON.stringify(owner.documents || []),
    document_type: null,
    nationality: owner.nationality || null,
    marital_status: owner.maritalStatus || null,
    profession: owner.profession || null,
    address: owner.address || null,
    notes: owner.notes || null,
    created_at: owner.createdAt,
  })))
}

async function persistProperties(value: any[]) {
  const tenantId = await getTenantId()
  if (!tenantId) return

  await replaceSimpleRows('properties', value.map((property) => ({
    tenant_id: tenantId,
    id: property.id,
    name: property.name,
    type: property.type,
    capacity: property.capacity,
    price_per_night: property.pricePerNight,
    price_per_month: property.pricePerMonth,
    status: property.status,
    address: property.address || null,
    city: property.city || null,
    conservation_state: property.conservationState || null,
    description: property.description,
    created_at: property.createdAt,
  })))

  const { error: deleteRelationsError } = await supabase
    .from('property_owners')
    .delete()
    .eq('tenant_id', tenantId)

  if (deleteRelationsError) throw deleteRelationsError

  const propertyOwners = value.flatMap((property) =>
    (property.ownerIds || []).map((ownerId: string) => ({
      tenant_id: tenantId,
      property_id: property.id,
      owner_id: ownerId,
    }))
  )

  if (propertyOwners.length > 0) {
    const { error } = await supabase.from('property_owners').insert(propertyOwners)
    if (error) throw error
  }

  const { error: deleteFurnitureError } = await supabase
    .from('property_furniture')
    .delete()
    .eq('tenant_id', tenantId)

  if (deleteFurnitureError) throw deleteFurnitureError

  const propertyFurniture = value.flatMap((property) =>
    (property.furnitureItems || [])
      .map((itemName: string) => itemName.trim())
      .filter(Boolean)
      .map((itemName: string, index: number) => ({
        tenant_id: tenantId,
        property_id: property.id,
        item_order: index + 1,
        item_name: itemName,
      }))
  )

  if (propertyFurniture.length > 0) {
    const { error } = await supabase.from('property_furniture').insert(propertyFurniture)
    if (error) throw error
  }
}

async function persistGuests(value: any[]) {
  const tenantId = await getTenantId()
  if (!tenantId) return

  await replaceSimpleRows('guests', value.map((guest) => ({
    tenant_id: tenantId,
    id: guest.id,
    name: guest.name,
    email: guest.email,
    phone: guest.phone,
    document: JSON.stringify(guest.documents || []),
    document_type: null,
    address: guest.address || null,
    nationality: guest.nationality || null,
    marital_status: guest.maritalStatus || null,
    profession: guest.profession || null,
    date_of_birth: guest.dateOfBirth || null,
    notes: guest.notes || null,
    created_at: guest.createdAt,
  })))
}

async function persistContracts(value: any[]) {
  const tenantId = await getTenantId()
  if (!tenantId) return

  await replaceSimpleRows('contracts', value.map((contract) => ({
    tenant_id: tenantId,
    id: contract.id,
    guest_id: contract.guestId,
    rental_type: contract.rentalType,
    start_date: contract.startDate,
    end_date: contract.endDate,
    close_date: contract.closeDate || null,
    payment_due_day: contract.paymentDueDay,
    monthly_amount: contract.monthlyAmount,
    special_payment_condition: contract.specialPaymentCondition || null,
    status: contract.status,
    notes: contract.notes || null,
    template_id: contract.templateId || null,
    created_at: contract.createdAt,
  })))

  const { error: deleteRelationsError } = await supabase
    .from('contract_properties')
    .delete()
    .eq('tenant_id', tenantId)

  if (deleteRelationsError) throw deleteRelationsError

  const contractProperties = value.flatMap((contract) =>
    (contract.propertyIds || []).map((propertyId: string) => ({
      tenant_id: tenantId,
      contract_id: contract.id,
      property_id: propertyId,
    }))
  )

  if (contractProperties.length > 0) {
    const { error } = await supabase.from('contract_properties').insert(contractProperties)
    if (error) throw error
  }
}

async function persistServiceProviders(value: any[]) {
  const tenantId = await getTenantId()
  if (!tenantId) return

  await replaceSimpleRows('service_providers', value.map((provider) => ({
    tenant_id: tenantId,
    id: provider.id,
    name: provider.name,
    service: provider.service,
    contact: provider.contact,
    email: provider.email || null,
  })))
}

async function persistTransactions(value: any[]) {
  const tenantId = await getTenantId()
  if (!tenantId) return

  await replaceSimpleRows('transactions', value.map((transaction) => ({
    tenant_id: tenantId,
    id: transaction.id,
    type: transaction.type,
    amount: transaction.amount,
    category: transaction.category,
    description: transaction.description,
    date: transaction.date,
    property_id: transaction.propertyId || null,
    contract_id: transaction.contractId || null,
    service_provider_id: transaction.serviceProviderId || null,
    created_at: transaction.createdAt,
  })))
}

async function persistTasks(value: any[]) {
  const tenantId = await getTenantId()
  if (!tenantId) return

  await replaceSimpleRows('tasks', value.map((task) => ({
    tenant_id: tenantId,
    id: task.id,
    title: task.title,
    description: task.description,
    due_date: task.dueDate,
    priority: task.priority,
    status: task.status,
    assignee: task.assignee || null,
    property_id: task.propertyId || null,
    created_at: task.createdAt,
  })))
}

async function persistAppointments(value: any[]) {
  const tenantId = await getTenantId()
  if (!tenantId) return

  await replaceSimpleRows('appointments', value.map((appointment) => ({
    tenant_id: tenantId,
    id: appointment.id,
    title: appointment.title,
    description: appointment.description || null,
    date: appointment.date,
    time: appointment.time,
    status: appointment.status,
    service_provider_id: appointment.serviceProviderId || null,
    contract_id: appointment.contractId || null,
    guest_id: appointment.guestId || null,
    property_id: appointment.propertyId || null,
    notes: appointment.notes || null,
    completion_notes: appointment.completionNotes || null,
    completed_at: appointment.completedAt || null,
    created_at: appointment.createdAt,
  })))
}

async function persistTemplates(value: any[]) {
  const tenantId = await getTenantId()
  if (!tenantId) return

  await replaceSimpleRows('contract_templates', value.map((template) => ({
    tenant_id: tenantId,
    id: template.id,
    name: template.name,
    type: template.type,
    content: template.content,
    created_at: template.createdAt,
    updated_at: template.updatedAt,
  })))
}

async function persistDocuments(value: any[]) {
  const tenantId = await getTenantId()
  if (!tenantId) return

  await replaceSimpleRows('documents', value.map((document) => ({
    tenant_id: tenantId,
    id: document.id,
    name: document.name,
    category: document.category,
    notes: document.notes || null,
    property_id: document.propertyId || null,
    upload_date: document.uploadDate,
  })))
}

async function persistCollection(key: string, value: unknown) {
  const rows = Array.isArray(value) ? value : []

  switch (key) {
    case 'owners': return persistOwners(rows)
    case 'properties': return persistProperties(rows)
    case 'guests': return persistGuests(rows)
    case 'contracts': return persistContracts(rows)
    case 'service-providers': return persistServiceProviders(rows)
    case 'transactions': return persistTransactions(rows)
    case 'tasks': return persistTasks(rows)
    case 'appointments': return persistAppointments(rows)
    case 'contract-templates': return persistTemplates(rows)
    case 'documents': return persistDocuments(rows)
    default: return undefined
  }
}

async function persistValue<T>(key: string, value: T) {
  if (isSettingKey(key)) return persistUserSetting(key, value)
  if (isCollectionKey(key)) return persistCollection(key, value)
}

export function useKV<T>(key: string, defaultValue: T): [T, Dispatch<SetStateAction<T>>] {
  const defaultValueRef = useRef(defaultValue)
  const [value, setValue] = useState<T>(defaultValue)
  const lastAuthScopeRef = useRef<string>('')

  useEffect(() => {
    defaultValueRef.current = defaultValue
  }, [defaultValue])

  useEffect(() => {
    let isMounted = true

    const sync = async () => {
      cache.delete(key)
      const loaded = await loadValue<T>(key, defaultValueRef.current)
      if (!isMounted) return
      setValue(loaded)
      notifySubscribers(key, loaded)
    }

    void sync()

    const unsubscribe = subscribeToKey(key, (nextValue) => {
      setValue(nextValue as T)
    })

    const unsubscribeAuthState = subscribeSupabaseAuthState((state) => {
      const scope = `${state.userId ?? 'anonymous'}:${state.tenantId ?? 'no-tenant'}:${state.isApproved ? 'approved' : 'not-approved'}`

      if (scope === lastAuthScopeRef.current) return
      lastAuthScopeRef.current = scope

      cachedTenantId = undefined
      cache.delete(key)
      void sync()
    })

    return () => {
      isMounted = false
      unsubscribe()
      unsubscribeAuthState()
    }
  }, [key])

  const setKVValue = useCallback<Dispatch<SetStateAction<T>>>((next) => {
    setValue((current) => {
      const base = (cache.has(key) ? cache.get(key) : current) as T
      const resolved = next instanceof Function ? next(base) : next

      cache.set(key, resolved)
      notifySubscribers(key, resolved)

      void persistValue(key, resolved).catch((error) => {
        console.error(`Failed to persist key "${key}" to Supabase`, error)
      })

      return resolved
    })
  }, [key])

  return useMemo(() => [value, setKVValue], [value, setKVValue])
}
