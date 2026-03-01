import { describe, it, expect, beforeEach } from 'vitest'
import { useSimulationStore } from './useSimulationStore'

beforeEach(() => {
  useSimulationStore.getState().reset()
})

describe('useSimulationStore', () => {
  describe('initial state', () => {
    it('has correct defaults', () => {
      const state = useSimulationStore.getState()
      expect(state.mcMethod).toBe('parametric')
      expect(state.selectedStrategy).toBe('constant_dollar')
      expect(state.nSimulations).toBe(10000)
      expect(state.withdrawalBasis).toBe('expenses')
      expect(state.deterministicAccumulation).toBe(false)
    })

    it('has no validation errors', () => {
      expect(Object.keys(useSimulationStore.getState().validationErrors)).toHaveLength(0)
    })
  })

  describe('setField', () => {
    it('changes MC method', () => {
      useSimulationStore.getState().setField('mcMethod', 'bootstrap')
      expect(useSimulationStore.getState().mcMethod).toBe('bootstrap')
    })

    it('changes nSimulations', () => {
      useSimulationStore.getState().setField('nSimulations', 5000)
      expect(useSimulationStore.getState().nSimulations).toBe(5000)
    })

    it('validates nSimulations out of range (too low)', () => {
      useSimulationStore.getState().setField('nSimulations', 50)
      expect(useSimulationStore.getState().validationErrors.nSimulations).toBeTruthy()
    })

    it('validates nSimulations out of range (too high)', () => {
      useSimulationStore.getState().setField('nSimulations', 200000)
      expect(useSimulationStore.getState().validationErrors.nSimulations).toBeTruthy()
    })

  })

  describe('setStrategyParam', () => {
    it('updates nested strategy param', () => {
      useSimulationStore.getState().setStrategyParam('constant_dollar', 'swr', 0.035)
      expect(useSimulationStore.getState().strategyParams.constant_dollar.swr).toBe(0.035)
    })

    it('does not affect other strategies', () => {
      useSimulationStore.getState().setStrategyParam('constant_dollar', 'swr', 0.035)
      expect(useSimulationStore.getState().strategyParams.guardrails.initialRate).toBe(0.05)
    })
  })

  describe('reset', () => {
    it('restores all defaults', () => {
      useSimulationStore.getState().setField('mcMethod', 'fat_tail')
      useSimulationStore.getState().setField('nSimulations', 1000)
      useSimulationStore.getState().setField('withdrawalBasis', 'rate')
      useSimulationStore.getState().reset()
      const state = useSimulationStore.getState()
      expect(state.mcMethod).toBe('parametric')
      expect(state.nSimulations).toBe(10000)
      expect(state.withdrawalBasis).toBe('expenses')
    })
  })

  describe('new strategy defaults', () => {
    it('has default params for all 12 strategies', () => {
      const state = useSimulationStore.getState()
      // Original 6
      expect(state.strategyParams.constant_dollar.swr).toBe(0.04)
      expect(state.strategyParams.vpw.expectedRealReturn).toBe(0.03)
      // New 6
      expect(state.strategyParams.percent_of_portfolio.rate).toBe(0.04)
      expect(state.strategyParams.one_over_n).toEqual({})
      expect(state.strategyParams.sensible_withdrawals.baseRate).toBe(0.03)
      expect(state.strategyParams.ninety_five_percent.swr).toBe(0.04)
      expect(state.strategyParams.endowment.smoothingWeight).toBe(0.70)
      expect(state.strategyParams.hebeler_autopilot.expectedRealReturn).toBe(0.03)
    })
  })

  describe('persist migration', () => {
    it('v3→v4: adds 6 new strategy param keys', () => {
      const { migrate } = useSimulationStore.persist.getOptions()
      const oldState: Record<string, unknown> = {
        strategyParams: {
          constant_dollar: { swr: 0.04 },
          vpw: { expectedRealReturn: 0.03, targetEndValue: 0 },
          guardrails: { initialRate: 0.05, ceilingTrigger: 1.2, floorTrigger: 0.8, adjustmentSize: 0.1 },
          vanguard_dynamic: { swr: 0.04, ceiling: 0.05, floor: 0.025 },
          cape_based: { baseRate: 0.04, capeWeight: 0.5, currentCape: 30 },
          floor_ceiling: { floor: 60000, ceiling: 150000, targetRate: 0.045 },
        },
        analysisMode: 'myPlan',
        lastMCSuccessRate: null,
        lastBacktestSuccessRate: null,
      }
      const migrated = migrate!(oldState, 3) as unknown as Record<string, unknown>
      const params = migrated.strategyParams as Record<string, Record<string, number>>
      expect(params.percent_of_portfolio).toEqual({ rate: 0.04 })
      expect(params.one_over_n).toEqual({})
      expect(params.sensible_withdrawals).toEqual({ baseRate: 0.03, extrasRate: 0.10 })
      expect(params.ninety_five_percent).toEqual({ swr: 0.04 })
      expect(params.endowment).toEqual({ swr: 0.04, smoothingWeight: 0.70 })
      expect(params.hebeler_autopilot).toEqual({ expectedRealReturn: 0.03 })
      // Existing params preserved
      expect(params.constant_dollar).toEqual({ swr: 0.04 })
    })

    it('full migration v0→v4 applies all steps', () => {
      const { migrate } = useSimulationStore.persist.getOptions()
      const oldState: Record<string, unknown> = {
        analysisMode: 'fireNumber', // v1 value that should migrate
        strategyParams: {
          constant_dollar: { swr: 0.04 },
        },
      }
      const migrated = migrate!(oldState, 0) as unknown as Record<string, unknown>
      // v1→v2: analysisMode migrated
      expect(migrated.analysisMode).toBe('fireTarget')
      // v2→v3: success rates added
      expect(migrated.lastMCSuccessRate).toBeNull()
      expect(migrated.lastBacktestSuccessRate).toBeNull()
      // v3→v4: new strategy params added
      const params = migrated.strategyParams as Record<string, Record<string, number>>
      expect(params.percent_of_portfolio).toEqual({ rate: 0.04 })
      expect(params.endowment).toEqual({ swr: 0.04, smoothingWeight: 0.70 })
    })

    it('v4→v5: adds withdrawalBasis field defaulting to expenses', () => {
      const { migrate } = useSimulationStore.persist.getOptions()
      const oldState: Record<string, unknown> = {
        mcMethod: 'parametric',
        selectedStrategy: 'constant_dollar',
        strategyParams: { constant_dollar: { swr: 0.04 } },
        nSimulations: 10000,
        analysisMode: 'myPlan',
        lastMCSuccessRate: null,
        lastBacktestSuccessRate: null,
      }
      const migrated = migrate!(oldState, 4) as unknown as Record<string, unknown>
      expect(migrated.withdrawalBasis).toBe('expenses')
    })

    it('v4→v5: preserves existing withdrawalBasis if already set', () => {
      const { migrate } = useSimulationStore.persist.getOptions()
      const oldState: Record<string, unknown> = {
        mcMethod: 'parametric',
        selectedStrategy: 'constant_dollar',
        strategyParams: { constant_dollar: { swr: 0.04 } },
        nSimulations: 10000,
        analysisMode: 'myPlan',
        lastMCSuccessRate: null,
        lastBacktestSuccessRate: null,
        withdrawalBasis: 'rate',
      }
      const migrated = migrate!(oldState, 4) as unknown as Record<string, unknown>
      expect(migrated.withdrawalBasis).toBe('rate')
    })

    it('v5→v6: adds deterministicAccumulation defaulting to false', () => {
      const { migrate } = useSimulationStore.persist.getOptions()
      const oldState: Record<string, unknown> = {
        mcMethod: 'parametric',
        selectedStrategy: 'constant_dollar',
        strategyParams: { constant_dollar: { swr: 0.04 } },
        nSimulations: 10000,
        analysisMode: 'myPlan',
        withdrawalBasis: 'expenses',
        lastMCSuccessRate: null,
        lastBacktestSuccessRate: null,
      }
      const migrated = migrate!(oldState, 5) as unknown as Record<string, unknown>
      expect(migrated.deterministicAccumulation).toBe(false)
    })
  })
})
