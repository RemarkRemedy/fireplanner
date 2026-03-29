# CPF Transition Planner: Plan 1 — Foundation + Core UI

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working `/cpf-planner` page with guided story, 5 core schemes, hero payout estimate, decision cards, sticky account cards, and bidirectional store linking.

**Architecture:** Scheme registry pattern — each CPF scheme is a thin metadata+rules definition over the existing CPF calculation engine. Each scheme has a cheap `assess()` for eligibility/relevance (runs on all schemes) and a full `compute()` that only runs for visible cards. A narrative orchestrator groups schemes into age chapters. The page is a single vertical scroll with no tabs. Editing state lives in local React state, with debounced URL sync and explicit "Save to profile" for store write-back.

**Tech Stack:** React 19, TypeScript, Zustand (existing stores), Zod, Recharts (summary chart in Plan 2), Framer Motion (animations in Plan 2), Vitest

**Spec:** `docs/superpowers/specs/2026-03-29-cpf-transition-planner-design.md`

**Plans 2 & 3:** Remaining schemes, Sankey animator, couples mode, sharing, feedback API

---

## File Map

### New files to create

```
frontend/src/lib/cpf-transition/
  types.ts                        # All CPF transition types (PlannerContext, SchemeDefinition, etc.)
  policy/packs.ts                 # PolicyPack wrapping existing cpfRates data
  policy/citations.ts             # Citation registry with URLs and verification dates
  domain/context.ts               # buildPlannerContext() from stores + URL params
  domain/confidence.ts            # classifyConfidence() — known vs estimated
  schemes/age55-transition.ts     # Scheme: SA->RA transfer at 55
  schemes/retirement-sum-target.ts# Scheme: BRS/FRS/ERS comparison
  schemes/oa-to-ra-transfer.ts    # Scheme: voluntary OA->RA transfer
  schemes/rstu-topup.ts           # Scheme: cash top-up with tax relief
  schemes/cpf-life-plan.ts        # Scheme: CPF LIFE plan selection + deferral
  schemes/registry.ts             # All schemes registered, typed array
  orchestration/eligibility.ts    # filterEligibleSchemes()
  orchestration/narrative.ts      # groupSchemesByChapter(), sortByRelevance()
  hooks/useCpfTransitionParams.ts # URL params + store merge + write-back
  hooks/useCpfTransition.ts       # Main hook: context + orchestration
  hooks/useCpfLifeEstimate.ts     # Hero payout number

frontend/src/lib/cpf-transition/tests/
  types.test.ts                   # Type guard tests
  packs.test.ts                   # PolicyPack correctness
  context.test.ts                 # Context builder tests
  age55-transition.test.ts        # Scheme tests
  retirement-sum-target.test.ts
  oa-to-ra-transfer.test.ts
  rstu-topup.test.ts
  cpf-life-plan.test.ts
  eligibility.test.ts             # Eligibility engine tests
  narrative.test.ts               # Narrative ordering tests

frontend/src/components/cpf-transition/
  CpfTransitionInput.tsx          # Quick input form (3-5 fields)
  CpfTransitionHero.tsx           # Monthly payout estimate hero
  CpfAccountCards.tsx             # Sticky dynamic 3-card header
  StoryChapter.tsx                # Chapter container (age range + scheme cards)
  DecisionCard.tsx                # Comparison table card pattern
  AutomaticCard.tsx               # "What happens automatically" card

frontend/src/pages/CpfTransitionPage.tsx  # New page (replaces existing CpfPlannerPage content)
```

### Files to modify

```
frontend/src/router.tsx:110       # Move /cpf-planner outside PlannerRouteShell for standalone access
frontend/src/pages/CpfPlannerPage.tsx  # Rename/replace with CpfTransitionPage
```

---

## Task 1: Core Types

**Files:**
- Create: `frontend/src/lib/cpf-transition/types.ts`
- Test: `frontend/src/lib/cpf-transition/tests/types.test.ts`

- [ ] **Step 1: Write type definitions**

```typescript
// frontend/src/lib/cpf-transition/types.ts
import type { CpfLifePlan, CpfRetirementSum, CpfRateEntry, ResidencyStatus } from '@/lib/types'

// --- Chapter ages ---
export type ChapterAge = 'pre55' | 'at55' | 'post55' | 'at65' | 'post65'

// --- Action types ---
export type ActionType = 'automatic' | 'optional' | 'review'

// --- Confidence level (drives solid vs hatched styling) ---
export type ConfidenceLevel = 'known' | 'estimated'

// --- Citation ---
export interface Citation {
  label: string       // e.g. "CPF Board — Retirement Sums"
  url: string         // e.g. "https://www.cpf.gov.sg/..."
  asOfDate: string    // e.g. "2026-03-29"
}

// --- Comparison row for decision cards ---
export interface ComparisonRow {
  metric: string                // e.g. "Withdrawable now"
  defaultNumeric: number        // Raw number for charts/sorting/testing
  actionNumeric: number         // Raw number for charts/sorting/testing
  unit: 'currency' | 'percent' | 'months' | 'years' | 'text'
  suffix?: string               // e.g. "/month" for payout rows
  confidence: ConfidenceLevel
  textOverride?: string         // Optional text when unit is 'text' (e.g. "Requires property pledge")
}

// --- Delta metric ---
export interface DeltaMetric {
  label: string           // e.g. "Monthly payout increase"
  value: number
  formatted: string       // e.g. "+$600/month"
  direction: 'positive' | 'negative' | 'neutral'
}

// --- Scheme result (output of compute()) ---
export interface SchemeResult {
  headline: string
  summary: string
  defaultOutcome: string
  metrics: ComparisonRow[]
  deltas: DeltaMetric[]
  citations: Citation[]
  confidence: ConfidenceLevel
  caveats: string[]
  whyShown?: string
}

// --- Policy pack (wraps existing cpfRates data) ---
export interface PolicyPack {
  asOfDate: string
  retirementSums: { brs: number; frs: number; ers: number; cohortYear: number }
  bhs: number
  cpfLifeRates: { basic: number; standard: number; escalating: number }
  interestRates: { oa: number; sa: number; ra: number; ma: number }
  extraInterest: { combinedCap: number; oaCap: number; oaCap55Plus: number; rate: number; raAdditional: number }
  contributionRates: CpfRateEntry[]  // B6 fix: include rates for Plan 2 contribution/interest schemes
  owCeilingAnnual: number
  awCeilingTotal: number
}

// --- Partner profile (for couples) ---
export interface PartnerProfile {
  age: number
  birthYear: number  // B7 fix: included for Plan 3 couple context builder
  oa: number
  sa: number
  ra: number
  ma: number
  monthlySalary: number
  cpfLifePlan?: CpfLifePlan       // Optional: defaults to 'standard'
  cpfLifeStartAge?: number        // Optional: defaults to 65
  cpfRetirementSum?: CpfRetirementSum  // Optional: defaults to 'frs'
}

// --- Planner context (input to all scheme computations) ---
export interface PlannerContext {
  profile: {
    age: number
    birthYear: number
    residency: ResidencyStatus
  }
  accounts: {
    oa: number
    sa: number
    ra: number
    ma: number
  }
  income: {
    monthlySalary: number
    annualBonus: number
    salaryGrowthRate: number
  }
  property: {
    owns: boolean
    hdbType?: string
    remainingLease?: number
    pledged: boolean
  }
  cpfLife: {
    plan: CpfLifePlan
    startAge: number
    retirementSum: CpfRetirementSum
  }
  srs: {
    balance: number
  }
  household: {
    isCoupleMode: boolean
    partner?: PartnerProfile
  }
  policy: PolicyPack
}

// --- Scheme assessment (cheap, runs on all schemes every input change) ---
export interface SchemeAssessment {
  eligible: boolean
  relevance: number  // 0-100
}

// --- Scheme definition ---
export interface SchemeDefinition {
  id: string
  title: string
  goalLabel: string
  chapters: ChapterAge[]              // B1 fix: schemes can span multiple chapters
  actionType: ActionType
  assess: (ctx: PlannerContext) => SchemeAssessment  // B3 fix: cheap eligibility+relevance check
  compute: (ctx: PlannerContext) => SchemeResult      // B3 fix: full computation, only for visible cards
}

// --- Assessed scheme (cheap output from assess()) ---
export interface AssessedScheme {
  definition: SchemeDefinition
  assessment: SchemeAssessment
}

// --- Grouped output for rendering (compute() called lazily per card) ---
export interface ChapterGroup {
  chapter: ChapterAge
  label: string
  ageRange: string
  schemes: AssessedScheme[]  // B3: results computed lazily, not eagerly
}
```

- [ ] **Step 2: Write type guard tests**

```typescript
// frontend/src/lib/cpf-transition/tests/types.test.ts
import { describe, it, expect } from 'vitest'
import type { PlannerContext, SchemeResult, PolicyPack, ChapterAge, ActionType } from '../types'

describe('CPF Transition Types', () => {
  it('ChapterAge covers all age ranges', () => {
    const chapters: ChapterAge[] = ['pre55', 'at55', 'post55', 'at65', 'post65']
    expect(chapters).toHaveLength(5)
  })

  it('ActionType covers all action types', () => {
    const actions: ActionType[] = ['automatic', 'optional', 'review']
    expect(actions).toHaveLength(3)
  })

  it('PlannerContext shape is assignable', () => {
    const ctx: PlannerContext = {
      profile: { age: 52, birthYear: 1974, residency: 'citizen' },
      accounts: { oa: 330000, sa: 330000, ra: 0, ma: 75000 },
      income: { monthlySalary: 8000, annualBonus: 0, salaryGrowthRate: 0.03 },
      property: { owns: false, pledged: false },
      cpfLife: { plan: 'standard', startAge: 65, retirementSum: 'frs' },
      srs: { balance: 0 },
      household: { isCoupleMode: false },
      policy: {
        asOfDate: '2026-03-29',
        retirementSums: { brs: 110200, frs: 220400, ers: 440800, cohortYear: 2026 },
        bhs: 79000,
        cpfLifeRates: { basic: 0.054, standard: 0.063, escalating: 0.048 },
        interestRates: { oa: 0.025, sa: 0.04, ra: 0.04, ma: 0.04 },
        extraInterest: { combinedCap: 60000, oaCap: 20000, oaCap55Plus: 30000, rate: 0.01, raAdditional: 0.01 },
        owCeilingAnnual: 96000,
        awCeilingTotal: 102000,
      },
    }
    expect(ctx.profile.age).toBe(52)
    expect(ctx.policy.retirementSums.frs).toBe(220400)
  })

  it('SchemeResult shape is assignable', () => {
    const result: SchemeResult = {
      headline: 'Test',
      summary: 'Test summary',
      defaultOutcome: 'If you do nothing: nothing happens',
      metrics: [{ metric: 'Test', defaultValue: '$0', actionValue: '$100', confidence: 'known' }],
      deltas: [{ label: 'Test', value: 100, formatted: '+$100', direction: 'positive' }],
      citations: [{ label: 'CPF Board', url: 'https://cpf.gov.sg', asOfDate: '2026-03-29' }],
      confidence: 'estimated',
      caveats: [],
    }
    expect(result.headline).toBe('Test')
  })
})
```

- [ ] **Step 3: Run tests**

Run: `cd /Users/tj/TJDevelopment/fireplanner/frontend && npx vitest run src/lib/cpf-transition/tests/types.test.ts`
Expected: 3 tests PASS

- [ ] **Step 4: Commit**

```bash
cd /Users/tj/TJDevelopment/fireplanner && git add frontend/src/lib/cpf-transition/types.ts frontend/src/lib/cpf-transition/tests/types.test.ts && git commit -m "feat(cpf-transition): add core type definitions"
```

---

## Task 2: PolicyPack and Citations

**Files:**
- Create: `frontend/src/lib/cpf-transition/policy/packs.ts`
- Create: `frontend/src/lib/cpf-transition/policy/citations.ts`
- Test: `frontend/src/lib/cpf-transition/tests/packs.test.ts`

- [ ] **Step 1: Write citations registry**

```typescript
// frontend/src/lib/cpf-transition/policy/citations.ts
import type { Citation } from '../types'

export const CITATIONS = {
  retirementSums: {
    label: 'CPF Board: Retirement Sums',
    url: 'https://www.cpf.gov.sg/member/infohub/educational-resources/what-is-the-cpf-retirement-sum',
    asOfDate: '2026-03-29',
  },
  interestRates: {
    label: 'CPF Board: Interest Rates',
    url: 'https://www.cpf.gov.sg/member/growing-your-savings/earning-higher-returns/earning-attractive-interest',
    asOfDate: '2026-03-29',
  },
  cpfLife: {
    label: 'CPF Board: CPF LIFE',
    url: 'https://www.cpf.gov.sg/member/retirement-income/monthly-payouts/cpf-life',
    asOfDate: '2026-03-29',
  },
  reaching55: {
    label: 'CPF Board: Reaching Age 55',
    url: 'https://www.cpf.gov.sg/member/retirement-income/milestones/reaching-age-55',
    asOfDate: '2026-03-29',
  },
  reaching65: {
    label: 'CPF Board: Reaching Age 65',
    url: 'https://www.cpf.gov.sg/member/retirement-income/milestones/reaching-age-65',
    asOfDate: '2026-03-29',
  },
  rstu: {
    label: 'CPF Board: Top-ups',
    url: 'https://www.cpf.gov.sg/member/growing-your-savings/saving-more-with-cpf/top-up-to-enjoy-higher-retirement-payouts',
    asOfDate: '2026-03-29',
  },
  contributionRates: {
    label: 'CPF Board: Contribution Rates',
    url: 'https://www.cpf.gov.sg/employer/employer-obligations/how-much-cpf-contributions-to-pay',
    asOfDate: '2026-03-29',
  },
  extraInterest: {
    label: 'CPF Board: Extra Interest',
    url: 'https://www.cpf.gov.sg/service/article/how-much-extra-interest-can-i-earn-on-my-cpf-savings',
    asOfDate: '2026-03-29',
  },
} as const satisfies Record<string, Citation>
```

- [ ] **Step 2: Write PolicyPack builder**

```typescript
// frontend/src/lib/cpf-transition/policy/packs.ts
import type { PolicyPack } from '../types'
import {
  CPF_RATES,
  OW_CEILING_ANNUAL,
  AW_CEILING_TOTAL,
  OA_INTEREST_RATE,
  SA_INTEREST_RATE,
  RA_INTEREST_RATE,  // W4 fix: use RA-specific constant
  MA_INTEREST_RATE,
  EXTRA_INTEREST_RATE,
  EXTRA_INTEREST_COMBINED_CAP,
  EXTRA_INTEREST_OA_CAP,
  EXTRA_INTEREST_OA_CAP_55_PLUS,
  EXTRA_INTEREST_RA_ADDITIONAL,
  BRS_BASE,
  FRS_BASE,
  ERS_BASE,
  RETIREMENT_SUM_BASE_YEAR,
  BRS_GROWTH_RATE,
  CPF_LIFE_BASIC_RATE,
  CPF_LIFE_STANDARD_RATE,
  CPF_LIFE_ESCALATING_RATE,
} from '@/lib/data/cpfRates'
import { MEDISAVE_BHS } from '@/lib/data/healthcarePremiums'
import { calculateBrsFrsErs } from '@/lib/calculations/cpf'

/** Data vintage — updated when cpfRates.ts or healthcarePremiums.ts changes */
const DATA_AS_OF = '2026-03-29'

/**
 * Build the PolicyPack for a given user age.
 * Retirement sums are projected to the user's age-55 cohort year.
 */
export function buildPolicyPack(currentAge: number, currentYear: number = new Date().getFullYear()): PolicyPack {
  const projected = calculateBrsFrsErs(currentAge, currentYear)

  return {
    asOfDate: DATA_AS_OF,
    retirementSums: {
      brs: Math.round(projected.brs),
      frs: Math.round(projected.frs),
      ers: Math.round(projected.ers),
      cohortYear: currentYear + Math.max(0, 55 - currentAge),
    },
    bhs: MEDISAVE_BHS,
    cpfLifeRates: {
      basic: CPF_LIFE_BASIC_RATE,
      standard: CPF_LIFE_STANDARD_RATE,
      escalating: CPF_LIFE_ESCALATING_RATE,
    },
    interestRates: {
      oa: OA_INTEREST_RATE,
      sa: SA_INTEREST_RATE,
      ra: RA_INTEREST_RATE,  // W4 fix: use RA-specific constant (same value today, but future-proof)
      ma: MA_INTEREST_RATE,
    },
    contributionRates: CPF_RATES,  // B6 fix: include for Plan 2 contribution/interest schemes
    extraInterest: {
      combinedCap: EXTRA_INTEREST_COMBINED_CAP,
      oaCap: EXTRA_INTEREST_OA_CAP,
      oaCap55Plus: EXTRA_INTEREST_OA_CAP_55_PLUS,
      rate: EXTRA_INTEREST_RATE,
      raAdditional: EXTRA_INTEREST_RA_ADDITIONAL,
    },
    owCeilingAnnual: OW_CEILING_ANNUAL,
    awCeilingTotal: AW_CEILING_TOTAL,
  }
}

/** Check if policy data is stale (> 6 months old) */
export function isPolicyStale(pack: PolicyPack): boolean {
  const asOf = new Date(pack.asOfDate)
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
  return asOf < sixMonthsAgo
}
```

- [ ] **Step 3: Write PolicyPack tests**

```typescript
// frontend/src/lib/cpf-transition/tests/packs.test.ts
import { describe, it, expect } from 'vitest'
import { buildPolicyPack, isPolicyStale } from '../policy/packs'

describe('buildPolicyPack', () => {
  it('returns FRS matching calculateBrsFrsErs for age 55 in 2026', () => {
    const pack = buildPolicyPack(55, 2026)
    // Age 55 in 2026 means cohort year is 2026, so FRS should match base year projection
    expect(pack.retirementSums.frs).toBeGreaterThan(200000)
    expect(pack.retirementSums.ers).toBeGreaterThan(pack.retirementSums.frs)
    expect(pack.retirementSums.brs).toBeLessThan(pack.retirementSums.frs)
    expect(pack.retirementSums.cohortYear).toBe(2026)
  })

  it('projects higher FRS for younger users', () => {
    const pack40 = buildPolicyPack(40, 2026)
    const pack55 = buildPolicyPack(55, 2026)
    expect(pack40.retirementSums.frs).toBeGreaterThan(pack55.retirementSums.frs)
  })

  it('includes current interest rates', () => {
    const pack = buildPolicyPack(50, 2026)
    expect(pack.interestRates.oa).toBe(0.025)
    expect(pack.interestRates.ra).toBe(0.04)
  })

  it('includes OW and AW ceilings', () => {
    const pack = buildPolicyPack(50, 2026)
    expect(pack.owCeilingAnnual).toBe(96000)
    expect(pack.awCeilingTotal).toBe(102000)
  })
})

describe('isPolicyStale', () => {
  it('returns false for recent data', () => {
    const pack = buildPolicyPack(50, 2026)
    expect(isPolicyStale(pack)).toBe(false)
  })

  it('returns true for old data', () => {
    const pack = buildPolicyPack(50, 2026)
    pack.asOfDate = '2025-01-01'
    expect(isPolicyStale(pack)).toBe(true)
  })
})
```

- [ ] **Step 4: Run tests**

Run: `cd /Users/tj/TJDevelopment/fireplanner/frontend && npx vitest run src/lib/cpf-transition/tests/packs.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/tj/TJDevelopment/fireplanner && git add frontend/src/lib/cpf-transition/policy/ frontend/src/lib/cpf-transition/tests/packs.test.ts && git commit -m "feat(cpf-transition): add PolicyPack and citations registry"
```

---

## Task 3: PlannerContext Builder

**Files:**
- Create: `frontend/src/lib/cpf-transition/domain/context.ts`
- Create: `frontend/src/lib/cpf-transition/domain/confidence.ts`
- Test: `frontend/src/lib/cpf-transition/tests/context.test.ts`

- [ ] **Step 1: Write confidence classifier**

```typescript
// frontend/src/lib/cpf-transition/domain/confidence.ts
import type { ConfidenceLevel, PlannerContext } from '../types'

/**
 * Classify whether a projected value is 'known' (current fact) or 'estimated' (projection).
 * Known: current balances, current rates, current retirement sums.
 * Estimated: future balances, projected payouts, anything involving salary growth or interest.
 */
export function classifyConfidence(age: number, projectedAge: number): ConfidenceLevel {
  return projectedAge <= age ? 'known' : 'estimated'
}

/** Check if the user's context represents an age-55+ member (SA closed, RA exists) */
export function isSaClosed(ctx: PlannerContext): boolean {
  return ctx.profile.age >= 55
}
```

- [ ] **Step 2: Write PlannerContext builder**

```typescript
// frontend/src/lib/cpf-transition/domain/context.ts
import type { PlannerContext } from '../types'
import type { CpfLifePlan, CpfRetirementSum, ResidencyStatus } from '@/lib/types'
import { buildPolicyPack } from '../policy/packs'

export interface RawInputs {
  age: number
  oa: number
  sa: number
  ra: number
  ma: number
  monthlySalary: number
  annualBonus?: number
  salaryGrowthRate?: number
  residency?: ResidencyStatus
  cpfLifePlan?: CpfLifePlan
  cpfLifeStartAge?: number
  cpfRetirementSum?: CpfRetirementSum
  srsBalance?: number
  ownsProperty?: boolean
  hdbType?: string
  remainingLease?: number
  propertyPledged?: boolean
  isCoupleMode?: boolean
}

/**
 * Build a PlannerContext from raw user inputs.
 * Fills in defaults for optional fields.
 */
export function buildPlannerContext(inputs: RawInputs): PlannerContext {
  const currentYear = new Date().getFullYear()
  const birthYear = currentYear - inputs.age

  return {
    profile: {
      age: inputs.age,
      birthYear,
      residency: inputs.residency ?? 'citizen',
    },
    accounts: {
      oa: inputs.oa,
      sa: inputs.age >= 55 ? 0 : inputs.sa,  // SA is closed at 55+
      ra: inputs.age >= 55 ? inputs.ra : 0,   // RA only exists at 55+
      ma: inputs.ma,
    },
    income: {
      monthlySalary: inputs.monthlySalary,
      annualBonus: inputs.annualBonus ?? 0,
      salaryGrowthRate: inputs.salaryGrowthRate ?? 0.03,
    },
    property: {
      owns: inputs.ownsProperty ?? false,
      hdbType: inputs.hdbType,
      remainingLease: inputs.remainingLease,
      pledged: inputs.propertyPledged ?? false,
    },
    cpfLife: {
      plan: inputs.cpfLifePlan ?? 'standard',
      startAge: inputs.cpfLifeStartAge ?? 65,
      retirementSum: inputs.cpfRetirementSum ?? 'frs',
    },
    srs: {
      balance: inputs.srsBalance ?? 0,
    },
    household: {
      isCoupleMode: inputs.isCoupleMode ?? false,
    },
    policy: buildPolicyPack(inputs.age, currentYear),
  }
}
```

- [ ] **Step 3: Write context tests**

```typescript
// frontend/src/lib/cpf-transition/tests/context.test.ts
import { describe, it, expect } from 'vitest'
import { buildPlannerContext } from '../domain/context'
import { classifyConfidence, isSaClosed } from '../domain/confidence'

describe('buildPlannerContext', () => {
  it('zeroes SA for age 55+', () => {
    const ctx = buildPlannerContext({ age: 57, oa: 200000, sa: 50000, ra: 220000, ma: 75000, monthlySalary: 0 })
    expect(ctx.accounts.sa).toBe(0)
    expect(ctx.accounts.ra).toBe(220000)
  })

  it('zeroes RA for age < 55', () => {
    const ctx = buildPlannerContext({ age: 50, oa: 200000, sa: 150000, ra: 0, ma: 60000, monthlySalary: 6000 })
    expect(ctx.accounts.ra).toBe(0)
    expect(ctx.accounts.sa).toBe(150000)
  })

  it('fills defaults for optional fields', () => {
    const ctx = buildPlannerContext({ age: 52, oa: 100000, sa: 100000, ra: 0, ma: 50000, monthlySalary: 5000 })
    expect(ctx.profile.residency).toBe('citizen')
    expect(ctx.cpfLife.plan).toBe('standard')
    expect(ctx.cpfLife.startAge).toBe(65)
    expect(ctx.income.salaryGrowthRate).toBe(0.03)
    expect(ctx.property.owns).toBe(false)
    expect(ctx.household.isCoupleMode).toBe(false)
  })

  it('attaches a valid PolicyPack', () => {
    const ctx = buildPlannerContext({ age: 50, oa: 100000, sa: 100000, ra: 0, ma: 50000, monthlySalary: 5000 })
    expect(ctx.policy.retirementSums.frs).toBeGreaterThan(200000)
    expect(ctx.policy.interestRates.oa).toBe(0.025)
  })
})

describe('classifyConfidence', () => {
  it('returns known for current age', () => {
    expect(classifyConfidence(52, 52)).toBe('known')
  })
  it('returns estimated for future age', () => {
    expect(classifyConfidence(52, 55)).toBe('estimated')
  })
})

describe('isSaClosed', () => {
  it('returns true for 55+', () => {
    const ctx = buildPlannerContext({ age: 55, oa: 0, sa: 0, ra: 0, ma: 0, monthlySalary: 0 })
    expect(isSaClosed(ctx)).toBe(true)
  })
  it('returns false for < 55', () => {
    const ctx = buildPlannerContext({ age: 54, oa: 0, sa: 0, ra: 0, ma: 0, monthlySalary: 0 })
    expect(isSaClosed(ctx)).toBe(false)
  })
})
```

- [ ] **Step 4: Run tests**

Run: `cd /Users/tj/TJDevelopment/fireplanner/frontend && npx vitest run src/lib/cpf-transition/tests/context.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/tj/TJDevelopment/fireplanner && git add frontend/src/lib/cpf-transition/domain/ frontend/src/lib/cpf-transition/tests/context.test.ts && git commit -m "feat(cpf-transition): add PlannerContext builder and confidence classifier"
```

---

## Task 4: Scheme — Age 55 Transition

**Files:**
- Create: `frontend/src/lib/cpf-transition/schemes/age55-transition.ts`
- Test: `frontend/src/lib/cpf-transition/tests/age55-transition.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// frontend/src/lib/cpf-transition/tests/age55-transition.test.ts
import { describe, it, expect } from 'vitest'
import { age55TransitionScheme } from '../schemes/age55-transition'
import { buildPlannerContext } from '../domain/context'

describe('age55TransitionScheme', () => {
  const baseInputs = { age: 52, oa: 330000, sa: 330000, ra: 0, ma: 75000, monthlySalary: 8000 }

  it('is eligible for users aged 50-59', () => {
    const ctx = buildPlannerContext(baseInputs)
    expect(age55TransitionScheme.eligibility(ctx)).toBe(true)
  })

  it('is not eligible for users aged 60+', () => {
    const ctx = buildPlannerContext({ ...baseInputs, age: 60, sa: 0, ra: 220000 })
    expect(age55TransitionScheme.eligibility(ctx)).toBe(false)
  })

  it('computes correct SA->RA transfer when SA > FRS', () => {
    const ctx = buildPlannerContext(baseInputs)
    const result = age55TransitionScheme.compute(ctx)
    // SA $330K > FRS ~$220K, so RA gets FRS, excess SA -> OA
    expect(result.headline).toContain('SA')
    expect(result.metrics.length).toBeGreaterThan(0)
    // Check the new OA includes excess SA
    const oaRow = result.metrics.find(m => m.metric === 'OA balance after 55')
    expect(oaRow).toBeDefined()
    // OA should be original OA + excess SA
    expect(result.confidence).toBe('estimated')
  })

  it('computes OA->RA shortfall when SA < FRS', () => {
    const ctx = buildPlannerContext({ ...baseInputs, sa: 100000 })
    const result = age55TransitionScheme.compute(ctx)
    // SA $100K < FRS, need OA to fill shortfall
    const raRow = result.metrics.find(m => m.metric === 'RA balance')
    expect(raRow).toBeDefined()
  })

  it('is automatic action type', () => {
    expect(age55TransitionScheme.actionType).toBe('automatic')
  })

  it('is in at55 chapter', () => {
    expect(age55TransitionScheme.chapter).toBe('at55')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/tj/TJDevelopment/fireplanner/frontend && npx vitest run src/lib/cpf-transition/tests/age55-transition.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement scheme**

```typescript
// frontend/src/lib/cpf-transition/schemes/age55-transition.ts
import type { SchemeDefinition, PlannerContext, SchemeResult } from '../types'
import { performAge55Transfer, getRetirementSumAmount } from '@/lib/calculations/cpf'
import { formatCurrency } from '@/lib/utils'
import { CITATIONS } from '../policy/citations'

export const age55TransitionScheme: SchemeDefinition = {
  id: 'age55-transition',
  title: 'Your SA merges into a new Retirement Account',
  goalLabel: 'Understand the age-55 transition',
  chapters: ['at55'],                    // B1 fix: array
  actionType: 'automatic',

  assess: (ctx: PlannerContext) => ({    // B3 fix: cheap assess()
    eligible: ctx.profile.age >= 50 && ctx.profile.age < 60,
    relevance: Math.max(0, 100 - Math.abs(ctx.profile.age - 55) * 10),
  }),

  compute: (ctx: PlannerContext): SchemeResult => {
    const frs = ctx.policy.retirementSums.frs
    const target = getRetirementSumAmount(ctx.cpfLife.retirementSum, ctx.profile.age)

    // Simulate the age-55 transfer
    const { newOA, newSA, newRA } = performAge55Transfer(
      ctx.accounts.oa,
      ctx.accounts.sa,
      target,
    )

    const saToRA = Math.min(ctx.accounts.sa, target)
    const saExcess = ctx.accounts.sa - saToRA
    const oaToRA = Math.min(ctx.accounts.oa, Math.max(0, target - saToRA))

    return {
      headline: `Your SA ${formatCurrency(ctx.accounts.sa)} transfers to a new Retirement Account`,
      summary: `At 55, CPF creates a Retirement Account (RA) using your SA first, then OA if needed, up to the ${ctx.cpfLife.retirementSum.toUpperCase()} (${formatCurrency(target)}). Your SA is permanently closed.`,
      defaultOutcome: `This happens automatically when you turn 55. No action needed.`,
      metrics: [
        // B2 fix: numeric values, formatting happens in DecisionCard UI
        { metric: 'SA transferred to RA', defaultNumeric: saToRA, actionNumeric: saToRA, unit: 'currency' as const, confidence: 'estimated' as const },
        { metric: 'Excess SA to OA', defaultNumeric: saExcess, actionNumeric: saExcess, unit: 'currency' as const, confidence: 'estimated' as const },
        ...(oaToRA > 0 ? [{ metric: 'OA transferred to RA (shortfall)', defaultNumeric: oaToRA, actionNumeric: oaToRA, unit: 'currency' as const, confidence: 'estimated' as const }] : []),
        { metric: 'RA balance', defaultNumeric: newRA, actionNumeric: newRA, unit: 'currency' as const, confidence: 'estimated' as const },
        { metric: 'OA balance after 55', defaultNumeric: newOA, actionNumeric: newOA, unit: 'currency' as const, confidence: 'estimated' as const },
      ],
      deltas: [
        { label: 'SA closed', value: -ctx.accounts.sa, formatted: `-${formatCurrency(ctx.accounts.sa)}`, direction: 'neutral' },
        { label: 'RA created', value: newRA, formatted: `+${formatCurrency(newRA)}`, direction: 'positive' },
      ],
      citations: [CITATIONS.reaching55],
      confidence: 'estimated',
      caveats: ctx.profile.age < 55
        ? ['Retirement sums grow ~3.5% per year. Your actual FRS at 55 may be higher than shown.']
        : [],
    }
  },
}
```

- [ ] **Step 4: Run tests**

Run: `cd /Users/tj/TJDevelopment/fireplanner/frontend && npx vitest run src/lib/cpf-transition/tests/age55-transition.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/tj/TJDevelopment/fireplanner && git add frontend/src/lib/cpf-transition/schemes/age55-transition.ts frontend/src/lib/cpf-transition/tests/age55-transition.test.ts && git commit -m "feat(cpf-transition): add age-55 transition scheme"
```

---

## Task 5: Scheme — Retirement Sum Target

**Files:**
- Create: `frontend/src/lib/cpf-transition/schemes/retirement-sum-target.ts`
- Test: `frontend/src/lib/cpf-transition/tests/retirement-sum-target.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// frontend/src/lib/cpf-transition/tests/retirement-sum-target.test.ts
import { describe, it, expect } from 'vitest'
import { retirementSumTargetScheme } from '../schemes/retirement-sum-target'
import { buildPlannerContext } from '../domain/context'

describe('retirementSumTargetScheme', () => {
  it('is eligible for all users 50+', () => {
    const ctx = buildPlannerContext({ age: 50, oa: 100000, sa: 100000, ra: 0, ma: 50000, monthlySalary: 5000 })
    expect(retirementSumTargetScheme.eligibility(ctx)).toBe(true)
  })

  it('is a review action in at55 chapter', () => {
    expect(retirementSumTargetScheme.actionType).toBe('review')
    expect(retirementSumTargetScheme.chapter).toBe('at55')
  })

  it('computes BRS/FRS/ERS with payout estimates', () => {
    const ctx = buildPlannerContext({ age: 52, oa: 200000, sa: 200000, ra: 0, ma: 70000, monthlySalary: 8000 })
    const result = retirementSumTargetScheme.compute(ctx)
    // Should have 3 comparison rows (one per tier)
    expect(result.metrics.length).toBeGreaterThanOrEqual(3)
    expect(result.headline).toContain('retirement sum')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/tj/TJDevelopment/fireplanner/frontend && npx vitest run src/lib/cpf-transition/tests/retirement-sum-target.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement scheme**

```typescript
// frontend/src/lib/cpf-transition/schemes/retirement-sum-target.ts
import type { SchemeDefinition, PlannerContext, SchemeResult } from '../types'
import { estimateCpfLifePayout } from '@/lib/calculations/cpf'
import { formatCurrency } from '@/lib/utils'
import { CITATIONS } from '../policy/citations'

export const retirementSumTargetScheme: SchemeDefinition = {
  id: 'retirement-sum-target',
  title: 'Choose your retirement sum target',
  goalLabel: 'Set your retirement income target',
  chapters: ['at55'],
  actionType: 'review',

  assess: (ctx: PlannerContext) => ({
    eligible: ctx.profile.age >= 50,
    relevance: Math.max(0, 90 - Math.abs(ctx.profile.age - 55) * 5),
  }),

  compute: (ctx: PlannerContext): SchemeResult => {
    const { brs, frs, ers } = ctx.policy.retirementSums

    const brsMonthly = estimateCpfLifePayout(brs, ctx.cpfLife.plan) / 12
    const frsMonthly = estimateCpfLifePayout(frs, ctx.cpfLife.plan) / 12
    const ersMonthly = estimateCpfLifePayout(ers, ctx.cpfLife.plan) / 12

    return {
      headline: `Three retirement sum tiers determine your monthly payout`,
      summary: `CPF offers three tiers: Basic (BRS), Full (FRS), and Enhanced (ERS). A higher retirement sum means a higher CPF LIFE monthly payout for life. BRS requires pledging your property.`,
      defaultOutcome: `If you do nothing, CPF sets aside the Full Retirement Sum (${formatCurrency(frs)}) from your SA and OA at age 55.`,
      metrics: [
        {
          metric: `Basic (BRS) ${formatCurrency(brs)}`,
          defaultValue: `~${formatCurrency(brsMonthly, 0)}/month`,
          actionValue: 'Requires property pledge',
          confidence: 'estimated',
        },
        {
          metric: `Full (FRS) ${formatCurrency(frs)}`,
          defaultValue: `~${formatCurrency(frsMonthly, 0)}/month`,
          actionValue: 'Default target',
          confidence: 'estimated',
        },
        {
          metric: `Enhanced (ERS) ${formatCurrency(ers)}`,
          defaultValue: `~${formatCurrency(ersMonthly, 0)}/month`,
          actionValue: 'Voluntary top-up needed',
          confidence: 'estimated',
        },
      ],
      deltas: [
        {
          label: 'FRS vs BRS monthly difference',
          value: (frsMonthly - brsMonthly) * 12,
          formatted: `+${formatCurrency(frsMonthly - brsMonthly, 0)}/month`,
          direction: 'positive',
        },
        {
          label: 'ERS vs FRS monthly difference',
          value: (ersMonthly - frsMonthly) * 12,
          formatted: `+${formatCurrency(ersMonthly - frsMonthly, 0)}/month`,
          direction: 'positive',
        },
      ],
      citations: [CITATIONS.retirementSums, CITATIONS.cpfLife],
      confidence: 'estimated',
      caveats: [
        'Payout estimates are based on current CPF LIFE rates. Actual payouts vary by birth year cohort.',
        'Retirement sums grow ~3.5% per year.',
      ],
    }
  },
}
```

- [ ] **Step 4: Run tests**

Run: `cd /Users/tj/TJDevelopment/fireplanner/frontend && npx vitest run src/lib/cpf-transition/tests/retirement-sum-target.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/tj/TJDevelopment/fireplanner && git add frontend/src/lib/cpf-transition/schemes/retirement-sum-target.ts frontend/src/lib/cpf-transition/tests/retirement-sum-target.test.ts && git commit -m "feat(cpf-transition): add retirement sum target scheme"
```

---

## Task 6: Scheme — OA to RA Transfer

**Files:**
- Create: `frontend/src/lib/cpf-transition/schemes/oa-to-ra-transfer.ts`
- Test: `frontend/src/lib/cpf-transition/tests/oa-to-ra-transfer.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// frontend/src/lib/cpf-transition/tests/oa-to-ra-transfer.test.ts
import { describe, it, expect } from 'vitest'
import { oaToRaTransferScheme } from '../schemes/oa-to-ra-transfer'
import { buildPlannerContext } from '../domain/context'

describe('oaToRaTransferScheme', () => {
  it('is eligible for 55+ with OA balance and RA below ERS', () => {
    const ctx = buildPlannerContext({ age: 56, oa: 300000, sa: 0, ra: 220000, ma: 75000, monthlySalary: 0 })
    expect(oaToRaTransferScheme.eligibility(ctx)).toBe(true)
  })

  it('is not eligible for under 55', () => {
    const ctx = buildPlannerContext({ age: 52, oa: 300000, sa: 200000, ra: 0, ma: 75000, monthlySalary: 0 })
    expect(oaToRaTransferScheme.eligibility(ctx)).toBe(false)
  })

  it('is not eligible when RA >= ERS', () => {
    const ctx = buildPlannerContext({ age: 56, oa: 100000, sa: 0, ra: 500000, ma: 75000, monthlySalary: 0 })
    expect(oaToRaTransferScheme.eligibility(ctx)).toBe(false)
  })

  it('computes transfer room and payout impact', () => {
    const ctx = buildPlannerContext({ age: 56, oa: 300000, sa: 0, ra: 220000, ma: 75000, monthlySalary: 0 })
    const result = oaToRaTransferScheme.compute(ctx)
    expect(result.metrics.length).toBeGreaterThan(0)
    expect(result.actionType).toBeUndefined() // actionType is on the definition, not result
    expect(result.headline).toContain('OA')
  })

  it('is optional action in at55 chapter', () => {
    expect(oaToRaTransferScheme.actionType).toBe('optional')
    expect(oaToRaTransferScheme.chapter).toBe('at55')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/tj/TJDevelopment/fireplanner/frontend && npx vitest run src/lib/cpf-transition/tests/oa-to-ra-transfer.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement scheme**

```typescript
// frontend/src/lib/cpf-transition/schemes/oa-to-ra-transfer.ts
import type { SchemeDefinition, PlannerContext, SchemeResult } from '../types'
import { estimateCpfLifePayout } from '@/lib/calculations/cpf'
import { formatCurrency } from '@/lib/utils'
import { CITATIONS } from '../policy/citations'

export const oaToRaTransferScheme: SchemeDefinition = {
  id: 'oa-to-ra-transfer',
  title: 'Transfer OA savings to RA for higher returns',
  goalLabel: 'Boost retirement income',
  chapters: ['at55', 'post55'],  // B1 fix: available in both chapters
  actionType: 'optional',

  assess: (ctx: PlannerContext) => {
    if (ctx.profile.age < 55 || ctx.accounts.oa <= 0) return { eligible: false, relevance: 0 }
    if (ctx.accounts.ra >= ctx.policy.retirementSums.ers) return { eligible: false, relevance: 0 }
    const raRoom = ctx.policy.retirementSums.ers - ctx.accounts.ra
    const transferable = Math.min(ctx.accounts.oa, raRoom)
    return { eligible: true, relevance: Math.min(80, Math.round(transferable / 5000)) }
  },

  compute: (ctx: PlannerContext): SchemeResult => {
    const ers = ctx.policy.retirementSums.ers
    const raRoom = Math.max(0, ers - ctx.accounts.ra)
    const maxTransfer = Math.min(ctx.accounts.oa, raRoom)

    const currentRA = ctx.accounts.ra
    const newRA = currentRA + maxTransfer
    const newOA = ctx.accounts.oa - maxTransfer

    const currentPayout = estimateCpfLifePayout(currentRA, ctx.cpfLife.plan) / 12
    const newPayout = estimateCpfLifePayout(newRA, ctx.cpfLife.plan) / 12

    // 10-year opportunity cost: OA at 2.5% vs RA at 4%
    const oaGrowth10 = maxTransfer * Math.pow(1.025, 10) - maxTransfer
    const raGrowth10 = maxTransfer * Math.pow(1.04, 10) - maxTransfer
    const interestGain = raGrowth10 - oaGrowth10

    return {
      headline: `Transfer up to ${formatCurrency(maxTransfer)} from OA to RA`,
      summary: `OA earns 2.5% while RA earns 4-6%. Transferring to RA increases your CPF LIFE payout but the money becomes locked. This transfer is irreversible.`,
      defaultOutcome: `If you do nothing, your OA stays at ${formatCurrency(ctx.accounts.oa)} earning 2.5%. Your RA stays at ${formatCurrency(currentRA)}.`,
      metrics: [
        {
          metric: 'Withdrawable now',
          defaultValue: formatCurrency(ctx.accounts.oa),
          actionValue: formatCurrency(newOA),
          confidence: 'known',
        },
        {
          metric: 'Est. monthly payout at 65',
          defaultValue: `~${formatCurrency(currentPayout, 0)}/month`,
          actionValue: `~${formatCurrency(newPayout, 0)}/month`,
          confidence: 'estimated',
        },
        {
          metric: 'Extra interest over 10 years',
          defaultValue: '$0',
          actionValue: `~${formatCurrency(interestGain, 0)}`,
          confidence: 'estimated',
        },
        {
          metric: 'Money locked until 65',
          defaultValue: formatCurrency(currentRA),
          actionValue: formatCurrency(newRA),
          confidence: 'known',
        },
      ],
      deltas: [
        {
          label: 'Monthly payout increase',
          value: (newPayout - currentPayout) * 12,
          formatted: `+${formatCurrency(newPayout - currentPayout, 0)}/month`,
          direction: 'positive',
        },
      ],
      citations: [CITATIONS.reaching55, CITATIONS.interestRates],
      confidence: 'estimated',
      caveats: [
        'This transfer is irreversible. You cannot move money back from RA to OA.',
        'OA money is withdrawable. RA money is locked for CPF LIFE.',
      ],
    }
  },
}
```

- [ ] **Step 4: Run tests**

Run: `cd /Users/tj/TJDevelopment/fireplanner/frontend && npx vitest run src/lib/cpf-transition/tests/oa-to-ra-transfer.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/tj/TJDevelopment/fireplanner && git add frontend/src/lib/cpf-transition/schemes/oa-to-ra-transfer.ts frontend/src/lib/cpf-transition/tests/oa-to-ra-transfer.test.ts && git commit -m "feat(cpf-transition): add OA-to-RA transfer scheme"
```

---

## Task 7: Scheme — RSTU Top-up

**Files:**
- Create: `frontend/src/lib/cpf-transition/schemes/rstu-topup.ts`
- Test: `frontend/src/lib/cpf-transition/tests/rstu-topup.test.ts`

Follow the same TDD pattern as Tasks 4-6. Key logic:

- [ ] **Step 1: Write failing test** — Test eligibility (has income for tax relief to matter), compute (show tax savings, payout impact, lockup cost)

- [ ] **Step 2: Run to verify fail**

- [ ] **Step 3: Implement** — Eligibility: `monthlySalary > 0` (tax relief only matters if you pay tax). Compute: show tax relief ($8K cap self, $16K combined), RA growth at 4%, equivalent external return needed to match. Use RSTU citation.

- [ ] **Step 4: Run to verify pass**

- [ ] **Step 5: Commit** — `feat(cpf-transition): add RSTU top-up scheme`

---

## Task 8: Scheme — CPF LIFE Plan Selection

**Files:**
- Create: `frontend/src/lib/cpf-transition/schemes/cpf-life-plan.ts`
- Test: `frontend/src/lib/cpf-transition/tests/cpf-life-plan.test.ts`

Follow the same TDD pattern. Key logic:

- [ ] **Step 1: Write failing test** — Test eligibility (age 50-70), compute (3-plan comparison + deferral bonus table)

- [ ] **Step 2: Run to verify fail**

- [ ] **Step 3: Implement** — Eligibility: age 50+. Compute: use `estimateCpfLifePayout()` for all 3 plans, show monthly payout, at-75 payout (escalating grows 2%/yr for 10 years), deferral bonus (+7%/yr from 65-70). Show 6 rows: age 65-70 start, monthly payout at each. Use CPF LIFE citation.

- [ ] **Step 4: Run to verify pass**

- [ ] **Step 5: Commit** — `feat(cpf-transition): add CPF LIFE plan selection scheme`

---

## Task 9: Scheme Registry + Orchestration

**Files:**
- Create: `frontend/src/lib/cpf-transition/schemes/registry.ts`
- Create: `frontend/src/lib/cpf-transition/orchestration/eligibility.ts`
- Create: `frontend/src/lib/cpf-transition/orchestration/narrative.ts`
- Test: `frontend/src/lib/cpf-transition/tests/eligibility.test.ts`
- Test: `frontend/src/lib/cpf-transition/tests/narrative.test.ts`

- [ ] **Step 1: Write registry**

```typescript
// frontend/src/lib/cpf-transition/schemes/registry.ts
import type { SchemeDefinition } from '../types'
import { age55TransitionScheme } from './age55-transition'
import { retirementSumTargetScheme } from './retirement-sum-target'
import { oaToRaTransferScheme } from './oa-to-ra-transfer'
import { rstuTopupScheme } from './rstu-topup'
import { cpfLifePlanScheme } from './cpf-life-plan'

export const ALL_SCHEMES: SchemeDefinition[] = [
  age55TransitionScheme,
  retirementSumTargetScheme,
  oaToRaTransferScheme,
  rstuTopupScheme,
  cpfLifePlanScheme,
]
```

- [ ] **Step 2: Write eligibility filter**

```typescript
// frontend/src/lib/cpf-transition/orchestration/eligibility.ts
import type { SchemeDefinition, PlannerContext } from '../types'

import type { AssessedScheme } from '../types'

/**
 * Assess all schemes cheaply (eligibility + relevance).
 * Returns only eligible schemes with their assessment.
 * Does NOT call compute() — that's deferred to the UI.
 */
export function assessSchemes(
  schemes: SchemeDefinition[],
  ctx: PlannerContext,
): AssessedScheme[] {
  return schemes
    .map(definition => ({ definition, assessment: definition.assess(ctx) }))
    .filter(s => s.assessment.eligible)
}
```

- [ ] **Step 3: Write narrative orchestrator**

```typescript
// frontend/src/lib/cpf-transition/orchestration/narrative.ts
import type { SchemeDefinition, PlannerContext, ChapterGroup, ChapterAge, AssessedScheme } from '../types'
import { assessSchemes } from './eligibility'

const CHAPTER_ORDER: ChapterAge[] = ['pre55', 'at55', 'post55', 'at65', 'post65']

const CHAPTER_META: Record<ChapterAge, { label: string; ageRange: string }> = {
  pre55: { label: 'Before 55: Preparation', ageRange: '50-54' },
  at55: { label: 'Age 55: The Transition', ageRange: '55' },
  post55: { label: 'After 55: Growth Phase', ageRange: '55-64' },
  at65: { label: 'Age 65: Payouts Begin', ageRange: '65' },
  post65: { label: 'After 65: Retirement', ageRange: '65-70' },
}

/**
 * Build the narrative: assess all schemes cheaply, group by chapter.
 * Does NOT call compute() — that's deferred to each card component.
 * B1 fix: schemes with multiple chapters appear in all their chapters.
 * B3 fix: only assess() runs here, compute() is lazy per-card.
 */
export function buildNarrative(
  allSchemes: SchemeDefinition[],
  ctx: PlannerContext,
): ChapterGroup[] {
  const assessed = assessSchemes(allSchemes, ctx)

  // B1 fix: index each scheme by ALL its chapters
  const byChapter = new Map<ChapterAge, AssessedScheme[]>()

  for (const item of assessed) {
    for (const ch of item.definition.chapters) {
      const list = byChapter.get(ch) ?? []
      list.push(item)
      byChapter.set(ch, list)
    }
  }

  // Sort within each chapter by relevance (descending)
  for (const [, schemes] of byChapter) {
    schemes.sort((a, b) => b.assessment.relevance - a.assessment.relevance)
  }

  // Build ordered chapters, skip empty ones
  return CHAPTER_ORDER
    .filter(ch => byChapter.has(ch))
    .map(ch => ({
      chapter: ch,
      ...CHAPTER_META[ch],
      schemes: byChapter.get(ch)!,
    }))
}
```

- [ ] **Step 4: Write tests**

```typescript
// frontend/src/lib/cpf-transition/tests/narrative.test.ts
import { describe, it, expect } from 'vitest'
import { buildNarrative } from '../orchestration/narrative'
import { ALL_SCHEMES } from '../schemes/registry'
import { buildPlannerContext } from '../domain/context'

describe('buildNarrative', () => {
  it('returns chapters with eligible schemes for a 52-year-old', () => {
    const ctx = buildPlannerContext({ age: 52, oa: 200000, sa: 200000, ra: 0, ma: 60000, monthlySalary: 6000 })
    const chapters = buildNarrative(ALL_SCHEMES, ctx)
    expect(chapters.length).toBeGreaterThan(0)
    // Should have at55 chapter at minimum (age55 transition, retirement sum target)
    const at55 = chapters.find(c => c.chapter === 'at55')
    expect(at55).toBeDefined()
    expect(at55!.schemes.length).toBeGreaterThanOrEqual(2)
  })

  it('returns chapters for a 57-year-old (post-55)', () => {
    const ctx = buildPlannerContext({ age: 57, oa: 300000, sa: 0, ra: 220000, ma: 75000, monthlySalary: 0 })
    const chapters = buildNarrative(ALL_SCHEMES, ctx)
    // B1 fix: OA-to-RA transfer has chapters: ['at55', 'post55'], should appear in both
    const at55 = chapters.find(c => c.chapter === 'at55')
    const post55 = chapters.find(c => c.chapter === 'post55')
    // At least one of these should contain the OA-to-RA scheme
    const hasOaToRa = [...(at55?.schemes ?? []), ...(post55?.schemes ?? [])]
      .some(s => s.definition.id === 'oa-to-ra-transfer')
    expect(hasOaToRa).toBe(true)
  })

  it('B1: multi-chapter schemes appear in all their chapters', () => {
    const ctx = buildPlannerContext({ age: 57, oa: 300000, sa: 0, ra: 220000, ma: 75000, monthlySalary: 0 })
    const chapters = buildNarrative(ALL_SCHEMES, ctx)
    const oaToRaScheme = ALL_SCHEMES.find(s => s.id === 'oa-to-ra-transfer')!
    for (const ch of oaToRaScheme.chapters) {
      const chapterGroup = chapters.find(c => c.chapter === ch)
      if (chapterGroup) {
        const found = chapterGroup.schemes.some(s => s.definition.id === 'oa-to-ra-transfer')
        expect(found).toBe(true)
      }
    }
  })

  it('skips empty chapters', () => {
    const ctx = buildPlannerContext({ age: 52, oa: 200000, sa: 200000, ra: 0, ma: 60000, monthlySalary: 6000 })
    const chapters = buildNarrative(ALL_SCHEMES, ctx)
    for (const ch of chapters) {
      expect(ch.schemes.length).toBeGreaterThan(0)
    }
  })

  it('sorts schemes by relevance within chapters', () => {
    const ctx = buildPlannerContext({ age: 54, oa: 200000, sa: 200000, ra: 0, ma: 60000, monthlySalary: 6000 })
    const chapters = buildNarrative(ALL_SCHEMES, ctx)
    const at55 = chapters.find(c => c.chapter === 'at55')
    if (at55 && at55.schemes.length >= 2) {
      // B3 fix: relevance comes from assessment, not direct function call
      const scores = at55.schemes.map(s => s.assessment.relevance)
      for (let i = 1; i < scores.length; i++) {
        expect(scores[i]).toBeLessThanOrEqual(scores[i - 1])
      }
    }
  })
})
```

- [ ] **Step 5: Run tests**

Run: `cd /Users/tj/TJDevelopment/fireplanner/frontend && npx vitest run src/lib/cpf-transition/tests/narrative.test.ts`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
cd /Users/tj/TJDevelopment/fireplanner && git add frontend/src/lib/cpf-transition/schemes/registry.ts frontend/src/lib/cpf-transition/orchestration/ frontend/src/lib/cpf-transition/tests/narrative.test.ts && git commit -m "feat(cpf-transition): add scheme registry and narrative orchestrator"
```

---

## Task 10: URL Params Hook (Bidirectional)

**Files:**
- Create: `frontend/src/lib/cpf-transition/hooks/useCpfTransitionParams.ts`

- [ ] **Step 1: Implement the bidirectional params hook**

```typescript
// frontend/src/lib/cpf-transition/hooks/useCpfTransitionParams.ts
import { useState, useCallback, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useProfileStore } from '@/stores/useProfileStore'
import { useIncomeStore } from '@/stores/useIncomeStore'
import type { RawInputs } from '../domain/context'

/**
 * B5 fix: Local draft state as single source of truth.
 * - On mount: initialize from URL params (if shared link) or store values (if profile exists)
 * - On edit: update local draft only (no store write, no URL write)
 * - Debounced URL sync: URL params update 300ms after last edit (for shareable links)
 * - Explicit "Save to profile": user clicks button to persist to stores
 */
export function useCpfTransitionParams(): {
  inputs: RawInputs
  updateField: (field: keyof RawInputs, value: number | string | boolean) => void
  saveToProfile: () => void
  isFromSharedLink: boolean
} {
  const [searchParams] = useSearchParams()

  // Read store values once on mount for initialization
  const profileAge = useProfileStore(s => s.currentAge)
  const profileOA = useProfileStore(s => s.cpfOA)
  const profileSA = useProfileStore(s => s.cpfSA)
  const profileRA = useProfileStore(s => s.cpfRA)
  const profileMA = useProfileStore(s => s.cpfMA)
  const annualSalary = useIncomeStore(s => s.annualSalary)

  // Detect if arriving from a shared link (URL has age param)
  const isFromSharedLink = searchParams.has('age')

  // Initialize local draft from URL params (priority) or stores (fallback)
  const [inputs, setInputs] = useState<RawInputs>(() => {
    const p = (key: string) => searchParams.get(key)
    const num = (key: string, fallback: number) => {
      const v = p(key)
      return v !== null ? Number(v) : fallback
    }
    return {
      age: num('age', profileAge),
      oa: num('oa', profileOA),
      sa: num('sa', profileSA),
      ra: num('ra', profileRA),
      ma: num('ma', profileMA),
      monthlySalary: num('salary', Math.round(annualSalary / 12)),
    }
  })

  // Debounced URL sync (300ms after last edit)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => {
    timerRef.current = setTimeout(() => {
      const url = new URL(window.location.href)
      url.searchParams.set('age', String(inputs.age))
      url.searchParams.set('oa', String(inputs.oa))
      url.searchParams.set('sa', String(inputs.sa))
      url.searchParams.set('ra', String(inputs.ra))
      url.searchParams.set('ma', String(inputs.ma))
      url.searchParams.set('salary', String(inputs.monthlySalary))
      window.history.replaceState(null, '', url.toString())
    }, 300)
    return () => clearTimeout(timerRef.current)
  }, [inputs])

  // Update local draft only (no store write)
  const updateField = useCallback((field: keyof RawInputs, value: number | string | boolean) => {
    setInputs(prev => ({ ...prev, [field]: value }))
  }, [])

  // Explicit "Save to profile" — writes to stores on user action
  const profileSetField = useProfileStore(s => s.setField)
  const incomeSetField = useIncomeStore(s => s.setField)

  const saveToProfile = useCallback(() => {
    profileSetField('currentAge', inputs.age)
    profileSetField('cpfOA', inputs.oa)
    profileSetField('cpfSA', inputs.sa)
    profileSetField('cpfRA', inputs.ra)
    profileSetField('cpfMA', inputs.ma)
    incomeSetField('annualSalary', inputs.monthlySalary * 12)
  }, [inputs, profileSetField, incomeSetField])

  return { inputs, updateField, saveToProfile, isFromSharedLink }
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/tj/TJDevelopment/fireplanner && git add frontend/src/lib/cpf-transition/hooks/useCpfTransitionParams.ts && git commit -m "feat(cpf-transition): add bidirectional URL params hook"
```

---

## Task 11: Main Orchestration Hook + Hero Payout Hook

**Files:**
- Create: `frontend/src/lib/cpf-transition/hooks/useCpfTransition.ts`
- Create: `frontend/src/lib/cpf-transition/hooks/useCpfLifeEstimate.ts`

- [ ] **Step 1: Write main hook**

```typescript
// frontend/src/lib/cpf-transition/hooks/useCpfTransition.ts
import { useMemo, useCallback } from 'react'
import { buildPlannerContext } from '../domain/context'
import { buildNarrative } from '../orchestration/narrative'
import { ALL_SCHEMES } from '../schemes/registry'
import { isPolicyStale } from '../policy/packs'
import type { RawInputs } from '../domain/context'
import type { PlannerContext, ChapterGroup, SchemeResult, SchemeDefinition } from '../types'

/**
 * B3 fix: buildNarrative only calls assess() (cheap) on all schemes.
 * compute() is called lazily per-card via computeScheme().
 * useMemo deps are primitive values from inputs to ensure stability.
 */
export function useCpfTransition(inputs: RawInputs): {
  context: PlannerContext
  chapters: ChapterGroup[]
  isStaleData: boolean
  computeScheme: (scheme: SchemeDefinition) => SchemeResult
} {
  const context = useMemo(
    () => buildPlannerContext(inputs),
    [inputs.age, inputs.oa, inputs.sa, inputs.ra, inputs.ma, inputs.monthlySalary]
  )

  const chapters = useMemo(
    () => buildNarrative(ALL_SCHEMES, context),
    [context]
  )

  const isStaleData = useMemo(() => isPolicyStale(context.policy), [context.policy])

  // Lazy compute: called by each card component when it renders
  const computeScheme = useCallback(
    (scheme: SchemeDefinition): SchemeResult => scheme.compute(context),
    [context]
  )

  return { context, chapters, isStaleData, computeScheme }
}
```

- [ ] **Step 2: Write hero payout hook**

```typescript
// frontend/src/lib/cpf-transition/hooks/useCpfLifeEstimate.ts
import { useMemo } from 'react'
import { performAge55Transfer, estimateCpfLifePayout, getRetirementSumAmount, projectCpfBalances } from '@/lib/calculations/cpf'
import type { PlannerContext } from '../types'

export interface PayoutEstimate {
  monthlyPayout: number
  retirementSumAt55: number
  plan: string
}

/**
 * Estimate CPF LIFE monthly payout based on current balances projected to age 55.
 * For users already 55+, uses current RA directly.
 */
export function useCpfLifeEstimate(ctx: PlannerContext): PayoutEstimate {
  return useMemo(() => {
    let retirementSumAt55: number

    if (ctx.profile.age >= 55) {
      // Already past 55 — RA balance is known
      retirementSumAt55 = ctx.accounts.ra
    } else {
      // Project to age 55: run year-by-year projection, then do the age-55 transfer
      const yearsTo55 = 55 - ctx.profile.age
      const annualSalary = ctx.income.monthlySalary * 12
      const projections = projectCpfBalances(
        ctx.profile.age, 54,
        ctx.accounts.oa, ctx.accounts.sa, ctx.accounts.ma,
        annualSalary, ctx.income.salaryGrowthRate,
      )
      const atAge54 = projections.length > 0
        ? projections[projections.length - 1]
        : { oaBalance: ctx.accounts.oa, saBalance: ctx.accounts.sa, maBalance: ctx.accounts.ma }

      const target = getRetirementSumAmount(ctx.cpfLife.retirementSum, ctx.profile.age)
      const { newRA } = performAge55Transfer(atAge54.oaBalance, atAge54.saBalance, target)
      retirementSumAt55 = newRA
    }

    const annualPayout = estimateCpfLifePayout(retirementSumAt55, ctx.cpfLife.plan)
    const monthlyPayout = annualPayout / 12

    return {
      monthlyPayout,
      retirementSumAt55,
      plan: ctx.cpfLife.plan,
    }
  }, [ctx])
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/tj/TJDevelopment/fireplanner && git add frontend/src/lib/cpf-transition/hooks/ && git commit -m "feat(cpf-transition): add main orchestration and hero payout hooks"
```

---

## Task 12: UI — DecisionCard and AutomaticCard Components

**Files:**
- Create: `frontend/src/components/cpf-transition/DecisionCard.tsx`
- Create: `frontend/src/components/cpf-transition/AutomaticCard.tsx`

- [ ] **Step 1: Write DecisionCard**

Build the comparison table card pattern from the spec. Props: `SchemeResult` + `actionType`. Shows action type badge, headline, summary, default outcome, comparison table, citations, and expandable "How is this calculated?" section. Projected values render with italic + muted color. Current values render solid.

- [ ] **Step 2: Write AutomaticCard**

Simpler variant for `actionType === 'automatic'`. Shows headline, summary, deltas, and citations. No comparison table.

- [ ] **Step 3: Commit**

```bash
cd /Users/tj/TJDevelopment/fireplanner && git add frontend/src/components/cpf-transition/DecisionCard.tsx frontend/src/components/cpf-transition/AutomaticCard.tsx && git commit -m "feat(cpf-transition): add DecisionCard and AutomaticCard components"
```

---

## Task 13: UI — CpfTransitionInput, CpfTransitionHero, CpfAccountCards

**Files:**
- Create: `frontend/src/components/cpf-transition/CpfTransitionInput.tsx`
- Create: `frontend/src/components/cpf-transition/CpfTransitionHero.tsx`
- Create: `frontend/src/components/cpf-transition/CpfAccountCards.tsx`

- [ ] **Step 1: Write CpfTransitionInput** — 3-5 field form using existing `CurrencyInput` and `NumberInput` wrappers. Dynamic SA/RA field based on age. Calls `updateField` from the params hook on change.

- [ ] **Step 2: Write CpfTransitionHero** — Displays monthly payout estimate from `useCpfLifeEstimate`. Hatched/faded styling for the projected number. **B4 fix: Label must say "in future dollars" to comply with CLAUDE.md dollar basis rule.** Example: "Your estimated monthly retirement income: ~$1,780 (in future dollars). Actual CPF LIFE payouts vary by birth year." Feedback CTA link.

- [ ] **Step 3: Write CpfAccountCards** — Three cards (OA/SA/MA or OA/RA/MA depending on age). Sticky positioned. Collapsed on mobile (single line, tap to expand). Uses `formatCurrency` for display.

- [ ] **Step 4: Commit**

```bash
cd /Users/tj/TJDevelopment/fireplanner && git add frontend/src/components/cpf-transition/CpfTransitionInput.tsx frontend/src/components/cpf-transition/CpfTransitionHero.tsx frontend/src/components/cpf-transition/CpfAccountCards.tsx && git commit -m "feat(cpf-transition): add input form, hero, and account card components"
```

---

## Task 14: UI — StoryChapter + Page Assembly

**Files:**
- Create: `frontend/src/components/cpf-transition/StoryChapter.tsx`
- Create: `frontend/src/pages/CpfTransitionPage.tsx`
- Modify: `frontend/src/router.tsx:109-110`
- Modify: `frontend/src/pages/CpfPlannerPage.tsx` (keep SEO, wrap new content)

- [ ] **Step 1: Write StoryChapter** — Container for a chapter. Shows chapter title, age range, and renders automatic/decision cards for each scheme in the chapter.

- [ ] **Step 2: Write CpfTransitionPage** — Assembles the full page: input form -> hero -> sticky account cards -> story chapters (from `useCpfTransition`). Preserves existing SEO schemas from CpfPlannerPage. Includes stale-data banner if `isStaleData`.

- [ ] **Step 3: Update router** — Move `/cpf-planner` outside `PlannerRouteShell` for standalone access (matching the `/goal-calculator` pattern). Keep the existing lazy import.

```typescript
// In router.tsx, move the cpf-planner route outside PlannerRouteShell:
// Before: inside the children array of PlannerRouteShell
// After: standalone route like goal-calculator
{ path: '/cpf-planner', element: page(CpfTransitionPage) },
```

- [ ] **Step 4: Run type-check and lint**

Run: `cd /Users/tj/TJDevelopment/fireplanner/frontend && npm run type-check && npm run lint`
Expected: Zero errors

- [ ] **Step 5: Run all tests**

Run: `cd /Users/tj/TJDevelopment/fireplanner/frontend && npm run test`
Expected: All tests pass (existing + new)

- [ ] **Step 6: Commit**

```bash
cd /Users/tj/TJDevelopment/fireplanner && git add frontend/src/components/cpf-transition/StoryChapter.tsx frontend/src/pages/CpfTransitionPage.tsx frontend/src/router.tsx && git commit -m "feat(cpf-transition): assemble page with story chapters and standalone route"
```

---

## Task 15: Manual QA + Dev Server Smoke Test

- [ ] **Step 1: Start dev server**

Run: `lsof -ti:5173 | xargs kill -9 2>/dev/null; cd /Users/tj/TJDevelopment/fireplanner/frontend && npm run dev -- --port 5173`

- [ ] **Step 2: Test the page** — Navigate to `http://localhost:5173/cpf-planner`. Verify:
  - Input form renders with age, OA, SA, MA, salary fields
  - Entering values updates the hero payout estimate
  - Account cards show OA/SA/MA for age < 55, OA/RA/MA for age >= 55
  - Story chapters render with scheme cards
  - Decision cards show comparison tables
  - Automatic cards show event descriptions
  - Citations link to cpf.gov.sg
  - URL params update as inputs change
  - Loading the page with `?age=55&oa=330000&ra=220000&ma=75000&salary=0` pre-fills the form

- [ ] **Step 3: Test bidirectional sync** — Enter data in CPF planner, navigate to `/inputs`, verify CPF balances are populated in the profile section.

- [ ] **Step 4: Fix any issues found**

- [ ] **Step 5: Final commit**

```bash
cd /Users/tj/TJDevelopment/fireplanner && git add -A && git commit -m "fix(cpf-transition): QA fixes from smoke test"
```

---

## Summary

**Plan 1 delivers:** A working `/cpf-planner` page with:
- 5 core schemes (age-55 transition, retirement sum targets, OA-to-RA transfer, RSTU top-up, CPF LIFE plan selection)
- Hero monthly payout estimate
- Sticky dynamic account cards (3-card, age-aware)
- Decision cards with comparison tables
- Bidirectional store linking
- URL param sharing
- Eligibility filtering and narrative ordering

**Plan 2 will add:** Remaining 14+ schemes, inline Sankey transition animator, mini waterfall summary chart, interest growth visualization.

**Plan 3 will add:** Couples mode, couple-specific schemes, feedback API endpoint, share URL encoding, mobile polish.
