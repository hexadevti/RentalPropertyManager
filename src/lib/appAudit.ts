import { supabase } from '@/lib/supabase'
import { getSupabaseAuthState } from '@/lib/supabaseAuthState'

export type AppAuditAction = 'login' | 'logout' | 'create' | 'update' | 'delete'

type AppAuditInput = {
  entity: string
  action: AppAuditAction
  recordId?: string | null
  tenantId?: string | null
  actorAuthUserId?: string | null
  actorLogin?: string | null
}

function isUuid(value: string | null | undefined) {
  if (!value) return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export async function logAppAudit(input: AppAuditInput) {
  const authState = getSupabaseAuthState()
  const tenantId = input.tenantId ?? authState.tenantId
  const actorAuthUserId = input.actorAuthUserId ?? authState.userId

  if (!tenantId) return

  const { error } = await supabase
    .from('app_audit_logs')
    .insert({
      tenant_id: tenantId,
      actor_auth_user_id: isUuid(actorAuthUserId) ? actorAuthUserId : null,
      actor_login: input.actorLogin || null,
      entity: input.entity,
      action: input.action,
      record_id: input.recordId || null,
    })

  if (error) {
    console.warn('Failed to write app audit log:', error)
  }
}
