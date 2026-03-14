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
    fields: [
      { name: 'currentAge', label: 'Current age', type: 'number', required: true, validationKey: 'currentAge', tooltip: 'Your age today. Used to calculate years to retirement and CPF projections.' },
      { name: 'retirementAge', label: 'Desired retirement age', type: 'number', required: true, validationKey: 'retirementAge', tooltip: 'The age you plan to stop working. Your portfolio must sustain you from this age onward.' },
      {
        name: 'retirementPhase',
        label: 'Retirement phase',
        type: 'select',
        tooltip: 'Determines CPF withdrawal rules and LIFE payout eligibility based on your current age bracket.',
        options: [
          { value: 'before-55', label: 'Before 55 (pre-CPF LIFE)' },
          { value: '55-to-64', label: '55 to 64 (CPF drawdown phase)' },
          { value: '65-plus', label: '65 and above (CPF LIFE payouts active)' },
        ],
      },
    ],
  },
  // Screen 2a: Income toggle (already-FIRE pathway: income may be optional)
  {
    id: 'income-toggle',
    title: 'Do you still earn income?',
    fields: [
      { name: 'hasIncome', label: 'I still earn employment or business income', type: 'toggle' },
    ],
  },
  // Screen 2b: Income details (skip if hasIncome is false)
  {
    id: 'income',
    title: 'What do you earn?',
    fields: [
      { name: 'annualIncome', label: 'Annual income', type: 'currency', required: true, validationKey: 'annualIncome', tooltip: 'Your total yearly employment income before any deductions.' },
      {
        name: 'incomeType',
        label: 'Income basis',
        type: 'select',
        tooltip: 'Gross = before tax and CPF. Take-home = after deductions. We\'ll estimate gross from take-home if needed.',
        options: [
          { value: 'gross', label: 'Gross (before tax/CPF)' },
          { value: 'take-home', label: 'Take-home (after deductions)' },
        ],
        required: true,
      },
    ],
    skipWhen: { field: 'hasIncome', equals: false },
  },
  // Screen 3: Expenses
  {
    id: 'expenses',
    title: 'What do you spend?',
    fields: [
      { name: 'annualExpenses', label: 'Annual expenses', type: 'currency', required: true, validationKey: 'annualExpenses', tooltip: 'Total yearly spending including rent, food, transport, utilities, and discretionary.', helperText: 'Include all regular spending: rent, food, transport, utilities, subscriptions. You can break it down later.' },
    ],
  },
  // Screen 4: Savings
  {
    id: 'savings',
    title: 'What have you saved?',
    fields: [
      { name: 'liquidNetWorth', label: 'Cash & investments (excl. CPF/property)', type: 'currency', required: true, validationKey: 'liquidNetWorth', tooltip: 'Cash, savings, investments, and fixed deposits you could access. Excludes CPF and property equity.', helperText: 'Include savings accounts, brokerage, fixed deposits. Exclude CPF and your home — those are tracked separately.' },
    ],
  },
  // Screen 5: Residency
  {
    id: 'residency',
    title: 'Are you a Singapore citizen or PR?',
    fields: [
      {
        name: 'residency',
        label: 'Residency status',
        type: 'select',
        tooltip: 'Determines CPF contribution rates, tax treatment, and ABSD rates for property.',
        options: [
          { value: 'citizen', label: 'Singapore Citizen' },
          { value: 'pr', label: 'Permanent Resident (PR)' },
          { value: 'foreigner', label: 'Foreigner' },
        ],
        required: true,
        helperText: 'This determines CPF eligibility and tax treatment.',
      },
    ],
  },
  // Screen 6: CPF (skip if foreigner)
  {
    id: 'cpf',
    title: 'Your CPF',
    fields: [
      { name: 'cpfKnown', label: 'I know my CPF balances', type: 'toggle', tooltip: 'Check my.cpf.gov.sg → My Statement for your balances.', helperText: 'Check my.cpf.gov.sg → My Statement. If you don\'t know, your projection will exclude CPF — you can add it later.' },
      { name: 'cpfTotal', label: 'Total CPF balance (OA + SA + MA)', type: 'currency', validationKey: 'cpfTotal', tooltip: 'Rough total across OA, SA, and MA. We\'ll split it by age-based heuristics. You can refine per-account later.', showWhen: { field: 'cpfKnown', equals: true }, helperText: 'A rough total is fine. You can break it down by account later.' },
    ],
    skipWhen: { field: 'residency', equals: 'foreigner' },
  },
  // Screen 7: Property toggle
  {
    id: 'property-toggle',
    title: 'Do you own property?',
    fields: [
      {
        name: 'ownsProperty',
        label: 'Property status',
        type: 'select',
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
    title: 'Healthcare planning',
    fields: [
      { name: 'healthcareEnabled', label: 'Include healthcare costs in projection', type: 'toggle', tooltip: 'Healthcare costs grow with age and can significantly impact retirement spending.', helperText: 'Healthcare is one of the largest retirement expenses. Including it makes your plan more realistic.' },
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
        type: 'select',
        options: [
          { value: 'citizen', label: 'Singapore Citizen' },
          { value: 'pr', label: 'Permanent Resident' },
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
  currentAge: 30,
  retirementAge: 55,
  retirementPhase: 'before-55',
  hasIncome: true,
  annualIncome: 72000,
  incomeType: 'gross',
  annualExpenses: 48000,
  liquidNetWorth: 50000,
  residency: 'citizen',
  cpfKnown: false,
  cpfTotal: 0,
  ownsProperty: 'no',
  propertyType: 'condo',
  propertyValue: 0,
  mortgageBalance: 0,
  purchasePrice: 1500000,
  purchaseYearsFromNow: 0,
  healthcareEnabled: false,
  ispTier: 'none',
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
  const draft: SetupDraft = {
    currentAge: values.currentAge as number,
    retirementAge: values.retirementAge as number,
    annualIncome: hasIncome ? (values.annualIncome as number) : 0,
    incomeType: hasIncome ? (values.incomeType as 'gross' | 'take-home') : 'gross',
    annualExpenses: values.annualExpenses as number,
    liquidNetWorth: values.liquidNetWorth as number,
    residency: values.residency as 'citizen' | 'pr' | 'foreigner',
    cpfKnown: values.cpfKnown as boolean,
    cpfTotal: values.cpfKnown ? (values.cpfTotal as number) : undefined,
    ownsProperty: values.ownsProperty as 'owns' | 'planning' | 'no',
    propertyType: values.propertyType as 'hdb' | 'condo' | 'landed' | undefined,
    propertyValue: values.ownsProperty === 'owns' ? (values.propertyValue as number) : undefined,
    mortgageBalance: values.ownsProperty === 'owns' ? (values.mortgageBalance as number) : undefined,
    purchasePrice: values.ownsProperty === 'planning' ? (values.purchasePrice as number) : undefined,
    purchaseYearsFromNow: values.ownsProperty === 'planning' ? (values.purchaseYearsFromNow as number) : undefined,
    healthcareEnabled: values.healthcareEnabled as boolean,
    ispTier: values.healthcareEnabled ? (values.ispTier as 'none' | 'basic' | 'enhanced') : undefined,
    lifeStage: 'pre-fire',
    retirementPhase: values.retirementPhase as 'before-55' | '55-to-64' | '65-plus' | undefined,
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
    currentAge: draft.currentAge,
    retirementAge: draft.retirementAge,
    retirementPhase: draft.retirementPhase ?? 'before-55',
    hasIncome: draft.annualIncome > 0,
    annualIncome: draft.annualIncome,
    incomeType: draft.incomeType,
    annualExpenses: draft.annualExpenses,
    liquidNetWorth: draft.liquidNetWorth,
    residency: draft.residency,
    cpfKnown: draft.cpfKnown,
    cpfTotal: draft.cpfTotal ?? 0,
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
      // checkpoint uses category indices (0=income, 1=expenses, etc.) that
      // don't map 1:1 to SCREENS indices. Find the best matching screen.
      const targetIds = ['income-toggle', 'expenses', 'cpf', 'property-toggle', 'healthcare-toggle', 'partner-name']
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

  const isDependentsScreen = currentScreen.id === 'dependents'
  const hasDependents = state.values.hasDependents as boolean
  const dependentsList = (state.values.dependentsList as Array<{ name: string; age: number; relationship: string }>) ?? []

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
      />

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
