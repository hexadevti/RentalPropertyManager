import { supabase } from '@/lib/supabase'
import { getEdgeFunctionErrorFromInvokeError, getEdgeFunctionErrorFromPayload } from '@/lib/edgeFunctionMessages'

export type BillingCheckoutInput = {
  tenantId: string
  planCode: string
  successUrl?: string
  cancelUrl?: string
}

export type BillingCheckoutResult = {
  provider: string
  checkoutUrl: string
  providerSessionId: string
}

function buildDefaultSuccessUrl() {
  return `${window.location.origin}/?tab=tenant&billing=success`
}

function buildDefaultCancelUrl() {
  return `${window.location.origin}/?tab=tenant&billing=cancelled`
}

export async function createBillingCheckoutSession(input: BillingCheckoutInput) {
  const payload = {
    tenantId: input.tenantId,
    planCode: input.planCode,
    successUrl: input.successUrl || buildDefaultSuccessUrl(),
    cancelUrl: input.cancelUrl || buildDefaultCancelUrl(),
  }

  const { data, error } = await supabase.functions.invoke('billing-checkout', {
    body: payload,
  })

  if (error) {
    throw await getEdgeFunctionErrorFromInvokeError(error, 'Failed to start checkout session')
  }

  const responseError = getEdgeFunctionErrorFromPayload(data, 'Failed to start checkout session')
  if (responseError) throw responseError

  if (!data?.success || !data?.checkoutUrl) {
    throw new Error(String(data?.error || 'Failed to start checkout session'))
  }

  return {
    provider: String(data.provider || ''),
    checkoutUrl: String(data.checkoutUrl),
    providerSessionId: String(data.providerSessionId || ''),
  } as BillingCheckoutResult
}
