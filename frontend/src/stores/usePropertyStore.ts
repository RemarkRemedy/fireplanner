import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PropertyState, DownsizingConfig, ValidationErrors } from '@/lib/types'

interface PropertyActions {
  setField: <K extends keyof Omit<PropertyState, 'validationErrors'>>(
    field: K,
    value: PropertyState[K]
  ) => void
  setDownsizingField: <K extends keyof DownsizingConfig>(
    field: K,
    value: DownsizingConfig[K]
  ) => void
  reset: () => void
}

const DEFAULT_DOWNSIZING: DownsizingConfig = {
  scenario: 'none',
  sellAge: 65,
  expectedSalePrice: 1500000,
  newPropertyCost: 800000,
  newMortgageRate: 0.035,
  newMortgageTerm: 20,
  newLtv: 0.75,
  monthlyRent: 2500,
  rentGrowthRate: 0.03,
}

const PROPERTY_DATA_KEYS = [
  'propertyType', 'purchasePrice', 'leaseYears', 'appreciationRate',
  'rentalYield', 'mortgageRate', 'mortgageTerm', 'ltv',
  'residencyForAbsd', 'propertyCount',
  'ownsProperty', 'existingPropertyValue', 'existingMortgageBalance',
  'existingMonthlyPayment',
  'existingMortgageRate', 'existingMortgageRemainingYears',
  'mortgageCpfMonthly',
  'ownershipPercent',
  'existingAppreciationRate', 'existingLeaseYears', 'existingApplyBalaDecay',
  'downsizing',
  'hdbFlatType', 'hdbMonetizationStrategy', 'hdbLbsRetainedLease',
  'hdbSublettingRooms', 'hdbSublettingRate', 'hdbCpfUsedForHousing',
] as const

const DEFAULT_PROPERTY: Omit<PropertyState, 'validationErrors'> = {
  propertyType: 'condo',
  purchasePrice: 1500000,
  leaseYears: 99,
  appreciationRate: 0.03,
  rentalYield: 0.03,
  mortgageRate: 0.035,
  mortgageTerm: 25,
  ltv: 0.75,
  residencyForAbsd: 'citizen',
  propertyCount: 0,
  ownsProperty: false,
  existingPropertyValue: 0,
  existingMortgageBalance: 0,
  existingMonthlyPayment: 0,
  existingMortgageRate: 0.035,
  existingMortgageRemainingYears: 25,
  mortgageCpfMonthly: 0,
  ownershipPercent: 1,
  existingAppreciationRate: 0.03,
  existingLeaseYears: 99,
  existingApplyBalaDecay: true,
  downsizing: DEFAULT_DOWNSIZING,
  hdbFlatType: '4-room',
  hdbMonetizationStrategy: 'none',
  hdbLbsRetainedLease: 30,
  hdbSublettingRooms: 1,
  hdbSublettingRate: 800,
  hdbCpfUsedForHousing: 0,
}

function extractPropertyData(
  state: PropertyState & PropertyActions
): Omit<PropertyState, 'validationErrors'> {
  const data: Record<string, unknown> = {}
  for (const key of PROPERTY_DATA_KEYS) {
    data[key] = state[key]
  }
  return data as Omit<PropertyState, 'validationErrors'>
}

function computeValidationErrors(
  state: Omit<PropertyState, 'validationErrors'>
): ValidationErrors {
  const errors: ValidationErrors = {}

  if (state.purchasePrice <= 0) {
    errors.purchasePrice = 'Purchase price must be positive'
  }
  if (state.leaseYears < 1 || state.leaseYears > 999) {
    errors.leaseYears = 'Lease must be between 1 and 999 years'
  }
  if (state.mortgageRate < 0 || state.mortgageRate > 0.15) {
    errors.mortgageRate = 'Mortgage rate must be between 0% and 15%'
  }
  if (state.mortgageTerm < 1 || state.mortgageTerm > 35) {
    errors.mortgageTerm = 'Mortgage term must be between 1 and 35 years'
  }
  if (state.ltv < 0 || state.ltv > 1) {
    errors.ltv = 'LTV must be between 0% and 100%'
  }

  if (state.ownsProperty) {
    if (state.existingPropertyValue < 0) {
      errors.existingPropertyValue = 'Property value cannot be negative'
    }
    if (state.existingMortgageBalance < 0) {
      errors.existingMortgageBalance = 'Mortgage balance cannot be negative'
    }
    if (state.existingMonthlyPayment < 0) {
      errors.existingMonthlyPayment = 'Monthly payment cannot be negative'
    }
    if (state.existingMortgageRate < 0 || state.existingMortgageRate > 0.15) {
      errors.existingMortgageRate = 'Mortgage rate must be between 0% and 15%'
    }
    if (state.existingMortgageRemainingYears < 0 || state.existingMortgageRemainingYears > 35) {
      errors.existingMortgageRemainingYears = 'Remaining years must be between 0 and 35'
    }
    if (state.mortgageCpfMonthly < 0) {
      errors.mortgageCpfMonthly = 'CPF portion cannot be negative'
    }
    if (state.mortgageCpfMonthly > state.existingMonthlyPayment) {
      errors.mortgageCpfMonthly = 'CPF portion cannot exceed total monthly payment'
    }
    if (state.ownershipPercent <= 0 || state.ownershipPercent > 1) {
      errors.ownershipPercent = 'Ownership share must be between 1% and 100%'
    }
    if (state.existingAppreciationRate < -0.1 || state.existingAppreciationRate > 0.2) {
      errors.existingAppreciationRate = 'Appreciation rate must be between -10% and 20%'
    }
    if (state.existingLeaseYears < 1 || state.existingLeaseYears > 999) {
      errors.existingLeaseYears = 'Lease must be between 1 and 999 years'
    }

    const ds = state.downsizing
    if (ds.scenario !== 'none') {
      if (ds.sellAge < 18 || ds.sellAge > 120) {
        errors['downsizing_sellAge'] = 'Sell age must be between 18 and 120'
      }
      if (ds.expectedSalePrice <= 0) {
        errors['downsizing_expectedSalePrice'] = 'Expected sale price must be positive'
      }
      if (ds.scenario === 'sell-and-downsize') {
        if (ds.newPropertyCost <= 0) {
          errors['downsizing_newPropertyCost'] = 'New property cost must be positive'
        }
        if (ds.newMortgageRate < 0 || ds.newMortgageRate > 0.15) {
          errors['downsizing_newMortgageRate'] = 'Mortgage rate must be between 0% and 15%'
        }
        if (ds.newMortgageTerm < 1 || ds.newMortgageTerm > 35) {
          errors['downsizing_newMortgageTerm'] = 'Term must be between 1 and 35 years'
        }
        if (ds.newLtv < 0 || ds.newLtv > 1) {
          errors['downsizing_newLtv'] = 'LTV must be between 0% and 100%'
        }
      }
      if (ds.scenario === 'sell-and-rent') {
        if (ds.monthlyRent < 0) {
          errors['downsizing_monthlyRent'] = 'Monthly rent cannot be negative'
        }
        if (ds.rentGrowthRate < 0 || ds.rentGrowthRate > 0.15) {
          errors['downsizing_rentGrowthRate'] = 'Rent growth rate must be between 0% and 15%'
        }
      }
    }
  }

  return errors
}

export const usePropertyStore = create<PropertyState & PropertyActions>()(
  persist(
    (set) => ({
      ...DEFAULT_PROPERTY,
      validationErrors: computeValidationErrors(DEFAULT_PROPERTY),

      setField: (field, value) =>
        set((state) => {
          const stateData = extractPropertyData(state)
          const updated = { ...stateData, [field]: value }
          return {
            [field]: value,
            validationErrors: computeValidationErrors(updated),
          }
        }),

      setDownsizingField: (field, value) =>
        set((state) => {
          const stateData = extractPropertyData(state)
          const updatedDownsizing = { ...stateData.downsizing, [field]: value }
          const updated = { ...stateData, downsizing: updatedDownsizing }
          return {
            downsizing: updatedDownsizing,
            validationErrors: computeValidationErrors(updated),
          }
        }),

      reset: () =>
        set({
          ...DEFAULT_PROPERTY,
          validationErrors: computeValidationErrors(DEFAULT_PROPERTY),
        }),
    }),
    {
      name: 'fireplanner-property',
      version: 10,
      migrate: (persisted, version) => {
        const state = persisted as Record<string, unknown>
        if (version < 2) {
          state.ownsProperty = state.ownsProperty ?? false
          state.existingPropertyValue = state.existingPropertyValue ?? 0
          state.existingMortgageBalance = state.existingMortgageBalance ?? 0
          state.existingMonthlyPayment = state.existingMonthlyPayment ?? 0
        }
        if (version < 3) {
          state.existingMortgageRate = state.existingMortgageRate ?? 0.035
          state.existingMortgageRemainingYears = state.existingMortgageRemainingYears ?? 25
          state.downsizing = state.downsizing ?? DEFAULT_DOWNSIZING
        }
        if (version < 4) {
          state.hdbFlatType ??= '4-room'
          state.hdbMonetizationStrategy ??= 'none'
          state.hdbLbsRetainedLease ??= 30
          state.hdbSublettingRooms ??= 1
          state.hdbSublettingRate ??= 800
          state.hdbCpfUsedForHousing ??= 0
        }
        if (version < 5) {
          state.mortgageCpfMonthly ??= 0
        }
        if (version < 6) {
          // sell-and-rent removed from HDB monetization (covered by downsizing)
          if (state.hdbMonetizationStrategy === 'sell-and-rent') {
            state.hdbMonetizationStrategy = 'none'
          }
        }
        if (version < 7) {
          state.ownershipPercent ??= 1
        }
        if (version < 8) {
          state.applyBalaDecay ??= true
        }
        if (version < 9) {
          state.existingAppreciationRate ??= 0.03
          state.existingLeaseYears ??= 99
          state.existingApplyBalaDecay ??= true
        }
        if (version < 10) {
          delete state.existingRentalIncome
        }
        return state
      },
      partialize: (state) => {
        const data: Record<string, unknown> = {}
        for (const key of PROPERTY_DATA_KEYS) {
          data[key] = state[key]
        }
        return data
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          const stateData = extractPropertyData(state)
          state.validationErrors = computeValidationErrors(stateData)
        }
      },
    }
  )
)
