import { describe, expect, it } from 'vitest'
import { isIcuMessage, validateIcu } from './icu.js'

describe('isIcuMessage', () => {
  it('detects a plural control structure', () => {
    expect(isIcuMessage('{count, plural, one {# item} other {# items}}')).toBe(true)
  })

  it('does not flag a plain interpolation as ICU', () => {
    expect(isIcuMessage('Hello {name}')).toBe(false)
  })
})

describe('validateIcu', () => {
  it('accepts a well-formed ICU plural message', () => {
    expect(validateIcu('{count, plural, one {# item} other {# items}}')).toBe(true)
  })

  it('rejects a malformed ICU message', () => {
    expect(validateIcu('{count, plural, one {# item} other')).toBe(false)
  })
})
