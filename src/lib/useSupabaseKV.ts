import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { getSupabaseAuthState, subscribeSupabaseAuthState } from '@/lib/supabaseAuthState'
import { logAppAudit, type AppAuditAction } from '@/lib/appAudit'
import { getNotificationEventTypeForTrigger } from '@/lib/notifications/catalog'

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
  'inspections',
  'notification-rules',
  'notification-templates',
  'owners',
  'properties',
  'service-providers',
  'tasks',
  'transactions',
])

function isSettingKey(key: string) {
  return key === 'app-language'
    || key === 'app-currency'
    || key === 'app-decimal-separator'
    || key === 'app-phone-mask'
    || key === 'app-phone-masks'
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
  if (cachedTenantId !== undefined) return cachedTenantId ?? null

  const authState = getSupabaseAuthState()

  if (authState.isAuthenticated && authState.isApproved) {
    cachedTenantId = authState.tenantId ?? null
    return cachedTenantId ?? null
  }

  if (import.meta.env.VITE_DEV_MODE === 'true') {
    cachedTenantId = import.meta.env.VITE_DEV_TENANT_ID || 'dev-tenant'
    return cachedTenantId ?? null
  }

  cachedTenantId = null

  return cachedTenantId ?? null
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

async function loadExistingRows(table: string, tenantId: string) {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('tenant_id', tenantId)

  if (error) throw error
  return data || []
}

function normalizeAuditValue(value: unknown) {
  if (value === undefined || value === null) return null
  return value
}

function rowChanged(nextRow: Record<string, unknown>, existingRow: Record<string, unknown>) {
  return Object.entries(nextRow).some(([key, value]) => {
    return normalizeAuditValue(existingRow[key]) !== normalizeAuditValue(value)
  })
}

function auditEntityName(table: string) {
  return table
}

async function logCollectionAudit(table: string, action: AppAuditAction, recordIds: string[], tenantId: string) {
  await Promise.all(recordIds.map((recordId) => (
    logAppAudit({
      tenantId,
      entity: auditEntityName(table),
      action,
      recordId,
    })
  )))
}

async function replaceSimpleRows(table: string, rows: any[]) {
  const tenantId = await getTenantId()
  if (!tenantId) return

  const existingRows = await loadExistingRows(table, tenantId)
  const existingIds = existingRows.map((row) => row.id)
  const existingRowsById = new Map(existingRows.map((row) => [row.id, row]))
  const nextIds = rows.map((row) => row.id)
  const removedIds = existingIds.filter((id) => !nextIds.includes(id))
  const createdIds = rows.filter((row) => !existingRowsById.has(row.id)).map((row) => row.id)
  const updatedIds = rows
    .filter((row) => {
      const existingRow = existingRowsById.get(row.id)
      return existingRow && rowChanged(row, existingRow)
    })
    .map((row) => row.id)

  if (removedIds.length > 0) {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq('tenant_id', tenantId)
      .in('id', removedIds)

    if (error) throw error
    await logCollectionAudit(table, 'delete', removedIds, tenantId)
  }

  if (rows.length > 0) {
    const { error } = await supabase
      .from(table)
      .upsert(rows, { onConflict: 'tenant_id,id' })

    if (error) throw error
    await logCollectionAudit(table, 'create', createdIds, tenantId)
    await logCollectionAudit(table, 'update', updatedIds, tenantId)
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
    { data: propertyEnvironments, error: environmentsError },
    { data: propertyFurniture, error: furnitureError },
    { data: propertyInspectionItems, error: inspectionItemsError },
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
      .from('property_environments')
      .select('property_id, environment_order, environment_name')
      .eq('tenant_id', tenantId)
      .order('property_id', { ascending: true })
      .order('environment_order', { ascending: true }),
    supabase
      .from('property_furniture')
      .select('property_id, item_order, item_name')
      .eq('tenant_id', tenantId)
      .order('property_id', { ascending: true })
      .order('item_order', { ascending: true }),
    supabase
      .from('property_inspection_items')
      .select('property_id, item_order, item_name')
      .eq('tenant_id', tenantId)
      .order('property_id', { ascending: true })
      .order('item_order', { ascending: true }),
  ])

  if (propertiesError) throw propertiesError
  if (ownersError) throw ownersError
  if (environmentsError) throw environmentsError
  if (furnitureError) throw furnitureError
  if (inspectionItemsError) throw inspectionItemsError

  const ownerMap = new Map<string, string[]>()
  for (const row of propertyOwners || []) {
    ownerMap.set(row.property_id, [...(ownerMap.get(row.property_id) || []), row.owner_id])
  }

  const environmentMap = new Map<string, string[]>()
  for (const row of propertyEnvironments || []) {
    const currentItems = environmentMap.get(row.property_id) || []
    currentItems.push(row.environment_name)
    environmentMap.set(row.property_id, currentItems)
  }

  const furnitureMap = new Map<string, string[]>()
  for (const row of propertyFurniture || []) {
    const currentItems = furnitureMap.get(row.property_id) || []
    currentItems.push(row.item_name)
    furnitureMap.set(row.property_id, currentItems)
  }

  const inspectionItemsMap = new Map<string, string[]>()
  for (const row of propertyInspectionItems || []) {
    const currentItems = inspectionItemsMap.get(row.property_id) || []
    currentItems.push(row.item_name)
    inspectionItemsMap.set(row.property_id, currentItems)
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
    environments: environmentMap.get(property.id) || [],
    furnitureItems: furnitureMap.get(property.id) || [],
    inspectionItems: inspectionItemsMap.get(property.id) || [],
    description: property.description,
    ownerIds: ownerMap.get(property.id) || [],
    createdAt: property.created_at,
  }))
}

async function loadGuests() {
  const tenantId = await getTenantId()
  if (!tenantId) return []

  const [
    { data: guests, error: guestsError },
    { data: sponsors, error: sponsorsError },
    { data: dependents, error: dependentsError },
  ] = await Promise.all([
    supabase
      .from('guests')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true }),
    supabase
      .from('guest_sponsors')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true }),
    supabase
      .from('guest_dependents')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true }),
  ])

  if (guestsError) throw guestsError
  if (sponsorsError) throw sponsorsError
  if (dependentsError) throw dependentsError

  const parseDocuments = (raw: unknown, fallbackDocument?: string | null, fallbackType?: string | null) => {
    let documents: { type: string; number: string }[] = []
    if (Array.isArray(raw)) {
      documents = raw as { type: string; number: string }[]
    } else if (typeof raw === 'string' && raw.trimStart().startsWith('[')) {
      try { documents = JSON.parse(raw) } catch { documents = [] }
    } else if (typeof raw === 'string' && raw) {
      documents = [{ type: fallbackType || '', number: raw }]
    } else if (fallbackDocument) {
      documents = [{ type: fallbackType || '', number: fallbackDocument }]
    }

    return documents
  }

  const mapRelatedPeople = (rows: any[] | null | undefined) => {
    const peopleByGuestId = new Map<string, any[]>()

    for (const row of rows || []) {
      const person = {
        id: row.id,
        name: row.name,
        email: row.email,
        phone: row.phone,
        documents: parseDocuments(row.documents),
        address: row.address || undefined,
        nationality: row.nationality || undefined,
        maritalStatus: row.marital_status || undefined,
        profession: row.profession || undefined,
        dateOfBirth: row.date_of_birth || undefined,
        notes: row.notes || undefined,
      }

      peopleByGuestId.set(row.guest_id, [...(peopleByGuestId.get(row.guest_id) || []), person])
    }

    return peopleByGuestId
  }

  const sponsorsByGuestId = mapRelatedPeople(sponsors)
  const dependentsByGuestId = mapRelatedPeople(dependents)

  return (guests || []).map((guest) => {
    const documents = parseDocuments(guest.document as string | null, guest.document as string | null, guest.document_type as string | null)
    return {
      id: guest.id,
      name: guest.name,
      email: guest.email,
      phone: guest.phone,
      documents,
      sponsors: sponsorsByGuestId.get(guest.id) || [],
      dependents: dependentsByGuestId.get(guest.id) || [],
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
    phone: provider.contact,
    email: provider.email || undefined,
    document: provider.document || undefined,
    address: provider.address || undefined,
    notes: provider.notes || undefined,
    createdAt: provider.created_at,
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
    assigneeName: task.assignee || undefined,
    assigneeType: task.assignee_type || undefined,
    assigneeId: task.assignee_id || undefined,
    propertyId: task.property_id || undefined,
    createdAt: task.created_at,
    updatedAt: task.updated_at || undefined,
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

async function loadNotificationTemplates() {
  const tenantId = await getTenantId()
  if (!tenantId) return []

  const { data, error } = await supabase
    .from('notification_templates')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true })

  if (error) throw error

  return (data || []).map((template) => ({
    id: template.id,
    name: template.name,
    channel: template.channel,
    eventType: template.event_type || 'general',
    contentType: template.content_type || 'html',
    description: template.description || undefined,
    subject: template.subject || undefined,
    content: template.content,
    createdAt: template.created_at,
    updatedAt: template.updated_at,
  }))
}

async function loadNotificationRules() {
  const tenantId = await getTenantId()
  if (!tenantId) return []

  const { data, error } = await supabase
    .from('notification_rules')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true })

  if (error) throw error

  return (data || []).map((rule) => ({
    id: rule.id,
    name: rule.name,
    trigger: rule.trigger,
    eventType: rule.event_type || getNotificationEventTypeForTrigger(rule.trigger),
    channels: Array.isArray(rule.channels) ? rule.channels : [],
    emailTemplateId: rule.email_template_id || undefined,
    smsTemplateId: rule.sms_template_id || undefined,
    whatsappTemplateId: rule.whatsapp_template_id || undefined,
    recipientRoles: Array.isArray(rule.recipient_roles) ? rule.recipient_roles : [],
    recipientUserIds: Array.isArray(rule.recipient_user_ids) ? rule.recipient_user_ids : [],
    sendToTaskAssignee: rule.send_to_task_assignee ?? false,
    sendToEventRecipient: rule.send_to_event_recipient ?? false,
    daysBefore: typeof rule.days_before === 'number' ? rule.days_before : undefined,
    isActive: rule.is_active ?? true,
    createdAt: rule.created_at,
    updatedAt: rule.updated_at,
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
    relationType: document.relation_type || (document.property_id ? 'property' : 'general'),
    relationId: document.relation_id || document.property_id || undefined,
    fileName: document.file_name || undefined,
    filePath: document.file_path || undefined,
    fileSize: document.file_size || undefined,
    mimeType: document.mime_type || undefined,
    uploadDate: document.upload_date,
  }))
}

async function loadInspections() {
  const tenantId = await getTenantId()
  if (!tenantId) return []

  const [
    { data: inspections, error: inspectionsError },
    { data: entries, error: entriesError },
  ] = await Promise.all([
    supabase
      .from('inspections')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true }),
    supabase
      .from('inspection_entries')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('environment_order', { ascending: true })
      .order('item_order', { ascending: true }),
  ])

  if (inspectionsError) throw inspectionsError
  if (entriesError) throw entriesError

  const entriesByInspection = new Map<string, any[]>()
  for (const entry of entries || []) {
    const current = entriesByInspection.get(entry.inspection_id) || []
    current.push(entry)
    entriesByInspection.set(entry.inspection_id, current)
  }

  return (inspections || []).map((inspection: any) => {
    const inspectionEntries = entriesByInspection.get(inspection.id) || []

    const environmentMap = new Map<number, { name: string; items: any[] }>()
    for (const entry of inspectionEntries) {
      const env: { name: string; items: any[] } = environmentMap.get(entry.environment_order) || { name: entry.environment_name, items: [] }
      env.items.push(entry)
      environmentMap.set(entry.environment_order, env)
    }

    const areas = Array.from(environmentMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([envOrder, env]) => ({
        id: `${inspection.id}-env-${envOrder}`,
        name: env.name,
        notes: '',
        items: env.items
          .sort((a: any, b: any) => a.item_order - b.item_order)
          .map((item: any) => ({
            id: item.id,
            label: item.item_name,
            condition: item.condition,
            notes: item.notes || '',
          })),
      }))

    return {
      id: inspection.id,
      title: inspection.title,
      propertyId: inspection.property_id,
      contractId: inspection.contract_id,
      parentInspectionId: inspection.parent_inspection_id || undefined,
      type: inspection.type,
      status: inspection.status,
      inspectorName: inspection.inspector_name,
      scheduledDate: inspection.scheduled_date,
      completedDate: inspection.completed_date || undefined,
      summary: inspection.summary || undefined,
      areas,
      createdAt: inspection.created_at,
      updatedAt: inspection.updated_at,
    }
  })
}

async function persistInspections(value: any[]) {
  const tenantId = await getTenantId()
  if (!tenantId) return

  const existingIds = await loadExistingIds('inspections', tenantId)
  const nextIds = value.map((i) => i.id)
  const removedIds = existingIds.filter((id) => !nextIds.includes(id))

  if (removedIds.length > 0) {
    const { error } = await supabase
      .from('inspections')
      .delete()
      .eq('tenant_id', tenantId)
      .in('id', removedIds)
    if (error) throw error
  }

  if (value.length > 0) {
    const { error } = await supabase
      .from('inspections')
      .upsert(
        value.map((inspection) => ({
          tenant_id: tenantId,
          id: inspection.id,
          property_id: inspection.propertyId,
          contract_id: inspection.contractId,
          parent_inspection_id: inspection.parentInspectionId || null,
          title: inspection.title,
          type: inspection.type,
          status: inspection.status,
          inspector_name: inspection.inspectorName,
          scheduled_date: inspection.scheduledDate,
          completed_date: inspection.completedDate || null,
          summary: inspection.summary || null,
          created_at: inspection.createdAt,
          updated_at: inspection.updatedAt,
        })),
        { onConflict: 'tenant_id,id' }
      )
    if (error) throw error
  }

  if (nextIds.length > 0) {
    const { error } = await supabase
      .from('inspection_entries')
      .delete()
      .eq('tenant_id', tenantId)
      .in('inspection_id', nextIds)
    if (error) throw error
  }

  const entryRows = value.flatMap((inspection) =>
    (inspection.areas || []).flatMap((area: any, areaIndex: number) =>
      (area.items || []).map((item: any, itemIndex: number) => ({
        id: item.id,
        tenant_id: tenantId,
        inspection_id: inspection.id,
        environment_name: area.name,
        environment_order: areaIndex + 1,
        item_name: item.label,
        item_order: itemIndex + 1,
        condition: item.condition,
        notes: item.notes || null,
      }))
    )
  )

  if (entryRows.length > 0) {
    const { error } = await supabase.from('inspection_entries').insert(entryRows)
    if (error) throw error
  }
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
    case 'inspections': return loadInspections()
    case 'notification-templates': return loadNotificationTemplates()
    case 'notification-rules': return loadNotificationRules()
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

  const { error: deleteEnvironmentsError } = await supabase
    .from('property_environments')
    .delete()
    .eq('tenant_id', tenantId)

  if (deleteEnvironmentsError) throw deleteEnvironmentsError

  const propertyEnvironments = value.flatMap((property) =>
    (property.environments || [])
      .map((environmentName: string) => environmentName.trim())
      .filter(Boolean)
      .map((environmentName: string, index: number) => ({
        tenant_id: tenantId,
        property_id: property.id,
        environment_order: index + 1,
        environment_name: environmentName,
      }))
  )

  if (propertyEnvironments.length > 0) {
    const { error } = await supabase.from('property_environments').insert(propertyEnvironments)
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

  const { error: deleteInspectionItemsError } = await supabase
    .from('property_inspection_items')
    .delete()
    .eq('tenant_id', tenantId)

  if (deleteInspectionItemsError) throw deleteInspectionItemsError

  const propertyInspectionItems = value.flatMap((property) =>
    (property.inspectionItems || [])
      .map((itemName: string) => itemName.trim())
      .filter(Boolean)
      .map((itemName: string, index: number) => ({
        tenant_id: tenantId,
        property_id: property.id,
        item_order: index + 1,
        item_name: itemName,
      }))
  )

  if (propertyInspectionItems.length > 0) {
    const { error } = await supabase.from('property_inspection_items').insert(propertyInspectionItems)
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

  const { error: deleteSponsorsError } = await supabase
    .from('guest_sponsors')
    .delete()
    .eq('tenant_id', tenantId)

  if (deleteSponsorsError) throw deleteSponsorsError

  const sponsorRows = value.flatMap((guest) =>
    (guest.sponsors || []).map((sponsor: any) => ({
      tenant_id: tenantId,
      id: sponsor.id,
      guest_id: guest.id,
      name: sponsor.name || '',
      email: sponsor.email || '',
      phone: sponsor.phone || '',
      documents: sponsor.documents || [],
      address: sponsor.address || null,
      nationality: sponsor.nationality || null,
      marital_status: sponsor.maritalStatus || null,
      profession: sponsor.profession || null,
      date_of_birth: sponsor.dateOfBirth || null,
      notes: sponsor.notes || null,
      created_at: sponsor.createdAt || new Date().toISOString(),
    }))
  )

  if (sponsorRows.length > 0) {
    const { error } = await supabase.from('guest_sponsors').upsert(sponsorRows, { onConflict: 'tenant_id,id' })
    if (error) throw error
  }

  const { error: deleteDependentsError } = await supabase
    .from('guest_dependents')
    .delete()
    .eq('tenant_id', tenantId)

  if (deleteDependentsError) throw deleteDependentsError

  const dependentRows = value.flatMap((guest) =>
    (guest.dependents || []).map((dependent: any) => ({
      tenant_id: tenantId,
      id: dependent.id,
      guest_id: guest.id,
      name: dependent.name || '',
      email: dependent.email || '',
      phone: dependent.phone || '',
      documents: dependent.documents || [],
      address: dependent.address || null,
      nationality: dependent.nationality || null,
      marital_status: dependent.maritalStatus || null,
      profession: dependent.profession || null,
      date_of_birth: dependent.dateOfBirth || null,
      notes: dependent.notes || null,
      created_at: dependent.createdAt || new Date().toISOString(),
    }))
  )

  if (dependentRows.length > 0) {
    const { error } = await supabase.from('guest_dependents').upsert(dependentRows, { onConflict: 'tenant_id,id' })
    if (error) throw error
  }
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
    contact: provider.phone || provider.contact || '',
    email: provider.email || null,
    document: provider.document || null,
    address: provider.address || null,
    notes: provider.notes || null,
    created_at: provider.createdAt || new Date().toISOString(),
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
    assignee: task.assigneeName || null,
    assignee_type: task.assigneeType || null,
    assignee_id: task.assigneeId || null,
    property_id: task.propertyId || null,
    created_at: task.createdAt,
    updated_at: task.updatedAt || new Date().toISOString(),
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

async function persistNotificationTemplates(value: any[]) {
  const tenantId = await getTenantId()
  if (!tenantId) return

  await replaceSimpleRows('notification_templates', value.map((template) => ({
    tenant_id: tenantId,
    id: template.id,
    name: template.name,
    channel: template.channel,
    event_type: template.eventType || 'general',
    content_type: template.contentType || 'html',
    description: template.description || null,
    subject: template.subject || null,
    content: template.content,
    created_at: template.createdAt,
    updated_at: template.updatedAt,
  })))
}

async function persistNotificationRules(value: any[]) {
  const tenantId = await getTenantId()
  if (!tenantId) return

  await replaceSimpleRows('notification_rules', value.map((rule) => ({
    tenant_id: tenantId,
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
    property_id: document.relationType === 'property'
      ? (document.relationId || document.propertyId || null)
      : (document.propertyId || null),
    relation_type: document.relationType || (document.propertyId ? 'property' : 'general'),
    relation_id: document.relationId || document.propertyId || null,
    file_name: document.fileName || null,
    file_path: document.filePath || null,
    file_size: document.fileSize || null,
    mime_type: document.mimeType || null,
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
    case 'inspections': return persistInspections(rows)
    case 'notification-templates': return persistNotificationTemplates(rows)
    case 'notification-rules': return persistNotificationRules(rows)
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
        const message = error instanceof Error ? error.message : String(error)
        toast.error(`Erro ao salvar: ${message}`)
      })

      return resolved
    })
  }, [key])

  return useMemo(() => [value, setKVValue], [value, setKVValue])
}
