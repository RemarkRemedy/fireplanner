import { describe, expect, it } from 'vitest'
import { ownerLabel, entryOwnerLabel } from '@/lib/household/editorUtils'
import type { PlanningAdult } from '@/lib/household/types'

const TAYLOR: Pick<PlanningAdult, 'owner' | 'displayName'> = {
  owner: 'self',
  displayName: 'Taylor',
}

const JORDAN: Pick<PlanningAdult, 'owner' | 'displayName'> = {
  owner: 'partner',
  displayName: 'Jordan',
}

const adults = [TAYLOR, JORDAN] as PlanningAdult[]

describe('ownerLabel', () => {
  it('returns adult displayName when adults array is provided', () => {
    expect(ownerLabel('self', adults)).toBe('Taylor (You)')
    expect(ownerLabel('partner', adults)).toBe('Jordan')
  })

  it('falls back to "You" / "Partner" when no matching adult found', () => {
    expect(ownerLabel('self', [])).toBe('You')
    expect(ownerLabel('partner', [])).toBe('Partner')
  })

  it('falls back to role labels when adults is omitted', () => {
    expect(ownerLabel('self')).toBe('You')
    expect(ownerLabel('partner')).toBe('Partner')
  })
})

describe('entryOwnerLabel', () => {
  it('returns "Shared" for shared owner', () => {
    expect(entryOwnerLabel('shared', adults)).toBe('Shared')
    expect(entryOwnerLabel('shared')).toBe('Shared')
  })

  it('delegates to ownerLabel for self/partner', () => {
    expect(entryOwnerLabel('self', adults)).toBe('Taylor (You)')
    expect(entryOwnerLabel('partner', adults)).toBe('Jordan')
  })
})
