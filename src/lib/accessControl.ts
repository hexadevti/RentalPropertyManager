import type { AccessLevel, AccessRoleId, UserRole } from '@/types'

export const SYSTEM_ACCESS_PROFILE_IDS = {
  administrator: 'system-administrator',
  guest: 'system-guest',
  operator: 'system-operator',
} as const

export function resolveDefaultAccessProfileId(role: 'admin' | 'guest') {
  return role === 'admin'
    ? SYSTEM_ACCESS_PROFILE_IDS.administrator
    : SYSTEM_ACCESS_PROFILE_IDS.guest
}

export function deriveUserRoleFromAccessProfileId(accessProfileId: string | null | undefined): UserRole {
  return accessProfileId === SYSTEM_ACCESS_PROFILE_IDS.administrator ? 'admin' : 'guest'
}

export function hasRequiredAccessLevel(currentLevel: AccessLevel | null | undefined, requiredLevel: AccessLevel = 'read') {
  if (currentLevel === 'write') return true
  if (requiredLevel === 'read') return currentLevel === 'read'
  return false
}

export function normalizeAccessLevel(value: string | null | undefined): AccessLevel {
  if (value === 'write') return 'write'
  if (value === 'read') return 'read'
  return 'none'
}

export const APP_TABS_BY_ACCESS_ROLE: Partial<Record<AccessRoleId, string>> = {
  tenant: 'tenant',
  properties: 'properties',
  owners: 'owners',
  finances: 'finances',
  calendar: 'calendar',
  tasks: 'tasks',
  reports: 'reports',
  guests: 'guests',
  contracts: 'contracts',
  documents: 'documents',
  'ai-assistant': 'ai-assistant',
  inspections: 'inspections',
  templates: 'templates',
  notifications: 'notifications',
  providers: 'providers',
  appointments: 'appointments',
  'users-permissions': 'users-permissions',
  'access-profiles': 'access-profiles',
  'audit-logs': 'audit-logs',
}

export const EXTRA_ACCESS_CONTROLLED_TABS: Array<{ tab: string; roleId: AccessRoleId }> = []
