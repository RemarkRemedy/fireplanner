import { toFiniteNumber } from '@/lib/companion/utils'
import type {
  ImportedHouseholdPlan,
  ImportedPlanDetectedMember,
  ImportedPlanMemberRole,
  ImportedPlanReview,
  PlannerSnapshotResponse,
} from '@/lib/companion/types'
import {
  createDefaultLegacyIndividualSnapshot,
  fromLegacyIndividual,
  type LegacyIndividualSnapshot,
} from './fromLegacyIndividual'
import { createId } from './ids'
import type {
  AssetItem,
  Dependent,
  EntryOwner,
  ExpenseItem,
  HouseholdPlan,
  IncomeSource,
  PlanningAdult,
} from './types'

type ParsedImportedMember = {
  id: string
  label: string
  role: ImportedPlanMemberRole
  age: number | null
  retirementAge: number | null
  lifeExpectancy: number | null
  annualIncome: number | null
  annualExpense: number | null
  annualCost: number | null
  liquidNetWorth: number | null
  relationship: Dependent['relationship']
}

const MONTHS_PER_YEAR = 12
const PARTNER_ADULT_ID = 'adult-partner'
const LOCAL_EDITABILITY_NOTE =
  'Imported plans are local Fireplanner copies. You can redistribute owners, edit fields, and keep planning here without syncing changes back to Expense.'
const KNOWN_SNAPSHOT_KEYS = new Set([
  'schemaVersion',
  'monthKey',
  'structuralMode',
  'emotionalMode',
  'avgMonthlyIncome',
  'avgMonthlyExpense',
  'avgMonthlySavings',
  'investableAssets',
  'annualWithdrawal',
  'fitness',
  'safeToSpend',
  'profile',
  'withdrawalProbabilitySuccess',
  'withdrawalCriticalRate50',
  'deterministicFireAge',
  'expenseImport',
  'members',
  'sharedDataUsage',
  'privateDataUsage',
  'unsupportedFields',
])

const DEFAULT_IMPORTED_ADULT_TEMPLATE = structuredClone(
  fromLegacyIndividual(createDefaultLegacyIndividualSnapshot()).adults[0],
)

function nowIsoString(): string {
  return new Date().toISOString()
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function normalizeImportToken(value: string | null): string | null {
  return value?.trim().toLowerCase() ?? null
}

function readString(record: Record<string, unknown> | null, ...keys: string[]): string | null {
  if (!record) return null

  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim()
    }
  }

  return null
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
}

function readFiniteNumber(
  record: Record<string, unknown> | null,
  ...keys: string[]
): number | null {
  if (!record) return null

  for (const key of keys) {
    const value = toFiniteNumber(record[key])
    if (value !== null) return value
  }

  return null
}

function normalizeRelationship(value: string | null): Dependent['relationship'] {
  switch (normalizeImportToken(value)) {
    case 'child':
      return 'child'
    case 'parent':
      return 'parent'
    default:
      return 'other'
  }
}

function normalizeRole(
  value: string | null,
  fallbackIndex: number,
  relationship: Dependent['relationship'],
): ImportedPlanMemberRole {
  const normalizedValue = normalizeImportToken(value)
  if (normalizedValue === 'self' || normalizedValue === 'partner' || normalizedValue === 'dependent') {
    return normalizedValue
  }

  if (relationship !== 'other') {
    return 'dependent'
  }

  if (fallbackIndex === 0) return 'self'
  if (fallbackIndex === 1) return 'partner'
  return 'dependent'
}

function getImportHints(snapshot: PlannerSnapshotResponse): Record<string, unknown> | null {
  return asRecord(snapshot.expenseImport)
}

function getSnapshotValue(snapshot: PlannerSnapshotResponse, key: string): unknown {
  const hints = getImportHints(snapshot)
  if (hints && key in hints) {
    return hints[key]
  }

  return (snapshot as Record<string, unknown>)[key]
}

function parseImportedMembers(snapshot: PlannerSnapshotResponse): ParsedImportedMember[] {
  const rawMembers = getSnapshotValue(snapshot, 'members')
  if (!Array.isArray(rawMembers)) return []

  const parsedMembers: ParsedImportedMember[] = []

  for (const rawMember of rawMembers) {
    const record = asRecord(rawMember)
    if (!record) continue

    const relationship = normalizeRelationship(readString(record, 'relationship'))
    const role = normalizeRole(readString(record, 'role', 'type'), parsedMembers.length, relationship)
    const label = readString(record, 'label', 'displayName', 'name')
      ?? (role === 'self'
        ? 'Imported primary adult'
        : role === 'partner'
          ? 'Imported partner'
          : 'Imported dependent')
    const annualIncome = readFiniteNumber(record, 'annualIncome')
    const monthlyIncome = readFiniteNumber(record, 'monthlyIncome')
    const annualExpense = readFiniteNumber(record, 'annualExpense')
    const monthlyExpense = readFiniteNumber(record, 'monthlyExpense')
    const annualCost = readFiniteNumber(record, 'annualCost', 'costAnnual')

    parsedMembers.push({
      id: readString(record, 'id') ?? createId(`imported-${role}`),
      label,
      role,
      age: readFiniteNumber(record, 'currentAge', 'age'),
      retirementAge: readFiniteNumber(record, 'retirementAgeTarget', 'retirementAge'),
      lifeExpectancy: readFiniteNumber(record, 'lifeExpectancy'),
      annualIncome: annualIncome ?? (monthlyIncome !== null ? monthlyIncome * MONTHS_PER_YEAR : null),
      annualExpense: annualExpense ?? (monthlyExpense !== null ? monthlyExpense * MONTHS_PER_YEAR : null),
      annualCost: annualCost ?? (monthlyExpense !== null ? monthlyExpense * MONTHS_PER_YEAR : null),
      liquidNetWorth: readFiniteNumber(record, 'investableAssets', 'liquidNetWorth'),
      relationship,
    })
  }

  return parsedMembers
}

function resolveAnnualIncome(snapshot: PlannerSnapshotResponse): number | null {
  const monthlyIncome = toFiniteNumber(snapshot.avgMonthlyIncome)
  const monthlyExpense = toFiniteNumber(snapshot.avgMonthlyExpense)
  const monthlySavings = toFiniteNumber(snapshot.avgMonthlySavings)

  if (monthlyIncome !== null) return Math.max(0, monthlyIncome * MONTHS_PER_YEAR)
  if (monthlyExpense !== null && monthlySavings !== null) {
    return Math.max(0, (monthlyExpense + monthlySavings) * MONTHS_PER_YEAR)
  }

  return null
}

function resolveAnnualExpense(snapshot: PlannerSnapshotResponse): number | null {
  const monthlyIncome = toFiniteNumber(snapshot.avgMonthlyIncome)
  const monthlyExpense = toFiniteNumber(snapshot.avgMonthlyExpense)
  const monthlySavings = toFiniteNumber(snapshot.avgMonthlySavings)

  if (monthlyExpense !== null) return Math.max(0, monthlyExpense * MONTHS_PER_YEAR)
  if (monthlyIncome !== null && monthlySavings !== null) {
    return Math.max(0, (monthlyIncome - monthlySavings) * MONTHS_PER_YEAR)
  }

  return null
}

function buildLegacySnapshot(
  snapshot: PlannerSnapshotResponse,
  residualAnnualIncome: number,
  residualAnnualExpense: number,
  residualLiquidNetWorth: number,
  hasPartner: boolean,
): LegacyIndividualSnapshot {
  const legacy = createDefaultLegacyIndividualSnapshot()
  const profile = snapshot.profile

  legacy.profile.annualIncome = residualAnnualIncome
  legacy.income.annualSalary = residualAnnualIncome
  legacy.profile.annualExpenses = residualAnnualExpense
  legacy.profile.liquidNetWorth = residualLiquidNetWorth

  if (hasPartner) {
    legacy.profile.maritalStatus = 'married'
  }

  if (profile) {
    const currentAge = toFiniteNumber(profile.currentAge)
    if (currentAge !== null) legacy.profile.currentAge = Math.round(currentAge)

    const retirementAge = toFiniteNumber(profile.retirementAgeTarget)
    if (retirementAge !== null) legacy.profile.retirementAge = Math.round(retirementAge)

    const lifeExpectancy = toFiniteNumber(profile.lifeExpectancy)
    if (lifeExpectancy !== null) legacy.profile.lifeExpectancy = Math.round(lifeExpectancy)

    const inflation = toFiniteNumber(profile.inflationPct)
    if (inflation !== null) legacy.profile.inflation = inflation / 100

    const expectedReturn = toFiniteNumber(profile.expectedReturnPct)
    if (expectedReturn !== null) legacy.profile.expectedReturn = expectedReturn / 100

    const expenseRatio = toFiniteNumber(profile.expenseRatioPct)
    if (expenseRatio !== null) legacy.profile.expenseRatio = expenseRatio / 100

    const swr = toFiniteNumber(profile.swrPct)
    if (swr !== null) legacy.profile.swr = swr / 100

    const cpfOA = toFiniteNumber(profile.cpfOA)
    if (cpfOA !== null) legacy.profile.cpfOA = cpfOA

    const cpfSA = toFiniteNumber(profile.cpfSA)
    if (cpfSA !== null) legacy.profile.cpfSA = cpfSA

    const cpfMA = toFiniteNumber(profile.cpfMA)
    if (cpfMA !== null) legacy.profile.cpfMA = cpfMA
  }

  return legacy
}

function buildImportedAdult(
  owner: 'self' | 'partner',
  member: ParsedImportedMember,
  fallbackAdult: PlanningAdult,
): PlanningAdult {
  const adult = structuredClone(DEFAULT_IMPORTED_ADULT_TEMPLATE)
  const fallbackRetirementAge = Math.max(fallbackAdult.currentAge + 1, fallbackAdult.retirementAge)

  adult.id = owner === 'self' ? fallbackAdult.id : PARTNER_ADULT_ID
  adult.owner = owner
  adult.displayName = member.label
  adult.currentAge = member.age !== null ? Math.round(member.age) : fallbackAdult.currentAge
  adult.retirementAge = member.retirementAge !== null
    ? Math.max(adult.currentAge + 1, Math.round(member.retirementAge))
    : fallbackRetirementAge
  adult.lifeExpectancy = member.lifeExpectancy !== null
    ? Math.max(adult.retirementAge + 1, Math.round(member.lifeExpectancy))
    : Math.max(adult.retirementAge + 1, fallbackAdult.lifeExpectancy)
  adult.maritalStatus = owner === 'partner' ? 'married' : fallbackAdult.maritalStatus
  adult.annualIncome = Math.max(0, member.annualIncome ?? 0)
  adult.annualExpenses = Math.max(0, member.annualExpense ?? 0)
  adult.liquidNetWorth = Math.max(0, member.liquidNetWorth ?? 0)
  adult.taxProfile.personalReliefs = 0
  adult.taxProfile.reliefBreakdown = null
  adult.lifeEvents = []
  adult.cpf.balances = { oa: 0, sa: 0, ma: 0, ra: 0 }
  adult.cpf.annualTopUps = { oa: 0, sa: 0, ma: 0 }
  adult.cpf.lifeActualMonthlyPayout = 0
  adult.cpf.oaWithdrawals = []
  adult.srs.balance = 0
  adult.srs.annualContribution = 0
  return adult
}

function createSalaryIncome(adult: PlanningAdult): IncomeSource | null {
  if (adult.annualIncome <= 0) return null

  return {
    id: createId(`income-salary-${adult.owner}`),
    owner: adult.owner,
    label: `${adult.displayName} salary`,
    kind: 'salary-model',
    timing: {
      kind: 'age-range',
      owner: adult.owner,
      startAge: adult.currentAge,
      endAge: adult.retirementAge,
    },
    annualAmount: adult.annualIncome,
    growthRate: 0.03,
    growthModel: 'fixed',
    taxTreatment: 'taxable',
    isCpfApplicable: true,
    isActive: true,
    streamType: 'employment',
    salaryModel: 'simple',
    bonusMonths: 0,
    employerCpfEnabled: true,
    realisticPhases: [],
    promotionJumps: [],
  }
}

function createBaseExpense(
  owner: EntryOwner,
  timingOwner: 'self' | 'partner',
  amount: number,
  startAge: number,
  retirementAge: number,
  label: string,
): ExpenseItem | null {
  if (amount <= 0) return null

  return {
    id: createId(`expense-base-${owner}`),
    owner,
    label,
    kind: 'base-living',
    timing: {
      kind: 'age-range',
      owner: timingOwner,
      startAge,
      endAge: retirementAge,
    },
    amount,
    periodicity: 'annual',
    growthRate: 0,
    retirementSpendingAdjustment: 0,
  }
}

function createLiquidAsset(
  owner: EntryOwner,
  amount: number,
  label: string,
): AssetItem | null {
  if (amount <= 0) return null

  return {
    id: createId(`asset-liquid-${owner}`),
    owner,
    label,
    kind: 'liquid-net-worth',
    amount,
  }
}

function createDependent(member: ParsedImportedMember, hasPartner: boolean): Dependent {
  return {
    id: createId('dependent'),
    owner: hasPartner ? 'shared' : 'self',
    label: member.label,
    relationship: member.relationship,
    currentAge: member.age !== null ? Math.round(member.age) : null,
    timing: null,
    annualCost: Math.max(0, member.annualCost ?? 0),
  }
}

function buildDetectedMembers(plan: HouseholdPlan): ImportedPlanDetectedMember[] {
  const adults = plan.adults.map<ImportedPlanDetectedMember>((adult) => ({
    id: adult.id,
    label: adult.displayName,
    role: adult.owner,
    owner: adult.owner,
    age: adult.currentAge,
  }))
  const dependents = plan.dependents.map<ImportedPlanDetectedMember>((dependent) => ({
    id: dependent.id,
    label: dependent.label,
    role: 'dependent',
    owner: dependent.owner,
    age: dependent.currentAge,
  }))

  return [...adults, ...dependents]
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values))
}

function buildSharedDataUsage(plan: HouseholdPlan): string[] {
  const usage: string[] = []

  if (plan.expenses.some((expense) => expense.kind === 'base-living' && expense.owner === 'shared')) {
    usage.push('Household living costs were mapped into a shared spending row.')
  }
  if (plan.dependents.length > 0) {
    usage.push('Imported dependents were added to the household roster for local editing.')
  }

  if (usage.length === 0) {
    usage.push('No explicit shared ownership splits came from Expense; shared rows can be added locally if needed.')
  }

  return usage
}

function buildPrivateDataUsage(plan: HouseholdPlan, hasPartnerSpecificRows: boolean): string[] {
  const usage = [
    'Primary adult profile, salary, CPF balances, and investable assets were prefilled on the self adult.',
  ]

  if (hasPartnerSpecificRows) {
    usage.push('Partner-specific rows were added only for values that were explicitly present in the import payload.')
  } else if (plan.adults.some((adult) => adult.owner === 'partner')) {
    usage.push('Partner demographics were detected, but any missing partner finances still need manual local editing.')
  }

  return usage
}

function buildUnsupportedFields(snapshot: PlannerSnapshotResponse): string[] {
  const hintedUnsupported = readStringArray(getSnapshotValue(snapshot, 'unsupportedFields'))
  const extraTopLevelKeys = Object.keys(snapshot)
    .filter((key) => !KNOWN_SNAPSHOT_KEYS.has(key))
    .map((key) => `snapshot.${key}`)

  return dedupe([...hintedUnsupported, ...extraTopLevelKeys]).sort()
}

export function fromExpenseImport(snapshot: PlannerSnapshotResponse): ImportedHouseholdPlan {
  const importedAt = nowIsoString()
  const parsedMembers = parseImportedMembers(snapshot)
  const selfMember = parsedMembers.find((member) => member.role === 'self') ?? {
    id: 'expense-import-self',
    label: 'Imported primary adult',
    role: 'self' as const,
    age: toFiniteNumber(snapshot.profile?.currentAge),
    retirementAge: toFiniteNumber(snapshot.profile?.retirementAgeTarget),
    lifeExpectancy: toFiniteNumber(snapshot.profile?.lifeExpectancy),
    annualIncome: null,
    annualExpense: null,
    annualCost: null,
    liquidNetWorth: null,
    relationship: 'other' as const,
  }
  const partnerMember = parsedMembers.find((member) => member.role === 'partner') ?? null
  const dependentMembers = parsedMembers.filter((member) => member.role === 'dependent')

  const totalAnnualIncome = resolveAnnualIncome(snapshot)
  const totalAnnualExpense = resolveAnnualExpense(snapshot)
  const totalLiquidNetWorth = Math.max(0, toFiniteNumber(snapshot.investableAssets) ?? 0)
  const partnerAnnualIncome = Math.max(0, partnerMember?.annualIncome ?? 0)
  const partnerAnnualExpense = Math.max(0, partnerMember?.annualExpense ?? 0)
  const partnerLiquidNetWorth = Math.max(0, partnerMember?.liquidNetWorth ?? 0)
  const dependentAnnualIncome = dependentMembers.reduce((sum, member) => sum + Math.max(0, member.annualIncome ?? 0), 0)
  const dependentAnnualCost = dependentMembers.reduce((sum, member) => sum + Math.max(0, member.annualCost ?? 0), 0)

  const residualAnnualIncome = Math.max(0, (totalAnnualIncome ?? 0) - partnerAnnualIncome - dependentAnnualIncome)
  const residualAnnualExpense = Math.max(0, (totalAnnualExpense ?? 0) - partnerAnnualExpense - dependentAnnualCost)
  const residualLiquidNetWorth = Math.max(0, totalLiquidNetWorth - partnerLiquidNetWorth)

  const legacySnapshot = buildLegacySnapshot(
    snapshot,
    residualAnnualIncome,
    residualAnnualExpense,
    residualLiquidNetWorth,
    partnerMember !== null,
  )
  const plan = fromLegacyIndividual(legacySnapshot)
  const hasPartner = partnerMember !== null
  const hasDependents = dependentMembers.length > 0

  plan.id = createId('household-import')
  plan.planType = hasPartner ? (hasDependents ? 'household' : 'couple') : (hasDependents ? 'household' : 'individual')

  const selfAdult = plan.adults[0]
  selfAdult.displayName = selfMember.label
  selfAdult.annualIncome = residualAnnualIncome
  selfAdult.annualExpenses = residualAnnualExpense
  selfAdult.liquidNetWorth = residualLiquidNetWorth
  if (selfMember.age !== null) selfAdult.currentAge = Math.round(selfMember.age)
  if (selfMember.retirementAge !== null) {
    selfAdult.retirementAge = Math.max(selfAdult.currentAge + 1, Math.round(selfMember.retirementAge))
  }
  if (selfMember.lifeExpectancy !== null) {
    selfAdult.lifeExpectancy = Math.max(selfAdult.retirementAge + 1, Math.round(selfMember.lifeExpectancy))
  }
  if (hasPartner) {
    selfAdult.maritalStatus = 'married'
  }

  const selfSalary = plan.income.find((income) => income.kind === 'salary-model' && income.owner === 'self')
  if (selfSalary) {
    selfSalary.label = `${selfAdult.displayName} salary`
    selfSalary.annualAmount = residualAnnualIncome
    selfSalary.timing = {
      kind: 'age-range',
      owner: 'self',
      startAge: selfAdult.currentAge,
      endAge: selfAdult.retirementAge,
    }
  }

  const baseExpense = plan.expenses.find((expense) => expense.kind === 'base-living')
  if (baseExpense) {
    baseExpense.label = hasPartner ? 'Imported household living costs' : `${selfAdult.displayName} living costs`
    baseExpense.owner = hasPartner ? 'shared' : 'self'
    baseExpense.amount = residualAnnualExpense
  }

  const selfAsset = plan.assets.find((asset) => asset.kind === 'liquid-net-worth' && asset.owner === 'self')
  if (selfAsset) {
    selfAsset.label = hasPartner ? 'Imported investable assets' : `${selfAdult.displayName} liquid balance`
    selfAsset.amount = residualLiquidNetWorth
  }

  let hasPartnerSpecificRows = false

  if (partnerMember) {
    const partnerAdult = buildImportedAdult('partner', partnerMember, selfAdult)
    partnerAdult.maritalStatus = 'married'
    plan.adults.push(partnerAdult)

    const partnerIncome = createSalaryIncome(partnerAdult)
    if (partnerIncome) {
      hasPartnerSpecificRows = true
      plan.income.push(partnerIncome)
    }

    const partnerExpense = createBaseExpense(
      'partner',
      'partner',
      partnerAdult.annualExpenses,
      partnerAdult.currentAge,
      partnerAdult.retirementAge,
      `${partnerAdult.displayName} living costs`,
    )
    if (partnerExpense) {
      hasPartnerSpecificRows = true
      plan.expenses.push(partnerExpense)
    }

    const partnerAsset = createLiquidAsset(
      'partner',
      partnerAdult.liquidNetWorth,
      `${partnerAdult.displayName} liquid balance`,
    )
    if (partnerAsset) {
      hasPartnerSpecificRows = true
      plan.assets.push(partnerAsset)
    }
  }

  if (dependentMembers.length > 0) {
    plan.dependents = dependentMembers.map((member) => createDependent(member, hasPartner))
  }

  const hintedSharedUsage = readStringArray(getSnapshotValue(snapshot, 'sharedDataUsage'))
  const hintedPrivateUsage = readStringArray(getSnapshotValue(snapshot, 'privateDataUsage'))

  const review: ImportedPlanReview = {
    provenance: {
      source: 'expense-import',
      importedAt,
      monthKey: snapshot.monthKey ?? null,
      schemaVersion: snapshot.schemaVersion,
      structuralMode: snapshot.structuralMode ?? null,
    },
    detectedMembers: buildDetectedMembers(plan),
    sharedDataUsage: hintedSharedUsage.length > 0 ? hintedSharedUsage : buildSharedDataUsage(plan),
    privateDataUsage: hintedPrivateUsage.length > 0 ? hintedPrivateUsage : buildPrivateDataUsage(plan, hasPartnerSpecificRows),
    unsupportedFields: buildUnsupportedFields(snapshot),
    localEditabilityNote: LOCAL_EDITABILITY_NOTE,
  }

  return { plan, review }
}
