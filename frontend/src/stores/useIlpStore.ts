import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { IlpAccount, IlpBonusRule, IlpChargeRule, IlpEventChargeRule, IlpFund, IlpPolicyInput } from '@/lib/calculations/ilp'
import type { IlpPolicySeed } from '@/lib/ilp-catalog/policySeedSchema'
import { refreshPersistedPolicyFromCatalog } from '@/lib/ilp-catalog/refreshPersistedPolicy'
import { ilpPolicySchema } from '@/lib/validation/ilpSchema'
import {
  DEFAULT_ALTERNATIVE_RETURN,
  DEFAULT_AUA_FEE_RATE,
  DEFAULT_DISCOUNT_RATE,
  DEFAULT_INFLATION_RATE,
  DEFAULT_IUA_FEE_RATE,
  DEFAULT_LOYALTY_RATE,
  DEFAULT_LOYALTY_START_PY,
  DEFAULT_MIP_LENGTH,
  DEFAULT_POWER_UP_END_PY,
  DEFAULT_POWER_UP_RATE,
  DEFAULT_POWER_UP_START_PY,
  EEC_PRESET_MIP_30,
} from '@/lib/data/ilpDefaults'

interface IlpStoreData {
  policies: IlpPolicyInput[]
  selectedPolicyId: string | null
}

interface IlpStoreState extends IlpStoreData {
  hasHydrated: boolean
  addPolicy: () => void
  addPolicyFromSeed: (seed: IlpPolicySeed) => { success: true, policyId: string } | { success: false, errors: string[] }
  removePolicy: (id: string) => void
  duplicatePolicy: (id: string) => void
  selectPolicy: (id: string) => void
  updatePolicy: (id: string, updates: Partial<IlpPolicyInput>) => void
  setFund: (policyId: string, index: number, fund: IlpFund) => void
  addFund: (policyId: string) => void
  removeFund: (policyId: string, index: number) => void
  setAccount: (policyId: string, index: number, account: IlpAccount) => void
  addAccount: (policyId: string) => void
  removeAccount: (policyId: string, index: number) => void
  setBonus: (policyId: string, index: number, bonus: IlpBonusRule) => void
  addBonus: (policyId: string) => void
  removeBonus: (policyId: string, index: number) => void
  reset: () => void
}

const DEFAULT_FUND: IlpFund = {
  name: 'Fund 1',
  allocation: 1,
  ocf: 0.015,
  grossReturnLow: 0.06,
  grossReturnMid: 0.08,
  grossReturnHigh: 0.1,
}

const DEFAULT_IUA: IlpAccount = {
  id: 'iua',
  label: 'Initial Unit Account (IUA)',
  feeRate: DEFAULT_IUA_FEE_RATE,
  currentValue: 0,
  contributionShare: 0,
  subjectToEec: true,
  postMipFeeRate: DEFAULT_AUA_FEE_RATE,
}

const DEFAULT_AUA: IlpAccount = {
  id: 'aua',
  label: 'Accumulation Unit Account (AUA)',
  feeRate: DEFAULT_AUA_FEE_RATE,
  currentValue: 0,
  contributionShare: 1,
  subjectToEec: false,
  postMipFeeRate: null,
}

const DEFAULT_BONUSES: IlpBonusRule[] = [
  {
    id: 'power-up-bonus',
    type: 'power-up',
    label: 'Power-up Bonus',
    mode: 'annual-rate',
    rate: DEFAULT_POWER_UP_RATE,
    amount: 0,
    appliesTo: ['aua'],
    startPolicyYear: DEFAULT_POWER_UP_START_PY,
    endPolicyYear: DEFAULT_POWER_UP_END_PY,
  },
  {
    id: 'loyalty-bonus',
    type: 'loyalty',
    label: 'Loyalty Bonus',
    mode: 'annual-rate',
    rate: DEFAULT_LOYALTY_RATE,
    amount: 0,
    appliesTo: [],
    startPolicyYear: DEFAULT_LOYALTY_START_PY,
    endPolicyYear: null,
  },
]

function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function cloneFund(fund: IlpFund): IlpFund {
  return { ...fund }
}

function cloneAccount(account: IlpAccount): IlpAccount {
  return {
    ...account,
    contributionRules: account.contributionRules?.map((rule) => ({ ...rule })),
  }
}

function cloneBonus(bonus: IlpBonusRule): IlpBonusRule {
  return {
    ...bonus,
    appliesTo: [...bonus.appliesTo],
    tieredRates: bonus.tieredRates?.map((tier) => ({ ...tier })),
    suspensionRules: bonus.suspensionRules?.map((rule) => ({ ...rule })),
    restorationRules: bonus.restorationRules?.map((rule) => ({ ...rule })),
  }
}

function cloneChargeRule(rule: IlpChargeRule): IlpChargeRule {
  return {
    ...rule,
    assuranceConfig: rule.assuranceConfig ? { ...rule.assuranceConfig } : undefined,
    premiumBaseConfig: rule.premiumBaseConfig
      ? {
          useHigherOfCommencementAndPrevailing: rule.premiumBaseConfig.useHigherOfCommencementAndPrevailing,
          capRate: rule.premiumBaseConfig.capRate,
          multiplierYearBasis: rule.premiumBaseConfig.multiplierYearBasis,
          multiplierSchedule: rule.premiumBaseConfig.multiplierSchedule.map((tier) => ({ ...tier })),
        }
      : undefined,
    appliesTo: [...rule.appliesTo],
    fallbackAppliesTo: rule.fallbackAppliesTo ? [...rule.fallbackAppliesTo] : undefined,
    rateSchedule: rule.rateSchedule?.map((tier) => ({ ...tier })),
    amountSchedule: rule.amountSchedule?.map((tier) => ({ ...tier })),
  }
}

function cloneEventChargeRule(rule: IlpEventChargeRule): IlpEventChargeRule {
  return {
    ...rule,
    appliesTo: [...rule.appliesTo],
    fallbackAppliesTo: rule.fallbackAppliesTo ? [...rule.fallbackAppliesTo] : undefined,
    freeLifetimeMonths: rule.freeLifetimeMonths,
    freeEventMaxAmountBasis: rule.freeEventMaxAmountBasis,
    rateSchedule: rule.rateSchedule?.map((tier) => ({ ...tier })),
  }
}

function clonePolicy(policy: IlpPolicyInput): IlpPolicyInput {
  return {
    ...policy,
    eecTable: [...policy.eecTable],
    assuranceProfile: policy.assuranceProfile ? { ...policy.assuranceProfile } : undefined,
    claimProfile: policy.claimProfile ? { ...policy.claimProfile } : undefined,
    policyEvents: policy.policyEvents?.map((event) => ({ ...event })),
    funds: policy.funds.map(cloneFund),
    accounts: policy.accounts.map(cloneAccount),
    bonuses: policy.bonuses.map(cloneBonus),
    chargeRules: policy.chargeRules?.map(cloneChargeRule),
    eventChargeRules: policy.eventChargeRules?.map(cloneEventChargeRule),
    catalogSource: policy.catalogSource ? { ...policy.catalogSource } : undefined,
    catalogWarnings: policy.catalogWarnings ? [...policy.catalogWarnings] : undefined,
  }
}

export function createDefaultPolicy(): IlpPolicyInput {
  return {
    id: createId('ilp'),
    name: 'New ILP Policy',
    insurer: '',
    currency: 'SGD',
    monthlyContribution: 350,
    regularPremiumPaymentFrequency: 'monthly',
    monthsAlreadyPaid: 0,
    currentPolicyYear: 1,
    icpMonths: 12,
    assuranceProfile: undefined,
    claimProfile: undefined,
    accounts: [cloneAccount(DEFAULT_IUA), cloneAccount(DEFAULT_AUA)],
    mipLength: DEFAULT_MIP_LENGTH,
    postMipYears: 0,
    eecTable: [...EEC_PRESET_MIP_30],
    funds: [cloneFund(DEFAULT_FUND)],
    bonuses: DEFAULT_BONUSES.map(cloneBonus),
    chargeRules: [],
    policyEvents: [],
    eventChargeRules: [],
    discountRate: DEFAULT_DISCOUNT_RATE,
    inflationRate: DEFAULT_INFLATION_RATE,
    alternativeReturn: DEFAULT_ALTERNATIVE_RETURN,
  }
}

/** Build an IlpPolicyInput from a seed without persisting to the store. */
export function mergePolicySeed(seed: IlpPolicySeed): IlpPolicyInput {
  const base = createDefaultPolicy()
  return {
    ...base,
    ...seed,
    eecTable: [...seed.eecTable],
    assuranceProfile: seed.assuranceProfile ? { ...seed.assuranceProfile } : undefined,
    claimProfile: seed.claimProfile ? { ...seed.claimProfile } : undefined,
    policyEvents: seed.policyEvents?.map((event) => ({ ...event })),
    funds: seed.funds.map(cloneFund),
    accounts: seed.accounts.map(cloneAccount),
    bonuses: seed.bonuses.map(cloneBonus),
    chargeRules: seed.chargeRules?.map(cloneChargeRule) ?? [],
    eventChargeRules: seed.eventChargeRules?.map(cloneEventChargeRule) ?? [],
    catalogSource: seed.catalogSource ? { ...seed.catalogSource } : undefined,
    catalogWarnings: seed.catalogWarnings ? [...seed.catalogWarnings] : undefined,
  }
}

function createInitialData(): IlpStoreData {
  const firstPolicy = createDefaultPolicy()
  return {
    policies: [firstPolicy],
    selectedPolicyId: firstPolicy.id,
  }
}

function sanitizePersistedData(persisted: unknown): IlpStoreData {
  const fallback = createInitialData()
  if (!persisted || typeof persisted !== 'object') {
    return fallback
  }

  const persistedRecord = persisted as Record<string, unknown>
  const rawPolicies = persistedRecord.policies
  let policies: IlpPolicyInput[]

  if (Array.isArray(rawPolicies)) {
    policies = rawPolicies.flatMap((policy) => {
      const parsed = ilpPolicySchema.safeParse(policy)
      if (!parsed.success) {
        return []
      }

      const refreshed = refreshPersistedPolicyFromCatalog(parsed.data)
      const refreshedParsed = ilpPolicySchema.safeParse(refreshed)
      return refreshedParsed.success ? [refreshedParsed.data] : []
    })

    if (rawPolicies.length > 0 && policies.length === 0) {
      return fallback
    }
  } else {
    return fallback
  }

  const selectedPolicyId = typeof persistedRecord.selectedPolicyId === 'string'
    ? persistedRecord.selectedPolicyId
    : null

  return {
    policies,
    selectedPolicyId: policies.some((policy) => policy.id === selectedPolicyId)
      ? selectedPolicyId
      : (policies[0]?.id ?? null),
  }
}

function updatePolicyList(
  policies: IlpPolicyInput[],
  id: string,
  updater: (policy: IlpPolicyInput) => IlpPolicyInput,
): IlpPolicyInput[] {
  return policies.map((policy) => (policy.id === id ? updater(policy) : policy))
}

const initialData = createInitialData()

export const useIlpStore = create<IlpStoreState>()(
  persist(
    (set) => ({
      ...initialData,
      hasHydrated: false,

      addPolicy: () => set((state) => {
        const policy = createDefaultPolicy()
        return {
          policies: [...state.policies, policy],
          selectedPolicyId: policy.id,
        }
      }),

      addPolicyFromSeed: (seed) => {
        const candidate = mergePolicySeed(seed)
        const parsed = ilpPolicySchema.safeParse(candidate)
        if (!parsed.success) {
          return {
            success: false,
            errors: parsed.error.issues.map((issue) => issue.message),
          }
        }

        set((state) => ({
          policies: [...state.policies, parsed.data],
          selectedPolicyId: parsed.data.id,
        }))

        return {
          success: true,
          policyId: parsed.data.id,
        }
      },

      removePolicy: (id) => set((state) => {
        const policies = state.policies.filter((policy) => policy.id !== id)
        return {
          policies,
          selectedPolicyId: state.selectedPolicyId === id
            ? (policies[0]?.id ?? null)
            : state.selectedPolicyId,
        }
      }),

      duplicatePolicy: (id) => set((state) => {
        const source = state.policies.find((policy) => policy.id === id)
        if (!source) return state

        const duplicate = clonePolicy(source)
        duplicate.id = createId('ilp')
        duplicate.name = `${source.name} (copy)`

        return {
          policies: [...state.policies, duplicate],
          selectedPolicyId: duplicate.id,
        }
      }),

      selectPolicy: (id) => set({ selectedPolicyId: id }),

      updatePolicy: (id, updates) => set((state) => ({
        policies: updatePolicyList(state.policies, id, (policy) => ({ ...policy, ...updates })),
      })),

      setFund: (policyId, index, fund) => set((state) => ({
        policies: updatePolicyList(state.policies, policyId, (policy) => {
          const funds = [...policy.funds]
          if (index < 0 || index >= funds.length) return policy
          funds[index] = cloneFund(fund)
          return { ...policy, funds }
        }),
      })),

      addFund: (policyId) => set((state) => ({
        policies: updatePolicyList(state.policies, policyId, (policy) => ({
          ...policy,
          funds: [
            ...policy.funds,
            { ...cloneFund(DEFAULT_FUND), name: `Fund ${policy.funds.length + 1}`, allocation: 0 },
          ],
        })),
      })),

      removeFund: (policyId, index) => set((state) => ({
        policies: updatePolicyList(state.policies, policyId, (policy) => ({
          ...policy,
          funds: policy.funds.filter((_, fundIndex) => fundIndex !== index),
        })),
      })),

      setAccount: (policyId, index, account) => set((state) => ({
        policies: updatePolicyList(state.policies, policyId, (policy) => {
          const accounts = [...policy.accounts]
          if (index < 0 || index >= accounts.length) return policy
          accounts[index] = cloneAccount(account)
          return { ...policy, accounts }
        }),
      })),

      addAccount: (policyId) => set((state) => ({
        policies: updatePolicyList(state.policies, policyId, (policy) => {
          const nextIndex = policy.accounts.length + 1
          return {
            ...policy,
            accounts: [
              ...policy.accounts,
              {
                id: createId('acct'),
                label: `Account ${nextIndex}`,
                feeRate: DEFAULT_AUA_FEE_RATE,
                currentValue: 0,
                contributionShare: 0,
                subjectToEec: false,
                postMipFeeRate: null,
              },
            ],
          }
        }),
      })),

      removeAccount: (policyId, index) => set((state) => ({
        policies: updatePolicyList(state.policies, policyId, (policy) => ({
          ...policy,
          accounts: policy.accounts.filter((_, accountIndex) => accountIndex !== index),
        })),
      })),

      setBonus: (policyId, index, bonus) => set((state) => ({
        policies: updatePolicyList(state.policies, policyId, (policy) => {
          const bonuses = [...policy.bonuses]
          if (index < 0 || index >= bonuses.length) return policy
          bonuses[index] = cloneBonus(bonus)
          return { ...policy, bonuses }
        }),
      })),

      addBonus: (policyId) => set((state) => ({
        policies: updatePolicyList(state.policies, policyId, (policy) => ({
          ...policy,
          bonuses: [
            ...policy.bonuses,
            {
              id: createId('bonus'),
              type: 'custom',
              label: 'Custom Bonus',
              mode: 'annual-rate',
              rate: 0.01,
              amount: 0,
              appliesTo: [],
              startPolicyYear: 1,
              endPolicyYear: null,
            },
          ],
        })),
      })),

      removeBonus: (policyId, index) => set((state) => ({
        policies: updatePolicyList(state.policies, policyId, (policy) => ({
          ...policy,
          bonuses: policy.bonuses.filter((_, bonusIndex) => bonusIndex !== index),
        })),
      })),

      reset: () => set(() => ({
        ...createInitialData(),
      })),
    }),
    {
      name: 'fireplanner-ilp',
      version: 1,
      partialize: (state) => ({
        policies: state.policies,
        selectedPolicyId: state.selectedPolicyId,
      }),
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...sanitizePersistedData(persistedState),
        hasHydrated: true,
      }),
      onRehydrateStorage: () => (state, error) => {
        if (!state) return
        if (error) {
          const fallback = createInitialData()
          state.policies = fallback.policies
          state.selectedPolicyId = fallback.selectedPolicyId
        }
        state.hasHydrated = true
      },
    },
  ),
)
