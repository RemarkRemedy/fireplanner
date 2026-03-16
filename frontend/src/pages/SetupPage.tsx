import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useNavigate, useSearchParams, useBlocker } from 'react-router-dom'
import { SetupScreen, shouldSkipScreen } from '@/components/setup/SetupScreen'
import { ReviewCheckpoint } from '@/components/setup/ReviewCheckpoint'
import { useUIStore } from '@/stores/useUIStore'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import {
  applySetupDraft,
  hydrateSetupFromPlan,
  type SetupDraft,
} from '@/lib/household/setupDraft'
import type { NudgeFlowScreen } from '@/lib/data/nudgeFlows'
import type { HouseholdPlanType } from '@/lib/household/types'
import type { SectionId } from '@/lib/household/sectionOrder'
import { usePageMeta } from '@/hooks/usePageMeta'
import { trackEvent } from '@/lib/analytics'
import { SetupDraftSchema } from '@/lib/validation/setupDraftSchema'
import { MonthlyIncomeInput, MonthlyExpenseInput } from '@/components/shared/FinancialInputCards'
import { CpfSetupInput } from '@/components/setup/CpfSetupInput'
import { grossUpFromTakeHome } from '@/lib/calculations/grossUp'
import { estimateCpfBalances } from '@/lib/calculations/cpf'
import { SG_EXPENSE_BENCHMARKS } from '@/lib/data/expenseBenchmarks'

// ---------------------------------------------------------------------------
// Screen definitions
// ---------------------------------------------------------------------------

const SCREENS: (NudgeFlowScreen & {
  skipWhen?: { field: string; equals?: string | boolean; notEquals?: string | boolean }
  /** Only show for these plan types. Omit to show for all. */
  planTypes?: HouseholdPlanType[]
})[] = [
  // Screen 1: Age
  {
    id: 'age',
    title: 'How old are you?',
    subtitle: 'We\'ll use this to estimate your savings timeline.',
    fields: [
      { name: 'yourName', label: 'Your name (optional)', type: 'text' },
      { name: 'currentAge', label: 'Current age', type: 'number', required: true, validationKey: 'currentAge', tooltip: 'Your age today. Used to calculate years to retirement and CPF projections.' },
      { name: 'retirementAge', label: 'Desired retirement age', type: 'number', required: true, validationKey: 'retirementAge', tooltip: 'The age you plan to stop working. Your portfolio must sustain you from this age onward.' },
    ],
  },
  // Screen 2: Income (toggle + details in one screen)
  {
    id: 'income',
    title: 'What do you earn?',
    subtitle: 'This helps us project your CPF contributions and savings rate.',
    fields: [
      { name: 'hasIncome', label: 'I earn employment or business income', type: 'toggle' },
      // Income details rendered as custom MonthlyIncomeInput below SetupScreen (see render)
    ],
  },
  // Screen 3: Expenses
  {
    id: 'expenses',
    title: 'What do you spend?',
    subtitle: 'Your spending determines how much you need to retire.',
    fields: [
      // Expenses rendered as custom MonthlyExpenseInput below SetupScreen (see render)
    ],
  },
  // Screen 4: Savings
  {
    id: 'savings',
    title: 'What have you saved?',
    subtitle: 'This is your starting point for the projection.',
    fields: [
      { name: 'liquidNetWorth', label: 'Cash & investments (excl. CPF/property)', type: 'currency', required: true, validationKey: 'liquidNetWorth', tooltip: 'Cash, savings, investments, and fixed deposits you could access. Excludes CPF and property equity.', helperText: 'Include savings accounts, brokerage, fixed deposits. Exclude CPF and your home. Those are tracked separately.' },
    ],
  },
  // Screen 5: Residency
  {
    id: 'residency',
    title: 'Are you a Singapore citizen or PR?',
    subtitle: 'Determines CPF rates and tax treatment.',
    fields: [
      {
        name: 'residency',
        label: 'Residency status',
        type: 'radio-cards',
        tooltip: 'Determines CPF contribution rates, tax treatment, and ABSD rates for property.',
        options: [
          { value: 'citizen', label: 'Singapore Citizen' },
          { value: 'pr', label: 'Permanent Resident (PR)' },
          { value: 'foreigner', label: 'Foreigner' },
        ],
        required: true,
      },
    ],
  },
  // Screen 6: CPF (skip if foreigner) — custom CpfSetupInput handles all fields
  { id: 'cpf', title: 'How much CPF do you have?', subtitle: 'CPF is a major part of your retirement income.', fields: [], skipWhen: { field: 'residency', equals: 'foreigner' } },
  // Screen 7: Property toggle
  {
    id: 'property-toggle',
    title: 'Do you own property?',
    subtitle: 'Property equity can be part of your retirement net worth.',
    fields: [
      {
        name: 'ownsProperty',
        label: 'Property status',
        type: 'radio-cards',
        tooltip: 'Property equity can be a significant part of your retirement net worth.',
        options: [
          { value: 'owns', label: 'I own property' },
          { value: 'planning', label: 'Planning to buy' },
          { value: 'no', label: 'No property' },
        ],
        required: true,
      },
    ],
  },
  // Screen 8a: Property details — current owner (show only when owns)
  {
    id: 'property-details',
    title: 'Your property',
    fields: [
      {
        name: 'propertyType',
        label: 'Property type',
        type: 'select',
        tooltip: 'Affects stamp duty, lease decay (Bala\'s Table for leasehold), and HDB-specific monetization options.',
        options: [
          { value: 'hdb', label: 'HDB' },
          { value: 'condo', label: 'Condo' },
          { value: 'landed', label: 'Landed' },
        ],
      },
      { name: 'propertyValue', label: 'Estimated current value', type: 'currency', validationKey: 'propertyValue', tooltip: 'Current market value estimate. Check recent transactions on HDB or URA for comparable sales.' },
      { name: 'mortgageBalance', label: 'Outstanding mortgage', type: 'currency', validationKey: 'mortgageBalance', tooltip: 'Outstanding loan amount. This reduces your net property equity.' },
    ],
    skipWhen: { field: 'ownsProperty', notEquals: 'owns' },
  },
  // Screen 8b: Property details — planning to buy (show only when planning)
  {
    id: 'property-planning',
    title: 'Your future property',
    fields: [
      {
        name: 'propertyType',
        label: 'Property type',
        type: 'select',
        tooltip: 'Affects stamp duty, lease decay (Bala\'s Table for leasehold), and HDB-specific monetization options.',
        options: [
          { value: 'hdb', label: 'HDB' },
          { value: 'condo', label: 'Condo' },
          { value: 'landed', label: 'Landed' },
        ],
      },
      { name: 'purchasePrice', label: 'Expected purchase price', type: 'currency', validationKey: 'purchasePrice', tooltip: 'Expected price of the property you plan to buy.' },
      { name: 'purchaseYearsFromNow', label: 'Years until purchase', type: 'number', tooltip: 'How many years until you expect to complete the purchase.' },
    ],
    skipWhen: { field: 'ownsProperty', notEquals: 'planning' },
  },
  // Screen 9: Healthcare toggle
  {
    id: 'healthcare-toggle',
    title: 'Should we include healthcare costs?',
    subtitle: 'Healthcare costs grow with age and can significantly affect retirement spending.',
    fields: [
      { name: 'healthcareEnabled', label: 'Include healthcare costs in projection', type: 'toggle', tooltip: 'Healthcare costs grow with age and can significantly impact retirement spending.', helperText: 'We\'ve included basic healthcare costs. You can adjust the tier or disable this.' },
    ],
  },
  // Screen 10: Healthcare details (skip if disabled)
  {
    id: 'healthcare-details',
    title: 'Healthcare basics',
    fields: [
      {
        name: 'ispTier',
        label: 'Integrated Shield Plan tier',
        type: 'select',
        tooltip: 'Determines hospital ward class coverage. Higher tiers = higher premiums but lower out-of-pocket costs.',
        helperText: 'Your ISP tier determines hospital ward class coverage and premium costs.',
        options: [
          { value: 'none', label: 'None (MediShield Life only)' },
          { value: 'basic', label: 'Basic (Class B1 ward)' },
          { value: 'standard', label: 'Standard (Class A ward)' },
          { value: 'enhanced', label: 'Enhanced (Private hospital)' },
        ],
      },
    ],
    skipWhen: { field: 'healthcareEnabled', equals: false },
  },
  // Screens 11-15: Partner screens (couple/household only)
  {
    id: 'partner-name',
    title: "Your partner's details",
    fields: [
      { name: 'partnerName', label: "Partner's name", type: 'text' },
      { name: 'partnerAge', label: "Partner's current age", type: 'number', required: true, validationKey: 'partnerAge', tooltip: "Partner's current age." },
      { name: 'partnerRetirementAge', label: "Partner's retirement age", type: 'number', required: true, validationKey: 'partnerRetirementAge', tooltip: 'The age your partner plans to stop working.' },
    ],
    planTypes: ['couple', 'household'],
  },
  {
    id: 'partner-income',
    title: "Partner's income",
    fields: [
      { name: 'partnerIncome', label: 'Annual income', type: 'currency', required: true, validationKey: 'partnerIncome', tooltip: "Partner's total yearly employment income." },
      {
        name: 'partnerIncomeType',
        label: 'Income basis',
        type: 'select',
        options: [
          { value: 'gross', label: 'Gross' },
          { value: 'take-home', label: 'Take-home' },
        ],
        required: true,
      },
    ],
    planTypes: ['couple', 'household'],
  },
  {
    id: 'partner-expenses',
    title: "Partner's expenses & savings",
    fields: [
      { name: 'partnerExpenses', label: 'Annual personal expenses', type: 'currency', required: true, validationKey: 'partnerExpenses', tooltip: "Partner's personal annual expenses (not shared household costs)." },
      { name: 'partnerNetWorth', label: 'Cash & investments', type: 'currency', required: true, validationKey: 'partnerNetWorth', tooltip: "Partner's personal cash and investments (excluding CPF and property)." },
    ],
    planTypes: ['couple', 'household'],
  },
  {
    id: 'partner-residency',
    title: "Partner's residency & CPF",
    fields: [
      {
        name: 'partnerResidency',
        label: 'Residency status',
        type: 'radio-cards',
        options: [
          { value: 'citizen', label: 'Singapore Citizen' },
          { value: 'pr', label: 'Permanent Resident (PR)' },
          { value: 'foreigner', label: 'Foreigner' },
        ],
        required: true,
      },
      { name: 'partnerCpfKnown', label: 'Partner knows CPF balance', type: 'toggle', tooltip: "Check partner's CPF statement at my.cpf.gov.sg.", helperText: 'If unknown, the projection will exclude their CPF.' },
      { name: 'partnerCpfTotal', label: 'Total CPF balance', type: 'currency', validationKey: 'partnerCpfTotal', tooltip: "Partner's total CPF across all accounts.", showWhen: { field: 'partnerCpfKnown', equals: true } },
    ],
    planTypes: ['couple', 'household'],
  },
  {
    id: 'partner-joint',
    title: 'Joint expenses',
    fields: [
      { name: 'jointMonthlyExpenses', label: 'Additional shared monthly expenses', type: 'currency', tooltip: 'Additional shared costs like housing, utilities, and groceries beyond individual expenses.' },
    ],
    planTypes: ['couple', 'household'],
  },
  // Screen 15: Dependents (couple/household only)
  // This screen uses a custom renderer — the static fields are just the toggle.
  // The dynamic dependent list is handled by SetupPage's DependentsList component.
  {
    id: 'dependents',
    title: 'Do you have dependents?',
    fields: [
      { name: 'hasDependents', label: 'I have dependents (children, elderly parents, etc.)', type: 'toggle', tooltip: 'Children, elderly parents, or others you financially support.', helperText: 'Children, elderly parents, or anyone you financially support.' },
    ],
    planTypes: ['couple', 'household'],
  },
]

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

interface SetupState {
  screenIndex: number
  values: Record<string, unknown>
}

type SetupAction =
  | { type: 'SET_FIELD'; field: string; value: unknown }
  | { type: 'GO_TO'; index: number }
  | { type: 'HYDRATE'; values: Record<string, unknown> }

function setupReducer(state: SetupState, action: SetupAction): SetupState {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, values: { ...state.values, ...{ [action.field]: action.value } } }
    case 'GO_TO':
      return { ...state, screenIndex: action.index }
    case 'HYDRATE':
      return { ...state, values: { ...state.values, ...action.values } }
    default:
      return state
  }
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const INITIAL_VALUES: Record<string, unknown> = {
  yourName: '',
  currentAge: 30,
  retirementAge: 55,
  retirementPhase: 'before-55',
  hasIncome: true,
  incomeType: 'take-home' as 'take-home' | 'gross',
  monthlyIncome: 4800,
  hasBonusAws: false,
  bonusMonths: 1,
  monthlyExpenses: 2500,
  liquidNetWorth: 50000,
  residency: 'citizen',
  cpfKnown: false,
  cpfMode: 'estimate',
  cpfEntryMode: 'total',
  cpfTotal: 0,
  cpfOA: 0,
  cpfSA: 0,
  cpfMA: 0,
  cpfRA: 0,
  usedOaForMortgage: false,
  oaMortgageAmount: 0,
  ownsProperty: 'no',
  propertyType: 'condo',
  propertyValue: 0,
  mortgageBalance: 0,
  purchasePrice: 1500000,
  purchaseYearsFromNow: 0,
  healthcareEnabled: true,
  ispTier: 'basic',
  // Partner defaults
  partnerName: '',
  partnerAge: 30,
  partnerRetirementAge: 55,
  partnerIncome: 72000,
  partnerIncomeType: 'gross',
  partnerExpenses: 48000,
  partnerNetWorth: 50000,
  partnerResidency: 'citizen',
  partnerCpfKnown: false,
  partnerCpfTotal: 0,
  jointMonthlyExpenses: 0,
  // Dependents defaults
  hasDependents: false,
  dependentsList: [] as Array<{ name: string; age: number; relationship: string }>,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function draftFromValues(values: Record<string, unknown>, planType: HouseholdPlanType, isRedo: boolean): SetupDraft {
  const hasIncome = values.hasIncome !== false
  const age = values.currentAge as number
  const monthlyIncome = hasIncome ? (values.monthlyIncome as number) : 0
  const incomeType = (values.incomeType as 'take-home' | 'gross') ?? 'take-home'
  const bonusMonths = (values.hasBonusAws ? (values.bonusMonths as number) : 0) ?? 0
  // grossUpFromTakeHome handles the take-home → gross conversion
  const grossMonthly = incomeType === 'take-home'
    ? grossUpFromTakeHome(monthlyIncome, age)
    : monthlyIncome
  const income = Math.round(grossMonthly * (12 + bonusMonths))

  // M1: Auto-derive retirement phase from age
  const retirementPhase: 'before-55' | '55-to-64' | '65-plus' =
    age >= 65 ? '65-plus' : age >= 55 ? '55-to-64' : 'before-55'

  // CPF: 3 modes — estimate, know/total, know/breakdown
  const cpfKnown = true
  let cpfTotal: number | undefined
  let cpfBreakdown: { oa: number; sa: number; ma: number; ra: number } | undefined
  const cpfMode = values.cpfMode as 'estimate' | 'know'
  if (cpfMode === 'estimate' || !cpfMode) {
    // Estimate mode — recompute using estimateCpfBalances
    const oaMortgage = values.usedOaForMortgage ? (values.oaMortgageAmount as number) : undefined
    const estimateResult = estimateCpfBalances(
      age, income, values.residency as 'citizen' | 'pr' | 'foreigner', undefined, oaMortgage,
    )
    cpfTotal = estimateResult.total
    cpfBreakdown = { oa: estimateResult.oa, sa: estimateResult.sa, ma: estimateResult.ma, ra: estimateResult.ra }
  } else {
    // Know mode — always breakdown (sub-toggle removed)
    const oa = (values.cpfOA as number) ?? 0
    const sa = (values.cpfSA as number) ?? 0
    const ma = (values.cpfMA as number) ?? 0
    const ra = (values.cpfRA as number) ?? 0
    cpfTotal = oa + sa + ma + ra
    cpfBreakdown = { oa, sa, ma, ra }
  }

  const draft: SetupDraft = {
    yourName: (values.yourName as string) || undefined,
    currentAge: age,
    retirementAge: values.retirementAge as number,
    annualIncome: income,
    incomeType: 'gross', // always gross — take-home conversion done above via grossUpFromTakeHome
    annualExpenses: (values.monthlyExpenses as number) * 12,
    liquidNetWorth: values.liquidNetWorth as number,
    residency: values.residency as 'citizen' | 'pr' | 'foreigner',
    cpfKnown,
    cpfTotal,
    cpfBreakdown,
    ownsProperty: values.ownsProperty as 'owns' | 'planning' | 'no',
    propertyType: values.propertyType as 'hdb' | 'condo' | 'landed' | undefined,
    propertyValue: values.ownsProperty === 'owns' ? (values.propertyValue as number) : undefined,
    mortgageBalance: values.ownsProperty === 'owns' ? (values.mortgageBalance as number) : undefined,
    purchasePrice: values.ownsProperty === 'planning' ? (values.purchasePrice as number) : undefined,
    purchaseYearsFromNow: values.ownsProperty === 'planning' ? (values.purchaseYearsFromNow as number) : undefined,
    healthcareEnabled: values.healthcareEnabled as boolean,
    ispTier: values.healthcareEnabled ? (values.ispTier as 'none' | 'basic' | 'enhanced') : undefined,
    lifeStage: 'pre-fire',
    retirementPhase,
    isRedo,
  }

  if (planType !== 'individual') {
    draft.partner = {
      name: values.partnerName as string,
      currentAge: values.partnerAge as number,
      retirementAge: values.partnerRetirementAge as number,
      annualIncome: values.partnerIncome as number,
      incomeType: values.partnerIncomeType as 'gross' | 'take-home',
      annualExpenses: values.partnerExpenses as number,
      liquidNetWorth: values.partnerNetWorth as number,
      residency: values.partnerResidency as 'citizen' | 'pr' | 'foreigner',
      cpfKnown: values.partnerCpfKnown as boolean,
      cpfTotal: values.partnerCpfKnown ? (values.partnerCpfTotal as number) : undefined,
    }
    draft.jointMonthlyExpenses = values.jointMonthlyExpenses as number

    // Dependents (screen 15)
    if (values.hasDependents) {
      const list = values.dependentsList as Array<{ name: string; age: number; relationship: string }> | undefined
      if (list && list.length > 0) {
        draft.dependents = list.filter(d => d.name || d.age > 0)
      }
    }
  }

  return draft
}

function hydrateDraftToValues(draft: SetupDraft): Record<string, unknown> {
  const values: Record<string, unknown> = {
    yourName: draft.yourName ?? '',
    currentAge: draft.currentAge,
    retirementAge: draft.retirementAge,
    retirementPhase: draft.retirementPhase ?? 'before-55',
    hasIncome: draft.annualIncome > 0,
    incomeType: draft.incomeType === 'take-home' ? 'take-home' : 'gross',
    monthlyIncome: Math.round(draft.annualIncome / 12),
    hasBonusAws: false,
    bonusMonths: 1,
    monthlyExpenses: Math.round(draft.annualExpenses / 12),
    liquidNetWorth: draft.liquidNetWorth,
    residency: draft.residency,
    cpfKnown: draft.cpfKnown,
    cpfMode: (draft.cpfTotal ?? 0) > 0 ? 'know' : 'estimate',
    cpfEntryMode: draft.cpfBreakdown ? 'breakdown' : 'total',
    cpfTotal: draft.cpfTotal ?? 0,
    cpfOA: draft.cpfBreakdown?.oa ?? 0,
    cpfSA: draft.cpfBreakdown?.sa ?? 0,
    cpfMA: draft.cpfBreakdown?.ma ?? 0,
    cpfRA: draft.cpfBreakdown?.ra ?? 0,
    usedOaForMortgage: false,
    oaMortgageAmount: 0,
    ownsProperty: draft.ownsProperty,
    propertyType: draft.propertyType ?? 'condo',
    propertyValue: draft.propertyValue ?? 0,
    mortgageBalance: draft.mortgageBalance ?? 0,
    purchasePrice: draft.purchasePrice ?? 1500000,
    purchaseYearsFromNow: draft.purchaseYearsFromNow ?? 0,
    healthcareEnabled: draft.healthcareEnabled,
    ispTier: draft.ispTier ?? 'none',
  }

  if (draft.partner) {
    values.partnerName = draft.partner.name
    values.partnerAge = draft.partner.currentAge
    values.partnerRetirementAge = draft.partner.retirementAge
    values.partnerIncome = draft.partner.annualIncome
    values.partnerIncomeType = draft.partner.incomeType
    values.partnerExpenses = draft.partner.annualExpenses
    values.partnerNetWorth = draft.partner.liquidNetWorth
    values.partnerResidency = draft.partner.residency
    values.partnerCpfKnown = draft.partner.cpfKnown
    values.partnerCpfTotal = draft.partner.cpfTotal ?? 0
  }

  if (draft.jointMonthlyExpenses != null) {
    values.jointMonthlyExpenses = draft.jointMonthlyExpenses
  }

  return values
}

/** Sections that the setup wizard populates. */
function derivePopulatedSections(values: Record<string, unknown>): SectionId[] {
  const sections: SectionId[] = [
    'section-personal',
    'section-income',
    'section-expenses',
    'section-net-worth',
  ]
  if (values.residency !== 'foreigner') {
    sections.push('section-cpf')
  }
  if (values.ownsProperty !== 'no') {
    sections.push('section-property')
  }
  if (values.healthcareEnabled) {
    sections.push('section-healthcare')
  }
  return sections
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SetupPage() {
  usePageMeta({
    title: 'Setup - SG FIRE Planner',
    description: 'Guided setup for your Singapore FIRE plan.',
    path: '/setup',
  })

  const navigate = useNavigate()
  const [validationError, setValidationError] = useState<string | null>(null)
  const [searchParams] = useSearchParams()
  const planType = (searchParams.get('planType') ?? 'individual') as HouseholdPlanType
  const isRedo = searchParams.get('redo') === 'true'
  const sectionOrder = useUIStore((s) => s.sectionOrder)
  const setUIField = useUIStore((s) => s.setField)

  // Filter screens by plan type
  const visibleScreenDefs = useMemo(
    () => SCREENS.filter((s) => !s.planTypes || s.planTypes.includes(planType)),
    [planType],
  )

  const [state, dispatch] = useReducer(setupReducer, {
    screenIndex: 0,
    values: { ...INITIAL_VALUES },
  })

  // Hydrate from existing plan on redo
  useEffect(() => {
    if (!isRedo) return
    try {
      const plan = useHouseholdPlanStore.getState().plan
      const existing = hydrateSetupFromPlan(plan)
      dispatch({ type: 'HYDRATE', values: hydrateDraftToValues(existing) })
    } catch {
      // No existing plan to hydrate from — use defaults
    }
  }, [isRedo])

  // Compute active (non-skipped) screen indices
  const activeScreenIndices = useMemo(
    () =>
      visibleScreenDefs
        .map((screen, i) => ({ screen, i }))
        .filter(({ screen }) => !shouldSkipScreen(screen, state.values))
        .map(({ i }) => i),
    [visibleScreenDefs, state.values],
  )

  const currentActivePosition = activeScreenIndices.indexOf(state.screenIndex)
  const isReview = currentActivePosition === -1 && state.screenIndex >= visibleScreenDefs.length
  const totalSteps = activeScreenIndices.length

  const handleChange = useCallback((field: string, value: unknown) => {
    dispatch({ type: 'SET_FIELD', field, value })
  }, [])

  const handleNext = useCallback(() => {
    const currentPos = activeScreenIndices.indexOf(state.screenIndex)
    if (currentPos < activeScreenIndices.length - 1) {
      // Go to next non-skipped screen
      dispatch({ type: 'GO_TO', index: activeScreenIndices[currentPos + 1] })
    } else {
      // Last screen -> go to review
      dispatch({ type: 'GO_TO', index: visibleScreenDefs.length })
    }
  }, [activeScreenIndices, state.screenIndex, visibleScreenDefs.length])

  const handleBack = useCallback(() => {
    const currentPos = activeScreenIndices.indexOf(state.screenIndex)
    if (currentPos > 0) {
      dispatch({ type: 'GO_TO', index: activeScreenIndices[currentPos - 1] })
    }
  }, [activeScreenIndices, state.screenIndex])

  const handleEdit = useCallback(
    (screenIndex: number) => {
      // Map review category screenIndex to a visible screen. The review
      // checkpoint uses category indices (0=age, 1=income, 2=expenses, etc.)
      // that don't map 1:1 to SCREENS indices. Find the best matching screen.
      const targetIds = ['age', 'income', 'expenses', 'cpf', 'property-toggle', 'healthcare-toggle', 'partner-name']
      const targetId = targetIds[screenIndex]
      const targetIndex = visibleScreenDefs.findIndex((s) => s.id === targetId)
      const resolvedIndex = targetIndex !== -1 ? targetIndex : 0

      // Walk back to the nearest non-skipped screen to avoid landing on a skipped screen
      let safeIndex = resolvedIndex
      while (safeIndex >= 0 && !activeScreenIndices.includes(safeIndex)) {
        safeIndex--
      }
      if (safeIndex >= 0) {
        dispatch({ type: 'GO_TO', index: safeIndex })
      } else {
        dispatch({ type: 'GO_TO', index: activeScreenIndices[0] ?? 0 })
      }
    },
    [visibleScreenDefs, activeScreenIndices],
  )

  const completingRef = useRef(false)

  const handleConfirm = useCallback(() => {
    const draft = draftFromValues(state.values, planType, isRedo)

    // Validate core fields before applying
    const parseResult = SetupDraftSchema.safeParse(draft)
    if (!parseResult.success) {
      setValidationError('Please check your inputs: ' + parseResult.error.issues.map(i => i.message).join(', '))
      return
    }
    setValidationError(null)

    // Already-fire pathway: override life stage and retirement age
    if (sectionOrder === 'already-fire') {
      draft.lifeStage = 'post-fire'
      draft.retirementAge = draft.currentAge
    }

    applySetupDraft(draft, planType)

    // Mark setup as completed in UIStore
    setUIField('setupCompleted', true)
    setUIField('setupPopulatedSections', derivePopulatedSections(state.values))

    // Disable blocker before navigating
    completingRef.current = true
    trackEvent('setup_completed', { planType, isRedo, pathway: sectionOrder })
    // Store flag so the projection page can show a welcome orientation
    sessionStorage.setItem('fireplanner-setup-just-completed', '1')
    navigate('/projection')
  }, [state.values, planType, isRedo, sectionOrder, setUIField, navigate])

  // SPA navigation guard for couple/household flows with progress
  // Disabled when completing setup (navigating to /projection intentionally)
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      !completingRef.current &&
      planType !== 'individual' &&
      state.screenIndex > 0 &&
      currentLocation.pathname !== nextLocation.pathname
  )

  useEffect(() => {
    if (blocker.state === 'blocked') {
      const confirmed = window.confirm('Are you sure? Your progress will be lost.')
      if (confirmed) blocker.proceed()
      else blocker.reset()
    }
  }, [blocker])

  // Abandonment guard for couple flows (browser refresh/close)
  useEffect(() => {
    if (planType === 'individual') return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = '' // Required by Chrome/Firefox
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [planType])

  // CPF estimate — must be above all early returns (React hooks rule)
  const cpfEstimate = useMemo(() => {
    const age = (state.values.currentAge as number) ?? 30
    const monthlyInc = (state.values.monthlyIncome as number) ?? 0
    const incType = (state.values.incomeType as 'take-home' | 'gross') ?? 'take-home'
    const grossMo = incType === 'take-home' ? grossUpFromTakeHome(monthlyInc, age) : monthlyInc
    const bonus = (state.values.hasBonusAws ? (state.values.bonusMonths as number) : 0) ?? 0
    const grossAnnual = grossMo * (12 + bonus)
    const residency = (state.values.residency as 'citizen' | 'pr' | 'foreigner') ?? 'citizen'
    const oaMortgage = state.values.usedOaForMortgage ? (state.values.oaMortgageAmount as number) : undefined
    return estimateCpfBalances(age, grossAnnual, residency, undefined, oaMortgage)
  }, [state.values.currentAge, state.values.monthlyIncome, state.values.incomeType, state.values.hasBonusAws, state.values.bonusMonths, state.values.residency, state.values.usedOaForMortgage, state.values.oaMortgageAmount])

  // Review screen
  if (isReview) {
    const draft = draftFromValues(state.values, planType, isRedo)
    return (
      <ReviewCheckpoint
        draft={draft}
        onConfirm={handleConfirm}
        onEdit={handleEdit}
        validationError={validationError}
      />
    )
  }

  // Normal screen
  const currentScreen = visibleScreenDefs[state.screenIndex]
  if (!currentScreen) {
    // Safety: shouldn't happen
    return null
  }

  const isFirstScreen = currentActivePosition === 0

  const isIncomeScreen = currentScreen.id === 'income'
  const isExpensesScreen = currentScreen.id === 'expenses'
  const isCpfScreen = currentScreen.id === 'cpf'
  const isDependentsScreen = currentScreen.id === 'dependents'
  const hasDependents = state.values.hasDependents as boolean
  const dependentsList = (state.values.dependentsList as Array<{ name: string; age: number; relationship: string }>) ?? []

  const isAgeScreen = currentScreen.id === 'age'

  // Build custom children for screens that need compound inputs
  const customChildren = (() => {
    if (isAgeScreen) {
      const age = (state.values.currentAge as number) ?? 30
      const retAge = (state.values.retirementAge as number) ?? 55
      const yearsToGo = retAge - age
      if (yearsToGo > 0) {
        return (
          <p className="text-sm text-muted-foreground text-center">
            {yearsToGo} years to go. Let&apos;s make them count.
          </p>
        )
      }
      return null
    }
    if (isIncomeScreen && state.values.hasIncome) {
      const monthlyInc = (state.values.monthlyIncome as number) ?? 0
      const incType = (state.values.incomeType as 'take-home' | 'gross') ?? 'take-home'
      const age = (state.values.currentAge as number) ?? 30
      const grossMo = incType === 'take-home' ? grossUpFromTakeHome(monthlyInc, age) : monthlyInc
      const bonus = (state.values.hasBonusAws ? (state.values.bonusMonths as number) : 0) ?? 0
      return (
        <MonthlyIncomeInput
          incomeType={incType}
          onIncomeTypeChange={(type) => handleChange('incomeType', type)}
          monthlyIncome={monthlyInc}
          onMonthlyIncomeChange={(v) => handleChange('monthlyIncome', v)}
          hasBonusAws={(state.values.hasBonusAws as boolean) ?? false}
          onHasBonusAwsChange={(v) => handleChange('hasBonusAws', v)}
          bonusMonths={(state.values.bonusMonths as number) ?? 1}
          onBonusMonthsChange={(v) => handleChange('bonusMonths', v)}
          grossMonthly={grossMo}
          annualIncome={Math.round(grossMo * (12 + bonus))}
          age={age}
        />
      )
    }
    if (isExpensesScreen) {
      return (
        <>
          <MonthlyExpenseInput
            monthlyExpenses={(state.values.monthlyExpenses as number) ?? 0}
            onMonthlyExpensesChange={(v) => handleChange('monthlyExpenses', v)}
            annualExpenses={((state.values.monthlyExpenses as number) ?? 0) * 12}
          />
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              Not sure? Here are typical ranges
            </summary>
            <div className="mt-2 space-y-1 text-muted-foreground pl-1">
              {SG_EXPENSE_BENCHMARKS.map((b) => (
                <p key={b.label}>{b.label}: {b.range}</p>
              ))}
              <p className="mt-2 text-xs italic">A rough estimate works fine. You can refine it later.</p>
            </div>
          </details>
        </>
      )
    }
    if (currentScreen.id === 'savings') {
      return (
        <details className="mt-1 text-sm">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            Help me add it up
          </summary>
          <div className="mt-2 space-y-1 text-muted-foreground pl-1">
            <p>Add together your:</p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>Bank savings and current accounts</li>
              <li>Stocks, ETFs, and brokerage balances</li>
              <li>Fixed deposits and bonds</li>
              <li>Robo-advisor balances (Endowus, Syfe, etc.)</li>
            </ul>
            <p className="mt-2 text-xs italic">Don&apos;t include CPF or property value.</p>
          </div>
        </details>
      )
    }
    if (isCpfScreen) {
      return (
        <CpfSetupInput
          age={(state.values.currentAge as number) ?? 30}
          showRA={((state.values.currentAge as number) ?? 30) >= 55}
          mode={(state.values.cpfMode as 'estimate' | 'know') ?? 'estimate'}
          onModeChange={(m) => handleChange('cpfMode', m)}
          estimate={{ total: cpfEstimate.total, split: cpfEstimate }}
          mortgage={{
            used: (state.values.usedOaForMortgage as boolean) ?? false,
            amount: (state.values.oaMortgageAmount as number) ?? 0,
          }}
          onMortgageChange={(m) => {
            handleChange('usedOaForMortgage', m.used)
            handleChange('oaMortgageAmount', m.amount)
          }}
          manual={{
            entryMode: 'breakdown',
            total: 0,
            oa: (state.values.cpfOA as number) ?? 0,
            sa: (state.values.cpfSA as number) ?? 0,
            ma: (state.values.cpfMA as number) ?? 0,
            ra: (state.values.cpfRA as number) ?? 0,
          }}
          onManualChange={(updates) => {
            if (updates.entryMode !== undefined) handleChange('cpfEntryMode', updates.entryMode)
            if (updates.total !== undefined) handleChange('cpfTotal', updates.total)
            if (updates.oa !== undefined) handleChange('cpfOA', updates.oa)
            if (updates.sa !== undefined) handleChange('cpfSA', updates.sa)
            if (updates.ma !== undefined) handleChange('cpfMA', updates.ma)
            if (updates.ra !== undefined) handleChange('cpfRA', updates.ra)
          }}
        />
      )
    }
    return null
  })()

  return (
    <div className="flex flex-col gap-6">
      <SetupScreen
        screen={currentScreen}
        values={state.values}
        onChange={handleChange}
        onNext={handleNext}
        onBack={isFirstScreen ? undefined : handleBack}
        currentStep={currentActivePosition + 1}
        totalSteps={totalSteps}
        submitLabel={
          currentActivePosition === totalSteps - 1 ? 'Review your answers' : 'Continue'
        }
      >
        {customChildren}
      </SetupScreen>

      {/* Dynamic dependents list — rendered below SetupScreen when on dependents screen */}
      {isDependentsScreen && hasDependents && (
        <div className="flex flex-col gap-4 -mt-2">
          {dependentsList.map((dep, i) => (
            <div key={i} className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Dependent {i + 1}</p>
                <button
                  type="button"
                  className="text-xs text-destructive hover:underline"
                  onClick={() => {
                    const updated = dependentsList.filter((_, j) => j !== i)
                    handleChange('dependentsList', updated)
                  }}
                >
                  Remove
                </button>
              </div>
              <div className="space-y-2">
                <label className="text-sm">Name</label>
                <input
                  type="text"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={dep.name}
                  onChange={(e) => {
                    const updated = [...dependentsList]
                    updated[i] = { ...dep, name: e.target.value }
                    handleChange('dependentsList', updated)
                  }}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm">Age</label>
                <input
                  type="number"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={dep.age}
                  onChange={(e) => {
                    const updated = [...dependentsList]
                    updated[i] = { ...dep, age: parseInt(e.target.value) || 0 }
                    handleChange('dependentsList', updated)
                  }}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm">Relationship</label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={dep.relationship}
                  onChange={(e) => {
                    const updated = [...dependentsList]
                    updated[i] = { ...dep, relationship: e.target.value }
                    handleChange('dependentsList', updated)
                  }}
                >
                  <option value="child">Child</option>
                  <option value="parent">Parent</option>
                  <option value="sibling">Sibling</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
          ))}
          <button
            type="button"
            className="w-full rounded-md border border-dashed border-muted-foreground/40 py-2 text-sm text-muted-foreground hover:bg-muted/50"
            onClick={() => {
              handleChange('dependentsList', [
                ...dependentsList,
                { name: '', age: 0, relationship: 'child' },
              ])
            }}
          >
            + Add dependent
          </button>
        </div>
      )}
    </div>
  )
}
