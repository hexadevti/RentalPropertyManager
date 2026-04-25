import type { AccessRoleId } from '@/types'
import { supabase } from '@/lib/supabase'

export type PlanCode = 'starter' | 'professional' | 'enterprise'

export interface TenantUsagePlan {
  tenantId: string
  planCode: PlanCode | string
  planName: string
  description?: string | null
  priceMonthlyBrl?: number | null
  maxProperties?: number | null
  maxUsers?: number | null
  allowedAccessRoleIds: AccessRoleId[]
  featureHighlights: string[]
  startsAt?: string | null
  endsAt?: string | null
  notes?: string | null
  isCustom?: boolean
}

export interface UsagePlanCatalogItem {
  code: PlanCode | string
  name: string
  description?: string | null
  priceMonthlyBrl?: number | null
  maxProperties?: number | null
  maxUsers?: number | null
  allowedAccessRoleIds: AccessRoleId[]
  featureHighlights: string[]
  isActive: boolean
}

export async function fetchTenantUsagePlan(tenantId?: string | null) {
  const { data, error } = await supabase.rpc('get_effective_tenant_usage_plan', {
    p_tenant_id: tenantId || null,
  })

  if (error) throw error
  const raw = (data || null) as any
  if (!raw) return null

  return {
    tenantId: raw.tenantId,
    planCode: raw.planCode,
    planName: raw.planName,
    description: raw.description || null,
    priceMonthlyBrl: raw.priceMonthlyBrl ?? null,
    maxProperties: raw.maxProperties ?? null,
    maxUsers: raw.maxUsers ?? null,
    allowedAccessRoleIds: Array.isArray(raw.allowedAccessRoleIds) ? raw.allowedAccessRoleIds : [],
    featureHighlights: Array.isArray(raw.featureHighlights) ? raw.featureHighlights : [],
    startsAt: raw.startsAt || null,
    endsAt: raw.endsAt || null,
    notes: raw.notes || null,
    isCustom: !!raw.isCustom,
  } as TenantUsagePlan
}

export async function fetchUsagePlanCatalog() {
  const { data, error } = await supabase
    .from('usage_plans')
    .select('code, name, description, price_monthly_brl, max_properties, max_users, allowed_access_roles, feature_highlights, is_active')
    .order('name', { ascending: true })

  if (error) throw error

  return ((data || []) as any[]).map((row) => ({
    code: row.code,
    name: row.name,
    description: row.description || null,
    priceMonthlyBrl: row.price_monthly_brl ?? null,
    maxProperties: row.max_properties ?? null,
    maxUsers: row.max_users ?? null,
    allowedAccessRoleIds: Array.isArray(row.allowed_access_roles) ? row.allowed_access_roles : [],
    featureHighlights: Array.isArray(row.feature_highlights) ? row.feature_highlights : [],
    isActive: !!row.is_active,
  })) as UsagePlanCatalogItem[]
}
