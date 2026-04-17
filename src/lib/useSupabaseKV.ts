import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { supabase } from '@/lib/supabase'

const cache = new Map<string, unknown>()
const subscribers = new Map<string, Set<(value: unknown) => void>>()
const inflightLoads = new Map<string, Promise<unknown>>()
const metadataCache = new Map<string, unknown>()
const ignoredPersistWarnings = new Set<string>()

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
  'user-profiles',
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

function shouldIgnorePersistError(key: string, error: any) {
  if (key !== 'user-profiles') return false
  return error?.code === '54001'
    || error?.code === '42501'
    || String(error?.message || '').includes('stack depth limit exceeded')
    || String(error?.message || '').toLowerCase().includes('row-level security policy')
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
    if (set.size === 0) {
      subscribers.delete(key)
    }
  }
}

async function getAuthUser() {
  const { data, error } = await supabase.auth.getUser()
  if (error) {
    console.error('Failed to read authenticated user', error)
    return null
  }
  return data.user ?? null
}

async function getAuthUserId() {
  const user = await getAuthUser()
  return user?.id ?? null
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
      {
        auth_user_id: authUserId,
        key: normalizeSettingKey(key),
        value,
      },
      { onConflict: 'auth_user_id,key' }
    )

  if (error) {
    throw error
  }
}

async function loadOwners() {
  const authUserId = await getAuthUserId()
  if (!authUserId) return []

  const { data, error } = await supabase
    .from('owners')
    .select('*')
    .eq('auth_user_id', authUserId)
    .order('created_at', { ascending: true })

  if (error) throw error

  return (data || []).map((owner) => ({
    id: owner.id,
    name: owner.name,
    email: owner.email,
    phone: owner.phone,
    document: owner.document,
    address: owner.address || undefined,
    notes: owner.notes || undefined,
    createdAt: owner.created_at,
  }))
}

async function loadProperties() {
  const authUserId = await getAuthUserId()
  if (!authUserId) return []

  const [{ data: properties, error: propertiesError }, { data: propertyOwners, error: ownersError }] = await Promise.all([
    supabase
      .from('properties')
      .select('*')
      .eq('auth_user_id', authUserId)
      .order('created_at', { ascending: true }),
    supabase
      .from('property_owners')
      .select('property_id, owner_id')
      .eq('auth_user_id', authUserId),
  ])

  if (propertiesError) throw propertiesError
  if (ownersError) throw ownersError

  const ownerMap = new Map<string, string[]>()
  for (const row of propertyOwners || []) {
    ownerMap.set(row.property_id, [...(ownerMap.get(row.property_id) || []), row.owner_id])
  }

  return (properties || []).map((property) => ({
    id: property.id,
    name: property.name,
    type: property.type,
    capacity: property.capacity,
    pricePerNight: property.price_per_night,
    pricePerMonth: property.price_per_month,
    status: property.status,
    description: property.description,
    ownerIds: ownerMap.get(property.id) || [],
    createdAt: property.created_at,
  }))
}

async function loadGuests() {
  const authUserId = await getAuthUserId()
  if (!authUserId) return []

  const { data, error } = await supabase
    .from('guests')
    .select('*')
    .eq('auth_user_id', authUserId)
    .order('created_at', { ascending: true })

  if (error) throw error

  return (data || []).map((guest) => ({
    id: guest.id,
    name: guest.name,
    email: guest.email,
    phone: guest.phone,
    document: guest.document,
    address: guest.address || undefined,
    nationality: guest.nationality || undefined,
    dateOfBirth: guest.date_of_birth || undefined,
    notes: guest.notes || undefined,
    createdAt: guest.created_at,
  }))
}

async function loadContracts() {
  const authUserId = await getAuthUserId()
  if (!authUserId) return []

  const [{ data: contracts, error: contractsError }, { data: contractProperties, error: propertiesError }] = await Promise.all([
    supabase
      .from('contracts')
      .select('*')
      .eq('auth_user_id', authUserId)
      .order('created_at', { ascending: true }),
    supabase
      .from('contract_properties')
      .select('contract_id, property_id')
      .eq('auth_user_id', authUserId),
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
    paymentDueDay: contract.payment_due_day,
    monthlyAmount: contract.monthly_amount,
    status: contract.status,
    notes: contract.notes || undefined,
    createdAt: contract.created_at,
  }))
}

async function loadServiceProviders() {
  const authUserId = await getAuthUserId()
  if (!authUserId) return []

  const { data, error } = await supabase
    .from('service_providers')
    .select('*')
    .eq('auth_user_id', authUserId)
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
  const authUserId = await getAuthUserId()
  if (!authUserId) return []

  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('auth_user_id', authUserId)
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
  const authUserId = await getAuthUserId()
  if (!authUserId) return []

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('auth_user_id', authUserId)
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
  const authUserId = await getAuthUserId()
  if (!authUserId) return []

  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .eq('auth_user_id', authUserId)
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
  const authUserId = await getAuthUserId()
  if (!authUserId) return []

  const { data, error } = await supabase
    .from('contract_templates')
    .select('*')
    .eq('auth_user_id', authUserId)
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
  const authUserId = await getAuthUserId()
  if (!authUserId) return []

  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('auth_user_id', authUserId)
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

async function loadProfiles() {
  const authUserId = await getAuthUserId()
  if (!authUserId) return []

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('auth_user_id', authUserId)
    .order('created_at', { ascending: true })

  if (error) throw error

  metadataCache.set('user-profiles-raw', data || [])

  return (data || []).map((profile) => ({
    githubLogin: profile.github_login,
    role: profile.role,
    status: profile.status,
    email: profile.email,
    avatarUrl: profile.avatar_url,
    createdAt: profile.created_at,
    updatedAt: profile.updated_at,
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
    case 'user-profiles': return loadProfiles()
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

async function loadExistingIds(table: string, authUserId: string) {
  const { data, error } = await supabase
    .from(table)
    .select('id')
    .eq('auth_user_id', authUserId)

  if (error) throw error
  return (data || []).map((row) => row.id)
}

async function replaceSimpleRows(table: string, rows: any[]) {
  const authUserId = await getAuthUserId()
  if (!authUserId) return

  const existingIds = await loadExistingIds(table, authUserId)
  const nextIds = rows.map((row) => row.id)
  const removedIds = existingIds.filter((id) => !nextIds.includes(id))

  if (removedIds.length > 0) {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq('auth_user_id', authUserId)
      .in('id', removedIds)

    if (error) throw error
  }

  if (rows.length > 0) {
    const { error } = await supabase
      .from(table)
      .upsert(rows, { onConflict: 'auth_user_id,id' })

    if (error) throw error
  }
}

async function persistOwners(value: any[]) {
  const authUserId = await getAuthUserId()
  if (!authUserId) return

  await replaceSimpleRows('owners', value.map((owner) => ({
    auth_user_id: authUserId,
    id: owner.id,
    name: owner.name,
    email: owner.email,
    phone: owner.phone,
    document: owner.document,
    address: owner.address || null,
    notes: owner.notes || null,
    created_at: owner.createdAt,
  })))
}

async function persistProperties(value: any[]) {
  const authUserId = await getAuthUserId()
  if (!authUserId) return

  await replaceSimpleRows('properties', value.map((property) => ({
    auth_user_id: authUserId,
    id: property.id,
    name: property.name,
    type: property.type,
    capacity: property.capacity,
    price_per_night: property.pricePerNight,
    price_per_month: property.pricePerMonth,
    status: property.status,
    description: property.description,
    created_at: property.createdAt,
  })))

  const { error: deleteRelationsError } = await supabase
    .from('property_owners')
    .delete()
    .eq('auth_user_id', authUserId)

  if (deleteRelationsError) throw deleteRelationsError

  const propertyOwners = value.flatMap((property) =>
    (property.ownerIds || []).map((ownerId: string) => ({
      auth_user_id: authUserId,
      property_id: property.id,
      owner_id: ownerId,
    }))
  )

  if (propertyOwners.length > 0) {
    const { error } = await supabase
      .from('property_owners')
      .insert(propertyOwners)

    if (error) throw error
  }
}

async function persistGuests(value: any[]) {
  const authUserId = await getAuthUserId()
  if (!authUserId) return

  await replaceSimpleRows('guests', value.map((guest) => ({
    auth_user_id: authUserId,
    id: guest.id,
    name: guest.name,
    email: guest.email,
    phone: guest.phone,
    document: guest.document,
    address: guest.address || null,
    nationality: guest.nationality || null,
    date_of_birth: guest.dateOfBirth || null,
    notes: guest.notes || null,
    created_at: guest.createdAt,
  })))
}

async function persistContracts(value: any[]) {
  const authUserId = await getAuthUserId()
  if (!authUserId) return

  await replaceSimpleRows('contracts', value.map((contract) => ({
    auth_user_id: authUserId,
    id: contract.id,
    guest_id: contract.guestId,
    rental_type: contract.rentalType,
    start_date: contract.startDate,
    end_date: contract.endDate,
    payment_due_day: contract.paymentDueDay,
    monthly_amount: contract.monthlyAmount,
    status: contract.status,
    notes: contract.notes || null,
    created_at: contract.createdAt,
  })))

  const { error: deleteRelationsError } = await supabase
    .from('contract_properties')
    .delete()
    .eq('auth_user_id', authUserId)

  if (deleteRelationsError) throw deleteRelationsError

  const contractProperties = value.flatMap((contract) =>
    (contract.propertyIds || []).map((propertyId: string) => ({
      auth_user_id: authUserId,
      contract_id: contract.id,
      property_id: propertyId,
    }))
  )

  if (contractProperties.length > 0) {
    const { error } = await supabase
      .from('contract_properties')
      .insert(contractProperties)

    if (error) throw error
  }
}

async function persistServiceProviders(value: any[]) {
  const authUserId = await getAuthUserId()
  if (!authUserId) return

  await replaceSimpleRows('service_providers', value.map((provider) => ({
    auth_user_id: authUserId,
    id: provider.id,
    name: provider.name,
    service: provider.service,
    contact: provider.contact,
    email: provider.email || null,
  })))
}

async function persistTransactions(value: any[]) {
  const authUserId = await getAuthUserId()
  if (!authUserId) return

  await replaceSimpleRows('transactions', value.map((transaction) => ({
    auth_user_id: authUserId,
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
  const authUserId = await getAuthUserId()
  if (!authUserId) return

  await replaceSimpleRows('tasks', value.map((task) => ({
    auth_user_id: authUserId,
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
  const authUserId = await getAuthUserId()
  if (!authUserId) return

  await replaceSimpleRows('appointments', value.map((appointment) => ({
    auth_user_id: authUserId,
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
  const authUserId = await getAuthUserId()
  if (!authUserId) return

  await replaceSimpleRows('contract_templates', value.map((template) => ({
    auth_user_id: authUserId,
    id: template.id,
    name: template.name,
    type: template.type,
    content: template.content,
    created_at: template.createdAt,
    updated_at: template.updatedAt,
  })))
}

async function persistDocuments(value: any[]) {
  const authUserId = await getAuthUserId()
  if (!authUserId) return

  await replaceSimpleRows('documents', value.map((document) => ({
    auth_user_id: authUserId,
    id: document.id,
    name: document.name,
    category: document.category,
    notes: document.notes || null,
    property_id: document.propertyId || null,
    upload_date: document.uploadDate,
  })))
}

async function persistProfiles(value: any[]) {
  const currentAuthUser = await getAuthUser()
  if (!currentAuthUser) return

  const existingProfiles = (metadataCache.get('user-profiles-raw') as any[] | undefined) || []
  const loginFromMetadata = currentAuthUser.user_metadata?.user_name || currentAuthUser.user_metadata?.preferred_username

  const matchingProfiles = value.filter((profile) =>
    profile.githubLogin === loginFromMetadata || profile.email === currentAuthUser.email
  )

  const targetProfile = matchingProfiles[0]
  if (!targetProfile) return

  const existing = existingProfiles.find((profile) => profile.auth_user_id === currentAuthUser.id)
    || existingProfiles.find((profile) => profile.github_login === targetProfile.githubLogin)

  const nextProfile = {
    auth_user_id: currentAuthUser.id,
    github_login: targetProfile.githubLogin,
    role: targetProfile.role,
    status: targetProfile.status,
    email: targetProfile.email,
    avatar_url: targetProfile.avatarUrl,
    created_at: existing?.created_at || targetProfile.createdAt || new Date().toISOString(),
    updated_at: targetProfile.updatedAt || new Date().toISOString(),
  }

  const { error } = await supabase
    .from('user_profiles')
    .upsert(nextProfile, { onConflict: 'github_login' })

  if (error) throw error

  metadataCache.set('user-profiles-raw', [nextProfile])
}

async function persistCollection(key: string, value: unknown) {
  const rows = Array.isArray(value) ? value : []

  switch (key) {
    case 'owners':
      return persistOwners(rows)
    case 'properties':
      return persistProperties(rows)
    case 'guests':
      return persistGuests(rows)
    case 'contracts':
      return persistContracts(rows)
    case 'service-providers':
      return persistServiceProviders(rows)
    case 'transactions':
      return persistTransactions(rows)
    case 'tasks':
      return persistTasks(rows)
    case 'appointments':
      return persistAppointments(rows)
    case 'contract-templates':
      return persistTemplates(rows)
    case 'documents':
      return persistDocuments(rows)
    case 'user-profiles':
      return persistProfiles(rows)
    default:
      return undefined
  }
}

async function persistValue<T>(key: string, value: T) {
  if (isSettingKey(key)) {
    return persistUserSetting(key, value)
  }

  if (isCollectionKey(key)) {
    return persistCollection(key, value)
  }
}

export function useKV<T>(key: string, defaultValue: T): [T, Dispatch<SetStateAction<T>>] {
  const defaultValueRef = useRef(defaultValue)
  const [value, setValue] = useState<T>(defaultValue)

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

    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      cache.delete(key)
      void sync()
    })

    return () => {
      isMounted = false
      unsubscribe()
      authListener.subscription.unsubscribe()
    }
  }, [key])

  const setKVValue = useCallback<Dispatch<SetStateAction<T>>>((next) => {
    setValue((current) => {
      const base = (cache.has(key) ? cache.get(key) : current) as T
      const resolved = next instanceof Function ? next(base) : next

      cache.set(key, resolved)
      notifySubscribers(key, resolved)

      void persistValue(key, resolved).catch((error) => {
        if (shouldIgnorePersistError(key, error)) {
          if (!ignoredPersistWarnings.has(key)) {
            console.warn(
              'Skipping user-profiles persistence for this session due to Supabase policy restrictions. Apply the latest user_profiles RLS migrations in the supabase folder to fix permanently.'
            )
            ignoredPersistWarnings.add(key)
          }
          return
        }

        console.error(`Failed to persist key "${key}" to relational Supabase tables`, error)
      })

      return resolved
    })
  }, [key])

  return useMemo(() => [value, setKVValue], [value, setKVValue])
}
