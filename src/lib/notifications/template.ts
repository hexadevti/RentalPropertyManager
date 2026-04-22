export function isHtmlTemplateContent(content: string) {
  return /<[a-z][\s\S]*>/i.test(content)
}

export function normalizeNotificationEditorContent(content: string, plainTextToHTML: (value: string) => string) {
  return isHtmlTemplateContent(content) ? content : plainTextToHTML(content)
}

function stringifyPreviewValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export function collectNotificationPreviewRows(
  value: unknown,
  basePath: string,
  rows: Array<{ path: string; value: string }>,
  depth = 0,
  maxDepth = 5
) {
  if (rows.length >= 300) return

  if (
    value === null
    || value === undefined
    || typeof value === 'string'
    || typeof value === 'number'
    || typeof value === 'boolean'
  ) {
    rows.push({ path: basePath, value: stringifyPreviewValue(value) })
    return
  }

  if (depth >= maxDepth) {
    rows.push({ path: basePath, value: stringifyPreviewValue(value) })
    return
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      rows.push({ path: basePath, value: '[]' })
      return
    }

    value.forEach((item, index) => {
      const nextPath = basePath ? `${basePath}{${index + 1}}` : `{${index + 1}}`
      collectNotificationPreviewRows(item, nextPath, rows, depth + 1, maxDepth)
    })
    return
  }

  const record = value as Record<string, unknown>
  const keys = Object.keys(record)
  if (keys.length === 0) {
    rows.push({ path: basePath, value: '{}' })
    return
  }

  keys.forEach((key) => {
    const nextPath = basePath ? `${basePath}.${key}` : key
    collectNotificationPreviewRows(record[key], nextPath, rows, depth + 1, maxDepth)
  })
}

export function getNotificationValueByPath(source: unknown, path: string): string | null {
  if (!path) return null

  const result = path.split('.').reduce<unknown>((current, segment) => {
    if (!segment) return current
    if (current === null || current === undefined) return null

    const arrayMatch = segment.match(/^(.*)\{(\d+)\}$/)
    if (arrayMatch) {
      const [, key, position] = arrayMatch
      const keyedValue = key ? (current as Record<string, unknown>)[key] : current
      if (!Array.isArray(keyedValue)) return null
      return keyedValue[Number(position) - 1]
    }

    if (typeof current !== 'object') return null
    return (current as Record<string, unknown>)[segment]
  }, source)

  if (result === null || result === undefined) return null
  return stringifyPreviewValue(result)
}

export function renderNotificationTemplateContent(
  content: string,
  notificationContext: Record<string, unknown>
) {
  return content.replace(/{{\s*([^{}]+?)\s*}}/g, (_match, tokenPath: string) => {
    const trimmedToken = tokenPath.trim()
    const normalizedPath = trimmedToken.startsWith('notification.')
      ? trimmedToken.slice('notification.'.length)
      : trimmedToken

    return getNotificationValueByPath(notificationContext, normalizedPath) ?? ''
  })
}
