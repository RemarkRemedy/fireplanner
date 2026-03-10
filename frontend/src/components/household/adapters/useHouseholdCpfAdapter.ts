import { useCallback, useMemo } from 'react'
import type {
  CpfOaWithdrawal,
  IncomeProjectionRow,
  IncomeStream,
  ProfileState,
  ValidationErrors,
} from '@/lib/types'
import { compileHouseholdPlan } from '@/lib/household/compileHouseholdPlan'
import type { HouseholdPlan, PlanningAdult } from '@/lib/household/types'
import { validateProfileField } from '@/lib/validation/schemas'
import { validateProfileConsistency } from '@/lib/validation/rules'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'

type HouseholdCpfFieldMap = Pick<
  ProfileState,
  | 'cpfOA'
  | 'cpfSA'
  | 'cpfMA'
  | 'cpfRA'
  | 'cpfTopUpOA'
  | 'cpfTopUpSA'
  | 'cpfTopUpMA'
  | 'cpfLifeActualMonthlyPayout'
  | 'cpfLifeStartAge'
  | 'cpfLifePlan'
  | 'cpfRetirementSum'
  | 'cpfisEnabled'
  | 'cpfisOaReturn'
  | 'cpfisSaReturn'
  | 'cpfAutoFallback'
  | 'cpfVirtualRebalancing'
  | 'cpfVirtualRebalancingMode'
>

type HouseholdCpfField = keyof HouseholdCpfFieldMap
type HouseholdCpfFieldValue = HouseholdCpfFieldMap[HouseholdCpfField]

const CPF_VALIDATION_FIELDS: HouseholdCpfField[] = [
  'cpfOA',
  'cpfSA',
  'cpfMA',
  'cpfRA',
  'cpfTopUpOA',
  'cpfTopUpSA',
  'cpfTopUpMA',
  'cpfLifeActualMonthlyPayout',
  'cpfLifeStartAge',
  'cpfisOaReturn',
  'cpfisSaReturn',
]

type HouseholdCpfProjectionRow = Pick<IncomeProjectionRow, 'age' | 'cpfLifePayout' | 'cpfOA' | 'cpfSA'>
type HouseholdCpfIncomeStream = Pick<IncomeStream, 'name' | 'type' | 'isActive'> & { id: string }

export interface CpfSectionModel {
  currentAge: number
  annualIncome: number
  cpfOA: number
  cpfSA: number
  cpfMA: number
  cpfRA: number
  cpfLifeStartAge: number
  cpfLifePlan: ProfileState['cpfLifePlan']
  cpfRetirementSum: ProfileState['cpfRetirementSum']
  lifeStage: ProfileState['lifeStage']
  retirementPhase: ProfileState['retirementPhase']
  cpfLifeActualMonthlyPayout: number
  cpfisEnabled: boolean
  cpfisOaReturn: number
  cpfisSaReturn: number
  cpfOaWithdrawals: CpfOaWithdrawal[]
  cpfTopUpOA: number
  cpfTopUpSA: number
  cpfTopUpMA: number
  residencyStatus: ProfileState['residencyStatus']
  prMonths: number
  cpfAutoFallback: boolean
  cpfVirtualRebalancing: boolean
  cpfVirtualRebalancingMode: ProfileState['cpfVirtualRebalancingMode']
  incomeStreams: HouseholdCpfIncomeStream[]
  projection: HouseholdCpfProjectionRow[] | null
  validationErrors: ValidationErrors
  setField: (field: HouseholdCpfField, value: HouseholdCpfFieldValue) => void
  addCpfOaWithdrawal: (entry: CpfOaWithdrawal) => void
  removeCpfOaWithdrawal: (id: string) => void
  updateCpfOaWithdrawal: (id: string, updates: Partial<Omit<CpfOaWithdrawal, 'id'>>) => void
}

function getSelectedAdult(plan: HouseholdPlan, selectedAdultId?: string): PlanningAdult | null {
  if (selectedAdultId) {
    const adult = plan.adults.find((entry) => entry.id === selectedAdultId)
    if (adult) return adult
  }

  return plan.adults.find((entry) => entry.owner === 'self') ?? plan.adults[0] ?? null
}

function getSelectedAdultAnnualIncome(plan: HouseholdPlan, adult: PlanningAdult): number {
  const salaryModel = plan.income.find((entry) => (
    entry.kind === 'salary-model'
    && entry.owner === adult.owner
    && entry.timing.owner === adult.owner
    && entry.isActive !== false
  ))

  return salaryModel?.annualAmount ?? adult.annualIncome
}

function buildValidationSnapshot(adult: PlanningAdult, annualIncome: number): Pick<
  ProfileState,
  | 'currentAge'
  | 'retirementAge'
  | 'lifeExpectancy'
  | 'lifeStage'
  | 'annualIncome'
  | 'cpfOA'
  | 'cpfSA'
  | 'cpfMA'
  | 'cpfRA'
  | 'cpfTopUpOA'
  | 'cpfTopUpSA'
  | 'cpfTopUpMA'
  | 'cpfLifeActualMonthlyPayout'
  | 'cpfLifeStartAge'
  | 'cpfLifePlan'
  | 'cpfRetirementSum'
  | 'cpfisEnabled'
  | 'cpfisOaReturn'
  | 'cpfisSaReturn'
  | 'cpfAutoFallback'
  | 'cpfAutoFallbackIncludeSA'
  | 'cpfVirtualRebalancing'
  | 'cpfVirtualRebalancingMode'
  | 'retirementPhase'
  | 'parentSupportEnabled'
  | 'parentSupport'
  | 'healthcareConfig'
  | 'retirementWithdrawals'
  | 'financialGoals'
  | 'cpfOaWithdrawals'
> & {
  expenseAdjustments: ProfileState['expenseAdjustments']
  lockedAssets: ProfileState['lockedAssets']
} {
  return {
    currentAge: adult.currentAge,
    retirementAge: adult.retirementAge,
    lifeExpectancy: adult.lifeExpectancy,
    lifeStage: adult.lifeStage,
    annualIncome,
    cpfOA: adult.cpf.balances.oa,
    cpfSA: adult.cpf.balances.sa,
    cpfMA: adult.cpf.balances.ma,
    cpfRA: adult.cpf.balances.ra,
    cpfTopUpOA: adult.cpf.annualTopUps.oa,
    cpfTopUpSA: adult.cpf.annualTopUps.sa,
    cpfTopUpMA: adult.cpf.annualTopUps.ma,
    cpfLifeActualMonthlyPayout: adult.cpf.lifeActualMonthlyPayout,
    cpfLifeStartAge: adult.cpf.lifeStartAge,
    cpfLifePlan: adult.cpf.lifePlan,
    cpfRetirementSum: adult.cpf.retirementSum,
    cpfisEnabled: adult.cpf.cpfisEnabled,
    cpfisOaReturn: adult.cpf.cpfisOaReturn,
    cpfisSaReturn: adult.cpf.cpfisSaReturn,
    cpfAutoFallback: adult.cpf.autoFallback,
    cpfAutoFallbackIncludeSA: adult.cpf.autoFallbackIncludeSA,
    cpfVirtualRebalancing: adult.cpf.virtualRebalancing,
    cpfVirtualRebalancingMode: adult.cpf.virtualRebalancingMode,
    retirementPhase: adult.cpf.retirementPhase,
    parentSupportEnabled: adult.parentSupportEnabled,
    parentSupport: [],
    healthcareConfig: adult.healthcare,
    retirementWithdrawals: [],
    financialGoals: [],
    cpfOaWithdrawals: adult.cpf.oaWithdrawals,
    expenseAdjustments: [],
    lockedAssets: [],
  }
}

function buildValidationErrors(adult: PlanningAdult, annualIncome: number): ValidationErrors {
  const snapshot = buildValidationSnapshot(adult, annualIncome)
  const fieldErrors: ValidationErrors = {}

  for (const field of CPF_VALIDATION_FIELDS) {
    const error = validateProfileField(field, snapshot[field])
    if (error) {
      fieldErrors[field] = error
    }
  }

  return {
    ...fieldErrors,
    ...validateProfileConsistency(snapshot),
  }
}

function mapIncomeStreams(plan: HouseholdPlan, adult: PlanningAdult): HouseholdCpfIncomeStream[] {
  return plan.income
    .filter((entry) => (
      entry.kind === 'income-stream'
      && entry.timing.owner === adult.owner
      && (entry.owner === adult.owner || entry.owner === 'shared')
    ))
    .map((entry) => ({
      id: entry.id,
      name: entry.label,
      type: entry.streamType,
      isActive: entry.isActive,
    }))
}

function mapProjection(plan: HouseholdPlan, selectedAdultId: string): HouseholdCpfProjectionRow[] | null {
  try {
    const compiledPlan = compileHouseholdPlan(plan)
    const slot = compiledPlan.cpfByAdultId[selectedAdultId]
    if (!slot) return null

    return slot.rows.map((row) => ({
      age: row.age,
      cpfLifePayout: row.cpfLifePayout,
      cpfOA: row.oaBalance,
      cpfSA: row.saBalance,
    }))
  } catch {
    return null
  }
}

export function useHouseholdCpfAdapter(selectedAdultId?: string): CpfSectionModel | null {
  const plan = useHouseholdPlanStore((state) => state.plan)
  const updateAdult = useHouseholdPlanStore((state) => state.updateAdult)

  const selectedAdult = useMemo(
    () => getSelectedAdult(plan, selectedAdultId),
    [plan, selectedAdultId],
  )

  const annualIncome = useMemo(
    () => (selectedAdult ? getSelectedAdultAnnualIncome(plan, selectedAdult) : 0),
    [plan, selectedAdult],
  )

  const projection = useMemo(
    () => (selectedAdult ? mapProjection(plan, selectedAdult.id) : null),
    [plan, selectedAdult],
  )

  const validationErrors = useMemo(
    () => (selectedAdult ? buildValidationErrors(selectedAdult, annualIncome) : {}),
    [annualIncome, selectedAdult],
  )

  const incomeStreams = useMemo(
    () => (selectedAdult ? mapIncomeStreams(plan, selectedAdult) : []),
    [plan, selectedAdult],
  )

  if (!selectedAdult) {
    return null
  }

  const updateCpf = useCallback((updater: (currentCpf: PlanningAdult['cpf']) => PlanningAdult['cpf']) => {
    const currentPlan = useHouseholdPlanStore.getState().plan
    const currentAdult = getSelectedAdult(currentPlan, selectedAdult.id)
    if (!currentAdult) return
    updateAdult(currentAdult.id, { cpf: updater(currentAdult.cpf) })
  }, [selectedAdult.id, updateAdult])

  const setField = useCallback<CpfSectionModel['setField']>((field, value) => {
    switch (field) {
      case 'cpfOA':
        updateCpf((currentCpf) => ({
          ...currentCpf,
          balances: { ...currentCpf.balances, oa: value as number },
        }))
        return
      case 'cpfSA':
        updateCpf((currentCpf) => ({
          ...currentCpf,
          balances: { ...currentCpf.balances, sa: value as number },
        }))
        return
      case 'cpfMA':
        updateCpf((currentCpf) => ({
          ...currentCpf,
          balances: { ...currentCpf.balances, ma: value as number },
        }))
        return
      case 'cpfRA':
        updateCpf((currentCpf) => ({
          ...currentCpf,
          balances: { ...currentCpf.balances, ra: value as number },
        }))
        return
      case 'cpfTopUpOA':
        updateCpf((currentCpf) => ({
          ...currentCpf,
          annualTopUps: { ...currentCpf.annualTopUps, oa: value as number },
        }))
        return
      case 'cpfTopUpSA':
        updateCpf((currentCpf) => ({
          ...currentCpf,
          annualTopUps: { ...currentCpf.annualTopUps, sa: value as number },
        }))
        return
      case 'cpfTopUpMA':
        updateCpf((currentCpf) => ({
          ...currentCpf,
          annualTopUps: { ...currentCpf.annualTopUps, ma: value as number },
        }))
        return
      case 'cpfLifeActualMonthlyPayout':
        updateCpf((currentCpf) => ({
          ...currentCpf,
          lifeActualMonthlyPayout: value as number,
        }))
        return
      case 'cpfLifeStartAge':
        updateCpf((currentCpf) => ({
          ...currentCpf,
          lifeStartAge: value as number,
        }))
        return
      case 'cpfLifePlan':
        updateCpf((currentCpf) => ({
          ...currentCpf,
          lifePlan: value as ProfileState['cpfLifePlan'],
        }))
        return
      case 'cpfRetirementSum':
        updateCpf((currentCpf) => ({
          ...currentCpf,
          retirementSum: value as ProfileState['cpfRetirementSum'],
        }))
        return
      case 'cpfisEnabled':
        updateCpf((currentCpf) => ({
          ...currentCpf,
          cpfisEnabled: value as boolean,
        }))
        return
      case 'cpfisOaReturn':
        updateCpf((currentCpf) => ({
          ...currentCpf,
          cpfisOaReturn: value as number,
        }))
        return
      case 'cpfisSaReturn':
        updateCpf((currentCpf) => ({
          ...currentCpf,
          cpfisSaReturn: value as number,
        }))
        return
      case 'cpfAutoFallback':
        updateCpf((currentCpf) => ({
          ...currentCpf,
          autoFallback: value as boolean,
        }))
        return
      case 'cpfVirtualRebalancing':
        updateCpf((currentCpf) => ({
          ...currentCpf,
          virtualRebalancing: value as boolean,
        }))
        return
      case 'cpfVirtualRebalancingMode':
        updateCpf((currentCpf) => ({
          ...currentCpf,
          virtualRebalancingMode: value as ProfileState['cpfVirtualRebalancingMode'],
        }))
        return
    }
  }, [updateCpf])

  const addCpfOaWithdrawal = useCallback<CpfSectionModel['addCpfOaWithdrawal']>((entry) => {
    updateCpf((currentCpf) => ({
      ...currentCpf,
      oaWithdrawals: [...currentCpf.oaWithdrawals, { ...entry }],
    }))
  }, [updateCpf])

  const removeCpfOaWithdrawal = useCallback<CpfSectionModel['removeCpfOaWithdrawal']>((id) => {
    updateCpf((currentCpf) => ({
      ...currentCpf,
      oaWithdrawals: currentCpf.oaWithdrawals.filter((entry) => entry.id !== id),
    }))
  }, [updateCpf])

  const updateCpfOaWithdrawal = useCallback<CpfSectionModel['updateCpfOaWithdrawal']>((id, updates) => {
    updateCpf((currentCpf) => ({
      ...currentCpf,
      oaWithdrawals: currentCpf.oaWithdrawals.map((entry) => (
        entry.id === id ? { ...entry, ...updates } : entry
      )),
    }))
  }, [updateCpf])

  return useMemo(() => ({
    currentAge: selectedAdult.currentAge,
    annualIncome,
    cpfOA: selectedAdult.cpf.balances.oa,
    cpfSA: selectedAdult.cpf.balances.sa,
    cpfMA: selectedAdult.cpf.balances.ma,
    cpfRA: selectedAdult.cpf.balances.ra,
    cpfLifeStartAge: selectedAdult.cpf.lifeStartAge,
    cpfLifePlan: selectedAdult.cpf.lifePlan,
    cpfRetirementSum: selectedAdult.cpf.retirementSum,
    lifeStage: selectedAdult.lifeStage,
    retirementPhase: selectedAdult.cpf.retirementPhase,
    cpfLifeActualMonthlyPayout: selectedAdult.cpf.lifeActualMonthlyPayout,
    cpfisEnabled: selectedAdult.cpf.cpfisEnabled,
    cpfisOaReturn: selectedAdult.cpf.cpfisOaReturn,
    cpfisSaReturn: selectedAdult.cpf.cpfisSaReturn,
    cpfOaWithdrawals: selectedAdult.cpf.oaWithdrawals,
    cpfTopUpOA: selectedAdult.cpf.annualTopUps.oa,
    cpfTopUpSA: selectedAdult.cpf.annualTopUps.sa,
    cpfTopUpMA: selectedAdult.cpf.annualTopUps.ma,
    residencyStatus: selectedAdult.residencyStatus,
    prMonths: selectedAdult.prMonths,
    cpfAutoFallback: selectedAdult.cpf.autoFallback,
    cpfVirtualRebalancing: selectedAdult.cpf.virtualRebalancing,
    cpfVirtualRebalancingMode: selectedAdult.cpf.virtualRebalancingMode,
    incomeStreams,
    projection,
    validationErrors,
    setField,
    addCpfOaWithdrawal,
    removeCpfOaWithdrawal,
    updateCpfOaWithdrawal,
  }), [
    addCpfOaWithdrawal,
    annualIncome,
    incomeStreams,
    projection,
    removeCpfOaWithdrawal,
    selectedAdult,
    setField,
    updateCpfOaWithdrawal,
    validationErrors,
  ])
}
