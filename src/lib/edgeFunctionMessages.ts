import { translations } from '@/lib/i18n'

type TranslationCatalog = typeof translations
type TranslationBundle = TranslationCatalog[keyof TranslationCatalog]
export type EdgeFunctionMessageParams = Record<string, string | number | null | undefined>

export class EdgeFunctionClientError extends Error {
  messageKey?: string
  messageParams?: EdgeFunctionMessageParams

  constructor(message: string, options?: { messageKey?: string; messageParams?: EdgeFunctionMessageParams }) {
    super(message)
    this.name = 'EdgeFunctionClientError'
    this.messageKey = options?.messageKey
    this.messageParams = options?.messageParams
  }
}

function interpolate(template: string, params?: EdgeFunctionMessageParams) {
  if (!params) return template

  return template.replace(/\{(\w+)\}/g, (_, token: string) => {
    const value = params[token]
    return value == null ? '' : String(value)
  })
}

export function resolveEdgeFunctionMessage(
  t: TranslationBundle,
  messageKey?: string | null,
  messageParams?: EdgeFunctionMessageParams,
  fallback?: string | null,
) {
  const translated = messageKey
    ? (t.edge_function_messages?.[messageKey as keyof typeof t.edge_function_messages] as string | undefined)
    : undefined

  const baseMessage = translated || String(fallback || messageKey || '').trim()
  return interpolate(baseMessage, messageParams)
}

export function getEdgeFunctionErrorFromPayload(payload: any, fallback?: string) {
  if (!payload || (!payload.error && !payload.errorKey)) return null

  return new EdgeFunctionClientError(
    String(payload.error || fallback || payload.errorKey || 'Unexpected error'),
    {
      messageKey: typeof payload.errorKey === 'string' ? payload.errorKey : undefined,
      messageParams: payload.errorParams && typeof payload.errorParams === 'object' ? payload.errorParams : undefined,
    },
  )
}

export async function getEdgeFunctionErrorFromInvokeError(error: any, fallback?: string) {
  const response = error?.context
  const fallbackMessage = String(error?.message || fallback || 'Unexpected error')

  if (!response || typeof response.text !== 'function') {
    return new EdgeFunctionClientError(fallbackMessage)
  }

  try {
    const raw = await response.text()
    if (!raw) return new EdgeFunctionClientError(fallbackMessage)

    try {
      const parsed = JSON.parse(raw)
      return getEdgeFunctionErrorFromPayload(parsed, fallbackMessage) || new EdgeFunctionClientError(raw)
    } catch {
      return new EdgeFunctionClientError(raw)
    }
  } catch {
    return new EdgeFunctionClientError(fallbackMessage)
  }
}

export function getEdgeFunctionMessage(error: unknown, t: TranslationBundle, fallback: string) {
  if (error instanceof EdgeFunctionClientError) {
    return resolveEdgeFunctionMessage(t, error.messageKey, error.messageParams, error.message || fallback)
  }

  if (error instanceof Error) return error.message || fallback
  return fallback
}

export function getEdgeFunctionAnswerFromPayload(payload: any, t: TranslationBundle, fallback?: string) {
  if (!payload) return String(fallback || '')

  if (payload.answerKey) {
    return resolveEdgeFunctionMessage(
      t,
      String(payload.answerKey),
      payload.answerParams && typeof payload.answerParams === 'object' ? payload.answerParams : undefined,
      payload.answer || fallback,
    )
  }

  return String(payload.answer || fallback || '')
}
