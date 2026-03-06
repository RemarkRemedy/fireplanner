import { describe, it, expect, beforeEach } from 'vitest'
import { useProfileStore } from './useProfileStore'

// Reset store to defaults before each test
beforeEach(() => {
  useProfileStore.getState().reset()
})

describe('useProfileStore', () => {
  describe('initial state', () => {
    it('has correct default values', () => {
      const state = useProfileStore.getState()
      expect(state.currentAge).toBe(30)
      expect(state.retirementAge).toBe(65)
      expect(state.lifeExpectancy).toBe(90)
      expect(state.lifeStage).toBe('pre-fire')
      expect(state.maritalStatus).toBe('single')
      expect(state.residencyStatus).toBe('citizen')
      expect(state.annualIncome).toBe(72000)
      expect(state.annualExpenses).toBe(48000)
      expect(state.liquidNetWorth).toBe(0)
      expect(state.swr).toBe(0.036)
      expect(state.fireType).toBe('regular')
      expect(state.inflation).toBe(0.025)
      expect(state.cpfOA).toBe(0)
      expect(state.cpfSA).toBe(0)
      expect(state.cpfMA).toBe(0)
    })

    it('has no validation errors with defaults', () => {
      const state = useProfileStore.getState()
      expect(Object.keys(state.validationErrors)).toHaveLength(0)
    })
  })

  describe('setField', () => {
    it('updates a single field', () => {
      useProfileStore.getState().setField('currentAge', 35)
      expect(useProfileStore.getState().currentAge).toBe(35)
    })

    it('does not affect other fields', () => {
      useProfileStore.getState().setField('currentAge', 35)
      expect(useProfileStore.getState().retirementAge).toBe(65)
      expect(useProfileStore.getState().annualIncome).toBe(72000)
    })

    it('triggers validation on field change', () => {
      useProfileStore.getState().setField('currentAge', 15)
      const errors = useProfileStore.getState().validationErrors
      expect(errors.currentAge).toBeTruthy()
    })

    it('clears validation error when field becomes valid', () => {
      useProfileStore.getState().setField('currentAge', 15)
      expect(useProfileStore.getState().validationErrors.currentAge).toBeTruthy()
      useProfileStore.getState().setField('currentAge', 30)
      expect(useProfileStore.getState().validationErrors.currentAge).toBeUndefined()
    })

    it('produces cross-field error when retirementAge <= currentAge', () => {
      useProfileStore.getState().setField('retirementAge', 30)
      const errors = useProfileStore.getState().validationErrors
      expect(errors.retirementAge).toBe('Retirement age must be later than current age')
    })

    it('produces cross-field error when lifeExpectancy <= retirementAge', () => {
      useProfileStore.getState().setField('lifeExpectancy', 65)
      const errors = useProfileStore.getState().validationErrors
      expect(errors.lifeExpectancy).toBe('Life expectancy must be later than retirement age')
    })

    it('syncs oopReferenceAge when currentAge changes and they match', () => {
      // Default: currentAge=30, oopReferenceAge=30 (they match)
      useProfileStore.getState().setField('currentAge', 40)
      expect(useProfileStore.getState().healthcareConfig.oopReferenceAge).toBe(40)
    })

    it('does not sync oopReferenceAge when they do not match', () => {
      // First, customize oopReferenceAge away from currentAge
      useProfileStore.getState().setField('healthcareConfig', {
        ...useProfileStore.getState().healthcareConfig,
        oopReferenceAge: 50,
      })
      useProfileStore.getState().setField('currentAge', 40)
      expect(useProfileStore.getState().healthcareConfig.oopReferenceAge).toBe(50)
    })
  })

  describe('parent support', () => {
    it('adds parent support entry', () => {
      useProfileStore.getState().addParentSupport({
        id: 'ps1',
        label: 'Mom',
        monthlyAmount: 500,
        startAge: 30,
        endAge: 65,
        growthRate: 0,
      })
      const state = useProfileStore.getState()
      expect(state.parentSupport).toHaveLength(1)
      expect(state.parentSupport[0].label).toBe('Mom')
    })

    it('removes parent support entry by ID', () => {
      useProfileStore.getState().addParentSupport({
        id: 'ps1', label: 'Mom', monthlyAmount: 500, startAge: 30, endAge: 65, growthRate: 0,
      })
      useProfileStore.getState().addParentSupport({
        id: 'ps2', label: 'Dad', monthlyAmount: 300, startAge: 30, endAge: 65, growthRate: 0,
      })
      useProfileStore.getState().removeParentSupport('ps1')
      const state = useProfileStore.getState()
      expect(state.parentSupport).toHaveLength(1)
      expect(state.parentSupport[0].id).toBe('ps2')
    })

    it('updates parent support entry fields', () => {
      useProfileStore.getState().addParentSupport({
        id: 'ps1', label: 'Mom', monthlyAmount: 500, startAge: 30, endAge: 65, growthRate: 0,
      })
      useProfileStore.getState().updateParentSupport('ps1', { monthlyAmount: 800 })
      expect(useProfileStore.getState().parentSupport[0].monthlyAmount).toBe(800)
    })

    it('validates parent support start < end age', () => {
      useProfileStore.getState().setField('parentSupportEnabled', true)
      useProfileStore.getState().addParentSupport({
        id: 'ps1', label: 'Mom', monthlyAmount: 500, startAge: 65, endAge: 30, growthRate: 0,
      })
      const errors = useProfileStore.getState().validationErrors
      expect(errors['parentSupport_ps1_startAge']).toBeTruthy()
    })
  })

  describe('healthcare config', () => {
    it('updates nested healthcare fields', () => {
      useProfileStore.getState().setField('healthcareConfig', {
        ...useProfileStore.getState().healthcareConfig,
        ispTier: 'enhanced',
        enabled: true,
      })
      const state = useProfileStore.getState()
      expect(state.healthcareConfig.ispTier).toBe('enhanced')
      expect(state.healthcareConfig.enabled).toBe(true)
    })
  })

  describe('reset', () => {
    it('restores all defaults', () => {
      useProfileStore.getState().setField('currentAge', 50)
      useProfileStore.getState().setField('annualIncome', 200000)
      useProfileStore.getState().setField('swr', 0.035)
      useProfileStore.getState().reset()
      const state = useProfileStore.getState()
      expect(state.currentAge).toBe(30)
      expect(state.annualIncome).toBe(72000)
      expect(state.swr).toBe(0.036)
      expect(Object.keys(state.validationErrors)).toHaveLength(0)
    })
  })

  describe('persist migration', () => {
    it('v1→v2: adds CPF fields with defaults', () => {
      // Simulate what the persist middleware migrate function does
      const { migrate } = useProfileStore.persist.getOptions()
      const oldState: Record<string, unknown> = { currentAge: 35 }
      const migrated = migrate!(oldState, 1) as Record<string, unknown>
      expect(migrated.cpfLifeStartAge).toBe(65)
      expect(migrated.cpfLifePlan).toBe('standard')
      expect(migrated.cpfRetirementSum).toBe('frs')
      expect(migrated.cpfHousingMode).toBe('none')
      expect(migrated.cpfHousingMonthly).toBe(0)
      expect(migrated.cpfMortgageYearsLeft).toBe(25)
    })

    it('v1→v2: migrates cpfHousingEndAge to cpfMortgageYearsLeft', () => {
      const { migrate } = useProfileStore.persist.getOptions()
      const oldState: Record<string, unknown> = { currentAge: 35, cpfHousingEndAge: 55 }
      const migrated = migrate!(oldState, 1) as Record<string, unknown>
      expect(migrated.cpfMortgageYearsLeft).toBe(20) // 55 - 35
      expect(migrated.cpfHousingEndAge).toBeUndefined()
    })

    it('v2→v3: adds retirementSpendingAdjustment', () => {
      const { migrate } = useProfileStore.persist.getOptions()
      const oldState: Record<string, unknown> = { currentAge: 30 }
      const migrated = migrate!(oldState, 2) as Record<string, unknown>
      expect(migrated.retirementSpendingAdjustment).toBe(1.0)
    })

    it('v3→v4: adds retirementPhase and cpfLifeActualMonthlyPayout', () => {
      const { migrate } = useProfileStore.persist.getOptions()
      const oldState: Record<string, unknown> = {}
      const migrated = migrate!(oldState, 3) as Record<string, unknown>
      expect(migrated.retirementPhase).toBeNull()
      expect(migrated.cpfLifeActualMonthlyPayout).toBe(0)
    })

    it('v4→v5: adds parentSupport fields', () => {
      const { migrate } = useProfileStore.persist.getOptions()
      const oldState: Record<string, unknown> = {}
      const migrated = migrate!(oldState, 4) as Record<string, unknown>
      expect(migrated.parentSupportEnabled).toBe(false)
      expect(migrated.parentSupport).toEqual([])
    })

    it('v5→v6: adds healthcareConfig', () => {
      const { migrate } = useProfileStore.persist.getOptions()
      const oldState: Record<string, unknown> = {}
      const migrated = migrate!(oldState, 5) as Record<string, unknown>
      expect(migrated.healthcareConfig).toBeDefined()
      expect((migrated.healthcareConfig as Record<string, unknown>).enabled).toBe(false)
    })

    it('v6→v7: adds oopInflationRate and oopReferenceAge to healthcareConfig', () => {
      const { migrate } = useProfileStore.persist.getOptions()
      const oldState: Record<string, unknown> = {
        currentAge: 40,
        healthcareConfig: { enabled: true, ispTier: 'b' },
      }
      const migrated = migrate!(oldState, 6) as Record<string, unknown>
      const hc = migrated.healthcareConfig as Record<string, unknown>
      expect(hc.oopInflationRate).toBe(0.03)
      expect(hc.oopReferenceAge).toBe(40)
    })

    it('v8→v9: adds cpfRA with default 0', () => {
      const { migrate } = useProfileStore.persist.getOptions()
      const oldState: Record<string, unknown> = { currentAge: 55 }
      const migrated = migrate!(oldState, 8) as Record<string, unknown>
      expect(migrated.cpfRA).toBe(0)
    })

    it('v8→v9: preserves existing cpfRA if already present', () => {
      const { migrate } = useProfileStore.persist.getOptions()
      const oldState: Record<string, unknown> = { currentAge: 55, cpfRA: 250000 }
      const migrated = migrate!(oldState, 8) as Record<string, unknown>
      expect(migrated.cpfRA).toBe(250000)
    })

    it('full migration v0→v9 applies all steps', () => {
      const { migrate } = useProfileStore.persist.getOptions()
      const oldState: Record<string, unknown> = { currentAge: 25 }
      const migrated = migrate!(oldState, 0) as Record<string, unknown>
      // v1→v2 fields
      expect(migrated.cpfLifeStartAge).toBe(65)
      // v2→v3 fields
      expect(migrated.retirementSpendingAdjustment).toBe(1.0)
      // v3→v4 fields
      expect(migrated.retirementPhase).toBeNull()
      // v4→v5 fields
      expect(migrated.parentSupportEnabled).toBe(false)
      // v5→v6 fields
      expect(migrated.healthcareConfig).toBeDefined()
      // v6→v7 fields
      const hc = migrated.healthcareConfig as Record<string, unknown>
      expect(hc.oopInflationRate).toBe(0.03)
      // v8→v9 fields
      expect(migrated.cpfRA).toBe(0)
    })

    it('v9→v10: backfills durationYears on retirementWithdrawals', () => {
      const { migrate } = useProfileStore.persist.getOptions()
      const oldState: Record<string, unknown> = {
        retirementWithdrawals: [
          { id: 'rw1', label: 'Car', amount: 50000, age: 60, inflationAdjusted: true },
          { id: 'rw2', label: 'Reno', amount: 80000, age: 65, inflationAdjusted: false },
        ],
      }
      const migrated = migrate!(oldState, 9) as Record<string, unknown>
      const rws = migrated.retirementWithdrawals as Array<Record<string, unknown>>
      expect(rws).toHaveLength(2)
      expect(rws[0].durationYears).toBe(1)
      expect(rws[1].durationYears).toBe(1)
    })

    it('v9→v10: preserves existing durationYears if already present', () => {
      const { migrate } = useProfileStore.persist.getOptions()
      const oldState: Record<string, unknown> = {
        retirementWithdrawals: [
          { id: 'rw1', label: 'Eldercare', amount: 2000, age: 75, durationYears: 10, inflationAdjusted: true },
        ],
      }
      const migrated = migrate!(oldState, 9) as Record<string, unknown>
      const rws = migrated.retirementWithdrawals as Array<Record<string, unknown>>
      expect(rws[0].durationYears).toBe(10)
    })

    it('v9→v10: handles empty retirementWithdrawals', () => {
      const { migrate } = useProfileStore.persist.getOptions()
      const oldState: Record<string, unknown> = { retirementWithdrawals: [] }
      const migrated = migrate!(oldState, 9) as Record<string, unknown>
      expect(migrated.retirementWithdrawals).toEqual([])
    })

    it('v9→v10: handles missing retirementWithdrawals (undefined)', () => {
      const { migrate } = useProfileStore.persist.getOptions()
      const oldState: Record<string, unknown> = {}
      const migrated = migrate!(oldState, 9) as Record<string, unknown>
      const rws = migrated.retirementWithdrawals as Array<Record<string, unknown>>
      expect(rws).toEqual([])
    })

    it('full migration v0→v10 applies all steps including durationYears', () => {
      const { migrate } = useProfileStore.persist.getOptions()
      const oldState: Record<string, unknown> = {
        currentAge: 25,
        retirementWithdrawals: [
          { id: 'rw1', label: 'Car', amount: 50000, age: 60, inflationAdjusted: true },
        ],
      }
      const migrated = migrate!(oldState, 0) as Record<string, unknown>
      // Earlier migrations
      expect(migrated.cpfLifeStartAge).toBe(65)
      expect(migrated.cpfRA).toBe(0)
      // v9→v10: durationYears backfilled
      const rws = migrated.retirementWithdrawals as Array<Record<string, unknown>>
      expect(rws[0].durationYears).toBe(1)
    })

    it('v16→v17: adds CPFIS and OA withdrawal fields', () => {
      const { migrate } = useProfileStore.persist.getOptions()
      const oldState: Record<string, unknown> = { currentAge: 30 }
      const migrated = migrate!(oldState, 16) as Record<string, unknown>
      expect(migrated.cpfOaWithdrawals).toEqual([])
      expect(migrated.cpfisEnabled).toBe(false)
      expect(migrated.cpfisOaReturn).toBe(0.04)
      expect(migrated.cpfisSaReturn).toBe(0.05)
    })

    it('v16→v17: preserves existing CPFIS fields if present', () => {
      const { migrate } = useProfileStore.persist.getOptions()
      const oldState: Record<string, unknown> = {
        cpfisEnabled: true,
        cpfisOaReturn: 0.06,
        cpfisSaReturn: 0.08,
        cpfOaWithdrawals: [{ id: 'ow1', label: 'Test', amount: 50000, age: 55 }],
      }
      const migrated = migrate!(oldState, 16) as Record<string, unknown>
      expect(migrated.cpfisEnabled).toBe(true)
      expect(migrated.cpfisOaReturn).toBe(0.06)
      expect(migrated.cpfisSaReturn).toBe(0.08)
      expect(migrated.cpfOaWithdrawals).toHaveLength(1)
    })

    it('full migration v0→v17 applies all steps including CPFIS', () => {
      const { migrate } = useProfileStore.persist.getOptions()
      const oldState: Record<string, unknown> = { currentAge: 25 }
      const migrated = migrate!(oldState, 0) as Record<string, unknown>
      // Earlier migrations
      expect(migrated.cpfLifeStartAge).toBe(65)
      expect(migrated.cpfRA).toBe(0)
      // v16→v17: CPFIS fields
      expect(migrated.cpfOaWithdrawals).toEqual([])
      expect(migrated.cpfisEnabled).toBe(false)
      expect(migrated.cpfisOaReturn).toBe(0.04)
      expect(migrated.cpfisSaReturn).toBe(0.05)
    })
  })

  describe('CPF OA withdrawal CRUD', () => {
    it('adds a CPF OA withdrawal entry', () => {
      useProfileStore.getState().addCpfOaWithdrawal({
        id: 'ow1',
        label: 'OA at 55',
        amount: 50000,
        age: 55,
      })
      const state = useProfileStore.getState()
      expect(state.cpfOaWithdrawals).toHaveLength(1)
      expect(state.cpfOaWithdrawals[0].label).toBe('OA at 55')
      expect(state.cpfOaWithdrawals[0].amount).toBe(50000)
      expect(state.cpfOaWithdrawals[0].age).toBe(55)
    })

    it('removes a CPF OA withdrawal entry by ID', () => {
      useProfileStore.getState().addCpfOaWithdrawal({
        id: 'ow1', label: 'OA at 55', amount: 50000, age: 55,
      })
      useProfileStore.getState().addCpfOaWithdrawal({
        id: 'ow2', label: 'OA at 60', amount: 30000, age: 60,
      })
      useProfileStore.getState().removeCpfOaWithdrawal('ow1')
      const state = useProfileStore.getState()
      expect(state.cpfOaWithdrawals).toHaveLength(1)
      expect(state.cpfOaWithdrawals[0].id).toBe('ow2')
    })

    it('updates a CPF OA withdrawal entry', () => {
      useProfileStore.getState().addCpfOaWithdrawal({
        id: 'ow1', label: 'OA at 55', amount: 50000, age: 55,
      })
      useProfileStore.getState().updateCpfOaWithdrawal('ow1', { amount: 80000 })
      expect(useProfileStore.getState().cpfOaWithdrawals[0].amount).toBe(80000)
    })

    it('updates age of a CPF OA withdrawal entry', () => {
      useProfileStore.getState().addCpfOaWithdrawal({
        id: 'ow1', label: 'OA withdrawal', amount: 50000, age: 55,
      })
      useProfileStore.getState().updateCpfOaWithdrawal('ow1', { age: 60 })
      expect(useProfileStore.getState().cpfOaWithdrawals[0].age).toBe(60)
    })

    it('does not affect other entries when updating', () => {
      useProfileStore.getState().addCpfOaWithdrawal({
        id: 'ow1', label: 'First', amount: 50000, age: 55,
      })
      useProfileStore.getState().addCpfOaWithdrawal({
        id: 'ow2', label: 'Second', amount: 30000, age: 60,
      })
      useProfileStore.getState().updateCpfOaWithdrawal('ow1', { amount: 80000 })
      expect(useProfileStore.getState().cpfOaWithdrawals[1].amount).toBe(30000)
    })
  })

  describe('CPFIS default values', () => {
    it('has correct CPFIS defaults', () => {
      const state = useProfileStore.getState()
      expect(state.cpfisEnabled).toBe(false)
      expect(state.cpfisOaReturn).toBe(0.04)
      expect(state.cpfisSaReturn).toBe(0.05)
      expect(state.cpfOaWithdrawals).toEqual([])
    })

    it('updates cpfisEnabled via setField', () => {
      useProfileStore.getState().setField('cpfisEnabled', true)
      expect(useProfileStore.getState().cpfisEnabled).toBe(true)
    })

    it('updates cpfisOaReturn via setField', () => {
      useProfileStore.getState().setField('cpfisOaReturn', 0.06)
      expect(useProfileStore.getState().cpfisOaReturn).toBe(0.06)
    })

    it('updates cpfisSaReturn via setField', () => {
      useProfileStore.getState().setField('cpfisSaReturn', 0.08)
      expect(useProfileStore.getState().cpfisSaReturn).toBe(0.08)
    })
  })
})
