import type {
  GoalItem,
  HouseholdPlan,
  HouseholdPlanType,
  PlanningAdult,
  PropertyPlan,
} from './types'
import { createId } from './ids'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import { CPF_HEURISTIC_SPLIT, SG_GROSS_UP_FACTOR } from '@/lib/data/cpfRates'
import { DEFAULT_LTV } from '@/lib/data/propertyDefaults'

// ---------------------------------------------------------------------------
// SetupDraft — flat structure for /setup wizard answers
// ---------------------------------------------------------------------------

export interface SetupDraft {
  // Essential
  yourName?: string
  currentAge: number
  retirementAge: number
  annualIncome: number
  incomeType: 'gross' | 'take-home'
  annualExpenses: number
  liquidNetWorth: number
  cashSavings?: number
  // SG Pillars
  residency: 'citizen' | 'pr' | 'foreigner'
  cpfKnown: boolean
  cpfTotal?: number
  cpfBreakdown?: { oa: number; sa: number; ma: number; ra: number }
  ownsProperty: 'owns' | 'planning' | 'no'
  propertyType?: 'hdb' | 'condo' | 'landed'
  propertyValue?: number
  mortgageBalance?: number
  purchasePrice?: number
  purchaseYearsFromNow?: number
  healthcareEnabled: boolean
  ispTier?: 'none' | 'basic' | 'enhanced'
  // Already-FIRE pathway
  lifeStage?: 'pre-fire' | 'post-fire'
  retirementPhase?: 'before-55' | '55-to-64' | '65-plus'
  // Partner (if couple)
  partner?: {
    name: string
    currentAge: number
    retirementAge: number
    annualIncome: number
    incomeType: 'gross' | 'take-home'
    annualExpenses: number
    liquidNetWorth: number
    residency: 'citizen' | 'pr' | 'foreigner'
    cpfKnown: boolean
    cpfTotal?: number
    healthcareEnabled?: boolean
    ispTier?: 'none' | 'basic' | 'enhanced'
  }
  // Joint
  jointMonthlyExpenses?: number
  dependents?: Array<{ name: string; age: number | null; relationship: string }>
  // Meta
  isRedo: boolean
}

// ---------------------------------------------------------------------------
// CPF age-based split heuristic
// ---------------------------------------------------------------------------

export interface CpfSplit {
  oa: number
  sa: number
  ma: number
  ra: number
}

export function splitCpfByAge(total: number, age: number): CpfSplit {
  const bracket = CPF_HEURISTIC_SPLIT.find((b) => age <= b.maxAge) ?? CPF_HEURISTIC_SPLIT[CPF_HEURISTIC_SPLIT.length - 1]
  return {
    oa: Math.round(total * bracket.oa),
    sa: Math.round(total * bracket.sa),
    ma: Math.round(total * bracket.ma),
    ra: Math.round(total * bracket.ra),
  }
}

// ---------------------------------------------------------------------------
// Gross-up heuristic for take-home → gross conversion
// ---------------------------------------------------------------------------

/** Rough SG heuristic: gross ~ takeHome / SG_GROSS_UP_FACTOR (covers CPF employee + avg tax) */
function estimateGross(takeHome: number): number {
  return Math.round(takeHome / SG_GROSS_UP_FACTOR)
}

function resolveGrossIncome(annualIncome: number, incomeType: 'gross' | 'take-home'): number {
  return incomeType === 'take-home' ? estimateGross(annualIncome) : annualIncome
}

// ---------------------------------------------------------------------------
// applySetupDraft — writes wizard answers into the household plan store
// ---------------------------------------------------------------------------

export function applySetupDraft(draft: SetupDraft, planType: HouseholdPlanType): void {
  const store = useHouseholdPlanStore.getState()

  // ---- Fresh vs redo ----
  if (!draft.isRedo) {
    store.initializeManualPlan(planType)
  }

  const plan = useHouseholdPlanStore.getState().plan
  const selfAdult = plan.adults.find((a) => a.owner === 'self')
  if (!selfAdult) return

  const grossIncome = resolveGrossIncome(draft.annualIncome, draft.incomeType)

  // --- Update self adult ---
  const adultUpdates: Partial<PlanningAdult> = {
    ...(draft.yourName ? { displayName: draft.yourName } : {}),
    currentAge: draft.currentAge,
    retirementAge: draft.retirementAge,
    annualIncome: grossIncome,
    annualExpenses: draft.annualExpenses,
    liquidNetWorth: draft.liquidNetWorth,
    cashSavings: draft.cashSavings ?? 0,
    residencyStatus: draft.residency,
    lifeStage: draft.lifeStage ?? 'pre-fire',
    healthcare: {
      ...selfAdult.healthcare,
      enabled: draft.healthcareEnabled,
      ...(draft.ispTier != null ? { ispTier: draft.ispTier } : {}),
    },
    cpf: {
      ...selfAdult.cpf,
      retirementPhase: draft.retirementPhase ?? null,
      ...(draft.cpfKnown && draft.cpfBreakdown
        ? { balances: draft.cpfBreakdown }
        : draft.cpfKnown && draft.cpfTotal != null
          ? { balances: splitCpfByAge(draft.cpfTotal, draft.currentAge) }
          : {}),
    },
  }
  useHouseholdPlanStore.getState().updateAdult(selfAdult.id, adultUpdates)

  // On redo, zero out CPF balances when user says they don't know them (but only for citizens/PRs)
  if (draft.isRedo && !draft.cpfKnown && draft.residency !== 'foreigner') {
    const refreshedSelf = useHouseholdPlanStore.getState().plan.adults.find((a) => a.owner === 'self')
    if (refreshedSelf) {
      useHouseholdPlanStore.getState().updateAdult(refreshedSelf.id, {
        cpf: { ...refreshedSelf.cpf, balances: { oa: 0, sa: 0, ma: 0, ra: 0 } },
      })
    }
  }

  // --- Update seeded salary-model income entry ---
  const refreshedPlan = useHouseholdPlanStore.getState().plan
  const salaryEntry = refreshedPlan.income.find(
    (e) =>
      e.kind === 'salary-model' &&
      e.owner === 'self' &&
      e.timing.kind === 'age-range' &&
      e.timing.owner === 'self',
  )
  if (salaryEntry?.timing.kind === 'age-range') {
    useHouseholdPlanStore.getState().updateIncome(salaryEntry.id, {
      annualAmount: grossIncome,
      timing: {
        ...salaryEntry.timing,
        startAge: draft.currentAge,
        endAge: draft.retirementAge,
      },
    })
  }

  // --- Update seeded base-living expense entry ---
  const baseExpense = refreshedPlan.expenses.find(
    (e) =>
      e.kind === 'base-living' &&
      e.owner === 'self' &&
      e.timing.kind === 'age-range' &&
      e.timing.owner === 'self',
  )
  if (baseExpense?.timing.kind === 'age-range') {
    useHouseholdPlanStore.getState().updateExpense(baseExpense.id, {
      amount: draft.annualExpenses,
      timing: {
        ...baseExpense.timing,
        startAge: draft.currentAge,
        endAge: null,
      },
    })
  }

  // --- Update seeded liquid-net-worth asset entry ---
  const liquidAsset = refreshedPlan.assets.find(
    (e) => e.kind === 'liquid-net-worth' && e.owner === 'self',
  )
  if (liquidAsset) {
    useHouseholdPlanStore.getState().updateAsset(liquidAsset.id, {
      amount: draft.liquidNetWorth,
    })
  }

  // --- Property ---
  applyPropertyDraft(draft)

  // --- Partner (couple plans) ---
  if (draft.partner) {
    applyPartnerDraft(draft, selfAdult)
  }

  // --- Joint expenses ---
  if (draft.jointMonthlyExpenses != null && draft.jointMonthlyExpenses > 0) {
    const jointAnnual = draft.jointMonthlyExpenses * 12
    const existingJoint = useHouseholdPlanStore.getState().plan.expenses.find(
      (e) => e.owner === 'shared' && e.kind === 'base-living',
    )
    if (existingJoint && draft.isRedo) {
      useHouseholdPlanStore.getState().updateExpense(existingJoint.id, {
        amount: jointAnnual,
      })
    } else if (!existingJoint) {
      useHouseholdPlanStore.getState().addExpense({
        id: createId('expense-joint-living'),
        owner: 'shared',
        label: 'Additional joint expenses',
        kind: 'base-living',
        timing: {
          kind: 'age-range',
          owner: 'self',
          startAge: draft.currentAge,
          endAge: null,
        },
        amount: jointAnnual,
        periodicity: 'annual',
        growthModel: 'inflation-linked',
      })
    }
  } else if (draft.isRedo) {
    // On redo with zero/undefined joint expenses, remove existing shared expense
    const existingJoint = useHouseholdPlanStore.getState().plan.expenses.find(
      (e) => e.owner === 'shared' && e.kind === 'base-living',
    )
    if (existingJoint) {
      useHouseholdPlanStore.getState().removeExpense(existingJoint.id)
    }
  }

  // --- Dependents ---
  // On redo, always clear existing dependents first (even if new list is empty)
  if (draft.isRedo) {
    const existingDeps = [...useHouseholdPlanStore.getState().plan.dependents]
    for (const dep of existingDeps) {
      useHouseholdPlanStore.getState().removeDependent(dep.id)
    }
  }
  // Then add from draft
  if (draft.dependents && draft.dependents.length > 0) {
    for (const dep of draft.dependents) {
      useHouseholdPlanStore.getState().addDependent({
        id: createId('dependent'),
        owner: 'shared',
        label: dep.name || 'Dependent',
        relationship: dep.relationship === 'child' ? 'child' : dep.relationship === 'parent' ? 'parent' : 'other',
        currentAge: dep.age,
        timing: null,
        annualCost: 0,
      })
    }
  }
}

// ---------------------------------------------------------------------------
// Property sub-routine
// ---------------------------------------------------------------------------

function applyPropertyDraft(draft: SetupDraft): void {
  // Re-read plan to get latest state (previous updates may have changed it)
  const plan = useHouseholdPlanStore.getState().plan
  const existingProperty = plan.properties.find((p) => p.owner === 'self')

  // Clean up auto-created down payment goal when switching away from 'planning'
  if (draft.ownsProperty !== 'planning') {
    const existingGoal = useHouseholdPlanStore.getState().plan.goals.find(
      (g) => g.label === 'Property Down Payment' && g.owner === 'self'
    )
    if (existingGoal) {
      useHouseholdPlanStore.getState().removeGoal(existingGoal.id)
    }
  }

  if (draft.ownsProperty === 'no') {
    // No property needed — remove seeded property if present
    if (existingProperty) {
      useHouseholdPlanStore.getState().removeProperty(existingProperty.id)
    }
    return
  }

  if (draft.ownsProperty === 'owns') {
    const updates: Partial<PropertyPlan> = {
      ownsProperty: true,
      existingPropertyValue: draft.propertyValue ?? 0,
      existingMortgageBalance: draft.mortgageBalance ?? 0,
      propertyType: draft.propertyType ?? 'condo',
    }

    if (existingProperty) {
      useHouseholdPlanStore.getState().updateProperty(existingProperty.id, updates)
    } else {
      useHouseholdPlanStore.getState().addProperty(buildPropertyEntry('self', updates))
    }
  } else if (draft.ownsProperty === 'planning') {
    const purchasePrice = draft.purchasePrice ?? 1_500_000
    const purchaseYearsFromNow = draft.purchaseYearsFromNow ?? 0
    const updates: Partial<PropertyPlan> = {
      ownsProperty: false,
      purchasePrice,
      purchaseYearsFromNow,
      propertyType: draft.propertyType ?? 'condo',
    }

    if (existingProperty) {
      useHouseholdPlanStore.getState().updateProperty(existingProperty.id, updates)
    } else {
      useHouseholdPlanStore.getState().addProperty(buildPropertyEntry('self', updates))
    }

    // Auto-create a down payment goal so the FIRE timeline accounts for this cash outflow.
    // Down payment = purchasePrice × (1 - LTV). Default LTV is 75%, so 25% down.
    const selfAdult = useHouseholdPlanStore.getState().plan.adults.find((a) => a.owner === 'self')
    if (selfAdult) {
      const downPayment = Math.round(purchasePrice * (1 - DEFAULT_LTV))
      const targetAge = selfAdult.currentAge + purchaseYearsFromNow
      const existingGoal = useHouseholdPlanStore.getState().plan.goals.find(
        (g) => g.label === 'Property Down Payment' && g.owner === 'self'
      )
      if (!existingGoal && downPayment > 0) {
        const goal: GoalItem = {
          id: createId('goal'),
          owner: 'self',
          label: 'Property Down Payment',
          kind: 'financial-goal',
          timing: { kind: 'single-age', owner: 'self', age: targetAge },
          amount: downPayment,
          durationYears: 1,
          priority: 'important',
          inflationAdjusted: true,
          category: 'housing',
        }
        useHouseholdPlanStore.getState().addGoal(goal)
      } else if (existingGoal) {
        // Update existing goal to match revised property details
        useHouseholdPlanStore.getState().updateGoal(existingGoal.id, {
          amount: downPayment,
          timing: { kind: 'single-age', owner: 'self', age: targetAge },
        })
      }
    }
  }
}

function buildPropertyEntry(
  owner: 'self' | 'partner',
  overrides: Partial<PropertyPlan>,
): PropertyPlan {
  return {
    id: createId('property'),
    owner,
    label: 'Primary residence',
    propertyType: 'condo',
    purchasePrice: 1_500_000,
    leaseYears: 99,
    appreciationRate: 0.03,
    rentalYield: 0.03,
    mortgageRate: 0.035,
    mortgageTerm: 25,
    ltv: 0.75, // MAS LTV limit for residential property (75% for first property)
    purchaseYearsFromNow: 0,
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
    downsizing: {
      scenario: 'none',
      sellAge: 65,
      expectedSalePrice: 0,
      newPropertyCost: 0,
      newMortgageRate: 0.035,
      newMortgageTerm: 25,
      newLtv: 0.75,
      monthlyRent: 0,
      rentGrowthRate: 0.03,
    },
    hdbFlatType: '4-room',
    hdbMonetizationStrategy: 'none',
    hdbLbsRetainedLease: 30,
    hdbSublettingRooms: 1,
    hdbSublettingRate: 800,
    hdbCpfUsedForHousing: 0,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Partner sub-routine
// ---------------------------------------------------------------------------

function applyPartnerDraft(draft: SetupDraft, selfAdultTemplate: PlanningAdult): void {
  const partner = draft.partner!
  const partnerGross = resolveGrossIncome(partner.annualIncome, partner.incomeType)

  if (!draft.isRedo) {
    // Fresh path: add partner adult + entries
    const partnerAdult: PlanningAdult = {
      ...structuredClone(selfAdultTemplate),
      id: createId('adult-partner'),
      owner: 'partner',
      displayName: partner.name || 'Partner',
      currentAge: partner.currentAge,
      retirementAge: partner.retirementAge,
      annualIncome: partnerGross,
      annualExpenses: partner.annualExpenses,
      liquidNetWorth: partner.liquidNetWorth,
      residencyStatus: partner.residency,
      lifeEvents: [],
      // Zero out financial fields inherited from self to avoid double-counting
      cashSavings: 0,
      nonMortgageDebtTotal: 0,
      nonMortgageDebtMonthlyPayment: 0,
      insuranceDeathCoverage: 0,
      insuranceCICoverage: 0,
      insuranceDisabilityMonthly: 0,
      funeralCosts: 15_000,
      ciRecoveryYears: 5,
      healthcare: {
        enabled: partner.healthcareEnabled ?? false,
        mediShieldLifeEnabled: true,
        ispTier: (partner.ispTier ?? 'none') as 'none' | 'basic' | 'standard' | 'enhanced',
        careShieldLifeEnabled: false,
        oopBaseAmount: 0,
        oopModel: 'fixed' as const,
        oopInflationRate: 0.03,
        oopReferenceAge: partner.currentAge,
        mediSaveTopUpAnnual: 0,
      },
      taxProfile: {
        ...structuredClone(selfAdultTemplate.taxProfile),
        reliefBasisAge: partner.currentAge,
      },
      cpf: {
        ...structuredClone(selfAdultTemplate.cpf),
        ...(partner.cpfKnown && partner.cpfTotal != null
          ? { balances: splitCpfByAge(partner.cpfTotal, partner.currentAge) }
          : {}),
      },
    }
    useHouseholdPlanStore.getState().addAdult(partnerAdult)

    // Partner salary-model income
    useHouseholdPlanStore.getState().addIncome({
      id: createId('income-salary-partner'),
      owner: 'partner',
      label: `${partner.name || 'Partner'}'s salary`,
      kind: 'salary-model',
      timing: {
        kind: 'age-range',
        owner: 'partner',
        startAge: partner.currentAge,
        endAge: partner.retirementAge,
      },
      annualAmount: partnerGross,
      growthRate: 0.03,
      growthModel: 'fixed',
      taxTreatment: 'taxable',
      isCpfApplicable: true,
      isActive: true,
      streamType: 'employment',
      salaryModel: 'simple',
      bonusMonths: 0,
      employerCpfEnabled: true,
    })

    // Partner base-living expense
    if (partner.annualExpenses > 0) {
      useHouseholdPlanStore.getState().addExpense({
        id: createId('expense-partner-living'),
        owner: 'partner',
        label: `${partner.name || 'Partner'}'s personal expenses`,
        kind: 'base-living',
        timing: {
          kind: 'age-range',
          owner: 'partner',
          startAge: partner.currentAge,
          endAge: null,
        },
        amount: partner.annualExpenses,
        periodicity: 'annual',
        growthModel: 'inflation-linked',
      })
    }

    // Partner liquid net worth asset
    if (partner.liquidNetWorth > 0) {
      useHouseholdPlanStore.getState().addAsset({
        id: createId('asset-partner-liquid'),
        owner: 'partner',
        label: `${partner.name || 'Partner'}'s cash & investments`,
        kind: 'liquid-net-worth',
        amount: partner.liquidNetWorth,
      })
    }
  } else {
    // Redo path: find existing partner adult + entries, update only setup-covered fields
    const existingPlan = useHouseholdPlanStore.getState().plan
    const existingPartner = existingPlan.adults.find((a) => a.owner === 'partner')
    if (!existingPartner) return

    useHouseholdPlanStore.getState().updateAdult(existingPartner.id, {
      displayName: partner.name || 'Partner',
      currentAge: partner.currentAge,
      retirementAge: partner.retirementAge,
      annualIncome: partnerGross,
      annualExpenses: partner.annualExpenses,
      liquidNetWorth: partner.liquidNetWorth,
      residencyStatus: partner.residency,
      healthcare: {
        ...existingPartner.healthcare,
        enabled: partner.healthcareEnabled ?? existingPartner.healthcare.enabled,
        ...(partner.ispTier != null ? { ispTier: partner.ispTier } : {}),
      },
      cpf: {
        ...existingPartner.cpf,
        ...(partner.cpfKnown && partner.cpfTotal != null
          ? { balances: splitCpfByAge(partner.cpfTotal, partner.currentAge) }
          : {}),
      },
    })

    // On redo, zero out partner CPF balances when user says they don't know them (but only for citizens/PRs)
    if (!partner.cpfKnown && partner.residency !== 'foreigner') {
      const refreshedPartner = useHouseholdPlanStore.getState().plan.adults.find((a) => a.owner === 'partner')
      if (refreshedPartner) {
        useHouseholdPlanStore.getState().updateAdult(refreshedPartner.id, {
          cpf: { ...refreshedPartner.cpf, balances: { oa: 0, sa: 0, ma: 0, ra: 0 } },
        })
      }
    }

    // Update partner salary
    const partnerSalary = existingPlan.income.find(
      (e) =>
        e.kind === 'salary-model' &&
        e.owner === 'partner' &&
        e.timing.kind === 'age-range',
    )
    if (partnerSalary && partnerSalary.timing.kind === 'age-range') {
      useHouseholdPlanStore.getState().updateIncome(partnerSalary.id, {
        annualAmount: partnerGross,
        timing: {
          ...partnerSalary.timing,
          startAge: partner.currentAge,
          endAge: partner.retirementAge,
        },
      })
    }

    // Update partner base-living expense
    const partnerExpense = existingPlan.expenses.find(
      (e) =>
        e.kind === 'base-living' &&
        e.owner === 'partner' &&
        e.timing.kind === 'age-range',
    )
    if (partnerExpense) {
      useHouseholdPlanStore.getState().updateExpense(partnerExpense.id, {
        amount: partner.annualExpenses,
      })
    }

    // Update partner liquid-net-worth asset
    const partnerAsset = existingPlan.assets.find(
      (e) => e.kind === 'liquid-net-worth' && e.owner === 'partner',
    )
    if (partnerAsset) {
      useHouseholdPlanStore.getState().updateAsset(partnerAsset.id, {
        amount: partner.liquidNetWorth,
      })
    }
  }
}

// ---------------------------------------------------------------------------
// hydrateSetupFromPlan — extracts simplified values from structured plan
// ---------------------------------------------------------------------------

export function hydrateSetupFromPlan(plan: HouseholdPlan): SetupDraft {
  const self = plan.adults.find((a) => a.owner === 'self')
  if (!self) {
    throw new Error('hydrateSetupFromPlan: no self adult found in plan')
  }

  const selfSalary = plan.income.find(
    (e) => e.kind === 'salary-model' && e.owner === 'self',
  )
  const selfExpense = plan.expenses.find(
    (e) => e.kind === 'base-living' && e.owner === 'self',
  )
  const selfAsset = plan.assets.find(
    (e) => e.kind === 'liquid-net-worth' && e.owner === 'self',
  )

  const cpfTotal =
    self.cpf.balances.oa + self.cpf.balances.sa + self.cpf.balances.ma + self.cpf.balances.ra
  const cpfKnown = cpfTotal > 0

  // Property
  const selfProperty = plan.properties.find((p) => p.owner === 'self')
  let ownsProperty: SetupDraft['ownsProperty'] = 'no'
  let propertyType: SetupDraft['propertyType']
  let propertyValue: number | undefined
  let mortgageBalance: number | undefined
  let purchasePrice: number | undefined
  let purchaseYearsFromNow: number | undefined

  if (selfProperty) {
    propertyType = selfProperty.propertyType
    if (selfProperty.ownsProperty) {
      ownsProperty = 'owns'
      propertyValue = selfProperty.existingPropertyValue
      mortgageBalance = selfProperty.existingMortgageBalance
    } else {
      ownsProperty = 'planning'
      purchasePrice = selfProperty.purchasePrice
      purchaseYearsFromNow = selfProperty.purchaseYearsFromNow
    }
  }

  // Partner
  const partnerAdult = plan.adults.find((a) => a.owner === 'partner')
  let partner: SetupDraft['partner']

  if (partnerAdult) {
    const partnerSalary = plan.income.find(
      (e) => e.kind === 'salary-model' && e.owner === 'partner',
    )
    const partnerExpense = plan.expenses.find(
      (e) => e.kind === 'base-living' && e.owner === 'partner',
    )
    const partnerAsset = plan.assets.find(
      (e) => e.kind === 'liquid-net-worth' && e.owner === 'partner',
    )
    const partnerCpfTotal =
      partnerAdult.cpf.balances.oa +
      partnerAdult.cpf.balances.sa +
      partnerAdult.cpf.balances.ma +
      partnerAdult.cpf.balances.ra

    const partnerIspTier = partnerAdult.healthcare.ispTier === 'standard'
      ? 'enhanced'
      : (partnerAdult.healthcare.ispTier as SetupDraft['ispTier'])

    partner = {
      name: partnerAdult.displayName,
      currentAge: partnerAdult.currentAge,
      retirementAge: partnerAdult.retirementAge,
      annualIncome: partnerSalary?.annualAmount ?? partnerAdult.annualIncome,
      incomeType: 'gross',
      annualExpenses: partnerExpense?.amount ?? partnerAdult.annualExpenses,
      liquidNetWorth: partnerAsset?.amount ?? partnerAdult.liquidNetWorth,
      residency: partnerAdult.residencyStatus,
      cpfKnown: partnerCpfTotal > 0,
      cpfTotal: partnerCpfTotal > 0 ? partnerCpfTotal : undefined,
      healthcareEnabled: partnerAdult.healthcare.enabled,
      ispTier: partnerIspTier,
    }
  }

  // Joint expenses
  const jointExpense = plan.expenses.find(
    (e) => e.owner === 'shared' && e.kind === 'base-living',
  )
  const jointMonthlyExpenses = jointExpense
    ? Math.round(jointExpense.amount / 12)
    : undefined

  // Healthcare
  const healthcareEnabled = self.healthcare.enabled
  const ispTier = self.healthcare.ispTier === 'standard'
    ? 'enhanced' // collapse standard → enhanced for simplified wizard
    : (self.healthcare.ispTier as SetupDraft['ispTier'])

  // Dependents
  const dependents: SetupDraft['dependents'] = plan.dependents.map((d) => ({
    name: d.label,
    age: d.currentAge,
    relationship: d.relationship,
  }))

  return {
    yourName: self.displayName !== 'You' ? self.displayName : undefined,
    currentAge: self.currentAge,
    retirementAge: self.retirementAge,
    annualIncome: selfSalary?.annualAmount ?? self.annualIncome,
    incomeType: 'gross',
    annualExpenses: selfExpense?.amount ?? self.annualExpenses,
    liquidNetWorth: selfAsset?.amount ?? self.liquidNetWorth,
    cashSavings: self.cashSavings > 0 ? self.cashSavings : undefined,
    residency: self.residencyStatus,
    cpfKnown,
    cpfTotal: cpfKnown ? cpfTotal : undefined,
    cpfBreakdown: cpfKnown
      ? { oa: self.cpf.balances.oa, sa: self.cpf.balances.sa, ma: self.cpf.balances.ma, ra: self.cpf.balances.ra }
      : undefined,
    ownsProperty,
    propertyType,
    propertyValue,
    mortgageBalance,
    purchasePrice,
    purchaseYearsFromNow,
    healthcareEnabled,
    ispTier,
    lifeStage: self.lifeStage === 'post-fire' ? 'post-fire' : 'pre-fire',
    retirementPhase: self.cpf.retirementPhase ?? undefined,
    partner,
    jointMonthlyExpenses,
    dependents: dependents.length > 0 ? dependents : undefined,
    isRedo: true,
  }
}
