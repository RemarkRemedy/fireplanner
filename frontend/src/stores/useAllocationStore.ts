import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AllocationState, AllocationTemplate, BucketConfig, GlidePathConfig, ValidationErrors } from '@/lib/types'
import { validateAllocationField } from '@/lib/validation/schemas'
import { ALLOCATION_TEMPLATES } from '@/lib/data/historicalReturns'
import { createDefaultBucketConfig } from '@/lib/calculations/bucketAllocation'

interface AllocationActions {
  setCurrentWeights: (weights: number[]) => void
  setTargetWeights: (weights: number[]) => void
  applyTemplate: (template: Exclude<AllocationTemplate, 'custom'>, target?: 'current' | 'target') => void
  setReturnOverride: (index: number, value: number | null) => void
  setStdDevOverride: (index: number, value: number | null) => void
  setGlidePathConfig: (config: GlidePathConfig) => void
  setBucketConfig: (config: BucketConfig) => void
  setField: <K extends keyof Omit<AllocationState, 'validationErrors'>>(
    field: K,
    value: AllocationState[K]
  ) => void
  reset: () => void
}

interface AllocationRevisionState {
  allocationRevision: number
}

type AllocationStoreState = AllocationState & AllocationRevisionState & AllocationActions

const ALLOCATION_DATA_KEYS = [
  'currentWeights', 'targetWeights', 'selectedTemplate', 'selectedTargetTemplate',
  'returnOverrides', 'stdDevOverrides', 'glidePathConfig', 'bucketConfig',
] as const

const DEFAULT_ALLOCATION: Omit<AllocationState, 'validationErrors'> = {
  currentWeights: [...ALLOCATION_TEMPLATES.balanced],
  targetWeights: [...ALLOCATION_TEMPLATES.conservative],
  selectedTemplate: 'balanced',
  selectedTargetTemplate: 'conservative',
  returnOverrides: [null, null, null, null, null, null, null, null],
  stdDevOverrides: [null, null, null, null, null, null, null, null],
  glidePathConfig: {
    enabled: false,
    method: 'linear',
    startAge: 60,
    endAge: 75,
  },
  bucketConfig: createDefaultBucketConfig(),
}

function extractAllocationData(
  state: AllocationStoreState
): Omit<AllocationState, 'validationErrors'> {
  const data: Record<string, unknown> = {}
  for (const key of ALLOCATION_DATA_KEYS) {
    data[key] = state[key]
  }
  return data as Omit<AllocationState, 'validationErrors'>
}

function bumpAllocationRevision(revision: number): number {
  return revision + 1
}

function computeValidationErrors(
  state: Omit<AllocationState, 'validationErrors'>
): ValidationErrors {
  const errors: ValidationErrors = {}

  const cwErr = validateAllocationField('currentWeights', state.currentWeights)
  if (cwErr) errors.currentWeights = cwErr

  const twErr = validateAllocationField('targetWeights', state.targetWeights)
  if (twErr) errors.targetWeights = twErr

  // Individual weight bounds
  for (let i = 0; i < state.currentWeights.length; i++) {
    const w = state.currentWeights[i]
    if (w < 0) errors[`currentWeight_${i}`] = 'Weight cannot be negative'
    if (w > 1) errors[`currentWeight_${i}`] = 'Weight cannot exceed 100%'
  }

  for (let i = 0; i < state.targetWeights.length; i++) {
    const w = state.targetWeights[i]
    if (w < 0) errors[`targetWeight_${i}`] = 'Weight cannot be negative'
    if (w > 1) errors[`targetWeight_${i}`] = 'Weight cannot exceed 100%'
  }

  // Glide path validation
  if (state.glidePathConfig.enabled) {
    if (state.glidePathConfig.startAge >= state.glidePathConfig.endAge) {
      errors['glidePathConfig.startAge'] = 'Start age must be less than end age'
    }
  }

  return errors
}

export const useAllocationStore = create<AllocationStoreState>()(
  persist(
    (set) => ({
      ...DEFAULT_ALLOCATION,
      allocationRevision: 0,
      validationErrors: computeValidationErrors(DEFAULT_ALLOCATION),

      setCurrentWeights: (weights) =>
        set((state) => {
          const stateData = extractAllocationData(state)
          const updated = { ...stateData, currentWeights: weights, selectedTemplate: 'custom' as AllocationTemplate }
          return {
            currentWeights: weights,
            selectedTemplate: 'custom',
            allocationRevision: bumpAllocationRevision(state.allocationRevision),
            validationErrors: computeValidationErrors(updated),
          }
        }),

      setTargetWeights: (weights) =>
        set((state) => {
          const stateData = extractAllocationData(state)
          const updated = { ...stateData, targetWeights: weights, selectedTargetTemplate: 'custom' as AllocationTemplate }
          return {
            targetWeights: weights,
            selectedTargetTemplate: 'custom',
            allocationRevision: bumpAllocationRevision(state.allocationRevision),
            validationErrors: computeValidationErrors(updated),
          }
        }),

      applyTemplate: (template, target = 'current') =>
        set((state) => {
          const templateWeights = [...ALLOCATION_TEMPLATES[template]]
          const stateData = extractAllocationData(state)
          if (target === 'current') {
            const updated = { ...stateData, currentWeights: templateWeights, selectedTemplate: template }
            return {
              currentWeights: templateWeights,
              selectedTemplate: template,
              allocationRevision: bumpAllocationRevision(state.allocationRevision),
              validationErrors: computeValidationErrors(updated),
            }
          } else {
            const updated = { ...stateData, targetWeights: templateWeights, selectedTargetTemplate: template }
            return {
              targetWeights: templateWeights,
              selectedTargetTemplate: template,
              allocationRevision: bumpAllocationRevision(state.allocationRevision),
              validationErrors: computeValidationErrors(updated),
            }
          }
        }),

      setReturnOverride: (index, value) =>
        set((state) => {
          const overrides = [...state.returnOverrides]
          overrides[index] = value
          const stateData = extractAllocationData(state)
          const updated = { ...stateData, returnOverrides: overrides }
          return {
            returnOverrides: overrides,
            allocationRevision: bumpAllocationRevision(state.allocationRevision),
            validationErrors: computeValidationErrors(updated),
          }
        }),

      setStdDevOverride: (index, value) =>
        set((state) => {
          const overrides = [...state.stdDevOverrides]
          overrides[index] = value
          const stateData = extractAllocationData(state)
          const updated = { ...stateData, stdDevOverrides: overrides }
          return {
            stdDevOverrides: overrides,
            allocationRevision: bumpAllocationRevision(state.allocationRevision),
            validationErrors: computeValidationErrors(updated),
          }
        }),

      setGlidePathConfig: (config) =>
        set((state) => {
          const stateData = extractAllocationData(state)
          const updated = { ...stateData, glidePathConfig: config }
          return {
            glidePathConfig: config,
            allocationRevision: bumpAllocationRevision(state.allocationRevision),
            validationErrors: computeValidationErrors(updated),
          }
        }),

      setBucketConfig: (config) =>
        set((state) => {
          const stateData = extractAllocationData(state)
          const updated = { ...stateData, bucketConfig: config }
          return {
            bucketConfig: config,
            allocationRevision: bumpAllocationRevision(state.allocationRevision),
            validationErrors: computeValidationErrors(updated),
          }
        }),

      setField: (field, value) =>
        set((state) => {
          const stateData = extractAllocationData(state)
          const updated = { ...stateData, [field]: value }
          return {
            [field]: value,
            allocationRevision: bumpAllocationRevision(state.allocationRevision),
            validationErrors: computeValidationErrors(updated),
          }
        }),

      reset: () =>
        set((state) => ({
          ...DEFAULT_ALLOCATION,
          allocationRevision: bumpAllocationRevision(state.allocationRevision),
          validationErrors: computeValidationErrors(DEFAULT_ALLOCATION),
        })),
    }),
    {
      name: 'fireplanner-allocation',
      version: 4,
      migrate: (persisted, version) => {
        const state = persisted as Record<string, unknown>
        if (version < 2) {
          // cpfHeavy template removed; CPF no longer in portfolio allocation
          if (state.selectedTemplate === 'cpfHeavy') {
            state.selectedTemplate = 'balanced'
            state.currentWeights = [...ALLOCATION_TEMPLATES.balanced]
          }
          // Zero out CPF weight (index 7) and normalize
          const zeroOutCpf = (weights: unknown) => {
            if (!Array.isArray(weights) || weights.length !== 8) return weights
            const w = [...weights] as number[]
            const cpfWeight = w[7] || 0
            w[7] = 0
            if (cpfWeight > 0) {
              // Redistribute proportionally to other non-zero weights
              const otherSum = w.slice(0, 7).reduce((a, b) => a + b, 0)
              if (otherSum > 0) {
                for (let i = 0; i < 7; i++) {
                  w[i] = w[i] + (w[i] / otherSum) * cpfWeight
                }
              }
            }
            return w
          }
          state.currentWeights = zeroOutCpf(state.currentWeights)
          state.targetWeights = zeroOutCpf(state.targetWeights)
        }
        if (version < 3) {
          // Add selectedTargetTemplate for existing users
          if (!state.selectedTargetTemplate) {
            state.selectedTargetTemplate = 'custom'
          }
        }
        if (version < 4) {
          // Add bucketConfig for existing users
          if (!state.bucketConfig) {
            state.bucketConfig = createDefaultBucketConfig()
          }
        }
        return state
      },
      partialize: (state) => {
        const data: Record<string, unknown> = {}
        for (const key of ALLOCATION_DATA_KEYS) {
          data[key] = state[key]
        }
        return data
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          const stateData = extractAllocationData(state)
          state.validationErrors = computeValidationErrors(stateData)
          state.allocationRevision = bumpAllocationRevision(state.allocationRevision)
        }
      },
    }
  )
)
