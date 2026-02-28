import { describe, it, expect } from 'vitest'
import { validateEmailSignup, type EmailSignupInput } from './emailValidation'
import { VALID_SOURCES, VALID_FEATURES } from './emailConstants'

describe('validateEmailSignup', () => {
  const valid: EmailSignupInput = {
    email: 'test@example.com',
    source: 'post_simulation',
  }

  it('accepts a valid email with source', () => {
    const result = validateEmailSignup(valid)
    expect(result.success).toBe(true)
  })

  it('accepts valid email with feature_interest', () => {
    const result = validateEmailSignup({
      ...valid,
      feature_interest: 'cpf_optimization',
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing email', () => {
    const result = validateEmailSignup({ ...valid, email: '' })
    expect(result.success).toBe(false)
    if (result.success) throw new Error('Expected failure but got success')
    expect(result.error).toContain('email')
  })

  it('rejects invalid email format', () => {
    const result = validateEmailSignup({ ...valid, email: 'notanemail' })
    expect(result.success).toBe(false)
    if (result.success) throw new Error('Expected failure but got success')
    expect(result.error).toContain('email')
  })

  it('rejects email without domain', () => {
    const result = validateEmailSignup({ ...valid, email: 'user@' })
    expect(result.success).toBe(false)
  })

  it('accepts email exactly 254 characters', () => {
    const exact = 'a'.repeat(249) + '@b.co'
    expect(exact.length).toBe(254)
    const result = validateEmailSignup({ ...valid, email: exact })
    expect(result.success).toBe(true)
  })

  it('rejects email longer than 254 characters', () => {
    const long = 'a'.repeat(250) + '@b.co'
    const result = validateEmailSignup({ ...valid, email: long })
    expect(result.success).toBe(false)
  })

  it('lowercases and trims email', () => {
    const result = validateEmailSignup({ ...valid, email: '  Test@Example.COM  ' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.email).toBe('test@example.com')
    }
  })

  it('rejects invalid source', () => {
    const result = validateEmailSignup({ ...valid, source: 'invalid_source' })
    expect(result.success).toBe(false)
    if (result.success) throw new Error('Expected failure but got success')
    expect(result.error).toContain('source')
  })

  it('accepts all valid sources', () => {
    for (const source of VALID_SOURCES) {
      const result = validateEmailSignup({ ...valid, source })
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid feature_interest', () => {
    const result = validateEmailSignup({
      ...valid,
      feature_interest: 'invalid_feature',
    })
    expect(result.success).toBe(false)
    if (result.success) throw new Error('Expected failure but got success')
    expect(result.error).toContain('feature_interest')
  })

  it('rejects empty string feature_interest', () => {
    const result = validateEmailSignup({
      ...valid,
      feature_interest: '',
    })
    expect(result.success).toBe(false)
    if (result.success) throw new Error('Expected failure but got success')
    expect(result.error).toContain('feature_interest')
  })

  it('accepts all valid feature_interest values', () => {
    for (const fi of VALID_FEATURES) {
      const result = validateEmailSignup({ ...valid, feature_interest: fi })
      expect(result.success).toBe(true)
    }
  })

  it('accepts missing feature_interest (optional)', () => {
    const result = validateEmailSignup({ email: 'a@b.com', source: 'landing_page' })
    expect(result.success).toBe(true)
  })
})
