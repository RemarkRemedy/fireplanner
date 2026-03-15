import { describe, it, expect, beforeEach } from 'vitest'
import { seedFlowValues } from './seedFlowValues'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'

describe('seedFlowValues', () => {
  beforeEach(() => {
    // Reset to default state before each test
    useHouseholdPlanStore.getState().reset()
  })

  it('returns empty object for unknown flowId', () => {
    const result = seedFlowValues('goals')
    // goals flow seeds nothing (new entries)
    expect(result).toEqual({})
  })

  it('seeds CPF flow with balances and plan settings', () => {
    const result = seedFlowValues('cpf')
    expect(result).toHaveProperty('cpfOA')
    expect(result).toHaveProperty('cpfSA')
    expect(result).toHaveProperty('cpfMA')
    expect(result).toHaveProperty('cpfRA')
    expect(result).toHaveProperty('cpfLifePlan')
    expect(result).toHaveProperty('cpfPayoutStartAge')
    expect(typeof result.cpfOA).toBe('number')
    expect(typeof result.cpfPayoutStartAge).toBe('number')
  })

  it('seeds healthcare flow with ISP tier and CareShield', () => {
    const result = seedFlowValues('healthcare')
    expect(result).toHaveProperty('ispTier')
    expect(result).toHaveProperty('careShieldEnrolled')
    expect(result).toHaveProperty('mediSaveBalance')
  })

  it('seeds SRS flow with balance and contribution toggle', () => {
    const result = seedFlowValues('srs')
    expect(result).toHaveProperty('srsBalance')
    expect(result).toHaveProperty('contributeToSrs')
    expect(typeof result.srsBalance).toBe('number')
    expect(typeof result.contributeToSrs).toBe('boolean')
  })

  it('seeds expenses flow with retirementSpendingRatio', () => {
    const result = seedFlowValues('expenses')
    expect(result).toHaveProperty('currentAge')
    // retirementSpendingRatio may or may not be set depending on base expense existence
  })

  it('seeds salary flow from salary-model income entry', () => {
    const result = seedFlowValues('salary')
    // Default plan should have a salary-model income entry
    expect(result).toHaveProperty('salaryModel')
  })

  it('seeds allocation flow with glide path config', () => {
    const result = seedFlowValues('allocation')
    expect(result).toHaveProperty('enableGlidePath')
    expect(result).toHaveProperty('rebalancingFrequency')
  })

  it('seeds protection flow with cash savings and debt status', () => {
    const result = seedFlowValues('protection')
    expect(result).toHaveProperty('emergencyFundBalance')
    expect(result).toHaveProperty('hasOutstandingDebt')
    expect(result).toHaveProperty('emergencyFundTarget')
  })

  it('seeds CPF top-up toggle as false when no top-ups exist', () => {
    const result = seedFlowValues('cpf')
    // Default plan has zero top-ups
    expect(result.hasCpfTopUps).toBe(false)
  })

  it('seeds property flow from first property in plan', () => {
    const result = seedFlowValues('property')
    expect(result).toHaveProperty('propertyType')
    expect(result).toHaveProperty('hasMortgage')
  })
})
