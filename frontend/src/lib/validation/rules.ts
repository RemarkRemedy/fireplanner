import type { ValidationErrors, ProfileState, IncomeState, AllocationState, WithdrawalState } from '@/lib/types'
import { MEDISAVE_BHS } from '@/lib/data/healthcarePremiums'
import { getBhsAtAge } from '@/lib/calculations/cpf'

/**
 * Cross-field validation rules within the profile store.
 * Returns a map of field names to error messages.
 */
export function validateProfileConsistency(
  profile: Pick<ProfileState, 'currentAge' | 'retirementAge' | 'lifeExpectancy' | 'lifeStage' | 'cpfLifeStartAge' | 'cpfMA' | 'parentSupportEnabled' | 'parentSupport' | 'healthcareConfig' | 'retirementWithdrawals' | 'financialGoals' | 'cpfOaWithdrawals'> & { lockedAssets?: ProfileState['lockedAssets']; expenseAdjustments?: ProfileState['expenseAdjustments'] }
): ValidationErrors {
  const errors: ValidationErrors = {}

  if (profile.lifeStage !== 'post-fire' && profile.retirementAge <= profile.currentAge) {
    errors.retirementAge = 'Retirement age must be later than current age'
  }

  if (profile.lifeExpectancy <= profile.retirementAge) {
    errors.lifeExpectancy = 'Life expectancy must be later than retirement age'
  }

  if (profile.cpfLifeStartAge >= profile.lifeExpectancy) {
    errors.cpfLifeStartAge = 'CPF LIFE start age must be earlier than life expectancy'
  }

  // MA cannot exceed BHS for current age
  const currentBhs = getBhsAtAge(profile.currentAge, profile.currentAge)
  if (profile.cpfMA > currentBhs) {
    errors.cpfMA = `MA cannot exceed the Basic Healthcare Sum ($${currentBhs.toLocaleString()})`
  }

  // Parent support validation
  if (profile.parentSupportEnabled) {
    for (const entry of profile.parentSupport) {
      if (entry.startAge < 18) {
        errors[`parentSupport_${entry.id}_startAge`] = 'Start age must be at least 18'
      }
      if (entry.startAge >= entry.endAge) {
        errors[`parentSupport_${entry.id}_startAge`] = 'Start age must be earlier than end age'
      }
      if (entry.endAge > profile.lifeExpectancy) {
        errors[`parentSupport_${entry.id}_endAge`] = `End age cannot exceed life expectancy (${profile.lifeExpectancy})`
      }
    }
  }

  // Retirement withdrawal validation
  for (const rw of profile.retirementWithdrawals ?? []) {
    if (rw.age < profile.retirementAge) {
      errors[`retirementWithdrawal_${rw.id}_age`] =
        `Withdrawal age (${rw.age}) must be at or after retirement age (${profile.retirementAge})`
    }
    if (rw.age + (rw.durationYears ?? 1) > profile.lifeExpectancy) {
      errors[`retirementWithdrawal_${rw.id}_durationYears`] =
        `Withdrawal end age (${rw.age + (rw.durationYears ?? 1)}) exceeds life expectancy (${profile.lifeExpectancy})`
    }
  }

  // Healthcare config validation
  if (profile.healthcareConfig?.enabled) {
    if (profile.healthcareConfig.oopBaseAmount < 0 || profile.healthcareConfig.oopBaseAmount > 50000) {
      errors['healthcareConfig.oopBaseAmount'] = 'Out-of-pocket base amount must be between $0 and $50,000'
    }
    if (profile.healthcareConfig.mediSaveTopUpAnnual < 0 || profile.healthcareConfig.mediSaveTopUpAnnual > MEDISAVE_BHS) {
      errors['healthcareConfig.mediSaveTopUpAnnual'] = `MediSave Account (MA) top-up must be between $0 and $${MEDISAVE_BHS.toLocaleString()} (Basic Healthcare Sum cap)`
    }
  }

  // Financial goals validation
  for (const goal of profile.financialGoals ?? []) {
    if (goal.amount <= 0) {
      errors[`goal_${goal.id}_amount`] = 'Amount must be positive'
    }
    if (goal.targetAge <= profile.currentAge) {
      errors[`goal_${goal.id}_age`] = 'Target age must be in the future'
    }
    if (goal.targetAge > profile.lifeExpectancy) {
      errors[`goal_${goal.id}_age`] = 'Target age exceeds life expectancy'
    }
    if (goal.durationYears < 1) {
      errors[`goal_${goal.id}_duration`] = 'Duration must be at least 1 year'
    }
    if (goal.targetAge + goal.durationYears > profile.lifeExpectancy) {
      errors[`goal_${goal.id}_duration`] = 'Goal extends beyond life expectancy'
    }
  }

  // CPF OA withdrawal validation
  for (const w of profile.cpfOaWithdrawals ?? []) {
    if (w.age < 55) {
      errors[`cpfOaWithdrawal_${w.id}_age`] = 'CPF Ordinary Account (OA) withdrawal age must be 55 or later'
    }
    if (w.age > profile.lifeExpectancy) {
      errors[`cpfOaWithdrawal_${w.id}_age`] = `Withdrawal age (${w.age}) exceeds life expectancy (${profile.lifeExpectancy})`
    }
    if (w.amount <= 0) {
      errors[`cpfOaWithdrawal_${w.id}_amount`] = 'Amount must be positive'
    }
  }

  // Expense adjustment validation
  if (profile.expenseAdjustments) {
    if (profile.expenseAdjustments.length > 10) {
      errors['expenseAdjustments'] = 'Maximum 10 expense adjustments'
    }
    for (const adj of profile.expenseAdjustments) {
      if (adj.endAge !== null && adj.endAge <= adj.startAge) {
        errors[`expenseAdjustment_${adj.id}_endAge`] = 'End age must be later than start age'
      }
      if (adj.endAge !== null && adj.endAge > profile.lifeExpectancy) {
        errors[`expenseAdjustment_${adj.id}_endAge`] = `End age cannot exceed life expectancy (${profile.lifeExpectancy})`
      }
    }
  }

  // Locked asset cross-store rules
  if (profile.lockedAssets) {
    for (let i = 0; i < profile.lockedAssets.length; i++) {
      const asset = profile.lockedAssets[i]
      if (asset.unlockAge <= profile.currentAge) {
        errors[`lockedAssets.${i}.unlockAge`] = 'Unlock age must be later than current age'
      }
      if (asset.unlockAge > profile.lifeExpectancy) {
        errors[`lockedAssets.${i}.unlockAge`] = 'Unlock age must not exceed life expectancy'
      }
    }
    if (profile.lockedAssets.length > 10) {
      errors['lockedAssets'] = 'Maximum 10 locked assets'
    }
  }

  return errors
}

/**
 * Cross-store validation: income store rules that depend on profile store.
 */
export function validateCrossStoreRules(
  profile: Pick<ProfileState, 'currentAge' | 'retirementAge' | 'lifeExpectancy'>,
  income: Pick<IncomeState, 'incomeStreams' | 'lifeEvents' | 'lifeEventsEnabled' | 'promotionJumps'>
): ValidationErrors {
  const errors: ValidationErrors = {}

  // Income stream validation against profile
  for (const stream of income.incomeStreams) {
    if (stream.endAge > profile.lifeExpectancy) {
      errors[`incomeStream_${stream.id}_endAge`] =
        `End age (${stream.endAge}) cannot exceed life expectancy (${profile.lifeExpectancy})`
    }
    if (stream.startAge >= stream.endAge) {
      errors[`incomeStream_${stream.id}_startAge`] =
        `Start age must be earlier than end age`
    }
  }

  // Life event validation against profile
  if (income.lifeEventsEnabled) {
    for (const event of income.lifeEvents) {
      if (event.endAge > profile.lifeExpectancy) {
        errors[`lifeEvent_${event.id}_endAge`] =
          `End age (${event.endAge}) cannot exceed life expectancy (${profile.lifeExpectancy})`
      }
      if (event.startAge >= event.endAge) {
        errors[`lifeEvent_${event.id}_startAge`] =
          `Start age must be earlier than end age`
      }
    }
  }

  // Promotion jump ages within working years
  for (let i = 0; i < income.promotionJumps.length; i++) {
    const jump = income.promotionJumps[i]
    if (jump.age < profile.currentAge) {
      errors[`promotionJump_${i}_age`] =
        `Promotion age (${jump.age}) must be at or after current age (${profile.currentAge})`
    }
    if (jump.age > profile.retirementAge) {
      errors[`promotionJump_${i}_age`] =
        `Promotion age (${jump.age}) must be at or before retirement age (${profile.retirementAge})`
    }
  }

  return errors
}

/**
 * Cross-store validation: allocation store rules that depend on profile store.
 */
export function validateAllocationCrossStoreRules(
  profile: Pick<ProfileState, 'currentAge' | 'lifeExpectancy'>,
  allocation: Pick<AllocationState, 'glidePathConfig' | 'targetWeights'>
): ValidationErrors {
  const errors: ValidationErrors = {}

  if (allocation.glidePathConfig.enabled) {
    if (allocation.glidePathConfig.startAge < profile.currentAge) {
      errors['glidePathConfig.startAge'] =
        `Glide path start age (${allocation.glidePathConfig.startAge}) must be at or after current age (${profile.currentAge})`
    }
    if (allocation.glidePathConfig.endAge > profile.lifeExpectancy) {
      errors['glidePathConfig.endAge'] =
        `Glide path end age (${allocation.glidePathConfig.endAge}) must be at or before life expectancy (${profile.lifeExpectancy})`
    }
    if (allocation.glidePathConfig.startAge >= allocation.glidePathConfig.endAge) {
      errors['glidePathConfig.startAge'] =
        'Glide path start age must be earlier than end age'
    }

    // Validate target weights sum when glide path is enabled
    const targetSum = allocation.targetWeights.reduce((a, b) => a + b, 0)
    if (Math.abs(targetSum - 1) >= 0.001) {
      errors.targetWeights = 'Target weights must sum to 100% when glide path is enabled'
    }
  }

  return errors
}

/**
 * Cross-store validation: withdrawal store rules that depend on profile store.
 */
export function validateWithdrawalCrossStoreRules(
  profile: Pick<ProfileState, 'annualExpenses' | 'retirementAge' | 'lifeExpectancy'>,
  withdrawal: Pick<WithdrawalState, 'strategyParams'>
): ValidationErrors {
  const errors: ValidationErrors = {}

  const fc = withdrawal.strategyParams.floor_ceiling
  if (fc.floor > profile.annualExpenses * 3) {
    errors['floor_ceiling.floor'] = 'Floor seems too high relative to annual expenses. Try a lower value or increase expenses first.'
  }

  const duration = profile.lifeExpectancy - profile.retirementAge
  if (duration <= 0) {
    errors.duration = 'Retirement duration must be positive'
  }

  return errors
}
