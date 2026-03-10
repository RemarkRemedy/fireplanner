import type {
  AdultOwner,
  AssetItem,
  Dependent,
  EntryOwner,
  ExpenseItem,
  GoalItem,
  HouseholdAssumptions,
  HouseholdCashReserveSettings,
  HouseholdPlan,
  IncomeSource,
  PlanningAdult,
  PropertyPlan,
  TimingRule,
} from './types'

export type HouseholdValidationEntityKind =
  | 'plan'
  | 'adult'
  | 'dependent'
  | 'income'
  | 'expense'
  | 'asset'
  | 'goal'
  | 'property'
  | 'assumptions'

export type HouseholdValidationErrors = Record<string, Record<string, string>>

function addEntityError(
  errors: HouseholdValidationErrors,
  entityKind: HouseholdValidationEntityKind,
  entityId: string,
  field: string,
  message: string,
) {
  const key = `${entityKind}:${entityId}`
  errors[key] = {
    ...(errors[key] ?? {}),
    [field]: message,
  }
}

function isKnownOwner(owner: EntryOwner, adultOwners: Set<AdultOwner>): boolean {
  return owner === 'shared' || adultOwners.has(owner)
}

function validateTimingRule(
  timing: TimingRule | null | undefined,
  errors: HouseholdValidationErrors,
  entityKind: HouseholdValidationEntityKind,
  entityId: string,
  field: string,
  adultOwners: Set<AdultOwner>,
) {
  if (!timing) {
    addEntityError(errors, entityKind, entityId, field, 'Timing is required.')
    return
  }

  if (!adultOwners.has(timing.owner)) {
    addEntityError(errors, entityKind, entityId, `${field}.owner`, 'Timing owner must reference an existing adult.')
  }

  if (timing.kind === 'single-age') {
    if (!Number.isFinite(timing.age) || timing.age < 0) {
      addEntityError(errors, entityKind, entityId, `${field}.age`, 'Timing age must be zero or greater.')
    }
    return
  }

  if (!Number.isFinite(timing.startAge) || timing.startAge < 0) {
    addEntityError(errors, entityKind, entityId, `${field}.startAge`, 'Start age must be zero or greater.')
  }

  if (timing.endAge != null) {
    if (!Number.isFinite(timing.endAge) || timing.endAge < timing.startAge) {
      addEntityError(errors, entityKind, entityId, `${field}.endAge`, 'End age must be greater than or equal to start age.')
    }
  }
}

function validateCommonOwnedEntry(
  entry: { id: string; owner: EntryOwner; label: string },
  errors: HouseholdValidationErrors,
  entityKind: Exclude<HouseholdValidationEntityKind, 'plan' | 'adult' | 'assumptions'>,
  adultOwners: Set<AdultOwner>,
) {
  if (!entry.label.trim()) {
    addEntityError(errors, entityKind, entry.id, 'label', 'Label is required.')
  }

  if (!isKnownOwner(entry.owner, adultOwners)) {
    addEntityError(errors, entityKind, entry.id, 'owner', 'Owner must reference an existing adult or shared scope.')
  }
}

function validateAdult(adult: PlanningAdult, errors: HouseholdValidationErrors) {
  if (!adult.displayName.trim()) {
    addEntityError(errors, 'adult', adult.id, 'displayName', 'Display name is required.')
  }
  if (!Number.isFinite(adult.currentAge) || adult.currentAge < 0) {
    addEntityError(errors, 'adult', adult.id, 'currentAge', 'Current age must be zero or greater.')
  }
  const isRetiredAdult = adult.cpf.retirementPhase !== null
  if (!Number.isFinite(adult.retirementAge) || (!isRetiredAdult && adult.retirementAge <= adult.currentAge)) {
    addEntityError(errors, 'adult', adult.id, 'retirementAge', 'Retirement age must be greater than current age.')
  }
  if (!Number.isFinite(adult.lifeExpectancy) || adult.lifeExpectancy <= adult.retirementAge) {
    addEntityError(errors, 'adult', adult.id, 'lifeExpectancy', 'Life expectancy must be greater than retirement age.')
  }
  if (adult.annualIncome < 0) {
    addEntityError(errors, 'adult', adult.id, 'annualIncome', 'Annual income cannot be negative.')
  }
  if (adult.annualExpenses < 0) {
    addEntityError(errors, 'adult', adult.id, 'annualExpenses', 'Annual expenses cannot be negative.')
  }
  if (adult.liquidNetWorth < 0) {
    addEntityError(errors, 'adult', adult.id, 'liquidNetWorth', 'Liquid net worth cannot be negative.')
  }

  // CPF balance sub-fields
  if (adult.cpf.balances.oa < 0) {
    addEntityError(errors, 'adult', adult.id, 'cpf.balances.oa', 'CPF OA balance cannot be negative.')
  }
  if (adult.cpf.balances.sa < 0) {
    addEntityError(errors, 'adult', adult.id, 'cpf.balances.sa', 'CPF SA balance cannot be negative.')
  }
  if (adult.cpf.balances.ma < 0) {
    addEntityError(errors, 'adult', adult.id, 'cpf.balances.ma', 'CPF MA balance cannot be negative.')
  }
  if (adult.cpf.balances.ra < 0) {
    addEntityError(errors, 'adult', adult.id, 'cpf.balances.ra', 'CPF RA balance cannot be negative.')
  }

  // SRS sub-fields
  if (adult.srs.balance < 0) {
    addEntityError(errors, 'adult', adult.id, 'srs.balance', 'SRS balance cannot be negative.')
  }
  if (adult.srs.annualContribution < 0) {
    addEntityError(errors, 'adult', adult.id, 'srs.annualContribution', 'SRS annual contribution cannot be negative.')
  }

  // Healthcare config
  if (adult.healthcare.oopBaseAmount < 0) {
    addEntityError(errors, 'adult', adult.id, 'healthcare.oopBaseAmount', 'Out-of-pocket base amount cannot be negative.')
  }
  if (adult.healthcare.mediSaveTopUpAnnual < 0) {
    addEntityError(errors, 'adult', adult.id, 'healthcare.mediSaveTopUpAnnual', 'MediSave top-up cannot be negative.')
  }

  // ── Protection fields ──
  if (adult.cashSavings < 0) {
    addEntityError(errors, 'adult', adult.id, 'cashSavings', 'Cash savings cannot be negative.')
  }
  if (adult.cashSavings > 0 && adult.liquidNetWorth > 0 && adult.cashSavings > adult.liquidNetWorth) {
    addEntityError(errors, 'adult', adult.id, 'cashSavings', 'Cash savings cannot exceed liquid net worth.')
  }
  if (adult.nonMortgageDebtTotal < 0) {
    addEntityError(errors, 'adult', adult.id, 'nonMortgageDebtTotal', 'Non-mortgage debt cannot be negative.')
  }
  if (adult.nonMortgageDebtMonthlyPayment < 0) {
    addEntityError(errors, 'adult', adult.id, 'nonMortgageDebtMonthlyPayment', 'Debt payment cannot be negative.')
  }
  if (adult.insuranceDeathCoverage < 0) {
    addEntityError(errors, 'adult', adult.id, 'insuranceDeathCoverage', 'Coverage cannot be negative.')
  }
  if (adult.insuranceCICoverage < 0) {
    addEntityError(errors, 'adult', adult.id, 'insuranceCICoverage', 'Coverage cannot be negative.')
  }
  if (adult.insuranceDisabilityMonthly < 0) {
    addEntityError(errors, 'adult', adult.id, 'insuranceDisabilityMonthly', 'Coverage cannot be negative.')
  }
  if (adult.funeralCosts < 0) {
    addEntityError(errors, 'adult', adult.id, 'funeralCosts', 'Funeral costs cannot be negative.')
  }
  if (adult.ciRecoveryYears < 1 || adult.ciRecoveryYears > 10 || !Number.isInteger(adult.ciRecoveryYears)) {
    addEntityError(errors, 'adult', adult.id, 'ciRecoveryYears', 'Recovery years must be an integer between 1 and 10.')
  }
}

function validateDependent(
  dependent: Dependent,
  errors: HouseholdValidationErrors,
  adultOwners: Set<AdultOwner>,
) {
  validateCommonOwnedEntry(dependent, errors, 'dependent', adultOwners)

  if (dependent.currentAge != null && dependent.currentAge < 0) {
    addEntityError(errors, 'dependent', dependent.id, 'currentAge', 'Current age cannot be negative.')
  }
  if (dependent.annualCost < 0) {
    addEntityError(errors, 'dependent', dependent.id, 'annualCost', 'Annual cost cannot be negative.')
  }

  if (dependent.timing) {
    validateTimingRule(dependent.timing, errors, 'dependent', dependent.id, 'timing', adultOwners)
  }
}

function validateIncomeSource(
  income: IncomeSource,
  errors: HouseholdValidationErrors,
  adultOwners: Set<AdultOwner>,
) {
  validateCommonOwnedEntry(income, errors, 'income', adultOwners)
  validateTimingRule(income.timing, errors, 'income', income.id, 'timing', adultOwners)

  if (income.annualAmount < 0) {
    addEntityError(errors, 'income', income.id, 'annualAmount', 'Annual amount cannot be negative.')
  }
}

function validateExpenseItem(
  expense: ExpenseItem,
  errors: HouseholdValidationErrors,
  adultOwners: Set<AdultOwner>,
) {
  validateCommonOwnedEntry(expense, errors, 'expense', adultOwners)
  validateTimingRule(expense.timing, errors, 'expense', expense.id, 'timing', adultOwners)

  const allowsNegativeAmount = expense.kind === 'expense-adjustment'
  if (!allowsNegativeAmount && expense.amount < 0) {
    addEntityError(errors, 'expense', expense.id, 'amount', 'Amount cannot be negative.')
  }
  if (expense.durationYears != null && expense.durationYears < 1) {
    addEntityError(errors, 'expense', expense.id, 'durationYears', 'Duration must be at least 1 year.')
  }
}

function validateAssetItem(
  asset: AssetItem,
  errors: HouseholdValidationErrors,
  adultOwners: Set<AdultOwner>,
) {
  validateCommonOwnedEntry(asset, errors, 'asset', adultOwners)

  if (asset.amount < 0) {
    addEntityError(errors, 'asset', asset.id, 'amount', 'Amount cannot be negative.')
  }
  if (asset.unlockAge != null && asset.unlockAge < 0) {
    addEntityError(errors, 'asset', asset.id, 'unlockAge', 'Unlock age must be zero or greater.')
  }
}

function validateGoalItem(
  goal: GoalItem,
  errors: HouseholdValidationErrors,
  adultOwners: Set<AdultOwner>,
) {
  validateCommonOwnedEntry(goal, errors, 'goal', adultOwners)
  validateTimingRule(goal.timing, errors, 'goal', goal.id, 'timing', adultOwners)

  if (goal.amount < 0) {
    addEntityError(errors, 'goal', goal.id, 'amount', 'Amount cannot be negative.')
  }
  if (goal.durationYears < 1) {
    addEntityError(errors, 'goal', goal.id, 'durationYears', 'Duration must be at least 1 year.')
  }
}

function validatePropertyPlan(
  property: PropertyPlan,
  errors: HouseholdValidationErrors,
  adultOwners: Set<AdultOwner>,
) {
  validateCommonOwnedEntry(property, errors, 'property', adultOwners)

  if (property.ownershipPercent <= 0 || property.ownershipPercent > 1) {
    addEntityError(errors, 'property', property.id, 'ownershipPercent', 'Ownership share must be greater than 0% and at most 100%.')
  }
  if (property.purchasePrice < 0) {
    addEntityError(errors, 'property', property.id, 'purchasePrice', 'Purchase price cannot be negative.')
  }
  if (property.existingPropertyValue < 0) {
    addEntityError(errors, 'property', property.id, 'existingPropertyValue', 'Existing property value cannot be negative.')
  }
  if (property.existingMortgageBalance < 0) {
    addEntityError(errors, 'property', property.id, 'existingMortgageBalance', 'Existing mortgage balance cannot be negative.')
  }
  if (property.existingMonthlyPayment < 0) {
    addEntityError(errors, 'property', property.id, 'existingMonthlyPayment', 'Existing monthly payment cannot be negative.')
  }
  if (property.mortgageRate < 0 || property.mortgageRate > 1) {
    addEntityError(errors, 'property', property.id, 'mortgageRate', 'Mortgage rate must be between 0% and 100%.')
  }
  if (property.ltv < 0 || property.ltv > 1) {
    addEntityError(errors, 'property', property.id, 'ltv', 'Loan-to-value must be between 0% and 100%.')
  }
  if (property.mortgageTerm < 1 || property.mortgageTerm > 40) {
    addEntityError(errors, 'property', property.id, 'mortgageTerm', 'Mortgage term must be between 1 and 40 years.')
  }
}

function validateCashReserveSettings(
  settings: HouseholdCashReserveSettings,
  errors: HouseholdValidationErrors,
  householdId: string,
) {
  if (settings.fixedAmount < 0) {
    addEntityError(errors, 'assumptions', householdId, 'cashReserve.fixedAmount', 'Cash reserve fixed amount cannot be negative.')
  }
  if (settings.months < 0) {
    addEntityError(errors, 'assumptions', householdId, 'cashReserve.months', 'Cash reserve months cannot be negative.')
  }
  if (settings.returnRate < 0) {
    addEntityError(errors, 'assumptions', householdId, 'cashReserve.returnRate', 'Cash reserve return rate cannot be negative.')
  }
}

function validateAssumptions(
  assumptions: HouseholdAssumptions,
  errors: HouseholdValidationErrors,
  householdId: string,
) {
  if (assumptions.fire.swr <= 0 || assumptions.fire.swr > 1) {
    addEntityError(errors, 'assumptions', householdId, 'fire.swr', 'Safe withdrawal rate must be between 0 and 100%.')
  }
  if (!Number.isFinite(assumptions.returns.expectedReturn)) {
    addEntityError(errors, 'assumptions', householdId, 'returns.expectedReturn', 'Expected return must be a finite number.')
  }
  if (!Number.isFinite(assumptions.returns.inflation)) {
    addEntityError(errors, 'assumptions', householdId, 'returns.inflation', 'Inflation must be a finite number.')
  }
  if (assumptions.returns.expenseRatio < 0) {
    addEntityError(errors, 'assumptions', householdId, 'returns.expenseRatio', 'Expense ratio cannot be negative.')
  }

  validateCashReserveSettings(assumptions.cashReserve, errors, householdId)
}

export function validateHouseholdPlan(plan: HouseholdPlan): HouseholdValidationErrors {
  const errors: HouseholdValidationErrors = {}
  const adultOwners = new Set<AdultOwner>(plan.adults.map((adult) => adult.owner))
  const selfAdults = plan.adults.filter((adult) => adult.owner === 'self')
  const duplicateIdBuckets = new Map<string, Set<string>>()

  if (plan.adults.length === 0) {
    addEntityError(errors, 'plan', plan.id, 'adults', 'At least one adult is required.')
  }

  if (selfAdults.length !== 1) {
    addEntityError(errors, 'plan', plan.id, 'adults.self', 'Exactly one self adult is required.')
  }

  const trackDuplicates = (
    entityKind: Exclude<HouseholdValidationEntityKind, 'plan' | 'assumptions'>,
    entityId: string,
  ) => {
    const seenIds = duplicateIdBuckets.get(entityKind) ?? new Set<string>()
    if (seenIds.has(entityId)) {
      addEntityError(errors, entityKind, entityId, 'id', 'IDs must be unique within each household collection.')
      return
    }
    seenIds.add(entityId)
    duplicateIdBuckets.set(entityKind, seenIds)
  }

  for (const adult of plan.adults) {
    trackDuplicates('adult', adult.id)
    validateAdult(adult, errors)
  }

  for (const dependent of plan.dependents) {
    trackDuplicates('dependent', dependent.id)
    validateDependent(dependent, errors, adultOwners)
  }

  for (const income of plan.income) {
    trackDuplicates('income', income.id)
    validateIncomeSource(income, errors, adultOwners)
  }

  for (const expense of plan.expenses) {
    trackDuplicates('expense', expense.id)
    validateExpenseItem(expense, errors, adultOwners)
  }

  for (const asset of plan.assets) {
    trackDuplicates('asset', asset.id)
    validateAssetItem(asset, errors, adultOwners)
  }

  for (const goal of plan.goals) {
    trackDuplicates('goal', goal.id)
    validateGoalItem(goal, errors, adultOwners)
  }

  for (const property of plan.properties) {
    trackDuplicates('property', property.id)
    validatePropertyPlan(property, errors, adultOwners)
  }

  validateAssumptions(plan.assumptions, errors, plan.id)

  return errors
}

export function hasHouseholdValidationErrors(errors: HouseholdValidationErrors): boolean {
  return Object.values(errors).some((entityErrors) => Object.keys(entityErrors).length > 0)
}
