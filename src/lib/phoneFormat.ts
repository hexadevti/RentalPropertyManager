export function onlyPhoneDigits(value: string) {
  return value.replace(/\D/g, '')
}

export function applyPhoneMask(value: string, mask: string) {
  const digits = onlyPhoneDigits(value)
  let index = 0
  let formatted = ''

  for (const char of mask) {
    if (char.toLowerCase() === 'x') {
      if (index >= digits.length) break
      formatted += digits[index]
      index += 1
      continue
    }

    if (index < digits.length) formatted += char
  }

  return formatted
}

export function countMaskDigits(mask: string) {
  return (mask.match(/x/gi) || []).length
}

export function sanitizeMasks(masks: string[]) {
  return Array.from(new Set(
    masks
      .map((mask) => mask.trim())
      .filter((mask) => countMaskDigits(mask) > 0)
  ))
}

export function chooseMaskForValue(value: string, masks: string[]) {
  const digitsLength = onlyPhoneDigits(value).length
  const ordered = sanitizeMasks(masks).sort((a, b) => countMaskDigits(a) - countMaskDigits(b))
  return ordered.find((mask) => countMaskDigits(mask) >= digitsLength)
    || ordered[ordered.length - 1]
    || ''
}

export function isValidPhoneByMasks(value: string, masks: string[]) {
  const validMasks = sanitizeMasks(masks)
  const digitsLength = onlyPhoneDigits(value).length
  if (digitsLength === 0) return true
  if (validMasks.length === 0) return true

  return validMasks.some((mask) => countMaskDigits(mask) === digitsLength)
}

export function formatPhoneByMasks(value: string, masks: string[]) {
  const validMasks = sanitizeMasks(masks)
  if (validMasks.length === 0) return value

  return applyPhoneMask(value, chooseMaskForValue(value, validMasks))
}
