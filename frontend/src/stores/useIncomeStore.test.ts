import { describe, it, expect, beforeEach } from 'vitest'
import { computeTotalReliefs } from '@/lib/data/taxBrackets'
import { useProfileStore } from './useProfileStore'
import { useIncomeStore, DEFAULT_CAREER_PHASES } from './useIncomeStore'

beforeEach(() => {
  useProfileStore.getState().reset()
  useIncomeStore.getState().reset()
})

describe('useIncomeStore', () => {
  describe('initial state', () => {
    it('has correct defaults', () => {
      const state = useIncomeStore.getState()
      expect(state.salaryModel).toBe('simple')
      expect(state.annualSalary).toBe(72000)
      expect(state.salaryGrowthRate).toBe(0.03)
      expect(state.employerCpfEnabled).toBe(true)
      expect(state.incomeStreams).toEqual([])
      expect(state.lifeEvents).toEqual([])
      expect(state.realisticPhases).toEqual(DEFAULT_CAREER_PHASES)
      expect(state.promotionJumps).toEqual([])
      expect(state.momEducation).toBe('degree')
      expect(state.momAdjustment).toBe(1.0)
      expect(state.lifeEventsEnabled).toBe(false)
      expect(state.personalReliefs).toBe(20000)
      expect(state.reliefBreakdown).toBeNull()
      expect(state.reliefBasisAge).toBeNull()
    })

    it('has no validation errors with defaults', () => {
      expect(Object.keys(useIncomeStore.getState().validationErrors)).toHaveLength(0)
    })
  })

  describe('setField', () => {
    it('switches salary model', () => {
      useIncomeStore.getState().setField('salaryModel', 'realistic')
      expect(useIncomeStore.getState().salaryModel).toBe('realistic')
    })

    it('updates salary', () => {
      useIncomeStore.getState().setField('annualSalary', 120000)
      expect(useIncomeStore.getState().annualSalary).toBe(120000)
    })

    it('toggles lifeEventsEnabled', () => {
      useIncomeStore.getState().setField('lifeEventsEnabled', true)
      expect(useIncomeStore.getState().lifeEventsEnabled).toBe(true)
    })

    it('toggles employerCpfEnabled', () => {
      useIncomeStore.getState().setField('employerCpfEnabled', false)
      expect(useIncomeStore.getState().employerCpfEnabled).toBe(false)
    })
  })

  describe('income streams', () => {
    const testStream = {
      id: 's1',
      name: 'Rental',
      annualAmount: 24000,
      startAge: 40,
      endAge: 90,
      growthRate: 0.03,
      type: 'rental' as const,
      growthModel: 'inflation-linked' as const,
      taxTreatment: 'taxable' as const,
      isCpfApplicable: false,
      isActive: true,
    }

    it('adds income stream', () => {
      useIncomeStore.getState().addIncomeStream(testStream)
      expect(useIncomeStore.getState().incomeStreams).toHaveLength(1)
      expect(useIncomeStore.getState().incomeStreams[0].name).toBe('Rental')
    })

    it('removes income stream by ID', () => {
      useIncomeStore.getState().addIncomeStream(testStream)
      useIncomeStore.getState().addIncomeStream({ ...testStream, id: 's2', name: 'Div' })
      useIncomeStore.getState().removeIncomeStream('s1')
      expect(useIncomeStore.getState().incomeStreams).toHaveLength(1)
      expect(useIncomeStore.getState().incomeStreams[0].id).toBe('s2')
    })

    it('updates income stream fields', () => {
      useIncomeStore.getState().addIncomeStream(testStream)
      useIncomeStore.getState().updateIncomeStream('s1', { annualAmount: 36000 })
      expect(useIncomeStore.getState().incomeStreams[0].annualAmount).toBe(36000)
    })

    it('validates stream startAge >= endAge', () => {
      useIncomeStore.getState().addIncomeStream({
        ...testStream, startAge: 90, endAge: 40,
      })
      const errors = useIncomeStore.getState().validationErrors
      expect(errors['incomeStream_s1_startAge']).toBeTruthy()
    })

    it('validates negative stream amount', () => {
      useIncomeStore.getState().addIncomeStream({
        ...testStream, annualAmount: -1000,
      })
      const errors = useIncomeStore.getState().validationErrors
      expect(errors['incomeStream_s1_annualAmount']).toBeTruthy()
    })
  })

  describe('life events', () => {
    const testEvent = {
      id: 'e1',
      name: 'Career Break',
      startAge: 35,
      endAge: 37,
      incomeImpact: 0,
      affectedStreamIds: [] as string[],
      savingsPause: true,
      cpfPause: true,
    }

    it('adds life event', () => {
      useIncomeStore.getState().addLifeEvent(testEvent)
      expect(useIncomeStore.getState().lifeEvents).toHaveLength(1)
    })

    it('removes life event', () => {
      useIncomeStore.getState().addLifeEvent(testEvent)
      useIncomeStore.getState().removeLifeEvent('e1')
      expect(useIncomeStore.getState().lifeEvents).toHaveLength(0)
    })

    it('updates life event fields', () => {
      useIncomeStore.getState().addLifeEvent(testEvent)
      useIncomeStore.getState().updateLifeEvent('e1', { name: 'Sabbatical' })
      expect(useIncomeStore.getState().lifeEvents[0].name).toBe('Sabbatical')
    })

    it('validates life event when enabled', () => {
      useIncomeStore.getState().setField('lifeEventsEnabled', true)
      useIncomeStore.getState().addLifeEvent({
        ...testEvent, startAge: 50, endAge: 30,
      })
      const errors = useIncomeStore.getState().validationErrors
      expect(errors['lifeEvent_e1_startAge']).toBeTruthy()
    })

    it('skips life event validation when disabled', () => {
      useIncomeStore.getState().setField('lifeEventsEnabled', false)
      useIncomeStore.getState().addLifeEvent({
        ...testEvent, startAge: 50, endAge: 30,
      })
      const errors = useIncomeStore.getState().validationErrors
      expect(errors['lifeEvent_e1_startAge']).toBeUndefined()
    })
  })

  describe('realistic career phases', () => {
    it('sets realistic phases', () => {
      const phases = [
        { label: 'Junior', minAge: 22, maxAge: 30, growthRate: 0.10 },
      ]
      useIncomeStore.getState().setRealisticPhases(phases)
      expect(useIncomeStore.getState().realisticPhases).toEqual(phases)
    })

    it('validates career phase when salary model is realistic', () => {
      useIncomeStore.getState().setField('salaryModel', 'realistic')
      useIncomeStore.getState().setRealisticPhases([
        { label: 'Bad', minAge: 50, maxAge: 30, growthRate: 0.05 },
      ])
      const errors = useIncomeStore.getState().validationErrors
      expect(errors['phase_0_minAge']).toBeTruthy()
    })
  })

  describe('promotion jumps', () => {
    it('sets promotion jumps', () => {
      const jumps = [{ age: 35, increasePercent: 0.20 }]
      useIncomeStore.getState().setPromotionJumps(jumps)
      expect(useIncomeStore.getState().promotionJumps).toEqual(jumps)
    })
  })

  describe('setReliefBreakdown', () => {
    const detailedReliefs = {
      earnedIncomeRelief: 0,
      nsmanStatus: 'performedDuty' as const,
      nsmanKAH: true,
      spouseRelief: true,
      nChildren: 1,
      parentReliefType: 'liveWith' as const,
      nParents: 1,
      otherReliefs: 500,
    }

    it('captures the current age as the relief basis age when materializing detailed reliefs', () => {
      useProfileStore.getState().setField('currentAge', 57)
      useIncomeStore.getState().setReliefBreakdown(detailedReliefs)

      const state = useIncomeStore.getState()
      expect(state.reliefBreakdown).toEqual(detailedReliefs)
      expect(state.reliefBasisAge).toBe(57)
      expect(state.personalReliefs).toBe(computeTotalReliefs(detailedReliefs, 57))
    })

    it('clears the relief basis age when leaving detailed relief mode', () => {
      useProfileStore.getState().setField('currentAge', 57)
      useIncomeStore.getState().setReliefBreakdown(detailedReliefs)
      useIncomeStore.getState().setReliefBreakdown(null)

      const state = useIncomeStore.getState()
      expect(state.reliefBreakdown).toBeNull()
      expect(state.reliefBasisAge).toBeNull()
    })
  })

  describe('reset', () => {
    it('restores all defaults', () => {
      useIncomeStore.getState().setField('annualSalary', 200000)
      useIncomeStore.getState().setField('salaryModel', 'data-driven')
      useIncomeStore.getState().reset()
      const state = useIncomeStore.getState()
      expect(state.annualSalary).toBe(72000)
      expect(state.salaryModel).toBe('simple')
      expect(state.incomeStreams).toEqual([])
      expect(state.reliefBasisAge).toBeNull()
    })
  })
})
