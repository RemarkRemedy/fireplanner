import { describe, it, expect } from 'vitest'
import { isReviewDue, SNOOZE_DURATION_MS } from './annualReview'

describe('isReviewDue', () => {
  const now = new Date('2026-03-17T12:00:00Z')

  it('returns true when lastReviewDate is null (never reviewed)', () => {
    expect(isReviewDue(null, null, now)).toBe(true)
  })

  it('returns false when review was completed less than 365 days ago', () => {
    // Reviewed 100 days ago
    const lastReview = new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000).toISOString()
    expect(isReviewDue(lastReview, null, now)).toBe(false)
  })

  it('returns true when review was completed exactly 365 days ago', () => {
    const lastReview = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString()
    expect(isReviewDue(lastReview, null, now)).toBe(true)
  })

  it('returns true when review was completed more than 365 days ago', () => {
    const lastReview = new Date(now.getTime() - 400 * 24 * 60 * 60 * 1000).toISOString()
    expect(isReviewDue(lastReview, null, now)).toBe(true)
  })

  it('returns false when snoozed and snooze has not expired', () => {
    // Never reviewed but snoozed until tomorrow
    const snoozeUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
    expect(isReviewDue(null, snoozeUntil, now)).toBe(false)
  })

  it('returns true when snoozed but snooze has expired', () => {
    // Never reviewed, snooze expired yesterday
    const snoozeUntil = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
    expect(isReviewDue(null, snoozeUntil, now)).toBe(true)
  })

  it('returns false when review is overdue but snooze is active', () => {
    // Reviewed 400 days ago, but snoozed until next week
    const lastReview = new Date(now.getTime() - 400 * 24 * 60 * 60 * 1000).toISOString()
    const snoozeUntil = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
    expect(isReviewDue(lastReview, snoozeUntil, now)).toBe(false)
  })

  it('returns true when review is overdue and snooze has expired', () => {
    const lastReview = new Date(now.getTime() - 400 * 24 * 60 * 60 * 1000).toISOString()
    const snoozeUntil = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString()
    expect(isReviewDue(lastReview, snoozeUntil, now)).toBe(true)
  })

  it('uses current date when now is not provided', () => {
    // Reviewed far in the past, no snooze
    expect(isReviewDue('2020-01-01T00:00:00Z', null)).toBe(true)
  })

  it('SNOOZE_DURATION_MS equals 30 days', () => {
    expect(SNOOZE_DURATION_MS).toBe(30 * 24 * 60 * 60 * 1000)
  })
})
