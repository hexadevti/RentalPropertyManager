export const STARTER_PLAN_CODE = 'starter'
export const AI_PLAN_UPGRADE_MESSAGE = 'Funcionalidades de IA não estão disponíveis no plano Starter. Faça upgrade para Professional ou Enterprise.'

export async function getEffectiveTenantPlanCode(adminClient: any, tenantId: string) {
  const { data, error } = await adminClient
    .from('tenant_usage_plans')
    .select('plan_code')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message || 'Failed to resolve tenant usage plan.')
  }

  return String(data?.plan_code || STARTER_PLAN_CODE).trim().toLowerCase()
}

export async function ensureAiPlanAccess(adminClient: any, tenantId: string) {
  const planCode = await getEffectiveTenantPlanCode(adminClient, tenantId)

  return {
    planCode,
    allowed: planCode !== STARTER_PLAN_CODE,
    message: planCode !== STARTER_PLAN_CODE ? null : AI_PLAN_UPGRADE_MESSAGE,
  }
}
