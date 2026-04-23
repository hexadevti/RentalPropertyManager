import { describe, expect, it } from 'vitest'

import {
  applyPhoneMask,
  chooseMaskForValue,
  formatPhoneByMasks,
  isValidPhoneByMasks,
  onlyPhoneDigits,
  sanitizeMasks,
} from '@/lib/phoneFormat'

describe('phoneFormat', () => {
  it('keeps only phone digits', () => {
    expect(onlyPhoneDigits('(11) 99876-1234')).toBe('11998761234')
  })

  it('applies the selected mask to the provided digits', () => {
    expect(applyPhoneMask('11998761234', '(xx) xxxxx-xxxx')).toBe('(11) 99876-1234')
  })

  it('removes duplicates and invalid masks', () => {
    expect(sanitizeMasks(['(xx) xxxxx-xxxx', '  ', '(xx) xxxx-xxxx', '(xx) xxxxx-xxxx'])).toEqual([
      '(xx) xxxxx-xxxx',
      '(xx) xxxx-xxxx',
    ])
  })

  it('chooses the shortest compatible mask for the entered value', () => {
    expect(chooseMaskForValue('1132654321', ['(xx) xxxxx-xxxx', '(xx) xxxx-xxxx'])).toBe('(xx) xxxx-xxxx')
    expect(chooseMaskForValue('11987654321', ['(xx) xxxxx-xxxx', '(xx) xxxx-xxxx'])).toBe('(xx) xxxxx-xxxx')
  })

  it('validates phones against any configured mask', () => {
    const masks = ['(xx) xxxxx-xxxx', '(xx) xxxx-xxxx']

    expect(isValidPhoneByMasks('(11) 99876-1234', masks)).toBe(true)
    expect(isValidPhoneByMasks('(11) 3265-4321', masks)).toBe(true)
    expect(isValidPhoneByMasks('123', masks)).toBe(false)
  })

  it('allows free typing when no masks are configured', () => {
    expect(isValidPhoneByMasks('+55 11 99876-1234', [])).toBe(true)
    expect(formatPhoneByMasks('+55 11 99876-1234', [])).toBe('+55 11 99876-1234')
  })

  it('formats using the best available mask', () => {
    expect(formatPhoneByMasks('1132654321', ['(xx) xxxxx-xxxx', '(xx) xxxx-xxxx'])).toBe('(11) 3265-4321')
  })
})
