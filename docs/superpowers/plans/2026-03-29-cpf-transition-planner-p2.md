# CPF Transition Planner: Plan 2 — Remaining Schemes + Visualizations

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement all remaining 17 CPF schemes plus 2 visualization components, building on the foundation from Plan 1. Each scheme follows the updated TDD pattern from Plan 1: SchemeDefinition with `assess()` (cheap) and `compute()` (full), registered in registry.ts.

**Architecture:** Same as Plan 1 (post-review fixes). Each scheme is a thin metadata+rules definition over the existing CPF calculation engine. Schemes delegate to functions in `lib/calculations/cpf.ts` and data in `lib/data/cpfRates.ts` / `lib/data/healthcarePremiums.ts`. New citations added to `policy/citations.ts` as needed.

**IMPORTANT — Review fixes applied to Plan 1 that affect ALL Plan 2 schemes:**

1. **`chapters: ChapterAge[]`** (not `chapter: ChapterAge`) — Use an array. Multi-chapter schemes appear in all their chapters.
2. **`assess()` + `compute()`** (not `eligibility()` + `relevanceScore()`) — `assess()` returns `{ eligible: boolean, relevance: number }`. `compute()` returns `SchemeResult`. See Plan 1 age55-transition for reference.
3. **Numeric ComparisonRow** — `ComparisonRow` has `defaultNumeric: number` and `actionNumeric: number` with `unit: 'currency' | 'percent' | 'months' | 'years' | 'text'`. Do NOT use `formatCurrency` in compute(). Formatting happens in DecisionCard UI.
4. **PolicyPack has `contributionRates`** — Use `ctx.policy.contributionRates` for rate lookups. Do NOT import `CPF_RATES` or `getCpfRatesForAge` directly. All data flows through PolicyPack for testability.
5. **`estimateCpfLifePayout()` returns ANNUAL** — Divide by 12 for monthly. Use a helper: `const toMonthly = (annual: number) => annual / 12`.

---

### REFERENCE SCHEME TEMPLATE

> All Plan 2 schemes MUST follow this pattern. The code blocks in Tasks 2-18 below were written before the Plan 1 review fixes. Implementing agents MUST adapt each scheme to this template.

```typescript
// === REFERENCE TEMPLATE: All Plan 2 schemes MUST follow this pattern ===
// The code blocks below were written before the Plan 1 review fixes.
// Implementing agents MUST adapt each scheme to this template.

import type { SchemeDefinition, PlannerContext, SchemeResult } from '../types'

export const exampleScheme: SchemeDefinition = {
  id: 'example-scheme',
  title: 'Goal-oriented title',
  goalLabel: 'User goal',
  chapters: ['at55', 'post55'],  // ARRAY, not singular
  actionType: 'optional',

  // CHEAP assessment — runs on ALL schemes every input change
  assess: (ctx: PlannerContext) => ({
    eligible: ctx.profile.age >= 55,
    relevance: 80,
  }),

  // FULL computation — called lazily per card, NOT eagerly
  compute: (ctx: PlannerContext): SchemeResult => ({
    headline: 'What happens',
    summary: 'Plain English explanation',
    defaultOutcome: 'If you do nothing: ...',
    metrics: [
      {
        metric: 'Monthly payout',
        defaultNumeric: 1200,      // RAW NUMBER, not formatCurrency()
        actionNumeric: 1800,       // RAW NUMBER
        unit: 'currency',          // REQUIRED
        suffix: '/month',          // OPTIONAL
        confidence: 'estimated',
      },
    ],
    deltas: [{ label: 'Payout increase', value: 600, formatted: '+$600/month', direction: 'positive' }],
    citations: [CITATIONS.reaching55],
    confidence: 'estimated',
    caveats: [],
  }),
}
```

> **Test note:** Tests must call `scheme.assess(ctx).eligible` (not `scheme.eligibility(ctx)`) and check `scheme.chapters` (array, not `scheme.chapter`).

---

**Tech Stack:** React 19, TypeScript, Zustand (existing stores), Recharts (CpfMiniWaterfall), Framer Motion (TransitionAnimator), Vitest

**Spec:** `docs/superpowers/specs/2026-03-29-cpf-transition-planner-design.md`
**Plan 1:** `docs/superpowers/plans/2026-03-29-cpf-transition-planner-p1.md`
**Research:** `docs/research/cpf-50-70-schemes-research.md`

**Depends on:** Plan 1 fully implemented (types, PolicyPack, PlannerContext, registry, orchestration, 5 core schemes, page shell)

---

## File Map

### New files to create

```
frontend/src/lib/cpf-transition/
  schemes/property-pledge.ts
  schemes/oa-withdrawal-55.ts
  schemes/post55-contributions.ts
  schemes/interest-growth.ts
  schemes/ma-bhs-overflow.ts
  schemes/vhr-housing-refund.ts
  schemes/mrss-matching.ts
  schemes/mmss-medisave.ts
  schemes/cpf-life-deferral.ts
  schemes/ra-lumpsum-65.ts
  schemes/lease-buyback.ts
  schemes/silver-support.ts
  schemes/srs-withdrawal.ts
  schemes/spousal-transfer.ts
  schemes/wis-workfare.ts
  schemes/nomination.ts
  schemes/healthcare-deductions.ts

frontend/src/lib/cpf-transition/tests/
  property-pledge.test.ts
  oa-withdrawal-55.test.ts
  post55-contributions.test.ts
  interest-growth.test.ts
  ma-bhs-overflow.test.ts
  vhr-housing-refund.test.ts
  mrss-matching.test.ts
  mmss-medisave.test.ts
  cpf-life-deferral.test.ts
  ra-lumpsum-65.test.ts
  lease-buyback.test.ts
  silver-support.test.ts
  srs-withdrawal.test.ts
  spousal-transfer.test.ts
  wis-workfare.test.ts
  nomination.test.ts
  healthcare-deductions.test.ts

frontend/src/components/cpf-transition/
  TransitionAnimator.tsx
  CpfMiniWaterfall.tsx
```

### Files to modify

```
frontend/src/lib/cpf-transition/policy/citations.ts   # Add new citation entries
frontend/src/lib/cpf-transition/schemes/registry.ts    # Register all new schemes
```

---

## Task 1: Add New Citations

**Files:**
- Modify: `frontend/src/lib/cpf-transition/policy/citations.ts`

- [ ] **Step 1: Add citations for all new schemes**

Add these entries to the existing `CITATIONS` object in `policy/citations.ts`:

```typescript
// Add to the existing CITATIONS object in policy/citations.ts

  propertyPledge: {
    label: 'CPF Board: Property Pledge',
    url: 'https://www.cpf.gov.sg/member/retirement-income/monthly-payouts/cpf-life/property-pledge',
    asOfDate: '2026-03-29',
  },
  oaWithdrawal: {
    label: 'CPF Board: Withdrawals from Age 55',
    url: 'https://www.cpf.gov.sg/member/retirement-income/milestones/reaching-age-55',
    asOfDate: '2026-03-29',
  },
  mrss: {
    label: 'CPF Board: Matched Retirement Savings Scheme',
    url: 'https://www.cpf.gov.sg/member/growing-your-savings/saving-more-with-cpf/matched-retirement-savings-scheme',
    asOfDate: '2026-03-29',
  },
  mmss: {
    label: 'CPF Board: Matched MediSave Scheme',
    url: 'https://www.cpf.gov.sg/member/growing-your-savings/saving-more-with-cpf/matched-medisave-scheme',
    asOfDate: '2026-03-29',
  },
  vhr: {
    label: 'CPF Board: Voluntary Housing Refund',
    url: 'https://www.cpf.gov.sg/member/growing-your-savings/saving-more-with-cpf/voluntary-housing-refund',
    asOfDate: '2026-03-29',
  },
  leaseBuyback: {
    label: 'HDB: Lease Buyback Scheme',
    url: 'https://www.hdb.gov.sg/residential/living-in-an-hdb-flat/for-our-seniors/lease-buyback-scheme',
    asOfDate: '2026-03-29',
  },
  silverSupport: {
    label: 'CPF Board: Silver Support Scheme',
    url: 'https://www.cpf.gov.sg/member/retirement-income/government-support/silver-support-scheme',
    asOfDate: '2026-03-29',
  },
  srsWithdrawal: {
    label: 'IRAS: SRS Withdrawal',
    url: 'https://www.iras.gov.sg/taxes/individual-income-tax/basics-of-individual-income-tax/special-tax-schemes/supplementary-retirement-scheme-(srs)',
    asOfDate: '2026-03-29',
  },
  spousalTransfer: {
    label: 'CPF Board: Transfer to Spouse',
    url: 'https://www.cpf.gov.sg/member/growing-your-savings/saving-more-with-cpf/transfer-cpf-savings-to-your-loved-ones',
    asOfDate: '2026-03-29',
  },
  wis: {
    label: 'Ministry of Manpower: Workfare Income Supplement',
    url: 'https://www.mom.gov.sg/employment-practices/workfare/workfare-income-supplement-scheme',
    asOfDate: '2026-03-29',
  },
  nomination: {
    label: 'CPF Board: CPF Nomination',
    url: 'https://www.cpf.gov.sg/member/account-services/cpf-nomination',
    asOfDate: '2026-03-29',
  },
  medishieldLife: {
    label: 'CPF Board: MediShield Life',
    url: 'https://www.cpf.gov.sg/member/healthcare-financing/medishield-life',
    asOfDate: '2026-03-29',
  },
  careshieldLife: {
    label: 'Ministry of Health: CareShield Life',
    url: 'https://www.careshieldlife.gov.sg/',
    asOfDate: '2026-03-29',
  },
  bhs: {
    label: 'CPF Board: Basic Healthcare Sum',
    url: 'https://www.cpf.gov.sg/member/healthcare-financing/basic-healthcare-sum',
    asOfDate: '2026-03-29',
  },
  cpfLifeDeferral: {
    label: 'CPF Board: Deferring CPF LIFE Payouts',
    url: 'https://www.cpf.gov.sg/member/retirement-income/monthly-payouts/cpf-life',
    asOfDate: '2026-03-29',
  },
  raLumpSum: {
    label: 'CPF Board: Lump Sum Withdrawal at 65',
    url: 'https://www.cpf.gov.sg/member/retirement-income/milestones/reaching-age-65',
    asOfDate: '2026-03-29',
  },
```

- [ ] **Step 2: Commit**

```bash
cd /Users/tj/TJDevelopment/fireplanner && git add frontend/src/lib/cpf-transition/policy/citations.ts && git commit -m "feat(cpf-transition): add citations for Plan 2 schemes"
```

---

## Task 2: Scheme -- Property Pledge

**Files:**
- Create: `frontend/src/lib/cpf-transition/schemes/property-pledge.ts`
- Test: `frontend/src/lib/cpf-transition/tests/property-pledge.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// frontend/src/lib/cpf-transition/tests/property-pledge.test.ts
import { describe, it, expect } from 'vitest'
import { propertyPledgeScheme } from '../schemes/property-pledge'
import { buildPlannerContext } from '../domain/context'

describe('propertyPledgeScheme', () => {
  const baseInputs = {
    age: 53,
    oa: 300000,
    sa: 250000,
    ra: 0,
    ma: 70000,
    monthlySalary: 8000,
    ownsProperty: true,
    hdbType: '4-room',
    remainingLease: 60,
  }

  describe('assess', () => {
    it('is eligible for property owners aged 50-64 who have not already pledged', () => {
      const ctx = buildPlannerContext(baseInputs)
      expect(propertyPledgeScheme.assess(ctx).eligible).toBe(true)
    })

    it('is not eligible for non-property owners', () => {
      const ctx = buildPlannerContext({ ...baseInputs, ownsProperty: false })
      expect(propertyPledgeScheme.assess(ctx).eligible).toBe(false)
    })

    it('is not eligible if property is already pledged', () => {
      const ctx = buildPlannerContext({ ...baseInputs, propertyPledged: true })
      expect(propertyPledgeScheme.assess(ctx).eligible).toBe(false)
    })

    it('is not eligible for age 65+', () => {
      const ctx = buildPlannerContext({
        ...baseInputs,
        age: 66,
        sa: 0,
        ra: 220000,
      })
      expect(propertyPledgeScheme.assess(ctx).eligible).toBe(false)
    })

    it('returns higher relevance closer to age 55', () => {
      const ctx53 = buildPlannerContext(baseInputs)
      const ctx50 = buildPlannerContext({ ...baseInputs, age: 50 })
      expect(propertyPledgeScheme.assess(ctx53).relevance).toBeGreaterThan(
        propertyPledgeScheme.assess(ctx50).relevance
      )
    })

    it('returns positive relevance for eligible user', () => {
      const ctx = buildPlannerContext(baseInputs)
      expect(propertyPledgeScheme.assess(ctx).relevance).toBeGreaterThan(0)
    })
  })

  describe('compute', () => {
    it('shows FRS vs BRS comparison with withdrawable difference', () => {
      const ctx = buildPlannerContext(baseInputs)
      const result = propertyPledgeScheme.compute(ctx)

      expect(result.headline).toContain('property')
      expect(result.summary).toContain('BRS')
      expect(result.metrics.length).toBeGreaterThanOrEqual(3)

      const withdrawableRow = result.metrics.find(
        (m) => m.metric.toLowerCase().includes('withdrawable')
      )
      expect(withdrawableRow).toBeDefined()
    })

    it('includes caveat about pledge refund at property sale', () => {
      const ctx = buildPlannerContext(baseInputs)
      const result = propertyPledgeScheme.compute(ctx)
      expect(result.caveats.some((c) => c.toLowerCase().includes('sell') || c.toLowerCase().includes('sale'))).toBe(true)
    })

    it('includes property pledge citation', () => {
      const ctx = buildPlannerContext(baseInputs)
      const result = propertyPledgeScheme.compute(ctx)
      expect(result.citations.length).toBeGreaterThan(0)
      expect(result.citations[0].url).toContain('cpf.gov.sg')
    })

    it('confidence is estimated for pre-55 users', () => {
      const ctx = buildPlannerContext(baseInputs)
      const result = propertyPledgeScheme.compute(ctx)
      expect(result.confidence).toBe('estimated')
    })
  })

  it('is optional action type in at55 chapter', () => {
    expect(propertyPledgeScheme.actionType).toBe('optional')
    expect(propertyPledgeScheme.chapters).toEqual(['at55'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/tj/TJDevelopment/fireplanner/frontend && npx vitest run src/lib/cpf-transition/tests/property-pledge.test.ts`
Expected: FAIL -- module not found

- [ ] **Step 3: Implement scheme**

```typescript
// frontend/src/lib/cpf-transition/schemes/property-pledge.ts
import type { SchemeDefinition, PlannerContext, SchemeResult } from '../types'
import { performAge55Transfer, estimateCpfLifePayout, getRetirementSumAmount } from '@/lib/calculations/cpf'
import { CITATIONS } from '../policy/citations'

export const propertyPledgeScheme: SchemeDefinition = {
  id: 'property-pledge',
  title: 'Pledge your property to unlock more cash at 55',
  goalLabel: 'Increase withdrawable savings',
  chapters: ['at55'],
  actionType: 'optional',

  assess: (ctx: PlannerContext) => {
    const eligible =
      ctx.property.owns &&
      !ctx.property.pledged &&
      ctx.profile.age >= 50 &&
      ctx.profile.age < 65

    // Most relevant close to 55 and when combined SA+OA is above FRS
    const distance = Math.abs(ctx.profile.age - 55)
    const base = Math.max(0, 75 - distance * 8)
    const combinedSavings = ctx.accounts.oa + ctx.accounts.sa + ctx.accounts.ra
    const frs = ctx.policy.retirementSums.frs
    const relevance = eligible ? (combinedSavings > frs ? base + 10 : base) : 0

    return { eligible, relevance }
  },

  compute: (ctx: PlannerContext): SchemeResult => {
    const { brs, frs } = ctx.policy.retirementSums

    // Scenario A: No pledge (FRS locked in RA)
    const transferFRS = performAge55Transfer(ctx.accounts.oa, ctx.accounts.sa, frs)
    const withdrawableFRS = Math.max(0, transferFRS.newOA)

    // Scenario B: Property pledge (only BRS locked in RA)
    const transferBRS = performAge55Transfer(ctx.accounts.oa, ctx.accounts.sa, brs)
    const withdrawableBRS = Math.max(0, transferBRS.newOA)

    const extraWithdrawable = withdrawableBRS - withdrawableFRS

    const payoutFRS = estimateCpfLifePayout(frs, ctx.cpfLife.plan) / 12
    const payoutBRS = estimateCpfLifePayout(brs, ctx.cpfLife.plan) / 12
    const payoutReduction = payoutFRS - payoutBRS

    return {
      headline: `Pledge your property to reduce locked RA from FRS to BRS`,
      summary: `If you own a property, you can pledge it to CPF Board. This reduces the amount locked in your RA from the Full Retirement Sum to the Basic Retirement Sum, freeing up more cash for withdrawal at 55.`,
      defaultOutcome: `If you do nothing, the FRS stays locked in your RA. You can withdraw OA above this amount.`,
      metrics: [
        {
          metric: 'Locked in RA',
          defaultNumeric: frs,
          actionNumeric: brs,
          unit: 'currency',
          confidence: 'estimated',
        },
        {
          metric: 'Withdrawable at 55',
          defaultNumeric: withdrawableFRS,
          actionNumeric: withdrawableBRS,
          unit: 'currency',
          confidence: 'estimated',
        },
        {
          metric: 'Extra cash unlocked',
          defaultNumeric: 0,
          actionNumeric: extraWithdrawable,
          unit: 'currency',
          confidence: 'estimated',
        },
        {
          metric: 'Est. monthly payout at 65',
          defaultNumeric: payoutFRS,
          actionNumeric: payoutBRS,
          unit: 'currency',
          suffix: '/month',
          confidence: 'estimated',
        },
        {
          metric: 'Monthly payout reduction',
          defaultNumeric: 0,
          actionNumeric: -payoutReduction,
          unit: 'currency',
          suffix: '/month',
          confidence: 'estimated',
        },
      ],
      deltas: [
        {
          label: 'Extra withdrawable cash',
          value: extraWithdrawable,
          formatted: `+$${extraWithdrawable.toLocaleString()}`,
          direction: 'positive',
        },
        {
          label: 'Monthly payout reduction',
          value: -payoutReduction * 12,
          formatted: `-$${Math.round(payoutReduction).toLocaleString()}/month`,
          direction: 'negative',
        },
      ],
      citations: [CITATIONS.propertyPledge, CITATIONS.retirementSums],
      confidence: 'estimated',
      caveats: [
        'When you sell the pledged property, the pledged amount plus accrued interest must be refunded to your RA.',
        'Property pledge only reduces the RA lock-in from FRS to BRS. It does not reduce the actual RA balance.',
        'Retirement sums grow ~3.5% per year. Actual BRS/FRS at your age 55 may differ.',
      ],
    }
  },
}
```

- [ ] **Step 4: Run tests**

Run: `cd /Users/tj/TJDevelopment/fireplanner/frontend && npx vitest run src/lib/cpf-transition/tests/property-pledge.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/tj/TJDevelopment/fireplanner && git add frontend/src/lib/cpf-transition/schemes/property-pledge.ts frontend/src/lib/cpf-transition/tests/property-pledge.test.ts && git commit -m "feat(cpf-transition): add property pledge scheme"
```

---

## Task 3: Scheme -- OA Withdrawal at 55

**Files:**
- Create: `frontend/src/lib/cpf-transition/schemes/oa-withdrawal-55.ts`
- Test: `frontend/src/lib/cpf-transition/tests/oa-withdrawal-55.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// frontend/src/lib/cpf-transition/tests/oa-withdrawal-55.test.ts
import { describe, it, expect } from 'vitest'
import { oaWithdrawal55Scheme } from '../schemes/oa-withdrawal-55'
import { buildPlannerContext } from '../domain/context'

describe('oaWithdrawal55Scheme', () => {
  describe('assess', () => {
    it('is eligible for users aged 50-64 with OA balance', () => {
      const ctx = buildPlannerContext({
        age: 53,
        oa: 300000,
        sa: 250000,
        ra: 0,
        ma: 70000,
        monthlySalary: 8000,
      })
      expect(oaWithdrawal55Scheme.assess(ctx).eligible).toBe(true)
    })

    it('is not eligible for users under 50', () => {
      const ctx = buildPlannerContext({
        age: 48,
        oa: 300000,
        sa: 250000,
        ra: 0,
        ma: 70000,
        monthlySalary: 8000,
      })
      expect(oaWithdrawal55Scheme.assess(ctx).eligible).toBe(false)
    })

    it('is not eligible if OA is zero', () => {
      const ctx = buildPlannerContext({
        age: 56,
        oa: 0,
        sa: 0,
        ra: 220000,
        ma: 70000,
        monthlySalary: 0,
      })
      expect(oaWithdrawal55Scheme.assess(ctx).eligible).toBe(false)
    })

    it('returns higher relevance when OA excess above FRS is larger', () => {
      const ctxRich = buildPlannerContext({
        age: 56,
        oa: 500000,
        sa: 0,
        ra: 220400,
        ma: 70000,
        monthlySalary: 0,
      })
      const ctxModest = buildPlannerContext({
        age: 56,
        oa: 50000,
        sa: 0,
        ra: 220400,
        ma: 70000,
        monthlySalary: 0,
      })
      expect(oaWithdrawal55Scheme.assess(ctxRich).relevance).toBeGreaterThan(
        oaWithdrawal55Scheme.assess(ctxModest).relevance
      )
    })
  })

  describe('compute', () => {
    it('shows withdrawable amount and opportunity cost for 55+ user', () => {
      const ctx = buildPlannerContext({
        age: 56,
        oa: 300000,
        sa: 0,
        ra: 220400,
        ma: 70000,
        monthlySalary: 0,
      })
      const result = oaWithdrawal55Scheme.compute(ctx)

      expect(result.headline).toContain('OA')
      expect(result.metrics.length).toBeGreaterThanOrEqual(2)

      // Should include opportunity cost metric
      const oppCostRow = result.metrics.find(
        (m) => m.metric.toLowerCase().includes('interest') || m.metric.toLowerCase().includes('opportunity')
      )
      expect(oppCostRow).toBeDefined()
    })

    it('shows $5,000 guaranteed minimum for user with RA below FRS', () => {
      const ctx = buildPlannerContext({
        age: 56,
        oa: 30000,
        sa: 0,
        ra: 150000,
        ma: 70000,
        monthlySalary: 0,
      })
      const result = oaWithdrawal55Scheme.compute(ctx)

      // Even with RA < FRS, the user can withdraw up to $5,000
      expect(result.summary).toContain('5,000')
    })

    it('includes citations', () => {
      const ctx = buildPlannerContext({
        age: 56,
        oa: 300000,
        sa: 0,
        ra: 220400,
        ma: 70000,
        monthlySalary: 0,
      })
      const result = oaWithdrawal55Scheme.compute(ctx)
      expect(result.citations.length).toBeGreaterThan(0)
    })
  })

  it('is optional action type in at55 chapter', () => {
    expect(oaWithdrawal55Scheme.actionType).toBe('optional')
    expect(oaWithdrawal55Scheme.chapters).toEqual(['at55'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/tj/TJDevelopment/fireplanner/frontend && npx vitest run src/lib/cpf-transition/tests/oa-withdrawal-55.test.ts`
Expected: FAIL -- module not found

- [ ] **Step 3: Implement scheme**

```typescript
// frontend/src/lib/cpf-transition/schemes/oa-withdrawal-55.ts
import type { SchemeDefinition, PlannerContext, SchemeResult } from '../types'
import { performAge55Transfer } from '@/lib/calculations/cpf'
import { CITATIONS } from '../policy/citations'

/** Minimum guaranteed withdrawal at 55 even if RA < FRS */
const MIN_WITHDRAWAL_55 = 5000

export const oaWithdrawal55Scheme: SchemeDefinition = {
  id: 'oa-withdrawal-55',
  title: 'Withdraw your OA savings at 55',
  goalLabel: 'Access cash at 55',
  chapters: ['at55'],
  actionType: 'optional',

  assess: (ctx: PlannerContext) => {
    const eligible = ctx.profile.age >= 50 && ctx.profile.age < 65 && ctx.accounts.oa > 0

    // Higher relevance when there is significant OA above FRS
    let relevance = 0
    if (eligible) {
      const frs = ctx.policy.retirementSums.frs
      if (ctx.profile.age >= 55) {
        // Post-55: OA is already separated, excess is directly withdrawable
        const excessRatio = Math.min(ctx.accounts.oa / frs, 1)
        relevance = Math.round(60 + excessRatio * 30)
      } else {
        // Pre-55: estimate post-transfer OA
        const { newOA } = performAge55Transfer(ctx.accounts.oa, ctx.accounts.sa, frs)
        relevance = newOA > 0 ? Math.round(50 + Math.min(newOA / frs, 1) * 30) : 30
      }
    }

    return { eligible, relevance }
  },

  compute: (ctx: PlannerContext): SchemeResult => {
    const frs = ctx.policy.retirementSums.frs
    let withdrawable: number
    let oaAfterTransfer: number

    if (ctx.profile.age >= 55) {
      // Already past 55: RA is set, OA is free if RA >= FRS
      oaAfterTransfer = ctx.accounts.oa
      if (ctx.accounts.ra >= frs) {
        withdrawable = oaAfterTransfer
      } else {
        withdrawable = Math.min(oaAfterTransfer, MIN_WITHDRAWAL_55)
      }
    } else {
      // Pre-55: simulate the transfer
      const { newOA, newRA } = performAge55Transfer(ctx.accounts.oa, ctx.accounts.sa, frs)
      oaAfterTransfer = newOA
      if (newRA >= frs) {
        withdrawable = oaAfterTransfer
      } else {
        withdrawable = Math.min(oaAfterTransfer, MIN_WITHDRAWAL_55)
      }
    }

    // Opportunity cost: OA earns 2.5% p.a.
    const oaRate = ctx.policy.interestRates.oa
    const interestOver10Years = withdrawable * (Math.pow(1 + oaRate, 10) - 1)

    const raMetFRS = ctx.profile.age >= 55
      ? ctx.accounts.ra >= frs
      : (ctx.accounts.sa + Math.max(0, ctx.accounts.oa - (ctx.accounts.sa >= frs ? 0 : frs - ctx.accounts.sa))) >= frs

    return {
      headline: `Withdraw your excess OA savings at 55`,
      summary: raMetFRS
        ? `Once your RA meets the FRS, you can withdraw all excess OA savings freely. This money is yours to use, but it stops earning 2.5% interest.`
        : `Your RA is below the FRS. You can still withdraw up to $5,000 from your OA at 55.`,
      defaultOutcome: `If you do nothing, your OA balance stays in CPF earning 2.5% per year.`,
      metrics: [
        {
          metric: 'Withdrawable at 55',
          defaultNumeric: 0,
          actionNumeric: withdrawable,
          unit: 'currency',
          confidence: ctx.profile.age >= 55 ? 'known' : 'estimated',
        },
        {
          metric: 'OA balance after withdrawal',
          defaultNumeric: oaAfterTransfer,
          actionNumeric: oaAfterTransfer - withdrawable,
          unit: 'currency',
          confidence: ctx.profile.age >= 55 ? 'known' : 'estimated',
        },
        {
          metric: 'Opportunity cost (interest over 10 years)',
          defaultNumeric: interestOver10Years,
          actionNumeric: 0,
          unit: 'currency',
          confidence: 'estimated',
        },
      ],
      deltas: [
        {
          label: 'Cash received',
          value: withdrawable,
          formatted: `+$${withdrawable.toLocaleString()}`,
          direction: 'positive',
        },
        {
          label: 'Foregone interest (10yr)',
          value: -interestOver10Years,
          formatted: `-$${Math.round(interestOver10Years).toLocaleString()}`,
          direction: 'negative',
        },
      ],
      citations: [CITATIONS.oaWithdrawal, CITATIONS.reaching55],
      confidence: ctx.profile.age >= 55 ? 'known' : 'estimated',
      caveats: [
        'If your RA is below the FRS, the maximum withdrawal is $5,000.',
        'Withdrawn money stops earning CPF interest (2.5% guaranteed).',
        'You can withdraw any time after 55, not just once.',
      ],
    }
  },
}
```

- [ ] **Step 4: Run tests**

Run: `cd /Users/tj/TJDevelopment/fireplanner/frontend && npx vitest run src/lib/cpf-transition/tests/oa-withdrawal-55.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/tj/TJDevelopment/fireplanner && git add frontend/src/lib/cpf-transition/schemes/oa-withdrawal-55.ts frontend/src/lib/cpf-transition/tests/oa-withdrawal-55.test.ts && git commit -m "feat(cpf-transition): add OA withdrawal at 55 scheme"
```

---

## Task 4: Scheme -- Post-55 Contribution Routing

> **API MIGRATION:** The code below uses a stale API. See the REFERENCE TEMPLATE above. Implementing agents must adapt `eligibility` to `assess`, `chapter` to `chapters`, and string metrics (`defaultValue`/`actionValue`) to numeric metrics (`defaultNumeric`/`actionNumeric` + `unit`).

**Files:**
- Create: `frontend/src/lib/cpf-transition/schemes/post55-contributions.ts`
- Test: `frontend/src/lib/cpf-transition/tests/post55-contributions.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// frontend/src/lib/cpf-transition/tests/post55-contributions.test.ts
import { describe, it, expect } from 'vitest'
import { post55ContributionsScheme } from '../schemes/post55-contributions'
import { buildPlannerContext } from '../domain/context'

describe('post55ContributionsScheme', () => {
  describe('eligibility', () => {
    it('is eligible for users aged 50+ with salary', () => {
      const ctx = buildPlannerContext({
        age: 52,
        oa: 200000,
        sa: 200000,
        ra: 0,
        ma: 60000,
        monthlySalary: 6000,
      })
      expect(post55ContributionsScheme.eligibility(ctx)).toBe(true)
    })

    it('is not eligible for users with no salary', () => {
      const ctx = buildPlannerContext({
        age: 57,
        oa: 200000,
        sa: 0,
        ra: 220000,
        ma: 60000,
        monthlySalary: 0,
      })
      expect(post55ContributionsScheme.eligibility(ctx)).toBe(false)
    })
  })

  describe('relevanceScore', () => {
    it('returns higher score for working users closer to 55', () => {
      const ctx54 = buildPlannerContext({
        age: 54,
        oa: 200000,
        sa: 200000,
        ra: 0,
        ma: 60000,
        monthlySalary: 6000,
      })
      const ctx50 = buildPlannerContext({
        age: 50,
        oa: 200000,
        sa: 200000,
        ra: 0,
        ma: 60000,
        monthlySalary: 6000,
      })
      expect(post55ContributionsScheme.relevanceScore(ctx54)).toBeGreaterThanOrEqual(
        post55ContributionsScheme.relevanceScore(ctx50)
      )
    })
  })

  describe('compute', () => {
    it('shows contribution rate table for multiple age bands', () => {
      const ctx = buildPlannerContext({
        age: 52,
        oa: 200000,
        sa: 200000,
        ra: 0,
        ma: 60000,
        monthlySalary: 6000,
      })
      const result = post55ContributionsScheme.compute(ctx)

      expect(result.headline).toContain('contribution')
      // Should have rows for at least 4 age bands: 50-55, 55-60, 60-65, 65-70
      expect(result.metrics.length).toBeGreaterThanOrEqual(4)
    })

    it('shows annual contribution amounts based on salary', () => {
      const ctx = buildPlannerContext({
        age: 57,
        oa: 200000,
        sa: 0,
        ra: 220000,
        ma: 60000,
        monthlySalary: 6000,
      })
      const result = post55ContributionsScheme.compute(ctx)
      // Check that metrics include formatted dollar amounts
      expect(result.metrics.some((m) => m.defaultValue.includes('$'))).toBe(true)
    })

    it('includes contribution rates citation', () => {
      const ctx = buildPlannerContext({
        age: 52,
        oa: 200000,
        sa: 200000,
        ra: 0,
        ma: 60000,
        monthlySalary: 6000,
      })
      const result = post55ContributionsScheme.compute(ctx)
      expect(result.citations.length).toBeGreaterThan(0)
    })
  })

  it('is automatic action type in post55 chapter', () => {
    expect(post55ContributionsScheme.actionType).toBe('automatic')
    expect(post55ContributionsScheme.chapter).toBe('post55')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/tj/TJDevelopment/fireplanner/frontend && npx vitest run src/lib/cpf-transition/tests/post55-contributions.test.ts`
Expected: FAIL -- module not found

- [ ] **Step 3: Implement scheme**

```typescript
// frontend/src/lib/cpf-transition/schemes/post55-contributions.ts
import type { SchemeDefinition, PlannerContext, SchemeResult } from '../types'
import { calculateCpfContribution } from '@/lib/calculations/cpf'
import { formatCurrency } from '@/lib/utils'
import { CITATIONS } from '../policy/citations'

/** Age bands to show in the contribution rate comparison */
const AGE_BANDS = [
  { label: '50-55', representativeAge: 52, totalRate: '37%', oaRate: '15%', saRate: '11.5%', maRate: '10.5%' },
  { label: '55-60', representativeAge: 57, totalRate: '34%', oaRate: '12%', saRate: '11.5% (RA)', maRate: '10.5%' },
  { label: '60-65', representativeAge: 62, totalRate: '25%', oaRate: '3.5%', saRate: '11% (RA)', maRate: '10.5%' },
  { label: '65-70', representativeAge: 67, totalRate: '16.5%', oaRate: '1%', saRate: '5% (RA)', maRate: '10.5%' },
  { label: 'Above 70', representativeAge: 72, totalRate: '12.5%', oaRate: '1%', saRate: '1% (RA)', maRate: '10.5%' },
]

export const post55ContributionsScheme: SchemeDefinition = {
  id: 'post55-contributions',
  title: 'How your CPF contributions change after 55',
  goalLabel: 'Understand contribution changes',
  chapter: 'post55',
  actionType: 'automatic',

  eligibility: (ctx: PlannerContext): boolean => {
    return ctx.profile.age >= 50 && ctx.income.monthlySalary > 0
  },

  relevanceScore: (ctx: PlannerContext): number => {
    // Higher relevance closer to the next rate-change age boundary
    const nextBoundary = [55, 60, 65, 70].find((a) => a > ctx.profile.age) ?? 70
    const distance = nextBoundary - ctx.profile.age
    return Math.max(0, 70 - distance * 5)
  },

  compute: (ctx: PlannerContext): SchemeResult => {
    const annualSalary = ctx.income.monthlySalary * 12
    const cappedSalary = Math.min(annualSalary, ctx.policy.owCeilingAnnual)

    // Compute annual contribution at each age band
    const metrics = AGE_BANDS.map((band) => {
      const contrib = calculateCpfContribution(annualSalary, band.representativeAge)
      return {
        metric: `Ages ${band.label}: ${band.totalRate} total`,
        defaultValue: `${formatCurrency(contrib.total, 0)}/year`,
        actionValue: `OA ${band.oaRate}, RA/SA ${band.saRate}, MA ${band.maRate}`,
        confidence: 'estimated' as const,
      }
    })

    // Find the user's current band
    const currentBand = AGE_BANDS.find(
      (b) => ctx.profile.age <= b.representativeAge + 3
    ) ?? AGE_BANDS[0]
    const currentContrib = calculateCpfContribution(annualSalary, ctx.profile.age)

    return {
      headline: `Your CPF contributions decline from ${currentBand.totalRate} as you age`,
      summary: `CPF contribution rates decrease in steps after age 55. The proportion going to OA drops significantly, while RA receives the former SA allocation. MA stays at 10.5% across all age bands. Post-55, SA contributions are redirected to RA.`,
      defaultOutcome: `This happens automatically. At your current salary of ${formatCurrency(ctx.income.monthlySalary)}/month (capped at ${formatCurrency(ctx.policy.owCeilingAnnual)}/year), your total CPF contribution is ${formatCurrency(currentContrib.total, 0)}/year.`,
      metrics,
      deltas: [
        {
          label: 'Current annual CPF contribution',
          value: currentContrib.total,
          formatted: formatCurrency(currentContrib.total, 0),
          direction: 'neutral',
        },
      ],
      citations: [CITATIONS.contributionRates],
      confidence: 'estimated',
      caveats: [
        'Rates shown are for Singapore Citizens. PR rates may differ.',
        'OW ceiling is $8,000/month ($96,000/year). Salary above this does not attract CPF.',
        'Employer contribution rates also decline with age.',
      ],
    }
  },
}
```

- [ ] **Step 4: Run tests**

Run: `cd /Users/tj/TJDevelopment/fireplanner/frontend && npx vitest run src/lib/cpf-transition/tests/post55-contributions.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/tj/TJDevelopment/fireplanner && git add frontend/src/lib/cpf-transition/schemes/post55-contributions.ts frontend/src/lib/cpf-transition/tests/post55-contributions.test.ts && git commit -m "feat(cpf-transition): add post-55 contribution routing scheme"
```

---

## Task 5: Scheme -- Interest Growth (Tiered Rates Visualization)

> **API MIGRATION:** The code below uses a stale API. See the REFERENCE TEMPLATE above. Implementing agents must adapt `eligibility` to `assess`, `chapter` to `chapters`, and string metrics (`defaultValue`/`actionValue`) to numeric metrics (`defaultNumeric`/`actionNumeric` + `unit`).

**Files:**
- Create: `frontend/src/lib/cpf-transition/schemes/interest-growth.ts`
- Test: `frontend/src/lib/cpf-transition/tests/interest-growth.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// frontend/src/lib/cpf-transition/tests/interest-growth.test.ts
import { describe, it, expect } from 'vitest'
import { interestGrowthScheme } from '../schemes/interest-growth'
import { buildPlannerContext } from '../domain/context'

describe('interestGrowthScheme', () => {
  describe('eligibility', () => {
    it('is eligible for all users aged 50+', () => {
      const ctx = buildPlannerContext({
        age: 50,
        oa: 200000,
        sa: 200000,
        ra: 0,
        ma: 60000,
        monthlySalary: 6000,
      })
      expect(interestGrowthScheme.eligibility(ctx)).toBe(true)
    })

    it('is not eligible for users under 50', () => {
      const ctx = buildPlannerContext({
        age: 45,
        oa: 200000,
        sa: 200000,
        ra: 0,
        ma: 60000,
        monthlySalary: 6000,
      })
      expect(interestGrowthScheme.eligibility(ctx)).toBe(false)
    })
  })

  describe('relevanceScore', () => {
    it('returns higher score for 55+ (extra interest kicks in)', () => {
      const ctx55 = buildPlannerContext({
        age: 56,
        oa: 200000,
        sa: 0,
        ra: 220000,
        ma: 60000,
        monthlySalary: 0,
      })
      const ctx52 = buildPlannerContext({
        age: 52,
        oa: 200000,
        sa: 200000,
        ra: 0,
        ma: 60000,
        monthlySalary: 6000,
      })
      expect(interestGrowthScheme.relevanceScore(ctx55)).toBeGreaterThan(
        interestGrowthScheme.relevanceScore(ctx52)
      )
    })
  })

  describe('compute', () => {
    it('shows tiered interest rates for 55+ user', () => {
      const ctx = buildPlannerContext({
        age: 57,
        oa: 100000,
        sa: 0,
        ra: 250000,
        ma: 70000,
        monthlySalary: 0,
      })
      const result = interestGrowthScheme.compute(ctx)

      expect(result.headline).toContain('interest')
      // Should show multiple tiers
      expect(result.metrics.length).toBeGreaterThanOrEqual(3)
    })

    it('computes total annual interest earned', () => {
      const ctx = buildPlannerContext({
        age: 57,
        oa: 100000,
        sa: 0,
        ra: 250000,
        ma: 70000,
        monthlySalary: 0,
      })
      const result = interestGrowthScheme.compute(ctx)
      // Annual interest on ~$420K combined should be significant
      expect(result.deltas.length).toBeGreaterThan(0)
      expect(result.deltas[0].value).toBeGreaterThan(0)
    })

    it('notes that OA extra interest is credited to RA for 55+', () => {
      const ctx = buildPlannerContext({
        age: 57,
        oa: 100000,
        sa: 0,
        ra: 250000,
        ma: 70000,
        monthlySalary: 0,
      })
      const result = interestGrowthScheme.compute(ctx)
      expect(
        result.caveats.some((c) => c.toLowerCase().includes('credited to ra') || c.toLowerCase().includes('oa extra'))
      ).toBe(true)
    })

    it('includes interest rate citation', () => {
      const ctx = buildPlannerContext({
        age: 57,
        oa: 100000,
        sa: 0,
        ra: 250000,
        ma: 70000,
        monthlySalary: 0,
      })
      const result = interestGrowthScheme.compute(ctx)
      expect(result.citations.length).toBeGreaterThan(0)
    })
  })

  it('is automatic action type in post55 chapter', () => {
    expect(interestGrowthScheme.actionType).toBe('automatic')
    expect(interestGrowthScheme.chapter).toBe('post55')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/tj/TJDevelopment/fireplanner/frontend && npx vitest run src/lib/cpf-transition/tests/interest-growth.test.ts`
Expected: FAIL -- module not found

- [ ] **Step 3: Implement scheme**

```typescript
// frontend/src/lib/cpf-transition/schemes/interest-growth.ts
import type { SchemeDefinition, PlannerContext, SchemeResult } from '../types'
import { calculateCpfExtraInterestWithAge } from '@/lib/calculations/cpf'
import { formatCurrency } from '@/lib/utils'
import { CITATIONS } from '../policy/citations'

export const interestGrowthScheme: SchemeDefinition = {
  id: 'interest-growth',
  title: 'How your CPF earns tiered interest',
  goalLabel: 'Understand interest rates',
  chapter: 'post55',
  actionType: 'automatic',

  eligibility: (ctx: PlannerContext): boolean => {
    return ctx.profile.age >= 50
  },

  relevanceScore: (ctx: PlannerContext): number => {
    // More relevant after 55 when extra interest tiers kick in
    return ctx.profile.age >= 55 ? 70 : 50
  },

  compute: (ctx: PlannerContext): SchemeResult => {
    const { oa, sa, ra, ma } = ctx.accounts
    const is55Plus = ctx.profile.age >= 55

    // Calculate base interest
    const oaBaseInterest = oa * ctx.policy.interestRates.oa
    const saBaseInterest = sa * ctx.policy.interestRates.sa
    const raBaseInterest = ra * ctx.policy.interestRates.ra
    const maBaseInterest = ma * ctx.policy.interestRates.ma
    const totalBaseInterest = oaBaseInterest + saBaseInterest + raBaseInterest + maBaseInterest

    // Calculate extra interest
    const extraInterest = calculateCpfExtraInterestWithAge(oa, sa, ma, ra, ctx.profile.age)
    const totalInterest = totalBaseInterest + extraInterest

    // Build tiered rate explanation rows
    const metrics = is55Plus
      ? [
          {
            metric: 'RA first $30K: up to 6%',
            defaultValue: `${formatCurrency(Math.min(ra, 30000)} at 6%`,
            actionValue: formatCurrency(Math.min(ra, 30000) * 0.06, 0),
            confidence: 'known' as const,
          },
          {
            metric: 'RA next $30K: up to 5%',
            defaultValue: `${formatCurrency(Math.max(0, Math.min(ra - 30000, 30000)))} at 5%`,
            actionValue: formatCurrency(Math.max(0, Math.min(ra - 30000, 30000)) * 0.05, 0),
            confidence: 'known' as const,
          },
          {
            metric: 'RA above $60K: 4%',
            defaultValue: `${formatCurrency(Math.max(0, ra - 60000))} at 4%`,
            actionValue: formatCurrency(Math.max(0, ra - 60000) * 0.04, 0),
            confidence: 'known' as const,
          },
          {
            metric: 'OA first $20K (within combined $30K tier): up to 3.5%',
            defaultValue: `${formatCurrency(Math.min(oa, 20000))} at 3.5%`,
            actionValue: formatCurrency(Math.min(oa, 20000) * 0.035, 0),
            confidence: 'known' as const,
          },
          {
            metric: 'OA above $20K: 2.5%',
            defaultValue: `${formatCurrency(Math.max(0, oa - 20000))} at 2.5%`,
            actionValue: formatCurrency(Math.max(0, oa - 20000) * 0.025, 0),
            confidence: 'known' as const,
          },
          {
            metric: 'MA: 4% + extra interest on qualifying portion',
            defaultValue: formatCurrency(ma),
            actionValue: formatCurrency(maBaseInterest, 0),
            confidence: 'known' as const,
          },
        ]
      : [
          {
            metric: 'OA first $20K: 3.5% (base 2.5% + 1% extra)',
            defaultValue: `${formatCurrency(Math.min(oa, 20000))} at 3.5%`,
            actionValue: formatCurrency(Math.min(oa, 20000) * 0.035, 0),
            confidence: 'known' as const,
          },
          {
            metric: 'OA above $20K: 2.5%',
            defaultValue: `${formatCurrency(Math.max(0, oa - 20000))} at 2.5%`,
            actionValue: formatCurrency(Math.max(0, oa - 20000) * 0.025, 0),
            confidence: 'known' as const,
          },
          {
            metric: 'SA: 4% + extra interest on qualifying portion',
            defaultValue: formatCurrency(sa),
            actionValue: formatCurrency(saBaseInterest, 0),
            confidence: 'known' as const,
          },
          {
            metric: 'MA: 4% + extra interest on qualifying portion',
            defaultValue: formatCurrency(ma),
            actionValue: formatCurrency(maBaseInterest, 0),
            confidence: 'known' as const,
          },
        ]

    return {
      headline: `Your CPF earns ${formatCurrency(totalInterest, 0)} in interest this year`,
      summary: is55Plus
        ? `After 55, your RA earns the highest tiered rates: up to 6% on the first $30K, 5% on the next $30K, and 4% above that. OA extra interest for members aged 55+ is credited to RA, not OA.`
        : `CPF pays extra interest on the first $60K of combined balances (OA capped at $20K). After 55, an additional tier adds up to 2% more on the first $30K and 1% more on the next $30K.`,
      defaultOutcome: `Interest is calculated and credited automatically. No action needed.`,
      metrics,
      deltas: [
        {
          label: 'Total annual interest',
          value: totalInterest,
          formatted: formatCurrency(totalInterest, 0),
          direction: 'positive',
        },
        {
          label: 'Extra interest earned',
          value: extraInterest,
          formatted: formatCurrency(extraInterest, 0),
          direction: 'positive',
        },
      ],
      citations: [CITATIONS.interestRates, CITATIONS.extraInterest],
      confidence: 'known',
      caveats: [
        is55Plus
          ? 'Extra interest earned on OA is credited to your RA, not OA.'
          : 'Extra interest earned on OA is credited to your SA (pre-55) or RA (post-55).',
        'Interest rates are reviewed quarterly. The 4% floor for SA/RA/MA is guaranteed through Dec 2026.',
        'Extra interest: +1% on first $60K combined (OA capped at $20K). After 55: additional +2% on first $30K and +1% on next $30K.',
      ],
    }
  },
}
```

- [ ] **Step 4: Run tests**

Run: `cd /Users/tj/TJDevelopment/fireplanner/frontend && npx vitest run src/lib/cpf-transition/tests/interest-growth.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/tj/TJDevelopment/fireplanner && git add frontend/src/lib/cpf-transition/schemes/interest-growth.ts frontend/src/lib/cpf-transition/tests/interest-growth.test.ts && git commit -m "feat(cpf-transition): add interest growth tiered rates scheme"
```

---

## Task 6: Scheme -- MA BHS Overflow Routing

> **API MIGRATION:** The code below uses a stale API. See the REFERENCE TEMPLATE above. Implementing agents must adapt `eligibility` to `assess`, `chapter` to `chapters`, and string metrics (`defaultValue`/`actionValue`) to numeric metrics (`defaultNumeric`/`actionNumeric` + `unit`).

**Files:**
- Create: `frontend/src/lib/cpf-transition/schemes/ma-bhs-overflow.ts`
- Test: `frontend/src/lib/cpf-transition/tests/ma-bhs-overflow.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// frontend/src/lib/cpf-transition/tests/ma-bhs-overflow.test.ts
import { describe, it, expect } from 'vitest'
import { maBhsOverflowScheme } from '../schemes/ma-bhs-overflow'
import { buildPlannerContext } from '../domain/context'

describe('maBhsOverflowScheme', () => {
  describe('eligibility', () => {
    it('is eligible when MA is close to or above BHS', () => {
      const ctx = buildPlannerContext({
        age: 57,
        oa: 200000,
        sa: 0,
        ra: 220000,
        ma: 75000,
        monthlySalary: 6000,
      })
      // MA $75K is close to BHS $79K
      expect(maBhsOverflowScheme.eligibility(ctx)).toBe(true)
    })

    it('is not eligible when MA is far below BHS', () => {
      const ctx = buildPlannerContext({
        age: 52,
        oa: 200000,
        sa: 200000,
        ra: 0,
        ma: 30000,
        monthlySalary: 6000,
      })
      // MA $30K is way below BHS $79K
      expect(maBhsOverflowScheme.eligibility(ctx)).toBe(false)
    })
  })

  describe('relevanceScore', () => {
    it('returns higher score when MA is closer to BHS', () => {
      const ctxClose = buildPlannerContext({
        age: 57,
        oa: 200000,
        sa: 0,
        ra: 220000,
        ma: 78000,
        monthlySalary: 6000,
      })
      const ctxFar = buildPlannerContext({
        age: 57,
        oa: 200000,
        sa: 0,
        ra: 220000,
        ma: 60000,
        monthlySalary: 6000,
      })
      expect(maBhsOverflowScheme.relevanceScore(ctxClose)).toBeGreaterThan(
        maBhsOverflowScheme.relevanceScore(ctxFar)
      )
    })
  })

  describe('compute', () => {
    it('shows overflow routing for 55+ user', () => {
      const ctx = buildPlannerContext({
        age: 57,
        oa: 200000,
        sa: 0,
        ra: 220000,
        ma: 80000,
        monthlySalary: 6000,
      })
      const result = maBhsOverflowScheme.compute(ctx)

      expect(result.headline).toContain('BHS')
      expect(result.summary).toContain('overflow')
    })

    it('explains routing: MA overflow -> RA (up to FRS) -> OA', () => {
      const ctx = buildPlannerContext({
        age: 57,
        oa: 200000,
        sa: 0,
        ra: 200000,
        ma: 80000,
        monthlySalary: 6000,
      })
      const result = maBhsOverflowScheme.compute(ctx)
      expect(result.summary.includes('RA') || result.metrics.some((m) => m.metric.includes('RA'))).toBe(true)
    })

    it('includes BHS citation', () => {
      const ctx = buildPlannerContext({
        age: 57,
        oa: 200000,
        sa: 0,
        ra: 220000,
        ma: 80000,
        monthlySalary: 6000,
      })
      const result = maBhsOverflowScheme.compute(ctx)
      expect(result.citations.length).toBeGreaterThan(0)
    })

    it('notes BHS freezes at 65', () => {
      const ctx = buildPlannerContext({
        age: 57,
        oa: 200000,
        sa: 0,
        ra: 220000,
        ma: 80000,
        monthlySalary: 6000,
      })
      const result = maBhsOverflowScheme.compute(ctx)
      expect(result.caveats.some((c) => c.includes('65') && c.includes('freeze'))).toBe(true)
    })
  })

  it('is automatic action type in post55 chapter', () => {
    expect(maBhsOverflowScheme.actionType).toBe('automatic')
    expect(maBhsOverflowScheme.chapter).toBe('post55')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/tj/TJDevelopment/fireplanner/frontend && npx vitest run src/lib/cpf-transition/tests/ma-bhs-overflow.test.ts`
Expected: FAIL -- module not found

- [ ] **Step 3: Implement scheme**

```typescript
// frontend/src/lib/cpf-transition/schemes/ma-bhs-overflow.ts
import type { SchemeDefinition, PlannerContext, SchemeResult } from '../types'
import { capMaAtBhs, calculateCpfContribution, getBhsAtAge } from '@/lib/calculations/cpf'
import { formatCurrency } from '@/lib/utils'
import { CITATIONS } from '../policy/citations'

export const maBhsOverflowScheme: SchemeDefinition = {
  id: 'ma-bhs-overflow',
  title: 'MediSave overflow when you hit the Basic Healthcare Sum',
  goalLabel: 'Understand MediSave cap',
  chapter: 'post55',
  actionType: 'automatic',

  eligibility: (ctx: PlannerContext): boolean => {
    // Show when MA is within 30% of BHS or above it
    return ctx.accounts.ma >= ctx.policy.bhs * 0.7
  },

  relevanceScore: (ctx: PlannerContext): number => {
    const ratio = ctx.accounts.ma / ctx.policy.bhs
    if (ratio >= 1) return 80 // Already at BHS
    return Math.round(40 + ratio * 40)
  },

  compute: (ctx: PlannerContext): SchemeResult => {
    const bhs = ctx.policy.bhs
    const maExcess = Math.max(0, ctx.accounts.ma - bhs)
    const is55Plus = ctx.profile.age >= 55
    const frs = ctx.policy.retirementSums.frs
    const raRoom = Math.max(0, frs - ctx.accounts.ra)

    // Estimate annual MA contribution to see overflow
    const annualSalary = ctx.income.monthlySalary * 12
    let annualMaContrib = 0
    if (annualSalary > 0) {
      const contrib = calculateCpfContribution(annualSalary, ctx.profile.age)
      annualMaContrib = contrib.maAllocation
    }

    // Simulate overflow routing
    const maRoom = Math.max(0, bhs - ctx.accounts.ma)
    const annualOverflow = Math.max(0, annualMaContrib - maRoom)

    // Where does the overflow go?
    let overflowToRA = 0
    let overflowToOA = 0
    let overflowToSA = 0

    if (annualOverflow > 0) {
      if (is55Plus) {
        overflowToRA = Math.min(annualOverflow, raRoom)
        overflowToOA = annualOverflow - overflowToRA
      } else {
        overflowToSA = annualOverflow
      }
    }

    // BHS at 65 (freezes)
    const bhsAt65 = ctx.profile.age < 65
      ? getBhsAtAge(65, ctx.profile.age)
      : bhs

    const metrics = [
      {
        metric: 'Current BHS',
        defaultValue: formatCurrency(bhs),
        actionValue: ctx.profile.age < 65 ? `${formatCurrency(bhsAt65)} at 65 (freezes)` : 'Frozen for life',
        confidence: 'known' as const,
      },
      {
        metric: 'Your MA balance',
        defaultValue: formatCurrency(ctx.accounts.ma),
        actionValue: maExcess > 0 ? `${formatCurrency(maExcess)} above BHS` : `${formatCurrency(bhs - ctx.accounts.ma)} below BHS`,
        confidence: 'known' as const,
      },
    ]

    if (annualSalary > 0) {
      metrics.push({
        metric: 'Annual MA contribution',
        defaultValue: formatCurrency(annualMaContrib, 0),
        actionValue: annualOverflow > 0 ? `${formatCurrency(annualOverflow, 0)} will overflow` : 'Fits within BHS',
        confidence: 'estimated' as const,
      })
    }

    if (annualOverflow > 0 && is55Plus) {
      metrics.push({
        metric: 'Overflow to RA',
        defaultValue: formatCurrency(overflowToRA, 0),
        actionValue: raRoom > 0 ? `Up to ${formatCurrency(raRoom, 0)} room in RA` : 'RA is full',
        confidence: 'estimated' as const,
      })
      metrics.push({
        metric: 'Overflow to OA',
        defaultValue: formatCurrency(overflowToOA, 0),
        actionValue: 'Withdrawable',
        confidence: 'estimated' as const,
      })
    } else if (annualOverflow > 0 && !is55Plus) {
      metrics.push({
        metric: 'Overflow to SA',
        defaultValue: formatCurrency(overflowToSA, 0),
        actionValue: 'Earns 4% interest',
        confidence: 'estimated' as const,
      })
    }

    return {
      headline: maExcess > 0
        ? `Your MediSave is ${formatCurrency(maExcess)} above the BHS (${formatCurrency(bhs)})`
        : `Your MediSave is approaching the BHS (${formatCurrency(bhs)})`,
      summary: `When your MediSave exceeds the Basic Healthcare Sum (BHS), the overflow is routed to other CPF accounts. ${is55Plus ? 'Post-55, overflow goes to RA first (up to your retirement sum target), then to OA.' : 'Pre-55, overflow goes to SA.'}`,
      defaultOutcome: `This happens automatically when MA contributions push your balance above the BHS.`,
      metrics,
      deltas: annualOverflow > 0
        ? [
            {
              label: 'Annual overflow redirected',
              value: annualOverflow,
              formatted: formatCurrency(annualOverflow, 0),
              direction: 'neutral',
            },
          ]
        : [],
      citations: [CITATIONS.bhs],
      confidence: annualSalary > 0 ? 'estimated' : 'known',
      caveats: [
        'BHS grows ~4.5% per year until you turn 65, then it freezes permanently at your age-65 cohort value.',
        `Your BHS at 65 is estimated at ${formatCurrency(bhsAt65)}.`,
        'MediShield Life and CareShield Life premiums are deducted from MA before overflow is calculated.',
      ],
    }
  },
}
```

- [ ] **Step 4: Run tests**

Run: `cd /Users/tj/TJDevelopment/fireplanner/frontend && npx vitest run src/lib/cpf-transition/tests/ma-bhs-overflow.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/tj/TJDevelopment/fireplanner && git add frontend/src/lib/cpf-transition/schemes/ma-bhs-overflow.ts frontend/src/lib/cpf-transition/tests/ma-bhs-overflow.test.ts && git commit -m "feat(cpf-transition): add MA BHS overflow routing scheme"
```

---

## Task 7: Scheme -- Voluntary Housing Refund (VHR)

> **API MIGRATION:** The code below uses a stale API. See the REFERENCE TEMPLATE above. Implementing agents must adapt `eligibility` to `assess`, `chapter` to `chapters`, and string metrics (`defaultValue`/`actionValue`) to numeric metrics (`defaultNumeric`/`actionNumeric` + `unit`).

**Files:**
- Create: `frontend/src/lib/cpf-transition/schemes/vhr-housing-refund.ts`
- Test: `frontend/src/lib/cpf-transition/tests/vhr-housing-refund.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// frontend/src/lib/cpf-transition/tests/vhr-housing-refund.test.ts
import { describe, it, expect } from 'vitest'
import { vhrHousingRefundScheme } from '../schemes/vhr-housing-refund'
import { buildPlannerContext } from '../domain/context'

describe('vhrHousingRefundScheme', () => {
  const baseInputs = {
    age: 53,
    oa: 200000,
    sa: 200000,
    ra: 0,
    ma: 60000,
    monthlySalary: 6000,
    ownsProperty: true,
    hdbType: '4-room',
  }

  describe('eligibility', () => {
    it('is eligible for property owners aged 50+', () => {
      const ctx = buildPlannerContext(baseInputs)
      expect(vhrHousingRefundScheme.eligibility(ctx)).toBe(true)
    })

    it('is not eligible for non-property owners', () => {
      const ctx = buildPlannerContext({ ...baseInputs, ownsProperty: false })
      expect(vhrHousingRefundScheme.eligibility(ctx)).toBe(false)
    })
  })

  describe('relevanceScore', () => {
    it('returns positive score for eligible users', () => {
      const ctx = buildPlannerContext(baseInputs)
      expect(vhrHousingRefundScheme.relevanceScore(ctx)).toBeGreaterThan(0)
    })
  })

  describe('compute', () => {
    it('explains pre-55 refund routing to SA', () => {
      const ctx = buildPlannerContext(baseInputs)
      const result = vhrHousingRefundScheme.compute(ctx)

      expect(result.headline).toContain('housing')
      expect(result.summary).toContain('SA')
    })

    it('explains post-55 refund routing to RA first', () => {
      const ctx = buildPlannerContext({
        ...baseInputs,
        age: 57,
        sa: 0,
        ra: 200000,
      })
      const result = vhrHousingRefundScheme.compute(ctx)
      expect(result.summary).toContain('RA')
    })

    it('includes VHR citation', () => {
      const ctx = buildPlannerContext(baseInputs)
      const result = vhrHousingRefundScheme.compute(ctx)
      expect(result.citations.length).toBeGreaterThan(0)
    })

    it('mentions reducing future refund obligation on property sale', () => {
      const ctx = buildPlannerContext(baseInputs)
      const result = vhrHousingRefundScheme.compute(ctx)
      expect(
        result.summary.toLowerCase().includes('refund') ||
        result.caveats.some((c) => c.toLowerCase().includes('sell') || c.toLowerCase().includes('sale'))
      ).toBe(true)
    })
  })

  it('is optional action type in post55 chapter', () => {
    expect(vhrHousingRefundScheme.actionType).toBe('optional')
    expect(vhrHousingRefundScheme.chapter).toBe('post55')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/tj/TJDevelopment/fireplanner/frontend && npx vitest run src/lib/cpf-transition/tests/vhr-housing-refund.test.ts`
Expected: FAIL -- module not found

- [ ] **Step 3: Implement scheme**

```typescript
// frontend/src/lib/cpf-transition/schemes/vhr-housing-refund.ts
import type { SchemeDefinition, PlannerContext, SchemeResult } from '../types'
import { formatCurrency } from '@/lib/utils'
import { CITATIONS } from '../policy/citations'

export const vhrHousingRefundScheme: SchemeDefinition = {
  id: 'vhr-housing-refund',
  title: 'Voluntary Housing Refund to boost higher-interest accounts',
  goalLabel: 'Boost retirement savings',
  chapter: 'post55',
  actionType: 'optional',

  eligibility: (ctx: PlannerContext): boolean => {
    return ctx.property.owns && ctx.profile.age >= 50
  },

  relevanceScore: (ctx: PlannerContext): number => {
    // More relevant if user is approaching 55 or post-55 with RA below FRS
    if (ctx.profile.age >= 55) {
      const raRoom = ctx.policy.retirementSums.frs - ctx.accounts.ra
      return raRoom > 0 ? 65 : 40
    }
    const distance = Math.abs(ctx.profile.age - 55)
    return Math.max(0, 55 - distance * 5)
  },

  compute: (ctx: PlannerContext): SchemeResult => {
    const is55Plus = ctx.profile.age >= 55
    const frs = ctx.policy.retirementSums.frs

    // VHR amount is the total OA used for housing (principal + accrued interest at 2.5%).
    // We don't know this exact value from inputs, so we show the concept and routing.
    // Users would check their CPF statement for the exact refund amount.

    if (is55Plus) {
      const raRoom = Math.max(0, frs - ctx.accounts.ra)

      return {
        headline: 'Refund OA housing usage to boost your RA and monthly payout',
        summary: `After 55, voluntary housing refunds go to your RA first (up to the FRS of ${formatCurrency(frs)}), then to OA. Refunded amounts earn 4-6% in RA instead of 2.5% in OA. This also reduces the mandatory refund obligation when you sell your property.`,
        defaultOutcome: 'If you do nothing, your housing usage amount accrues interest at 2.5% and must be refunded from sale proceeds when you sell the property.',
        metrics: [
          {
            metric: 'Current RA room (up to FRS)',
            defaultValue: formatCurrency(raRoom),
            actionValue: raRoom > 0 ? 'VHR fills RA first' : 'RA already at FRS, goes to OA',
            confidence: 'known',
          },
          {
            metric: 'Interest rate on refunded amount',
            defaultValue: '2.5% (in OA)',
            actionValue: '4-6% (in RA)',
            confidence: 'known',
          },
          {
            metric: 'Refund obligation at property sale',
            defaultValue: 'Full amount + accrued interest',
            actionValue: 'Reduced by VHR amount',
            confidence: 'known',
          },
        ],
        deltas: raRoom > 0
          ? [
              {
                label: 'Interest rate improvement',
                value: 0.015,
                formatted: '+1.5-3.5% higher interest',
                direction: 'positive',
              },
            ]
          : [],
        citations: [CITATIONS.vhr],
        confidence: 'known',
        caveats: [
          'Check your CPF statement for the exact housing refund amount (principal + accrued interest).',
          'Partial refunds are accepted. You do not have to refund the full amount.',
          'When you sell the property, any remaining housing usage amount plus accrued interest must be refunded to CPF.',
        ],
      }
    }

    // Pre-55: VHR goes to SA (higher interest than OA)
    return {
      headline: 'Refund OA housing usage to your SA before 55',
      summary: `Before 55, voluntary housing refunds go to your SA, earning 4% instead of 2.5% in OA. After 55, your SA becomes RA, so early refunds grow at the higher rate for longer.`,
      defaultOutcome: 'If you do nothing, your housing usage amount stays as an OA obligation earning 2.5%. At property sale, you must refund principal + accrued interest.',
      metrics: [
        {
          metric: 'Refund destination (pre-55)',
          defaultValue: 'SA (4% interest)',
          actionValue: 'Becomes part of RA at 55',
          confidence: 'known',
        },
        {
          metric: 'Interest rate improvement',
          defaultValue: '2.5% (OA obligation)',
          actionValue: '4% (in SA, then RA)',
          confidence: 'known',
        },
        {
          metric: 'Property sale obligation',
          defaultValue: 'Full amount + accrued interest',
          actionValue: 'Reduced by refund amount',
          confidence: 'known',
        },
      ],
      deltas: [
        {
          label: 'Interest rate improvement',
          value: 0.015,
          formatted: '+1.5% higher interest',
          direction: 'positive',
        },
      ],
      citations: [CITATIONS.vhr],
      confidence: 'known',
      caveats: [
        'Check your CPF statement for the exact housing refund amount.',
        'Partial refunds are accepted.',
        'After 55: refunds go to RA first (up to FRS), then OA.',
      ],
    }
  },
}
```

- [ ] **Step 4: Run tests**

Run: `cd /Users/tj/TJDevelopment/fireplanner/frontend && npx vitest run src/lib/cpf-transition/tests/vhr-housing-refund.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/tj/TJDevelopment/fireplanner && git add frontend/src/lib/cpf-transition/schemes/vhr-housing-refund.ts frontend/src/lib/cpf-transition/tests/vhr-housing-refund.test.ts && git commit -m "feat(cpf-transition): add voluntary housing refund scheme"
```

---

## Task 8: Scheme -- MRSS Matching

> **API MIGRATION:** The code below uses a stale API. See the REFERENCE TEMPLATE above. Implementing agents must adapt `eligibility` to `assess`, `chapter` to `chapters`, and string metrics (`defaultValue`/`actionValue`) to numeric metrics (`defaultNumeric`/`actionNumeric` + `unit`).

**Files:**
- Create: `frontend/src/lib/cpf-transition/schemes/mrss-matching.ts`
- Test: `frontend/src/lib/cpf-transition/tests/mrss-matching.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// frontend/src/lib/cpf-transition/tests/mrss-matching.test.ts
import { describe, it, expect } from 'vitest'
import { mrssMatchingScheme } from '../schemes/mrss-matching'
import { buildPlannerContext } from '../domain/context'

describe('mrssMatchingScheme', () => {
  const eligibleInputs = {
    age: 56,
    oa: 50000,
    sa: 0,
    ra: 80000,
    ma: 50000,
    monthlySalary: 3000,
  }

  describe('eligibility', () => {
    it('is eligible: 55+, citizen, RA < BRS, income <= $4,000/month', () => {
      const ctx = buildPlannerContext(eligibleInputs)
      // RA $80K < BRS $110K, salary $3K < $4K
      expect(mrssMatchingScheme.eligibility(ctx)).toBe(true)
    })

    it('is not eligible: RA >= BRS', () => {
      const ctx = buildPlannerContext({
        ...eligibleInputs,
        ra: 120000,
      })
      expect(mrssMatchingScheme.eligibility(ctx)).toBe(false)
    })

    it('is not eligible: income > $4,000/month', () => {
      const ctx = buildPlannerContext({
        ...eligibleInputs,
        monthlySalary: 5000,
      })
      expect(mrssMatchingScheme.eligibility(ctx)).toBe(false)
    })

    it('is not eligible: under 55', () => {
      const ctx = buildPlannerContext({
        ...eligibleInputs,
        age: 52,
        sa: 80000,
        ra: 0,
      })
      expect(mrssMatchingScheme.eligibility(ctx)).toBe(false)
    })

    it('is not eligible for non-citizens', () => {
      const ctx = buildPlannerContext({
        ...eligibleInputs,
        residency: 'foreigner' as const,
      })
      expect(mrssMatchingScheme.eligibility(ctx)).toBe(false)
    })
  })

  describe('relevanceScore', () => {
    it('returns higher score when RA is further below BRS', () => {
      const ctxLow = buildPlannerContext({ ...eligibleInputs, ra: 50000 })
      const ctxHigh = buildPlannerContext({ ...eligibleInputs, ra: 100000 })
      expect(mrssMatchingScheme.relevanceScore(ctxLow)).toBeGreaterThan(
        mrssMatchingScheme.relevanceScore(ctxHigh)
      )
    })
  })

  describe('compute', () => {
    it('shows annual cap of $2,000 and lifetime cap of $20,000', () => {
      const ctx = buildPlannerContext(eligibleInputs)
      const result = mrssMatchingScheme.compute(ctx)

      expect(result.summary).toContain('2,000')
      expect(result.summary).toContain('20,000')
    })

    it('shows dollar-for-dollar matching on cash top-ups', () => {
      const ctx = buildPlannerContext(eligibleInputs)
      const result = mrssMatchingScheme.compute(ctx)
      expect(result.headline.toLowerCase()).toContain('match')
    })

    it('includes MRSS citation', () => {
      const ctx = buildPlannerContext(eligibleInputs)
      const result = mrssMatchingScheme.compute(ctx)
      expect(result.citations.length).toBeGreaterThan(0)
    })

    it('mentions RSTU double-dipping restriction from YA 2026', () => {
      const ctx = buildPlannerContext(eligibleInputs)
      const result = mrssMatchingScheme.compute(ctx)
      expect(
        result.caveats.some((c) => c.includes('RSTU') || c.includes('tax relief'))
      ).toBe(true)
    })
  })

  it('is optional action type in at55 chapter', () => {
    expect(mrssMatchingScheme.actionType).toBe('optional')
    expect(mrssMatchingScheme.chapter).toBe('at55')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/tj/TJDevelopment/fireplanner/frontend && npx vitest run src/lib/cpf-transition/tests/mrss-matching.test.ts`
Expected: FAIL -- module not found

- [ ] **Step 3: Implement scheme**

```typescript
// frontend/src/lib/cpf-transition/schemes/mrss-matching.ts
import type { SchemeDefinition, PlannerContext, SchemeResult } from '../types'
import { formatCurrency } from '@/lib/utils'
import { CITATIONS } from '../policy/citations'

/** MRSS constants */
const MRSS_ANNUAL_CAP = 2000
const MRSS_LIFETIME_CAP = 20000
const MRSS_INCOME_CEILING = 4000 // monthly average
const MRSS_AV_CEILING = 21000 // annual value of property

export const mrssMatchingScheme: SchemeDefinition = {
  id: 'mrss-matching',
  title: 'Get dollar-for-dollar matching on RA top-ups',
  goalLabel: 'Free money for retirement',
  chapter: 'at55',
  actionType: 'optional',

  eligibility: (ctx: PlannerContext): boolean => {
    if (ctx.profile.age < 55) return false
    if (ctx.profile.residency !== 'citizen') return false
    if (ctx.accounts.ra >= ctx.policy.retirementSums.brs) return false
    if (ctx.income.monthlySalary > MRSS_INCOME_CEILING) return false
    return true
  },

  relevanceScore: (ctx: PlannerContext): number => {
    // More relevant when RA is further below BRS (more room for matching)
    const brs = ctx.policy.retirementSums.brs
    const raGap = Math.max(0, brs - ctx.accounts.ra)
    const gapRatio = Math.min(raGap / brs, 1)
    return Math.round(60 + gapRatio * 30)
  },

  compute: (ctx: PlannerContext): SchemeResult => {
    const brs = ctx.policy.retirementSums.brs
    const raGap = Math.max(0, brs - ctx.accounts.ra)
    const maxTopUp = Math.min(raGap, MRSS_ANNUAL_CAP)
    const matchAmount = maxTopUp // dollar-for-dollar
    const yearsOfMatching = Math.min(Math.ceil(MRSS_LIFETIME_CAP / MRSS_ANNUAL_CAP), Math.ceil(raGap / MRSS_ANNUAL_CAP))
    const totalLifetimeMatch = Math.min(MRSS_LIFETIME_CAP, raGap)

    return {
      headline: `Get up to ${formatCurrency(matchAmount)} in government matching this year`,
      summary: `The Matched Retirement Savings Scheme (MRSS) gives dollar-for-dollar matching on cash top-ups to your RA, up to ${formatCurrency(MRSS_ANNUAL_CAP)}/year and ${formatCurrency(MRSS_LIFETIME_CAP)} lifetime. You top up cash to your RA, and CPF Board matches the same amount.`,
      defaultOutcome: `If you do not make a cash top-up, you receive no matching. The government matching is only triggered by voluntary cash contributions to your RA.`,
      metrics: [
        {
          metric: 'Your RA gap (below BRS)',
          defaultValue: formatCurrency(raGap),
          actionValue: `Top up ${formatCurrency(maxTopUp)} to get match`,
          confidence: 'known',
        },
        {
          metric: 'Annual match',
          defaultValue: '$0 (no top-up)',
          actionValue: `+${formatCurrency(matchAmount)} from government`,
          confidence: 'known',
        },
        {
          metric: 'Your annual cost',
          defaultValue: '$0',
          actionValue: `${formatCurrency(maxTopUp)} cash top-up`,
          confidence: 'known',
        },
        {
          metric: 'Lifetime match available',
          defaultValue: formatCurrency(MRSS_LIFETIME_CAP),
          actionValue: `~${yearsOfMatching} years of matching`,
          confidence: 'estimated',
        },
        {
          metric: 'Effective return on top-up',
          defaultValue: 'N/A',
          actionValue: '100% immediate + 4-6% ongoing interest',
          confidence: 'known',
        },
      ],
      deltas: [
        {
          label: 'Free money this year',
          value: matchAmount,
          formatted: `+${formatCurrency(matchAmount)}`,
          direction: 'positive',
        },
        {
          label: 'Total lifetime matching potential',
          value: totalLifetimeMatch,
          formatted: `+${formatCurrency(totalLifetimeMatch)}`,
          direction: 'positive',
        },
      ],
      citations: [CITATIONS.mrss],
      confidence: 'known',
      caveats: [
        'Eligibility: 55+, Singapore Citizen, RA below BRS, average monthly income at most $4,000, property annual value at most $21,000, own at most 1 property.',
        'From YA 2026, cash top-ups that trigger MRSS matching no longer qualify for RSTU tax relief (no double-dipping).',
        'Match is credited to your RA in Q1 of the following year.',
        '~750,000 Singaporeans are estimated to be eligible in 2026.',
      ],
      whyShown: `Shown because your RA (${formatCurrency(ctx.accounts.ra)}) is below the BRS (${formatCurrency(brs)}) and your income is ${formatCurrency(ctx.income.monthlySalary)}/month.`,
    }
  },
}
```

- [ ] **Step 4: Run tests**

Run: `cd /Users/tj/TJDevelopment/fireplanner/frontend && npx vitest run src/lib/cpf-transition/tests/mrss-matching.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/tj/TJDevelopment/fireplanner && git add frontend/src/lib/cpf-transition/schemes/mrss-matching.ts frontend/src/lib/cpf-transition/tests/mrss-matching.test.ts && git commit -m "feat(cpf-transition): add MRSS matching scheme"
```

---

## Task 9: Scheme -- MMSS MediSave Matching

> **API MIGRATION:** The code below uses a stale API. See the REFERENCE TEMPLATE above. Implementing agents must adapt `eligibility` to `assess`, `chapter` to `chapters`, and string metrics (`defaultValue`/`actionValue`) to numeric metrics (`defaultNumeric`/`actionNumeric` + `unit`).

**Files:**
- Create: `frontend/src/lib/cpf-transition/schemes/mmss-medisave.ts`
- Test: `frontend/src/lib/cpf-transition/tests/mmss-medisave.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// frontend/src/lib/cpf-transition/tests/mmss-medisave.test.ts
import { describe, it, expect } from 'vitest'
import { mmssMedisaveScheme } from '../schemes/mmss-medisave'
import { buildPlannerContext } from '../domain/context'

describe('mmssMedisaveScheme', () => {
  const eligibleInputs = {
    age: 57,
    oa: 200000,
    sa: 0,
    ra: 220000,
    ma: 35000,
    monthlySalary: 3000,
  }

  describe('eligibility', () => {
    it('is eligible: 55-70, citizen, MA < half BHS', () => {
      const ctx = buildPlannerContext(eligibleInputs)
      // MA $35K < half BHS ($39.5K)
      expect(mmssMedisaveScheme.eligibility(ctx)).toBe(true)
    })

    it('is not eligible: MA >= half BHS', () => {
      const ctx = buildPlannerContext({ ...eligibleInputs, ma: 45000 })
      expect(mmssMedisaveScheme.eligibility(ctx)).toBe(false)
    })

    it('is not eligible: under 55', () => {
      const ctx = buildPlannerContext({
        ...eligibleInputs,
        age: 52,
        sa: 200000,
        ra: 0,
      })
      expect(mmssMedisaveScheme.eligibility(ctx)).toBe(false)
    })

    it('is not eligible: over 70', () => {
      const ctx = buildPlannerContext({
        ...eligibleInputs,
        age: 72,
      })
      expect(mmssMedisaveScheme.eligibility(ctx)).toBe(false)
    })
  })

  describe('relevanceScore', () => {
    it('returns higher score when MA is lower', () => {
      const ctxLow = buildPlannerContext({ ...eligibleInputs, ma: 20000 })
      const ctxHigh = buildPlannerContext({ ...eligibleInputs, ma: 38000 })
      expect(mmssMedisaveScheme.relevanceScore(ctxLow)).toBeGreaterThan(
        mmssMedisaveScheme.relevanceScore(ctxHigh)
      )
    })
  })

  describe('compute', () => {
    it('shows annual cap of $1,000', () => {
      const ctx = buildPlannerContext(eligibleInputs)
      const result = mmssMedisaveScheme.compute(ctx)
      expect(result.summary).toContain('1,000')
    })

    it('shows dollar-for-dollar matching', () => {
      const ctx = buildPlannerContext(eligibleInputs)
      const result = mmssMedisaveScheme.compute(ctx)
      expect(result.headline.toLowerCase()).toContain('match')
    })

    it('includes MMSS citation', () => {
      const ctx = buildPlannerContext(eligibleInputs)
      const result = mmssMedisaveScheme.compute(ctx)
      expect(result.citations.length).toBeGreaterThan(0)
    })

    it('notes pilot period 2026-2030', () => {
      const ctx = buildPlannerContext(eligibleInputs)
      const result = mmssMedisaveScheme.compute(ctx)
      expect(
        result.caveats.some((c) => c.includes('2026') || c.includes('pilot'))
      ).toBe(true)
    })
  })

  it('is optional action type in post55 chapter', () => {
    expect(mmssMedisaveScheme.actionType).toBe('optional')
    expect(mmssMedisaveScheme.chapter).toBe('post55')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/tj/TJDevelopment/fireplanner/frontend && npx vitest run src/lib/cpf-transition/tests/mmss-medisave.test.ts`
Expected: FAIL -- module not found

- [ ] **Step 3: Implement scheme**

```typescript
// frontend/src/lib/cpf-transition/schemes/mmss-medisave.ts
import type { SchemeDefinition, PlannerContext, SchemeResult } from '../types'
import { formatCurrency } from '@/lib/utils'
import { CITATIONS } from '../policy/citations'

/** MMSS constants */
const MMSS_ANNUAL_CAP = 1000
const MMSS_MIN_AGE = 55
const MMSS_MAX_AGE = 70

export const mmssMedisaveScheme: SchemeDefinition = {
  id: 'mmss-medisave',
  title: 'Get MediSave matching on cash top-ups',
  goalLabel: 'Boost MediSave for healthcare',
  chapter: 'post55',
  actionType: 'optional',

  eligibility: (ctx: PlannerContext): boolean => {
    if (ctx.profile.age < MMSS_MIN_AGE || ctx.profile.age > MMSS_MAX_AGE) return false
    if (ctx.profile.residency !== 'citizen') return false
    const halfBHS = ctx.policy.bhs / 2
    return ctx.accounts.ma < halfBHS
  },

  relevanceScore: (ctx: PlannerContext): number => {
    const halfBHS = ctx.policy.bhs / 2
    const maGapRatio = Math.max(0, (halfBHS - ctx.accounts.ma) / halfBHS)
    return Math.round(50 + maGapRatio * 30)
  },

  compute: (ctx: PlannerContext): SchemeResult => {
    const halfBHS = ctx.policy.bhs / 2
    const maGap = Math.max(0, halfBHS - ctx.accounts.ma)
    const maxTopUp = Math.min(maGap, MMSS_ANNUAL_CAP)
    const matchAmount = maxTopUp

    // Years of matching potential
    const yearsRemaining = Math.max(0, MMSS_MAX_AGE - ctx.profile.age)
    const totalPotentialMatch = Math.min(yearsRemaining * MMSS_ANNUAL_CAP, maGap)

    return {
      headline: `Get up to ${formatCurrency(matchAmount)} in MediSave matching this year`,
      summary: `The Matched MediSave Scheme (MMSS) gives dollar-for-dollar matching on cash top-ups to your MediSave, up to ${formatCurrency(MMSS_ANNUAL_CAP)}/year. This helps build your healthcare savings for MediShield Life premiums and medical expenses.`,
      defaultOutcome: `If you do not make a cash top-up to MediSave, you receive no matching.`,
      metrics: [
        {
          metric: 'Your MA gap (below half BHS)',
          defaultValue: formatCurrency(maGap),
          actionValue: `Top up ${formatCurrency(maxTopUp)} to get match`,
          confidence: 'known',
        },
        {
          metric: 'Annual match',
          defaultValue: '$0 (no top-up)',
          actionValue: `+${formatCurrency(matchAmount)} from government`,
          confidence: 'known',
        },
        {
          metric: 'Your annual cost',
          defaultValue: '$0',
          actionValue: `${formatCurrency(maxTopUp)} cash top-up`,
          confidence: 'known',
        },
        {
          metric: 'Effective return on top-up',
          defaultValue: 'N/A',
          actionValue: '100% immediate + 4% ongoing interest',
          confidence: 'known',
        },
      ],
      deltas: [
        {
          label: 'Free healthcare savings this year',
          value: matchAmount,
          formatted: `+${formatCurrency(matchAmount)}`,
          direction: 'positive',
        },
      ],
      citations: [CITATIONS.mmss],
      confidence: 'known',
      caveats: [
        'MMSS is a pilot scheme running from 2026 to 2030. ~185,000 Singaporeans are estimated to be eligible.',
        'Eligibility: 55-70, Singapore Citizen, MediSave below half of BHS.',
        `Half BHS threshold: ${formatCurrency(halfBHS)}.`,
        'Cash top-ups to MediSave can be made through the CPF website or app.',
      ],
      whyShown: `Shown because your MediSave (${formatCurrency(ctx.accounts.ma)}) is below half the BHS (${formatCurrency(halfBHS)}).`,
    }
  },
}
```

- [ ] **Step 4: Run tests**

Run: `cd /Users/tj/TJDevelopment/fireplanner/frontend && npx vitest run src/lib/cpf-transition/tests/mmss-medisave.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/tj/TJDevelopment/fireplanner && git add frontend/src/lib/cpf-transition/schemes/mmss-medisave.ts frontend/src/lib/cpf-transition/tests/mmss-medisave.test.ts && git commit -m "feat(cpf-transition): add MMSS MediSave matching scheme"
```

---

## Task 10: Scheme -- CPF LIFE Deferral Bonus

> **API MIGRATION:** The code below uses a stale API. See the REFERENCE TEMPLATE above. Implementing agents must adapt `eligibility` to `assess`, `chapter` to `chapters`, and string metrics (`defaultValue`/`actionValue`) to numeric metrics (`defaultNumeric`/`actionNumeric` + `unit`).

**Files:**
- Create: `frontend/src/lib/cpf-transition/schemes/cpf-life-deferral.ts`
- Test: `frontend/src/lib/cpf-transition/tests/cpf-life-deferral.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// frontend/src/lib/cpf-transition/tests/cpf-life-deferral.test.ts
import { describe, it, expect } from 'vitest'
import { cpfLifeDeferralScheme } from '../schemes/cpf-life-deferral'
import { buildPlannerContext } from '../domain/context'

describe('cpfLifeDeferralScheme', () => {
  describe('eligibility', () => {
    it('is eligible for users aged 50-70', () => {
      const ctx = buildPlannerContext({
        age: 60,
        oa: 100000,
        sa: 0,
        ra: 220000,
        ma: 70000,
        monthlySalary: 0,
      })
      expect(cpfLifeDeferralScheme.eligibility(ctx)).toBe(true)
    })

    it('is not eligible for users over 70', () => {
      const ctx = buildPlannerContext({
        age: 71,
        oa: 50000,
        sa: 0,
        ra: 220000,
        ma: 70000,
        monthlySalary: 0,
      })
      expect(cpfLifeDeferralScheme.eligibility(ctx)).toBe(false)
    })
  })

  describe('relevanceScore', () => {
    it('returns higher score for users closer to 65', () => {
      const ctx63 = buildPlannerContext({
        age: 63,
        oa: 100000,
        sa: 0,
        ra: 220000,
        ma: 70000,
        monthlySalary: 0,
      })
      const ctx55 = buildPlannerContext({
        age: 55,
        oa: 100000,
        sa: 0,
        ra: 220000,
        ma: 70000,
        monthlySalary: 0,
      })
      expect(cpfLifeDeferralScheme.relevanceScore(ctx63)).toBeGreaterThan(
        cpfLifeDeferralScheme.relevanceScore(ctx55)
      )
    })
  })

  describe('compute', () => {
    it('shows deferral bonus table from age 65 to 70', () => {
      const ctx = buildPlannerContext({
        age: 60,
        oa: 100000,
        sa: 0,
        ra: 220000,
        ma: 70000,
        monthlySalary: 0,
      })
      const result = cpfLifeDeferralScheme.compute(ctx)

      // Should have rows for ages 65-70 (6 rows)
      expect(result.metrics.length).toBeGreaterThanOrEqual(6)
    })

    it('shows ~7% per year deferral bonus', () => {
      const ctx = buildPlannerContext({
        age: 60,
        oa: 100000,
        sa: 0,
        ra: 220000,
        ma: 70000,
        monthlySalary: 0,
      })
      const result = cpfLifeDeferralScheme.compute(ctx)
      expect(result.summary).toContain('7%')
    })

    it('shows cumulative income comparison to age 85', () => {
      const ctx = buildPlannerContext({
        age: 60,
        oa: 100000,
        sa: 0,
        ra: 220000,
        ma: 70000,
        monthlySalary: 0,
      })
      const result = cpfLifeDeferralScheme.compute(ctx)
      // The cumulative income metric should be present
      expect(
        result.metrics.some((m) => m.metric.toLowerCase().includes('cumulative') || m.metric.toLowerCase().includes('total'))
      ).toBe(true)
    })

    it('includes CPF LIFE deferral citation', () => {
      const ctx = buildPlannerContext({
        age: 60,
        oa: 100000,
        sa: 0,
        ra: 220000,
        ma: 70000,
        monthlySalary: 0,
      })
      const result = cpfLifeDeferralScheme.compute(ctx)
      expect(result.citations.length).toBeGreaterThan(0)
    })
  })

  it('is optional action type in at65 chapter', () => {
    expect(cpfLifeDeferralScheme.actionType).toBe('optional')
    expect(cpfLifeDeferralScheme.chapter).toBe('at65')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/tj/TJDevelopment/fireplanner/frontend && npx vitest run src/lib/cpf-transition/tests/cpf-life-deferral.test.ts`
Expected: FAIL -- module not found

- [ ] **Step 3: Implement scheme**

```typescript
// frontend/src/lib/cpf-transition/schemes/cpf-life-deferral.ts
import type { SchemeDefinition, PlannerContext, SchemeResult } from '../types'
import { estimateCpfLifePayout } from '@/lib/calculations/cpf'
import { formatCurrency } from '@/lib/utils'
import { CITATIONS } from '../policy/citations'

/** Deferral bonus rate per year (approximate) */
const DEFERRAL_BONUS_PER_YEAR = 0.07

export const cpfLifeDeferralScheme: SchemeDefinition = {
  id: 'cpf-life-deferral',
  title: 'Defer CPF LIFE payouts for a higher monthly amount',
  goalLabel: 'Increase monthly payout',
  chapter: 'at65',
  actionType: 'optional',

  eligibility: (ctx: PlannerContext): boolean => {
    return ctx.profile.age >= 50 && ctx.profile.age <= 70
  },

  relevanceScore: (ctx: PlannerContext): number => {
    const distance = Math.abs(ctx.profile.age - 65)
    return Math.max(0, 85 - distance * 5)
  },

  compute: (ctx: PlannerContext): SchemeResult => {
    // Use current RA for 55+ or project to 55 for younger users
    const raForPayout = ctx.profile.age >= 55 ? ctx.accounts.ra : ctx.accounts.sa + ctx.accounts.oa
    const basePayout = estimateCpfLifePayout(
      Math.min(raForPayout, ctx.policy.retirementSums.frs),
      ctx.cpfLife.plan
    ) / 12

    // Build deferral table: ages 65-70
    const deferralTable = [65, 66, 67, 68, 69, 70].map((startAge) => {
      const yearsDeferred = startAge - 65
      const bonus = 1 + DEFERRAL_BONUS_PER_YEAR * yearsDeferred
      const monthlyPayout = basePayout * bonus
      const yearsReceiving = 85 - startAge
      const cumulativeTo85 = monthlyPayout * 12 * yearsReceiving
      return { startAge, bonus, monthlyPayout, cumulativeTo85 }
    })

    const metrics = deferralTable.map((row) => ({
      metric: `Start at ${row.startAge}: +${Math.round((row.bonus - 1) * 100)}% bonus`,
      defaultValue: `~${formatCurrency(row.monthlyPayout, 0)}/month`,
      actionValue: `~${formatCurrency(row.cumulativeTo85, 0)} total to age 85`,
      confidence: 'estimated' as const,
    }))

    const maxDeferral = deferralTable[deferralTable.length - 1]
    const noDeferral = deferralTable[0]

    return {
      headline: `Deferring CPF LIFE from 65 to 70 increases your payout by ~35%`,
      summary: `You can defer your CPF LIFE payout start age from 65 up to 70. Each year of deferral increases your monthly payout by approximately 7%. At 70, your payout is ~35% higher than at 65. However, you forgo payouts during the deferral years.`,
      defaultOutcome: `If you do nothing, CPF LIFE payouts start at 65 at ~${formatCurrency(noDeferral.monthlyPayout, 0)}/month.`,
      metrics,
      deltas: [
        {
          label: 'Maximum deferral benefit (age 70 vs 65)',
          value: (maxDeferral.monthlyPayout - noDeferral.monthlyPayout) * 12,
          formatted: `+${formatCurrency(maxDeferral.monthlyPayout - noDeferral.monthlyPayout, 0)}/month`,
          direction: 'positive',
        },
        {
          label: 'Breakeven age (start at 70 vs 65)',
          value: 0,
          formatted: '~82-84 years old',
          direction: 'neutral',
        },
      ],
      citations: [CITATIONS.cpfLifeDeferral, CITATIONS.cpfLife],
      confidence: 'estimated',
      caveats: [
        'Deferral bonus is approximately 7% per year, compounding.',
        'If you defer, you receive no payouts during the deferral period.',
        'At age 70, CPF LIFE auto-starts if you have not begun payouts (Standard Plan default).',
        'The breakeven age (where total payouts from deferral exceed the no-deferral scenario) is typically around 82-84.',
      ],
    }
  },
}
```

- [ ] **Step 4: Run tests**

Run: `cd /Users/tj/TJDevelopment/fireplanner/frontend && npx vitest run src/lib/cpf-transition/tests/cpf-life-deferral.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/tj/TJDevelopment/fireplanner && git add frontend/src/lib/cpf-transition/schemes/cpf-life-deferral.ts frontend/src/lib/cpf-transition/tests/cpf-life-deferral.test.ts && git commit -m "feat(cpf-transition): add CPF LIFE deferral bonus scheme"
```

---

## Task 11: Scheme -- 20% RA Lump Sum Withdrawal at 65

> **API MIGRATION:** The code below uses a stale API. See the REFERENCE TEMPLATE above. Implementing agents must adapt `eligibility` to `assess`, `chapter` to `chapters`, and string metrics (`defaultValue`/`actionValue`) to numeric metrics (`defaultNumeric`/`actionNumeric` + `unit`).

**Files:**
- Create: `frontend/src/lib/cpf-transition/schemes/ra-lumpsum-65.ts`
- Test: `frontend/src/lib/cpf-transition/tests/ra-lumpsum-65.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// frontend/src/lib/cpf-transition/tests/ra-lumpsum-65.test.ts
import { describe, it, expect } from 'vitest'
import { raLumpsum65Scheme } from '../schemes/ra-lumpsum-65'
import { buildPlannerContext } from '../domain/context'

describe('raLumpsum65Scheme', () => {
  describe('eligibility', () => {
    it('is eligible for users aged 50+', () => {
      const ctx = buildPlannerContext({
        age: 55,
        oa: 200000,
        sa: 0,
        ra: 220000,
        ma: 70000,
        monthlySalary: 0,
      })
      expect(raLumpsum65Scheme.eligibility(ctx)).toBe(true)
    })

    it('is not eligible for users under 50', () => {
      const ctx = buildPlannerContext({
        age: 45,
        oa: 200000,
        sa: 200000,
        ra: 0,
        ma: 70000,
        monthlySalary: 0,
      })
      expect(raLumpsum65Scheme.eligibility(ctx)).toBe(false)
    })
  })

  describe('compute', () => {
    it('calculates 20% of RA as withdrawable lump sum', () => {
      const ctx = buildPlannerContext({
        age: 65,
        oa: 50000,
        sa: 0,
        ra: 250000,
        ma: 70000,
        monthlySalary: 0,
      })
      const result = raLumpsum65Scheme.compute(ctx)

      // 20% of $250K = $50K
      expect(result.headline).toContain('50,000')
    })

    it('notes that the $5K from age 55 is inclusive', () => {
      const ctx = buildPlannerContext({
        age: 65,
        oa: 50000,
        sa: 0,
        ra: 250000,
        ma: 70000,
        monthlySalary: 0,
      })
      const result = raLumpsum65Scheme.compute(ctx)
      expect(
        result.caveats.some((c) => c.includes('5,000') || c.includes('inclusive'))
      ).toBe(true)
    })

    it('shows payout impact of withdrawal', () => {
      const ctx = buildPlannerContext({
        age: 65,
        oa: 50000,
        sa: 0,
        ra: 250000,
        ma: 70000,
        monthlySalary: 0,
      })
      const result = raLumpsum65Scheme.compute(ctx)
      expect(result.metrics.length).toBeGreaterThanOrEqual(3)
    })

    it('includes RA lump sum citation', () => {
      const ctx = buildPlannerContext({
        age: 65,
        oa: 50000,
        sa: 0,
        ra: 250000,
        ma: 70000,
        monthlySalary: 0,
      })
      const result = raLumpsum65Scheme.compute(ctx)
      expect(result.citations.length).toBeGreaterThan(0)
    })
  })

  it('is optional action type in at65 chapter', () => {
    expect(raLumpsum65Scheme.actionType).toBe('optional')
    expect(raLumpsum65Scheme.chapter).toBe('at65')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/tj/TJDevelopment/fireplanner/frontend && npx vitest run src/lib/cpf-transition/tests/ra-lumpsum-65.test.ts`
Expected: FAIL -- module not found

- [ ] **Step 3: Implement scheme**

```typescript
// frontend/src/lib/cpf-transition/schemes/ra-lumpsum-65.ts
import type { SchemeDefinition, PlannerContext, SchemeResult } from '../types'
import { estimateCpfLifePayout } from '@/lib/calculations/cpf'
import { formatCurrency } from '@/lib/utils'
import { CITATIONS } from '../policy/citations'

/** Maximum proportion withdrawable at 65 */
const LUMP_SUM_RATE = 0.20

/** Amount already withdrawable at 55 ($5K minimum) */
const AGE_55_WITHDRAWAL = 5000

export const raLumpsum65Scheme: SchemeDefinition = {
  id: 'ra-lumpsum-65',
  title: 'Withdraw up to 20% of your RA as a lump sum at 65',
  goalLabel: 'Access cash at 65',
  chapter: 'at65',
  actionType: 'optional',

  eligibility: (ctx: PlannerContext): boolean => {
    return ctx.profile.age >= 50
  },

  relevanceScore: (ctx: PlannerContext): number => {
    const distance = Math.abs(ctx.profile.age - 65)
    return Math.max(0, 80 - distance * 5)
  },

  compute: (ctx: PlannerContext): SchemeResult => {
    // Use RA for 55+ users, project for pre-55
    const raBalance = ctx.profile.age >= 55 ? ctx.accounts.ra : ctx.accounts.sa

    const totalLumpSum = Math.round(raBalance * LUMP_SUM_RATE)
    // The $5K at 55 is inclusive of the 20% at 65
    const additionalAt65 = Math.max(0, totalLumpSum - AGE_55_WITHDRAWAL)

    const raAfterWithdrawal = raBalance - totalLumpSum
    const payoutBefore = estimateCpfLifePayout(raBalance, ctx.cpfLife.plan) / 12
    const payoutAfter = estimateCpfLifePayout(raAfterWithdrawal, ctx.cpfLife.plan) / 12
    const payoutReduction = payoutBefore - payoutAfter

    return {
      headline: `Withdraw up to ${formatCurrency(totalLumpSum)} (20% of your RA) at 65`,
      summary: `At 65, you can withdraw up to 20% of your RA balance as a lump sum. This is inclusive of the $5,000 you may have already withdrawn at 55. The remaining 80% stays in CPF LIFE for monthly payouts.`,
      defaultOutcome: `If you do not withdraw, your full RA of ${formatCurrency(raBalance)} goes into CPF LIFE, giving you a higher monthly payout.`,
      metrics: [
        {
          metric: 'Total 20% lump sum',
          defaultValue: '$0 (leave in CPF)',
          actionValue: formatCurrency(totalLumpSum),
          confidence: ctx.profile.age >= 55 ? 'known' : 'estimated',
        },
        {
          metric: 'Already withdrawn at 55 ($5K)',
          defaultValue: formatCurrency(AGE_55_WITHDRAWAL),
          actionValue: 'Counted toward 20%',
          confidence: 'known',
        },
        {
          metric: 'Additional at 65',
          defaultValue: '$0',
          actionValue: formatCurrency(additionalAt65),
          confidence: ctx.profile.age >= 55 ? 'known' : 'estimated',
        },
        {
          metric: 'Est. monthly payout (full RA)',
          defaultValue: `~${formatCurrency(payoutBefore, 0)}/month`,
          actionValue: `~${formatCurrency(payoutAfter, 0)}/month (after withdrawal)`,
          confidence: 'estimated',
        },
        {
          metric: 'Monthly payout reduction',
          defaultValue: '$0',
          actionValue: `-${formatCurrency(payoutReduction, 0)}/month`,
          confidence: 'estimated',
        },
      ],
      deltas: [
        {
          label: 'Cash received at 65',
          value: additionalAt65,
          formatted: `+${formatCurrency(additionalAt65)}`,
          direction: 'positive',
        },
        {
          label: 'Payout reduction',
          value: -payoutReduction * 12,
          formatted: `-${formatCurrency(payoutReduction, 0)}/month`,
          direction: 'negative',
        },
      ],
      citations: [CITATIONS.raLumpSum, CITATIONS.reaching65],
      confidence: ctx.profile.age >= 55 ? 'known' : 'estimated',
      caveats: [
        'The 20% includes the $5,000 minimum withdrawal at 55. If you already withdrew $5,000, the additional at 65 is 20% of RA minus $5,000.',
        'Withdrawing reduces your CPF LIFE monthly payout proportionally.',
        'The withdrawal is optional. You do not have to withdraw at 65.',
      ],
    }
  },
}
```

- [ ] **Step 4: Run tests**

Run: `cd /Users/tj/TJDevelopment/fireplanner/frontend && npx vitest run src/lib/cpf-transition/tests/ra-lumpsum-65.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/tj/TJDevelopment/fireplanner && git add frontend/src/lib/cpf-transition/schemes/ra-lumpsum-65.ts frontend/src/lib/cpf-transition/tests/ra-lumpsum-65.test.ts && git commit -m "feat(cpf-transition): add RA lump sum withdrawal at 65 scheme"
```

---

## Task 12: Scheme -- Lease Buyback Scheme

> **API MIGRATION:** The code below uses a stale API. See the REFERENCE TEMPLATE above. Implementing agents must adapt `eligibility` to `assess`, `chapter` to `chapters`, and string metrics (`defaultValue`/`actionValue`) to numeric metrics (`defaultNumeric`/`actionNumeric` + `unit`).

**Files:**
- Create: `frontend/src/lib/cpf-transition/schemes/lease-buyback.ts`
- Test: `frontend/src/lib/cpf-transition/tests/lease-buyback.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// frontend/src/lib/cpf-transition/tests/lease-buyback.test.ts
import { describe, it, expect } from 'vitest'
import { leaseBuybackScheme } from '../schemes/lease-buyback'
import { buildPlannerContext } from '../domain/context'

describe('leaseBuybackScheme', () => {
  const eligibleInputs = {
    age: 66,
    oa: 50000,
    sa: 0,
    ra: 150000,
    ma: 60000,
    monthlySalary: 0,
    ownsProperty: true,
    hdbType: '4-room',
    remainingLease: 50,
  }

  describe('eligibility', () => {
    it('is eligible: 65+, HDB owner, citizen', () => {
      const ctx = buildPlannerContext(eligibleInputs)
      expect(leaseBuybackScheme.eligibility(ctx)).toBe(true)
    })

    it('is not eligible: under 65', () => {
      const ctx = buildPlannerContext({ ...eligibleInputs, age: 62, ra: 150000 })
      expect(leaseBuybackScheme.eligibility(ctx)).toBe(false)
    })

    it('is not eligible: no property', () => {
      const ctx = buildPlannerContext({ ...eligibleInputs, ownsProperty: false })
      expect(leaseBuybackScheme.eligibility(ctx)).toBe(false)
    })

    it('is not eligible: non-HDB (condo)', () => {
      const ctx = buildPlannerContext({ ...eligibleInputs, hdbType: 'condo' })
      expect(leaseBuybackScheme.eligibility(ctx)).toBe(false)
    })

    it('is not eligible: remaining lease < 20 years', () => {
      const ctx = buildPlannerContext({ ...eligibleInputs, remainingLease: 15 })
      expect(leaseBuybackScheme.eligibility(ctx)).toBe(false)
    })
  })

  describe('relevanceScore', () => {
    it('returns higher score when RA is below FRS', () => {
      const ctxLowRA = buildPlannerContext(eligibleInputs)
      const ctxHighRA = buildPlannerContext({ ...eligibleInputs, ra: 300000 })
      expect(leaseBuybackScheme.relevanceScore(ctxLowRA)).toBeGreaterThan(
        leaseBuybackScheme.relevanceScore(ctxHighRA)
      )
    })
  })

  describe('compute', () => {
    it('shows RA top-up target and LBS bonus', () => {
      const ctx = buildPlannerContext(eligibleInputs)
      const result = leaseBuybackScheme.compute(ctx)

      expect(result.headline.toLowerCase()).toContain('lease buyback')
      expect(result.metrics.length).toBeGreaterThanOrEqual(3)
    })

    it('shows LBS bonus amount based on flat type', () => {
      const ctx = buildPlannerContext(eligibleInputs)
      const result = leaseBuybackScheme.compute(ctx)
      // 4-room LBS bonus = $15,000
      expect(
        result.metrics.some((m) => m.metric.toLowerCase().includes('bonus'))
      ).toBe(true)
    })

    it('shows cash payout up to $100K', () => {
      const ctx = buildPlannerContext(eligibleInputs)
      const result = leaseBuybackScheme.compute(ctx)
      expect(
        result.metrics.some((m) => m.defaultValue.includes('100,000') || m.actionValue.includes('100,000'))
      ).toBe(true)
    })

    it('includes LBS citation', () => {
      const ctx = buildPlannerContext(eligibleInputs)
      const result = leaseBuybackScheme.compute(ctx)
      expect(result.citations.length).toBeGreaterThan(0)
    })
  })

  it('is optional action type in at65 chapter', () => {
    expect(leaseBuybackScheme.actionType).toBe('optional')
    expect(leaseBuybackScheme.chapter).toBe('at65')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/tj/TJDevelopment/fireplanner/frontend && npx vitest run src/lib/cpf-transition/tests/lease-buyback.test.ts`
Expected: FAIL -- module not found

- [ ] **Step 3: Implement scheme**

```typescript
// frontend/src/lib/cpf-transition/schemes/lease-buyback.ts
import type { SchemeDefinition, PlannerContext, SchemeResult } from '../types'
import { formatCurrency } from '@/lib/utils'
import { CITATIONS } from '../policy/citations'

/** LBS constants */
const LBS_MIN_AGE = 65
const LBS_MIN_REMAINING_LEASE = 20
const LBS_CASH_CAP = 100000
const LBS_INCOME_CEILING = 14000 // household monthly

/** LBS bonus by flat type */
const LBS_BONUS: Record<string, { full: number; label: string }> = {
  '1-room': { full: 30000, label: '3-room or smaller' },
  '2-room': { full: 30000, label: '3-room or smaller' },
  '3-room': { full: 30000, label: '3-room or smaller' },
  '4-room': { full: 15000, label: '4-room' },
  '5-room': { full: 7500, label: '5-room or larger' },
  'executive': { full: 7500, label: '5-room or larger' },
}

const HDB_TYPES = new Set(['1-room', '2-room', '3-room', '4-room', '5-room', 'executive'])

export const leaseBuybackScheme: SchemeDefinition = {
  id: 'lease-buyback',
  title: 'Lease Buyback Scheme: unlock home equity for retirement',
  goalLabel: 'Monetize HDB for retirement',
  chapter: 'at65',
  actionType: 'optional',

  eligibility: (ctx: PlannerContext): boolean => {
    if (ctx.profile.age < LBS_MIN_AGE) return false
    if (!ctx.property.owns) return false
    if (ctx.profile.residency !== 'citizen') return false

    // Must be HDB
    const hdbType = ctx.property.hdbType?.toLowerCase() ?? ''
    if (!HDB_TYPES.has(hdbType)) return false

    // Must have sufficient remaining lease
    if ((ctx.property.remainingLease ?? 0) < LBS_MIN_REMAINING_LEASE) return false

    return true
  },

  relevanceScore: (ctx: PlannerContext): number => {
    // More relevant when RA is well below FRS
    const frs = ctx.policy.retirementSums.frs
    const raGap = Math.max(0, frs - ctx.accounts.ra)
    const gapRatio = Math.min(raGap / frs, 1)
    return Math.round(50 + gapRatio * 30)
  },

  compute: (ctx: PlannerContext): SchemeResult => {
    const frs = ctx.policy.retirementSums.frs
    const brs = ctx.policy.retirementSums.brs
    const hdbType = ctx.property.hdbType?.toLowerCase() ?? '4-room'

    // RA top-up target: FRS for single owner, BRS for joint owner
    const isCoupleMode = ctx.household.isCoupleMode
    const raTarget = isCoupleMode ? brs : frs
    const raGap = Math.max(0, raTarget - ctx.accounts.ra)

    // LBS bonus
    const bonusEntry = LBS_BONUS[hdbType] ?? LBS_BONUS['4-room']
    const fullBonus = bonusEntry.full
    // Partial bonus: $1 for every $2 topped up if RA top-up < $60K
    const partialThreshold = 60000
    const bonus = raGap >= partialThreshold ? fullBonus : Math.round(Math.min(raGap, partialThreshold) / 2)

    return {
      headline: `Lease Buyback Scheme: top up RA and receive cash + bonus`,
      summary: `Sell the tail-end of your HDB lease to HDB and retain 15-35 years. Proceeds go to your RA first (${isCoupleMode ? 'BRS each for joint owners' : 'FRS for single owner'}), then cash up to ${formatCurrency(LBS_CASH_CAP)}. You continue living in the flat for the retained lease period.`,
      defaultOutcome: `If you do nothing, your HDB lease runs to expiry. You retain full ownership but no additional cash or RA top-up from the scheme.`,
      metrics: [
        {
          metric: `RA top-up target (${isCoupleMode ? 'BRS each' : 'FRS'})`,
          defaultValue: formatCurrency(ctx.accounts.ra),
          actionValue: `Top up to ${formatCurrency(raTarget)} (gap: ${formatCurrency(raGap)})`,
          confidence: 'known',
        },
        {
          metric: `LBS bonus (${bonusEntry.label})`,
          defaultValue: '$0',
          actionValue: `Up to ${formatCurrency(fullBonus)} (full) or ${formatCurrency(bonus)} (partial)`,
          confidence: 'estimated',
        },
        {
          metric: 'Cash payout (after RA top-up)',
          defaultValue: '$0',
          actionValue: `Up to ${formatCurrency(LBS_CASH_CAP)}`,
          confidence: 'estimated',
        },
        {
          metric: 'Remaining lease retained',
          defaultValue: `${ctx.property.remainingLease ?? 0} years`,
          actionValue: '15-35 years (your choice)',
          confidence: 'known',
        },
      ],
      deltas: [
        {
          label: 'RA top-up from proceeds',
          value: raGap,
          formatted: `+${formatCurrency(raGap)}`,
          direction: 'positive',
        },
        {
          label: 'LBS bonus',
          value: bonus,
          formatted: `+${formatCurrency(bonus)}`,
          direction: 'positive',
        },
      ],
      citations: [CITATIONS.leaseBuyback],
      confidence: 'estimated',
      caveats: [
        `Eligibility: 65+, Singapore Citizen, HDB owner, household income at most ${formatCurrency(LBS_INCOME_CEILING)}/month, no second property, at least 20 years remaining lease.`,
        'Proceeds flow to RA first. Only the amount above your RA target is paid as cash.',
        'Full LBS bonus requires RA top-up of at least $60,000. Below that, bonus is $1 for every $2 topped up.',
        'For joint owners, each owner tops up to BRS (not FRS).',
        'You continue living in the flat for the retained lease period (15-35 years).',
      ],
    }
  },
}
```

- [ ] **Step 4: Run tests**

Run: `cd /Users/tj/TJDevelopment/fireplanner/frontend && npx vitest run src/lib/cpf-transition/tests/lease-buyback.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/tj/TJDevelopment/fireplanner && git add frontend/src/lib/cpf-transition/schemes/lease-buyback.ts frontend/src/lib/cpf-transition/tests/lease-buyback.test.ts && git commit -m "feat(cpf-transition): add Lease Buyback Scheme"
```

---

## Task 13: Scheme -- Silver Support

> **API MIGRATION:** The code below uses a stale API. See the REFERENCE TEMPLATE above. Implementing agents must adapt `eligibility` to `assess`, `chapter` to `chapters`, and string metrics (`defaultValue`/`actionValue`) to numeric metrics (`defaultNumeric`/`actionNumeric` + `unit`).

**Files:**
- Create: `frontend/src/lib/cpf-transition/schemes/silver-support.ts`
- Test: `frontend/src/lib/cpf-transition/tests/silver-support.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// frontend/src/lib/cpf-transition/tests/silver-support.test.ts
import { describe, it, expect } from 'vitest'
import { silverSupportScheme } from '../schemes/silver-support'
import { buildPlannerContext } from '../domain/context'

describe('silverSupportScheme', () => {
  const eligibleInputs = {
    age: 66,
    oa: 30000,
    sa: 0,
    ra: 100000,
    ma: 40000,
    monthlySalary: 1000,
    ownsProperty: true,
    hdbType: '3-room',
  }

  describe('eligibility', () => {
    it('is eligible: 65+, citizen, lower income', () => {
      const ctx = buildPlannerContext(eligibleInputs)
      expect(silverSupportScheme.eligibility(ctx)).toBe(true)
    })

    it('is not eligible: under 65', () => {
      const ctx = buildPlannerContext({ ...eligibleInputs, age: 63, ra: 100000 })
      expect(silverSupportScheme.eligibility(ctx)).toBe(false)
    })

    it('is not eligible: high income', () => {
      const ctx = buildPlannerContext({ ...eligibleInputs, monthlySalary: 5000 })
      expect(silverSupportScheme.eligibility(ctx)).toBe(false)
    })
  })

  describe('relevanceScore', () => {
    it('returns higher score for lower income', () => {
      const ctxLow = buildPlannerContext(eligibleInputs)
      const ctxHigher = buildPlannerContext({ ...eligibleInputs, monthlySalary: 2000 })
      expect(silverSupportScheme.relevanceScore(ctxLow)).toBeGreaterThanOrEqual(
        silverSupportScheme.relevanceScore(ctxHigher)
      )
    })
  })

  describe('compute', () => {
    it('shows quarterly payout amounts by HDB type', () => {
      const ctx = buildPlannerContext(eligibleInputs)
      const result = silverSupportScheme.compute(ctx)

      expect(result.headline.toLowerCase()).toContain('silver support')
      expect(result.metrics.length).toBeGreaterThanOrEqual(2)
    })

    it('differentiates between lower and higher income tiers', () => {
      const ctxLow = buildPlannerContext(eligibleInputs)
      const ctxHigh = buildPlannerContext({ ...eligibleInputs, monthlySalary: 2000 })
      const resultLow = silverSupportScheme.compute(ctxLow)
      const resultHigh = silverSupportScheme.compute(ctxHigh)

      // Lower income should get higher payout
      expect(resultLow.deltas[0].value).toBeGreaterThan(resultHigh.deltas[0].value)
    })

    it('notes payouts are in cash, not CPF', () => {
      const ctx = buildPlannerContext(eligibleInputs)
      const result = silverSupportScheme.compute(ctx)
      expect(
        result.summary.toLowerCase().includes('cash') ||
        result.caveats.some((c) => c.toLowerCase().includes('cash'))
      ).toBe(true)
    })

    it('includes Silver Support citation', () => {
      const ctx = buildPlannerContext(eligibleInputs)
      const result = silverSupportScheme.compute(ctx)
      expect(result.citations.length).toBeGreaterThan(0)
    })
  })

  it('is automatic action type in at65 chapter', () => {
    expect(silverSupportScheme.actionType).toBe('automatic')
    expect(silverSupportScheme.chapter).toBe('at65')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/tj/TJDevelopment/fireplanner/frontend && npx vitest run src/lib/cpf-transition/tests/silver-support.test.ts`
Expected: FAIL -- module not found

- [ ] **Step 3: Implement scheme**

```typescript
// frontend/src/lib/cpf-transition/schemes/silver-support.ts
import type { SchemeDefinition, PlannerContext, SchemeResult } from '../types'
import { formatCurrency } from '@/lib/utils'
import { CITATIONS } from '../policy/citations'

/** Silver Support income ceiling (per person per month in household) */
const SS_INCOME_CEILING = 2300

/** Quarterly payout table: [hdbType][incomeTier] */
const SS_PAYOUTS: Record<string, { lower: number; higher: number }> = {
  '1-room': { lower: 1080, higher: 540 },
  '2-room': { lower: 1080, higher: 540 },
  '3-room': { lower: 860, higher: 430 },
  '4-room': { lower: 650, higher: 325 },
  '5-room': { lower: 430, higher: 215 },
  'executive': { lower: 430, higher: 215 },
}

const SS_INCOME_LOWER_CEILING = 1500

export const silverSupportScheme: SchemeDefinition = {
  id: 'silver-support',
  title: 'Silver Support: quarterly cash payouts for lower-income seniors',
  goalLabel: 'Government support',
  chapter: 'at65',
  actionType: 'automatic',

  eligibility: (ctx: PlannerContext): boolean => {
    if (ctx.profile.age < 65) return false
    if (ctx.profile.residency !== 'citizen') return false
    // Rough income check (actual uses household per-person)
    if (ctx.income.monthlySalary > SS_INCOME_CEILING) return false
    return true
  },

  relevanceScore: (ctx: PlannerContext): number => {
    // Higher relevance for lower income
    if (ctx.income.monthlySalary <= SS_INCOME_LOWER_CEILING) return 80
    if (ctx.income.monthlySalary <= SS_INCOME_CEILING) return 65
    return 0
  },

  compute: (ctx: PlannerContext): SchemeResult => {
    const hdbType = ctx.property.hdbType?.toLowerCase() ?? '4-room'
    const payoutEntry = SS_PAYOUTS[hdbType] ?? SS_PAYOUTS['4-room']
    const isLowerIncome = ctx.income.monthlySalary <= SS_INCOME_LOWER_CEILING

    const quarterlyPayout = isLowerIncome ? payoutEntry.lower : payoutEntry.higher
    const annualPayout = quarterlyPayout * 4

    // Build comparison table across HDB types
    const hdbTypes = ['1-2 Room', '3-Room', '4-Room', '5-Room+']
    const payoutKeys = ['1-room', '3-room', '4-room', '5-room']

    const metrics = hdbTypes.map((label, i) => {
      const key = payoutKeys[i]
      const entry = SS_PAYOUTS[key] ?? SS_PAYOUTS['4-room']
      return {
        metric: `${label} HDB`,
        defaultValue: `${formatCurrency(entry.lower, 0)}/quarter (income up to $1,500)`,
        actionValue: `${formatCurrency(entry.higher, 0)}/quarter (income $1,500-$2,300)`,
        confidence: 'known' as const,
      }
    })

    return {
      headline: `Silver Support: ~${formatCurrency(quarterlyPayout, 0)} per quarter in cash`,
      summary: `The Silver Support Scheme provides quarterly cash payouts to lower-income seniors aged 65 and above. Payouts are automatic, paid in cash (not CPF), and vary by HDB flat type and income level.`,
      defaultOutcome: `If eligible, payouts are automatic. No application needed. CPF Board determines eligibility annually.`,
      metrics,
      deltas: [
        {
          label: 'Quarterly cash payout',
          value: quarterlyPayout,
          formatted: `${formatCurrency(quarterlyPayout, 0)}/quarter`,
          direction: 'positive',
        },
        {
          label: 'Annual cash support',
          value: annualPayout,
          formatted: `${formatCurrency(annualPayout, 0)}/year`,
          direction: 'positive',
        },
      ],
      citations: [CITATIONS.silverSupport],
      confidence: 'estimated',
      caveats: [
        'Paid in cash, not CPF. No application needed.',
        'Eligibility: 65+, Singapore Citizen, household monthly income per person at most $2,300, lifetime CPF contributions by age 55 at most $140,000.',
        'Actual eligibility is assessed by CPF Board annually. The criteria above are approximate.',
        'Payouts are higher for smaller flats and lower household incomes.',
      ],
      whyShown: `Shown because you are ${ctx.profile.age} with monthly income of ${formatCurrency(ctx.income.monthlySalary)}.`,
    }
  },
}
```

- [ ] **Step 4: Run tests**

Run: `cd /Users/tj/TJDevelopment/fireplanner/frontend && npx vitest run src/lib/cpf-transition/tests/silver-support.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/tj/TJDevelopment/fireplanner && git add frontend/src/lib/cpf-transition/schemes/silver-support.ts frontend/src/lib/cpf-transition/tests/silver-support.test.ts && git commit -m "feat(cpf-transition): add Silver Support scheme"
```

---

## Task 14: Scheme -- SRS Withdrawal Timeline

> **API MIGRATION:** The code below uses a stale API. See the REFERENCE TEMPLATE above. Implementing agents must adapt `eligibility` to `assess`, `chapter` to `chapters`, and string metrics (`defaultValue`/`actionValue`) to numeric metrics (`defaultNumeric`/`actionNumeric` + `unit`).

**Files:**
- Create: `frontend/src/lib/cpf-transition/schemes/srs-withdrawal.ts`
- Test: `frontend/src/lib/cpf-transition/tests/srs-withdrawal.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// frontend/src/lib/cpf-transition/tests/srs-withdrawal.test.ts
import { describe, it, expect } from 'vitest'
import { srsWithdrawalScheme } from '../schemes/srs-withdrawal'
import { buildPlannerContext } from '../domain/context'

describe('srsWithdrawalScheme', () => {
  const eligibleInputs = {
    age: 60,
    oa: 200000,
    sa: 0,
    ra: 220000,
    ma: 70000,
    monthlySalary: 0,
    srsBalance: 300000,
  }

  describe('eligibility', () => {
    it('is eligible when SRS balance > 0 and age >= 50', () => {
      const ctx = buildPlannerContext(eligibleInputs)
      expect(srsWithdrawalScheme.eligibility(ctx)).toBe(true)
    })

    it('is not eligible when SRS balance is 0', () => {
      const ctx = buildPlannerContext({ ...eligibleInputs, srsBalance: 0 })
      expect(srsWithdrawalScheme.eligibility(ctx)).toBe(false)
    })

    it('is not eligible when under 50', () => {
      const ctx = buildPlannerContext({
        ...eligibleInputs,
        age: 48,
        sa: 200000,
        ra: 0,
      })
      expect(srsWithdrawalScheme.eligibility(ctx)).toBe(false)
    })
  })

  describe('relevanceScore', () => {
    it('returns higher score closer to SRS withdrawal age (62)', () => {
      const ctx60 = buildPlannerContext(eligibleInputs)
      const ctx55 = buildPlannerContext({
        ...eligibleInputs,
        age: 55,
        ra: 220000,
      })
      expect(srsWithdrawalScheme.relevanceScore(ctx60)).toBeGreaterThan(
        srsWithdrawalScheme.relevanceScore(ctx55)
      )
    })

    it('returns higher score for larger SRS balance', () => {
      const ctxLarge = buildPlannerContext(eligibleInputs)
      const ctxSmall = buildPlannerContext({ ...eligibleInputs, srsBalance: 50000 })
      expect(srsWithdrawalScheme.relevanceScore(ctxLarge)).toBeGreaterThan(
        srsWithdrawalScheme.relevanceScore(ctxSmall)
      )
    })
  })

  describe('compute', () => {
    it('shows optimal withdrawal of ~$40K/year for tax-free strategy', () => {
      const ctx = buildPlannerContext(eligibleInputs)
      const result = srsWithdrawalScheme.compute(ctx)

      expect(result.summary).toContain('40,000')
    })

    it('shows 10-year withdrawal window', () => {
      const ctx = buildPlannerContext(eligibleInputs)
      const result = srsWithdrawalScheme.compute(ctx)
      expect(result.summary).toContain('10')
    })

    it('shows 50% tax concession', () => {
      const ctx = buildPlannerContext(eligibleInputs)
      const result = srsWithdrawalScheme.compute(ctx)
      expect(result.summary).toContain('50%')
    })

    it('includes SRS withdrawal citation', () => {
      const ctx = buildPlannerContext(eligibleInputs)
      const result = srsWithdrawalScheme.compute(ctx)
      expect(result.citations.length).toBeGreaterThan(0)
    })
  })

  it('is optional action type in post55 chapter', () => {
    expect(srsWithdrawalScheme.actionType).toBe('optional')
    expect(srsWithdrawalScheme.chapter).toBe('post55')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/tj/TJDevelopment/fireplanner/frontend && npx vitest run src/lib/cpf-transition/tests/srs-withdrawal.test.ts`
Expected: FAIL -- module not found

- [ ] **Step 3: Implement scheme**

```typescript
// frontend/src/lib/cpf-transition/schemes/srs-withdrawal.ts
import type { SchemeDefinition, PlannerContext, SchemeResult } from '../types'
import { formatCurrency } from '@/lib/utils'
import { CITATIONS } from '../policy/citations'

/** SRS tax-free withdrawal threshold (50% of ~$80K personal relief = ~$40K taxable at 0%) */
const SRS_TAX_FREE_ANNUAL = 40000

/** Statutory retirement age for SRS penalty-free withdrawal */
const SRS_WITHDRAWAL_AGE = 62

/** SRS penalty-free withdrawal window */
const SRS_WINDOW_YEARS = 10

/** Early withdrawal penalty */
const SRS_EARLY_PENALTY_RATE = 0.05

export const srsWithdrawalScheme: SchemeDefinition = {
  id: 'srs-withdrawal',
  title: 'Plan your SRS withdrawal for minimum tax',
  goalLabel: 'Minimize SRS withdrawal tax',
  chapter: 'post55',
  actionType: 'optional',

  eligibility: (ctx: PlannerContext): boolean => {
    return ctx.srs.balance > 0 && ctx.profile.age >= 50
  },

  relevanceScore: (ctx: PlannerContext): number => {
    const distanceToWindow = Math.max(0, SRS_WITHDRAWAL_AGE - ctx.profile.age)
    const balanceScore = Math.min(30, Math.round(ctx.srs.balance / 10000))
    return Math.max(0, 70 - distanceToWindow * 5) + balanceScore
  },

  compute: (ctx: PlannerContext): SchemeResult => {
    const srsBalance = ctx.srs.balance

    // Optimal withdrawal: ~$40K/year = $0 tax (50% concession, below personal relief)
    const optimalAnnual = SRS_TAX_FREE_ANNUAL
    const yearsToWithdraw = Math.ceil(srsBalance / optimalAnnual)
    const fitsInWindow = yearsToWithdraw <= SRS_WINDOW_YEARS

    // If balance is too large for 10-year window at $40K/year
    const windowCapacity = SRS_WINDOW_YEARS * optimalAnnual // $400K
    const excessOverWindow = Math.max(0, srsBalance - windowCapacity)
    const adjustedAnnual = fitsInWindow
      ? optimalAnnual
      : Math.ceil(srsBalance / SRS_WINDOW_YEARS)
    const adjustedTaxable = adjustedAnnual * 0.5 // 50% concession

    // Penalty-free window start
    const windowStartAge = Math.max(ctx.profile.age, SRS_WITHDRAWAL_AGE)
    const windowEndAge = windowStartAge + SRS_WINDOW_YEARS

    // Early withdrawal cost
    const earlyPenalty = srsBalance * SRS_EARLY_PENALTY_RATE

    return {
      headline: `Plan your ${formatCurrency(srsBalance)} SRS withdrawal starting at age ${windowStartAge}`,
      summary: `SRS penalty-free withdrawals start at the statutory retirement age (62, or 63-64 depending on when you first contributed). You have a 10-year window. Only 50% of withdrawals are taxable. At ~${formatCurrency(optimalAnnual)}/year with no other income, you pay $0 tax.`,
      defaultOutcome: `If you do nothing before the window closes (age ${windowEndAge}), the remaining balance is treated as a lump sum withdrawal with 50% taxable, which could push you into a higher tax bracket.`,
      metrics: [
        {
          metric: 'SRS balance',
          defaultValue: formatCurrency(srsBalance),
          actionValue: `${yearsToWithdraw} years at ${formatCurrency(optimalAnnual)}/year`,
          confidence: 'known',
        },
        {
          metric: 'Penalty-free window',
          defaultValue: `Age ${windowStartAge} to ${windowEndAge}`,
          actionValue: `${SRS_WINDOW_YEARS} years`,
          confidence: 'known',
        },
        {
          metric: 'Optimal annual withdrawal (tax-free)',
          defaultValue: `${formatCurrency(optimalAnnual)}/year`,
          actionValue: '$0 tax (with no other income)',
          confidence: 'estimated',
        },
        ...(excessOverWindow > 0
          ? [
              {
                metric: 'Balance exceeding 10-year window capacity',
                defaultValue: formatCurrency(excessOverWindow),
                actionValue: `Withdraw ${formatCurrency(adjustedAnnual, 0)}/year (taxable: ${formatCurrency(adjustedTaxable, 0)})`,
                confidence: 'estimated' as const,
              },
            ]
          : []),
        {
          metric: 'Early withdrawal penalty (before window)',
          defaultValue: `${formatCurrency(earlyPenalty, 0)} (5% penalty + 100% taxable)`,
          actionValue: 'Avoid by waiting for penalty-free window',
          confidence: 'known',
        },
      ],
      deltas: fitsInWindow
        ? [
            {
              label: 'Tax savings vs lump-sum withdrawal',
              value: 0,
              formatted: 'Potentially $0 total tax over 10 years',
              direction: 'positive',
            },
          ]
        : [
            {
              label: 'Adjusted annual withdrawal',
              value: adjustedAnnual,
              formatted: `${formatCurrency(adjustedAnnual, 0)}/year (some tax payable)`,
              direction: 'neutral',
            },
          ],
      citations: [CITATIONS.srsWithdrawal],
      confidence: 'estimated',
      caveats: [
        'The statutory retirement age depends on when you made your first SRS contribution. It was 62 until Jun 2022, 63 from Jul 2022, and 64 from Jul 2026.',
        'The 50% tax concession applies only to penalty-free withdrawals within the 10-year window.',
        'If you have other taxable income during withdrawal years, the tax-free threshold may be lower.',
        'Remaining balance after the 10-year window is a lump-sum 50% taxable withdrawal.',
      ],
    }
  },
}
```

- [ ] **Step 4: Run tests**

Run: `cd /Users/tj/TJDevelopment/fireplanner/frontend && npx vitest run src/lib/cpf-transition/tests/srs-withdrawal.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/tj/TJDevelopment/fireplanner && git add frontend/src/lib/cpf-transition/schemes/srs-withdrawal.ts frontend/src/lib/cpf-transition/tests/srs-withdrawal.test.ts && git commit -m "feat(cpf-transition): add SRS withdrawal timeline scheme"
```

---

## Task 15: Scheme -- Spousal RA Transfer

> **API MIGRATION:** The code below uses a stale API. See the REFERENCE TEMPLATE above. Implementing agents must adapt `eligibility` to `assess`, `chapter` to `chapters`, and string metrics (`defaultValue`/`actionValue`) to numeric metrics (`defaultNumeric`/`actionNumeric` + `unit`).

**Files:**
- Create: `frontend/src/lib/cpf-transition/schemes/spousal-transfer.ts`
- Test: `frontend/src/lib/cpf-transition/tests/spousal-transfer.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// frontend/src/lib/cpf-transition/tests/spousal-transfer.test.ts
import { describe, it, expect } from 'vitest'
import { spousalTransferScheme } from '../schemes/spousal-transfer'
import { buildPlannerContext } from '../domain/context'

describe('spousalTransferScheme', () => {
  const eligibleInputs = {
    age: 56,
    oa: 300000,
    sa: 0,
    ra: 250000,
    ma: 70000,
    monthlySalary: 0,
    isCoupleMode: true,
  }

  describe('eligibility', () => {
    it('is eligible: 55+, couple mode, RA > BRS', () => {
      const ctx = buildPlannerContext(eligibleInputs)
      // RA $250K > BRS $110K, and couple mode
      expect(spousalTransferScheme.eligibility(ctx)).toBe(true)
    })

    it('is not eligible: not in couple mode', () => {
      const ctx = buildPlannerContext({ ...eligibleInputs, isCoupleMode: false })
      expect(spousalTransferScheme.eligibility(ctx)).toBe(false)
    })

    it('is not eligible: under 55', () => {
      const ctx = buildPlannerContext({
        ...eligibleInputs,
        age: 52,
        sa: 250000,
        ra: 0,
      })
      expect(spousalTransferScheme.eligibility(ctx)).toBe(false)
    })

    it('is not eligible: RA at or below BRS', () => {
      const ctx = buildPlannerContext({
        ...eligibleInputs,
        ra: 100000,
      })
      expect(spousalTransferScheme.eligibility(ctx)).toBe(false)
    })
  })

  describe('relevanceScore', () => {
    it('returns higher score with more excess above BRS', () => {
      const ctxHigh = buildPlannerContext({ ...eligibleInputs, ra: 400000 })
      const ctxLow = buildPlannerContext({ ...eligibleInputs, ra: 120000 })
      expect(spousalTransferScheme.relevanceScore(ctxHigh)).toBeGreaterThan(
        spousalTransferScheme.relevanceScore(ctxLow)
      )
    })
  })

  describe('compute', () => {
    it('shows transferable amount (excess OA/RA above BRS)', () => {
      const ctx = buildPlannerContext(eligibleInputs)
      const result = spousalTransferScheme.compute(ctx)

      expect(result.headline.toLowerCase()).toContain('spouse')
      expect(result.metrics.length).toBeGreaterThanOrEqual(2)
    })

    it('notes transfer is irreversible', () => {
      const ctx = buildPlannerContext(eligibleInputs)
      const result = spousalTransferScheme.compute(ctx)
      expect(
        result.caveats.some((c) => c.toLowerCase().includes('irreversible'))
      ).toBe(true)
    })

    it('limits spouse RA to ERS', () => {
      const ctx = buildPlannerContext(eligibleInputs)
      const result = spousalTransferScheme.compute(ctx)
      expect(
        result.summary.includes('ERS') || result.caveats.some((c) => c.includes('ERS'))
      ).toBe(true)
    })

    it('includes spousal transfer citation', () => {
      const ctx = buildPlannerContext(eligibleInputs)
      const result = spousalTransferScheme.compute(ctx)
      expect(result.citations.length).toBeGreaterThan(0)
    })
  })

  it('is optional action type in at55 chapter', () => {
    expect(spousalTransferScheme.actionType).toBe('optional')
    expect(spousalTransferScheme.chapter).toBe('at55')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/tj/TJDevelopment/fireplanner/frontend && npx vitest run src/lib/cpf-transition/tests/spousal-transfer.test.ts`
Expected: FAIL -- module not found

- [ ] **Step 3: Implement scheme**

```typescript
// frontend/src/lib/cpf-transition/schemes/spousal-transfer.ts
import type { SchemeDefinition, PlannerContext, SchemeResult } from '../types'
import { estimateCpfLifePayout } from '@/lib/calculations/cpf'
import { formatCurrency } from '@/lib/utils'
import { CITATIONS } from '../policy/citations'

export const spousalTransferScheme: SchemeDefinition = {
  id: 'spousal-transfer',
  title: "Transfer excess CPF to your spouse's RA",
  goalLabel: "Boost spouse's retirement income",
  chapter: 'at55',
  actionType: 'optional',

  eligibility: (ctx: PlannerContext): boolean => {
    if (ctx.profile.age < 55) return false
    if (!ctx.household.isCoupleMode) return false
    // Must have set aside BRS first
    return ctx.accounts.ra > ctx.policy.retirementSums.brs
  },

  relevanceScore: (ctx: PlannerContext): number => {
    const brs = ctx.policy.retirementSums.brs
    const excess = ctx.accounts.ra + ctx.accounts.oa - brs
    if (excess <= 0) return 0
    return Math.min(80, Math.round(excess / 5000) + 40)
  },

  compute: (ctx: PlannerContext): SchemeResult => {
    const { brs, ers } = ctx.policy.retirementSums
    const excessRA = Math.max(0, ctx.accounts.ra - brs)
    const transferableFromOA = ctx.accounts.oa
    const totalTransferable = excessRA + transferableFromOA

    // Spouse's RA cap is ERS
    const spouseRA = ctx.household.partner?.ra ?? 0
    const spouseRoom = Math.max(0, ers - spouseRA)
    const actualTransfer = Math.min(totalTransferable, spouseRoom)

    // Payout impact for spouse
    const spouseCurrentPayout = estimateCpfLifePayout(spouseRA, ctx.cpfLife.plan) / 12
    const spouseNewPayout = estimateCpfLifePayout(spouseRA + actualTransfer, ctx.cpfLife.plan) / 12
    const spousePayoutIncrease = spouseNewPayout - spouseCurrentPayout

    return {
      headline: `Transfer up to ${formatCurrency(actualTransfer)} to your spouse's RA`,
      summary: `After setting aside BRS (${formatCurrency(brs)}) in your RA, you can transfer excess OA or RA savings to your spouse's RA, up to the ERS (${formatCurrency(ers)}). This increases your spouse's CPF LIFE payout.`,
      defaultOutcome: `If you do nothing, your excess OA/RA stays in your own CPF accounts.`,
      metrics: [
        {
          metric: 'Your excess above BRS',
          defaultValue: `RA: ${formatCurrency(excessRA)}, OA: ${formatCurrency(transferableFromOA)}`,
          actionValue: formatCurrency(totalTransferable),
          confidence: 'known',
        },
        {
          metric: "Spouse's RA room (up to ERS)",
          defaultValue: formatCurrency(spouseRoom),
          actionValue: `Transfer up to ${formatCurrency(actualTransfer)}`,
          confidence: ctx.household.partner ? 'known' : 'estimated',
        },
        {
          metric: "Spouse's payout increase",
          defaultValue: `~${formatCurrency(spouseCurrentPayout, 0)}/month`,
          actionValue: `~${formatCurrency(spouseNewPayout, 0)}/month`,
          confidence: 'estimated',
        },
      ],
      deltas: [
        {
          label: "Spouse's monthly payout increase",
          value: spousePayoutIncrease * 12,
          formatted: `+${formatCurrency(spousePayoutIncrease, 0)}/month`,
          direction: 'positive',
        },
      ],
      citations: [CITATIONS.spousalTransfer],
      confidence: ctx.household.partner ? 'known' : 'estimated',
      caveats: [
        'This transfer is irreversible. You cannot move money back from your spouse.',
        'You must set aside at least the BRS in your own RA before transferring.',
        `Spouse's RA can receive up to the ERS (${formatCurrency(ers)}).`,
        'No tax relief for spousal RA transfers.',
        'If you have not entered your spouse details, the payout estimates are approximate.',
      ],
    }
  },
}
```

- [ ] **Step 4: Run tests**

Run: `cd /Users/tj/TJDevelopment/fireplanner/frontend && npx vitest run src/lib/cpf-transition/tests/spousal-transfer.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/tj/TJDevelopment/fireplanner && git add frontend/src/lib/cpf-transition/schemes/spousal-transfer.ts frontend/src/lib/cpf-transition/tests/spousal-transfer.test.ts && git commit -m "feat(cpf-transition): add spousal RA transfer scheme"
```

---

## Task 16: Scheme -- WIS/Workfare Income Supplement

> **API MIGRATION:** The code below uses a stale API. See the REFERENCE TEMPLATE above. Implementing agents must adapt `eligibility` to `assess`, `chapter` to `chapters`, and string metrics (`defaultValue`/`actionValue`) to numeric metrics (`defaultNumeric`/`actionNumeric` + `unit`).

**Files:**
- Create: `frontend/src/lib/cpf-transition/schemes/wis-workfare.ts`
- Test: `frontend/src/lib/cpf-transition/tests/wis-workfare.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// frontend/src/lib/cpf-transition/tests/wis-workfare.test.ts
import { describe, it, expect } from 'vitest'
import { wisWorkfareScheme } from '../schemes/wis-workfare'
import { buildPlannerContext } from '../domain/context'

describe('wisWorkfareScheme', () => {
  const eligibleInputs = {
    age: 52,
    oa: 100000,
    sa: 100000,
    ra: 0,
    ma: 40000,
    monthlySalary: 2000,
  }

  describe('eligibility', () => {
    it('is eligible: citizen, income $500-$3,000/month, age 45+', () => {
      const ctx = buildPlannerContext(eligibleInputs)
      expect(wisWorkfareScheme.eligibility(ctx)).toBe(true)
    })

    it('is not eligible: income > $3,000', () => {
      const ctx = buildPlannerContext({ ...eligibleInputs, monthlySalary: 4000 })
      expect(wisWorkfareScheme.eligibility(ctx)).toBe(false)
    })

    it('is not eligible: income < $500', () => {
      const ctx = buildPlannerContext({ ...eligibleInputs, monthlySalary: 400 })
      expect(wisWorkfareScheme.eligibility(ctx)).toBe(false)
    })

    it('is not eligible: non-citizen', () => {
      const ctx = buildPlannerContext({ ...eligibleInputs, residency: 'pr' as const })
      expect(wisWorkfareScheme.eligibility(ctx)).toBe(false)
    })
  })

  describe('relevanceScore', () => {
    it('returns higher score for older eligible workers', () => {
      const ctx60 = buildPlannerContext({
        ...eligibleInputs,
        age: 62,
        sa: 0,
        ra: 200000,
      })
      const ctx50 = buildPlannerContext(eligibleInputs)
      expect(wisWorkfareScheme.relevanceScore(ctx60)).toBeGreaterThanOrEqual(
        wisWorkfareScheme.relevanceScore(ctx50)
      )
    })
  })

  describe('compute', () => {
    it('shows annual WIS amount with 60% CPF / 40% cash split', () => {
      const ctx = buildPlannerContext(eligibleInputs)
      const result = wisWorkfareScheme.compute(ctx)

      expect(result.summary).toContain('60%')
      expect(result.summary).toContain('40%')
    })

    it('differentiates by age bracket (45-59 vs 60+)', () => {
      const ctx52 = buildPlannerContext(eligibleInputs)
      const ctx62 = buildPlannerContext({
        ...eligibleInputs,
        age: 62,
        sa: 0,
        ra: 200000,
      })
      const result52 = wisWorkfareScheme.compute(ctx52)
      const result62 = wisWorkfareScheme.compute(ctx62)

      // 60+ gets higher maximum
      expect(result62.deltas[0].value).toBeGreaterThan(result52.deltas[0].value)
    })

    it('includes WIS citation', () => {
      const ctx = buildPlannerContext(eligibleInputs)
      const result = wisWorkfareScheme.compute(ctx)
      expect(result.citations.length).toBeGreaterThan(0)
    })
  })

  it('is automatic action type in pre55 chapter', () => {
    expect(wisWorkfareScheme.actionType).toBe('automatic')
    expect(wisWorkfareScheme.chapter).toBe('pre55')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/tj/TJDevelopment/fireplanner/frontend && npx vitest run src/lib/cpf-transition/tests/wis-workfare.test.ts`
Expected: FAIL -- module not found

- [ ] **Step 3: Implement scheme**

```typescript
// frontend/src/lib/cpf-transition/schemes/wis-workfare.ts
import type { SchemeDefinition, PlannerContext, SchemeResult } from '../types'
import { formatCurrency } from '@/lib/utils'
import { CITATIONS } from '../policy/citations'

/** WIS constants */
const WIS_MIN_INCOME = 500
const WIS_MAX_INCOME = 3000
const WIS_MIN_AGE = 45

/** Maximum annual WIS by age bracket */
const WIS_MAX_45_59 = 4200
const WIS_MAX_60_PLUS = 4900

/** Split: 60% CPF, 40% cash */
const WIS_CPF_RATIO = 0.6
const WIS_CASH_RATIO = 0.4

export const wisWorkfareScheme: SchemeDefinition = {
  id: 'wis-workfare',
  title: 'Workfare Income Supplement: automatic CPF and cash top-up',
  goalLabel: 'Government support for workers',
  chapter: 'pre55',
  actionType: 'automatic',

  eligibility: (ctx: PlannerContext): boolean => {
    if (ctx.profile.residency !== 'citizen') return false
    if (ctx.profile.age < WIS_MIN_AGE) return false
    const salary = ctx.income.monthlySalary
    return salary >= WIS_MIN_INCOME && salary <= WIS_MAX_INCOME
  },

  relevanceScore: (ctx: PlannerContext): number => {
    // Higher score for older workers (higher WIS) and lower income
    const ageScore = ctx.profile.age >= 60 ? 70 : 55
    const incomeRatio = 1 - ctx.income.monthlySalary / WIS_MAX_INCOME
    return Math.round(ageScore + incomeRatio * 20)
  },

  compute: (ctx: PlannerContext): SchemeResult => {
    const isOver60 = ctx.profile.age >= 60
    const maxWIS = isOver60 ? WIS_MAX_60_PLUS : WIS_MAX_45_59

    // WIS amount scales with income. Maximum at lower incomes, tapers off toward $3K.
    // Simplified: linear scale from max at $500 to $0 at $3,000
    const incomeRange = WIS_MAX_INCOME - WIS_MIN_INCOME
    const incomeRatio = Math.max(0, 1 - (ctx.income.monthlySalary - WIS_MIN_INCOME) / incomeRange)
    const estimatedWIS = Math.round(maxWIS * incomeRatio)

    const cpfPortion = Math.round(estimatedWIS * WIS_CPF_RATIO)
    const cashPortion = Math.round(estimatedWIS * WIS_CASH_RATIO)

    return {
      headline: `WIS: ~${formatCurrency(estimatedWIS, 0)}/year (${formatCurrency(cpfPortion, 0)} CPF + ${formatCurrency(cashPortion, 0)} cash)`,
      summary: `The Workfare Income Supplement (WIS) automatically tops up your CPF and gives cash payouts if you earn $500-$3,000/month. 60% goes to CPF (boosting retirement savings), 40% is paid in cash. No application needed.`,
      defaultOutcome: `WIS is automatic. If eligible, you receive it without applying.`,
      metrics: [
        {
          metric: 'Estimated annual WIS',
          defaultValue: formatCurrency(estimatedWIS, 0),
          actionValue: `Max: ${formatCurrency(maxWIS, 0)} (ages ${isOver60 ? '60+' : '45-59'})`,
          confidence: 'estimated',
        },
        {
          metric: 'CPF portion (60%)',
          defaultValue: formatCurrency(cpfPortion, 0),
          actionValue: 'Credited to CPF accounts',
          confidence: 'estimated',
        },
        {
          metric: 'Cash portion (40%)',
          defaultValue: formatCurrency(cashPortion, 0),
          actionValue: 'Paid to bank account',
          confidence: 'estimated',
        },
        {
          metric: 'Age bracket',
          defaultValue: isOver60 ? '60+ (higher WIS)' : '45-59',
          actionValue: `Max ${formatCurrency(maxWIS, 0)}/year`,
          confidence: 'known',
        },
      ],
      deltas: [
        {
          label: 'Total annual WIS',
          value: estimatedWIS,
          formatted: `+${formatCurrency(estimatedWIS, 0)}/year`,
          direction: 'positive',
        },
      ],
      citations: [CITATIONS.wis],
      confidence: 'estimated',
      caveats: [
        'WIS amount varies with income. Higher payout at lower incomes, tapering to $0 at $3,000/month.',
        'Ages 45-59: max $4,200/year. Ages 60+: max $4,900/year.',
        'Must be employed (self-employed also eligible under Workfare).',
        'WIS CPF portion is split across OA, SA/RA, and MA based on CPF allocation ratios.',
      ],
      whyShown: `Shown because your monthly income is ${formatCurrency(ctx.income.monthlySalary)} (within $500-$3,000 range).`,
    }
  },
}
```

- [ ] **Step 4: Run tests**

Run: `cd /Users/tj/TJDevelopment/fireplanner/frontend && npx vitest run src/lib/cpf-transition/tests/wis-workfare.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/tj/TJDevelopment/fireplanner && git add frontend/src/lib/cpf-transition/schemes/wis-workfare.ts frontend/src/lib/cpf-transition/tests/wis-workfare.test.ts && git commit -m "feat(cpf-transition): add WIS/Workfare scheme"
```

---

## Task 17: Scheme -- CPF Nomination/Bequest

> **API MIGRATION:** The code below uses a stale API. See the REFERENCE TEMPLATE above. Implementing agents must adapt `eligibility` to `assess`, `chapter` to `chapters`, and string metrics (`defaultValue`/`actionValue`) to numeric metrics (`defaultNumeric`/`actionNumeric` + `unit`).

**Files:**
- Create: `frontend/src/lib/cpf-transition/schemes/nomination.ts`
- Test: `frontend/src/lib/cpf-transition/tests/nomination.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// frontend/src/lib/cpf-transition/tests/nomination.test.ts
import { describe, it, expect } from 'vitest'
import { nominationScheme } from '../schemes/nomination'
import { buildPlannerContext } from '../domain/context'

describe('nominationScheme', () => {
  describe('eligibility', () => {
    it('is eligible for all users aged 50+', () => {
      const ctx = buildPlannerContext({
        age: 52,
        oa: 200000,
        sa: 200000,
        ra: 0,
        ma: 60000,
        monthlySalary: 6000,
      })
      expect(nominationScheme.eligibility(ctx)).toBe(true)
    })

    it('is not eligible for users under 50', () => {
      const ctx = buildPlannerContext({
        age: 45,
        oa: 200000,
        sa: 200000,
        ra: 0,
        ma: 60000,
        monthlySalary: 6000,
      })
      expect(nominationScheme.eligibility(ctx)).toBe(false)
    })
  })

  describe('compute', () => {
    it('warns that CPF bypasses the will', () => {
      const ctx = buildPlannerContext({
        age: 65,
        oa: 50000,
        sa: 0,
        ra: 220000,
        ma: 70000,
        monthlySalary: 0,
      })
      const result = nominationScheme.compute(ctx)
      expect(result.summary.toLowerCase()).toContain('will')
    })

    it('warns that marriage revokes nomination', () => {
      const ctx = buildPlannerContext({
        age: 65,
        oa: 50000,
        sa: 0,
        ra: 220000,
        ma: 70000,
        monthlySalary: 0,
      })
      const result = nominationScheme.compute(ctx)
      expect(
        result.caveats.some((c) => c.toLowerCase().includes('marriage'))
      ).toBe(true)
    })

    it('shows timeline: nomination vs Public Trustee', () => {
      const ctx = buildPlannerContext({
        age: 65,
        oa: 50000,
        sa: 0,
        ra: 220000,
        ma: 70000,
        monthlySalary: 0,
      })
      const result = nominationScheme.compute(ctx)
      expect(result.metrics.length).toBeGreaterThanOrEqual(2)
    })

    it('includes nomination citation', () => {
      const ctx = buildPlannerContext({
        age: 65,
        oa: 50000,
        sa: 0,
        ra: 220000,
        ma: 70000,
        monthlySalary: 0,
      })
      const result = nominationScheme.compute(ctx)
      expect(result.citations.length).toBeGreaterThan(0)
    })
  })

  it('is review action type in at65 chapter', () => {
    expect(nominationScheme.actionType).toBe('review')
    expect(nominationScheme.chapter).toBe('at65')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/tj/TJDevelopment/fireplanner/frontend && npx vitest run src/lib/cpf-transition/tests/nomination.test.ts`
Expected: FAIL -- module not found

- [ ] **Step 3: Implement scheme**

```typescript
// frontend/src/lib/cpf-transition/schemes/nomination.ts
import type { SchemeDefinition, PlannerContext, SchemeResult } from '../types'
import { formatCurrency } from '@/lib/utils'
import { CITATIONS } from '../policy/citations'

export const nominationScheme: SchemeDefinition = {
  id: 'nomination',
  title: 'Nominate who receives your CPF',
  goalLabel: 'Estate planning',
  chapter: 'at65',
  actionType: 'review',

  eligibility: (ctx: PlannerContext): boolean => {
    return ctx.profile.age >= 50
  },

  relevanceScore: (ctx: PlannerContext): number => {
    // Always moderately relevant for 50+ users
    const totalCpf = ctx.accounts.oa + ctx.accounts.sa + ctx.accounts.ra + ctx.accounts.ma
    if (totalCpf > 200000) return 65
    return 50
  },

  compute: (ctx: PlannerContext): SchemeResult => {
    const totalCpf = ctx.accounts.oa + ctx.accounts.sa + ctx.accounts.ra + ctx.accounts.ma

    return {
      headline: `Make sure your ${formatCurrency(totalCpf)} goes to who you intend`,
      summary: `CPF savings bypass your will entirely. Without a valid CPF nomination, your savings go to the Public Trustee's Office for distribution under intestacy law, which takes up to 6 months and incurs admin fees. With a nomination, distribution takes about 10 working days.`,
      defaultOutcome: `Without a nomination, your CPF goes to the Public Trustee's Office. Distribution follows intestacy law (may not match your wishes), takes up to 6 months, and incurs admin fees.`,
      metrics: [
        {
          metric: 'With CPF nomination',
          defaultValue: '~10 working days',
          actionValue: 'Direct to your chosen nominees',
          confidence: 'known',
        },
        {
          metric: 'Without CPF nomination',
          defaultValue: 'Up to 6 months',
          actionValue: 'Public Trustee distributes per intestacy law',
          confidence: 'known',
        },
        {
          metric: 'Your total CPF savings',
          defaultValue: formatCurrency(totalCpf),
          actionValue: 'Ensure it goes to the right people',
          confidence: 'known',
        },
        {
          metric: 'CPF LIFE on death',
          defaultValue: 'Unused premium balance returned to nominees',
          actionValue: 'Amount depends on plan type and age at death',
          confidence: 'estimated',
        },
      ],
      deltas: [],
      citations: [CITATIONS.nomination],
      confidence: 'known',
      caveats: [
        'Marriage automatically revokes your CPF nomination. Re-nominate after marriage.',
        'CPF nomination is separate from your will. Even if you have a will, CPF savings are distributed per your CPF nomination.',
        'You can nominate online at cpf.gov.sg or at any CPF Service Centre.',
        'For CPF LIFE: on death, the unused premium balance (not the monthly payouts) goes to nominees. The Basic plan has the highest bequest value.',
      ],
    }
  },
}
```

- [ ] **Step 4: Run tests**

Run: `cd /Users/tj/TJDevelopment/fireplanner/frontend && npx vitest run src/lib/cpf-transition/tests/nomination.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/tj/TJDevelopment/fireplanner && git add frontend/src/lib/cpf-transition/schemes/nomination.ts frontend/src/lib/cpf-transition/tests/nomination.test.ts && git commit -m "feat(cpf-transition): add CPF nomination/bequest scheme"
```

---

## Task 18: Scheme -- Healthcare Deductions (MediShield + CareShield)

> **API MIGRATION:** The code below uses a stale API. See the REFERENCE TEMPLATE above. Implementing agents must adapt `eligibility` to `assess`, `chapter` to `chapters`, and string metrics (`defaultValue`/`actionValue`) to numeric metrics (`defaultNumeric`/`actionNumeric` + `unit`).

**Files:**
- Create: `frontend/src/lib/cpf-transition/schemes/healthcare-deductions.ts`
- Test: `frontend/src/lib/cpf-transition/tests/healthcare-deductions.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// frontend/src/lib/cpf-transition/tests/healthcare-deductions.test.ts
import { describe, it, expect } from 'vitest'
import { healthcareDeductionsScheme } from '../schemes/healthcare-deductions'
import { buildPlannerContext } from '../domain/context'

describe('healthcareDeductionsScheme', () => {
  describe('eligibility', () => {
    it('is eligible for all users aged 50+', () => {
      const ctx = buildPlannerContext({
        age: 52,
        oa: 200000,
        sa: 200000,
        ra: 0,
        ma: 60000,
        monthlySalary: 6000,
      })
      expect(healthcareDeductionsScheme.eligibility(ctx)).toBe(true)
    })

    it('is not eligible for users under 50', () => {
      const ctx = buildPlannerContext({
        age: 45,
        oa: 200000,
        sa: 200000,
        ra: 0,
        ma: 60000,
        monthlySalary: 6000,
      })
      expect(healthcareDeductionsScheme.eligibility(ctx)).toBe(false)
    })
  })

  describe('compute', () => {
    it('shows MediShield Life premium for user age', () => {
      const ctx = buildPlannerContext({
        age: 57,
        oa: 200000,
        sa: 0,
        ra: 220000,
        ma: 70000,
        monthlySalary: 0,
      })
      const result = healthcareDeductionsScheme.compute(ctx)

      expect(result.headline).toContain('healthcare')
      expect(result.metrics.length).toBeGreaterThanOrEqual(2)
    })

    it('shows CareShield Life premium (age-dependent)', () => {
      const ctx = buildPlannerContext({
        age: 60,
        oa: 200000,
        sa: 0,
        ra: 220000,
        ma: 70000,
        monthlySalary: 0,
      })
      const result = healthcareDeductionsScheme.compute(ctx)
      // CareShield premiums paid until 67
      expect(
        result.metrics.some((m) => m.metric.toLowerCase().includes('careshield'))
      ).toBe(true)
    })

    it('shows no CareShield premiums for age 68+', () => {
      const ctx = buildPlannerContext({
        age: 68,
        oa: 50000,
        sa: 0,
        ra: 220000,
        ma: 70000,
        monthlySalary: 0,
      })
      const result = healthcareDeductionsScheme.compute(ctx)
      const careshieldRow = result.metrics.find(
        (m) => m.metric.toLowerCase().includes('careshield')
      )
      expect(careshieldRow?.defaultValue).toContain('$0')
    })

    it('includes healthcare citations', () => {
      const ctx = buildPlannerContext({
        age: 57,
        oa: 200000,
        sa: 0,
        ra: 220000,
        ma: 70000,
        monthlySalary: 0,
      })
      const result = healthcareDeductionsScheme.compute(ctx)
      expect(result.citations.length).toBeGreaterThan(0)
    })

    it('total deduction reduces MA balance', () => {
      const ctx = buildPlannerContext({
        age: 57,
        oa: 200000,
        sa: 0,
        ra: 220000,
        ma: 70000,
        monthlySalary: 0,
      })
      const result = healthcareDeductionsScheme.compute(ctx)
      expect(result.deltas.length).toBeGreaterThan(0)
      expect(result.deltas[0].value).toBeLessThan(0)
    })
  })

  it('is automatic action type in post55 chapter', () => {
    expect(healthcareDeductionsScheme.actionType).toBe('automatic')
    expect(healthcareDeductionsScheme.chapter).toBe('post55')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/tj/TJDevelopment/fireplanner/frontend && npx vitest run src/lib/cpf-transition/tests/healthcare-deductions.test.ts`
Expected: FAIL -- module not found

- [ ] **Step 3: Implement scheme**

```typescript
// frontend/src/lib/cpf-transition/schemes/healthcare-deductions.ts
import type { SchemeDefinition, PlannerContext, SchemeResult } from '../types'
import { formatCurrency } from '@/lib/utils'
import { CITATIONS } from '../policy/citations'
import {
  MEDISHIELD_LIFE_PREMIUMS,
  CARESHIELD_LIFE_PREMIUMS,
  lookupByAge,
} from '@/lib/data/healthcarePremiums'

export const healthcareDeductionsScheme: SchemeDefinition = {
  id: 'healthcare-deductions',
  title: 'MediShield Life and CareShield Life premiums from MediSave',
  goalLabel: 'Understand healthcare costs',
  chapter: 'post55',
  actionType: 'automatic',

  eligibility: (ctx: PlannerContext): boolean => {
    return ctx.profile.age >= 50
  },

  relevanceScore: (ctx: PlannerContext): number => {
    // More relevant as healthcare premiums increase with age
    return Math.min(60, 30 + Math.round((ctx.profile.age - 50) * 1.5))
  },

  compute: (ctx: PlannerContext): SchemeResult => {
    const age = ctx.profile.age
    const medishieldPremium = lookupByAge(MEDISHIELD_LIFE_PREMIUMS, age)
    const careshieldPremium = age <= 67 ? lookupByAge(CARESHIELD_LIFE_PREMIUMS, age) : 0
    const totalPremium = medishieldPremium + careshieldPremium

    // Project premiums at key ages
    const ages = [age, 60, 65, 70, 75].filter((a) => a >= age)
    const projectionRows = ages.map((projAge) => {
      const msl = lookupByAge(MEDISHIELD_LIFE_PREMIUMS, projAge)
      const csl = projAge <= 67 ? lookupByAge(CARESHIELD_LIFE_PREMIUMS, projAge) : 0
      return {
        metric: `Age ${projAge}: healthcare premiums`,
        defaultValue: `MediShield: ${formatCurrency(msl, 0)}/year`,
        actionValue: csl > 0
          ? `CareShield: ${formatCurrency(csl, 0)}/year. Total: ${formatCurrency(msl + csl, 0)}/year`
          : `CareShield: $0 (premiums end at 67). Total: ${formatCurrency(msl, 0)}/year`,
        confidence: 'estimated' as const,
      }
    })

    return {
      headline: `${formatCurrency(totalPremium, 0)}/year in healthcare premiums deducted from your MediSave`,
      summary: `MediShield Life and CareShield Life premiums are automatically deducted from your MediSave Account. Premiums increase with age. CareShield Life premiums are paid until age 67, then stop. MediShield Life premiums continue for life.`,
      defaultOutcome: `These deductions are automatic. No action needed.`,
      metrics: [
        {
          metric: 'MediShield Life (current)',
          defaultValue: `${formatCurrency(medishieldPremium, 0)}/year`,
          actionValue: 'Deducted from MA annually',
          confidence: 'known',
        },
        {
          metric: 'CareShield Life (current)',
          defaultValue: careshieldPremium > 0
            ? `${formatCurrency(careshieldPremium, 0)}/year`
            : '$0 (premiums end at 67)',
          actionValue: careshieldPremium > 0
            ? `Deducted from MA. Premiums increase ~4%/year until 2030.`
            : 'No more premiums after age 67',
          confidence: 'known',
        },
        ...projectionRows,
      ],
      deltas: [
        {
          label: 'Annual healthcare deduction from MA',
          value: -totalPremium,
          formatted: `-${formatCurrency(totalPremium, 0)}/year`,
          direction: 'negative',
        },
      ],
      citations: [CITATIONS.medishieldLife, CITATIONS.careshieldLife],
      confidence: 'known',
      caveats: [
        'MediShield Life premiums increase with age in 5-year brackets.',
        'CareShield Life premiums are paid from age 30 to 67. After 67, no more premiums.',
        'CareShield Life premiums increase ~4% annually from 2026 to 2030.',
        'If your MA is insufficient, premiums may be shared with household members or paid in cash.',
        'These premiums reduce your MA balance, which affects BHS overflow calculations.',
      ],
    }
  },
}
```

- [ ] **Step 4: Run tests**

Run: `cd /Users/tj/TJDevelopment/fireplanner/frontend && npx vitest run src/lib/cpf-transition/tests/healthcare-deductions.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/tj/TJDevelopment/fireplanner && git add frontend/src/lib/cpf-transition/schemes/healthcare-deductions.ts frontend/src/lib/cpf-transition/tests/healthcare-deductions.test.ts && git commit -m "feat(cpf-transition): add healthcare deductions scheme"
```

---

## Task 19: Register All New Schemes

**Files:**
- Modify: `frontend/src/lib/cpf-transition/schemes/registry.ts`

- [ ] **Step 1: Update registry with all new schemes**

Replace the contents of `registry.ts` with:

```typescript
// frontend/src/lib/cpf-transition/schemes/registry.ts
import type { SchemeDefinition } from '../types'

// Plan 1 schemes
import { age55TransitionScheme } from './age55-transition'
import { retirementSumTargetScheme } from './retirement-sum-target'
import { oaToRaTransferScheme } from './oa-to-ra-transfer'
import { rstuTopupScheme } from './rstu-topup'
import { cpfLifePlanScheme } from './cpf-life-plan'

// Plan 2 schemes
import { propertyPledgeScheme } from './property-pledge'
import { oaWithdrawal55Scheme } from './oa-withdrawal-55'
import { post55ContributionsScheme } from './post55-contributions'
import { interestGrowthScheme } from './interest-growth'
import { maBhsOverflowScheme } from './ma-bhs-overflow'
import { vhrHousingRefundScheme } from './vhr-housing-refund'
import { mrssMatchingScheme } from './mrss-matching'
import { mmssMedisaveScheme } from './mmss-medisave'
import { cpfLifeDeferralScheme } from './cpf-life-deferral'
import { raLumpsum65Scheme } from './ra-lumpsum-65'
import { leaseBuybackScheme } from './lease-buyback'
import { silverSupportScheme } from './silver-support'
import { srsWithdrawalScheme } from './srs-withdrawal'
import { spousalTransferScheme } from './spousal-transfer'
import { wisWorkfareScheme } from './wis-workfare'
import { nominationScheme } from './nomination'
import { healthcareDeductionsScheme } from './healthcare-deductions'

export const ALL_SCHEMES: SchemeDefinition[] = [
  // at55 chapter — automatic
  age55TransitionScheme,

  // at55 chapter — review/optional
  retirementSumTargetScheme,
  propertyPledgeScheme,
  oaWithdrawal55Scheme,
  oaToRaTransferScheme,
  rstuTopupScheme,
  mrssMatchingScheme,
  spousalTransferScheme,

  // pre55 chapter — automatic
  wisWorkfareScheme,

  // post55 chapter — automatic
  post55ContributionsScheme,
  interestGrowthScheme,
  maBhsOverflowScheme,
  healthcareDeductionsScheme,

  // post55 chapter — optional
  vhrHousingRefundScheme,
  mmssMedisaveScheme,
  srsWithdrawalScheme,

  // at65 chapter — review
  cpfLifePlanScheme,
  nominationScheme,

  // at65 chapter — optional
  cpfLifeDeferralScheme,
  raLumpsum65Scheme,
  leaseBuybackScheme,

  // at65 chapter — automatic
  silverSupportScheme,
]
```

- [ ] **Step 2: Commit**

```bash
cd /Users/tj/TJDevelopment/fireplanner && git add frontend/src/lib/cpf-transition/schemes/registry.ts && git commit -m "feat(cpf-transition): register all Plan 2 schemes in registry"
```

---

## Task 20: Visualization -- TransitionAnimator (Inline Sankey)

**Files:**
- Create: `frontend/src/components/cpf-transition/TransitionAnimator.tsx`

**MOBILE RESPONSIVE (autoplan fix 4):** At `< 640px`, the horizontal Sankey SVG is infeasible (287px usable width can't fit 3 source boxes + flow lines + 3 target boxes with readable text). Replace with a **vertical flow diagram** on mobile: source box at top, animated arrow/line pointing down, target box at bottom, dollar amounts inline. Same information, mobile-native layout. Use a `useMediaQuery` or Tailwind `sm:` breakpoint to toggle between horizontal (desktop) and vertical (mobile) layouts. Trigger animation on scroll-into-view via `IntersectionObserver`, duration 1.5s, easing `easeInOut`, sequential flow (SA->RA first 0-800ms, excess SA->OA 800-1200ms, OA->RA shortfall 1200-1500ms). Include a "Replay" button below.

- [ ] **Step 1: Implement TransitionAnimator**

```tsx
// frontend/src/components/cpf-transition/TransitionAnimator.tsx
import { motion } from 'framer-motion'
import { formatCurrency } from '@/lib/utils'

interface AccountBox {
  label: string
  amount: number
  color: string
}

interface FlowBand {
  from: string
  to: string
  amount: number
  color: string
  label?: string
}

interface TransitionAnimatorProps {
  /** Title shown above the animation */
  title: string
  /** Account boxes on the left (before transition) */
  leftBoxes: AccountBox[]
  /** Account boxes on the right (after transition) */
  rightBoxes: AccountBox[]
  /** Flow bands connecting left to right */
  flows: FlowBand[]
  /** Annotations below the animation */
  annotations?: string[]
}

const BOX_WIDTH = 120
const BOX_HEIGHT = 60
const BOX_GAP = 16
const FLOW_AREA_WIDTH = 160
const SVG_PADDING = 20

export function TransitionAnimator({
  title,
  leftBoxes,
  rightBoxes,
  flows,
  annotations,
}: TransitionAnimatorProps) {
  const maxBoxes = Math.max(leftBoxes.length, rightBoxes.length)
  const svgHeight = SVG_PADDING * 2 + maxBoxes * (BOX_HEIGHT + BOX_GAP) - BOX_GAP
  const svgWidth = SVG_PADDING * 2 + BOX_WIDTH * 2 + FLOW_AREA_WIDTH

  const leftX = SVG_PADDING
  const rightX = SVG_PADDING + BOX_WIDTH + FLOW_AREA_WIDTH

  // Calculate total flow for proportional band heights
  const totalFlow = flows.reduce((sum, f) => sum + f.amount, 0)

  // Build flow paths
  const getBoxCenter = (
    boxes: AccountBox[],
    label: string,
    xBase: number,
  ): { x: number; y: number } => {
    const idx = boxes.findIndex((b) => b.label === label)
    if (idx === -1) return { x: xBase + BOX_WIDTH / 2, y: svgHeight / 2 }
    const y = SVG_PADDING + idx * (BOX_HEIGHT + BOX_GAP) + BOX_HEIGHT / 2
    return { x: xBase === leftX ? xBase + BOX_WIDTH : xBase, y }
  }

  return (
    <div className="my-6">
      <h4 className="text-sm font-semibold text-muted-foreground mb-3">{title}</h4>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full max-w-lg mx-auto"
          role="img"
          aria-label={title}
        >
          {/* Left boxes */}
          {leftBoxes.map((box, i) => {
            const y = SVG_PADDING + i * (BOX_HEIGHT + BOX_GAP)
            return (
              <motion.g
                key={`left-${box.label}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1, duration: 0.4 }}
              >
                <rect
                  x={leftX}
                  y={y}
                  width={BOX_WIDTH}
                  height={BOX_HEIGHT}
                  rx={8}
                  fill={box.color}
                  opacity={0.15}
                  stroke={box.color}
                  strokeWidth={1.5}
                />
                <text
                  x={leftX + BOX_WIDTH / 2}
                  y={y + 22}
                  textAnchor="middle"
                  className="text-xs font-medium"
                  fill={box.color}
                >
                  {box.label}
                </text>
                <text
                  x={leftX + BOX_WIDTH / 2}
                  y={y + 42}
                  textAnchor="middle"
                  className="text-xs"
                  fill="currentColor"
                >
                  {formatCurrency(box.amount)}
                </text>
              </motion.g>
            )
          })}

          {/* Flow bands */}
          {flows.map((flow, i) => {
            const from = getBoxCenter(leftBoxes, flow.from, leftX)
            const to = getBoxCenter(rightBoxes, flow.to, rightX)
            const bandHeight = Math.max(4, (flow.amount / (totalFlow || 1)) * 40)
            const midX = leftX + BOX_WIDTH + FLOW_AREA_WIDTH / 2

            const path = `M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`

            return (
              <motion.g key={`flow-${i}`}>
                <motion.path
                  d={path}
                  fill="none"
                  stroke={flow.color}
                  strokeWidth={bandHeight}
                  strokeOpacity={0.25}
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ delay: 0.5 + i * 0.2, duration: 0.8, ease: 'easeInOut' }}
                />
                {flow.label && (
                  <motion.text
                    x={midX}
                    y={((from.y + to.y) / 2) - bandHeight / 2 - 4}
                    textAnchor="middle"
                    className="text-[10px]"
                    fill="currentColor"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.0 + i * 0.2 }}
                  >
                    {flow.label}
                  </motion.text>
                )}
              </motion.g>
            )
          })}

          {/* Right boxes */}
          {rightBoxes.map((box, i) => {
            const y = SVG_PADDING + i * (BOX_HEIGHT + BOX_GAP)
            return (
              <motion.g
                key={`right-${box.label}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.0 + i * 0.1, duration: 0.4 }}
              >
                <rect
                  x={rightX}
                  y={y}
                  width={BOX_WIDTH}
                  height={BOX_HEIGHT}
                  rx={8}
                  fill={box.color}
                  opacity={0.15}
                  stroke={box.color}
                  strokeWidth={1.5}
                />
                <text
                  x={rightX + BOX_WIDTH / 2}
                  y={y + 22}
                  textAnchor="middle"
                  className="text-xs font-medium"
                  fill={box.color}
                >
                  {box.label}
                </text>
                <text
                  x={rightX + BOX_WIDTH / 2}
                  y={y + 42}
                  textAnchor="middle"
                  className="text-xs"
                  fill="currentColor"
                >
                  {formatCurrency(box.amount)}
                </text>
              </motion.g>
            )
          })}
        </svg>
      </div>
      {annotations && annotations.length > 0 && (
        <div className="mt-2 space-y-1">
          {annotations.map((note, i) => (
            <p key={i} className="text-xs text-muted-foreground text-center">{note}</p>
          ))}
        </div>
      )}
    </div>
  )
}

// --- Pre-built configurations for the two major transitions ---

interface Age55AnimatorProps {
  oaBefore: number
  saBefore: number
  maBefore: number
  oaAfter: number
  raAfter: number
  maAfter: number
  saToRA: number
  saExcess: number
  oaToRA: number
}

export function Age55TransitionAnimator({
  oaBefore,
  saBefore,
  maBefore,
  oaAfter,
  raAfter,
  maAfter,
  saToRA,
  saExcess,
  oaToRA,
}: Age55AnimatorProps) {
  const flows: FlowBand[] = [
    { from: 'SA', to: 'RA', amount: saToRA, color: '#8b5cf6', label: formatCurrency(saToRA) },
  ]
  if (saExcess > 0) {
    flows.push({ from: 'SA', to: 'OA', amount: saExcess, color: '#3b82f6', label: formatCurrency(saExcess) })
  }
  if (oaToRA > 0) {
    flows.push({ from: 'OA', to: 'RA', amount: oaToRA, color: '#8b5cf6', label: formatCurrency(oaToRA) })
  }
  flows.push({ from: 'MA', to: 'MA', amount: maAfter, color: '#22c55e' })

  return (
    <TransitionAnimator
      title="Age 55 Transition: SA closes, RA is created"
      leftBoxes={[
        { label: 'OA', amount: oaBefore, color: '#3b82f6' },
        { label: 'SA', amount: saBefore, color: '#8b5cf6' },
        { label: 'MA', amount: maBefore, color: '#22c55e' },
      ]}
      rightBoxes={[
        { label: 'OA', amount: oaAfter, color: '#3b82f6' },
        { label: 'RA', amount: raAfter, color: '#dc2626' },
        { label: 'MA', amount: maAfter, color: '#22c55e' },
      ]}
      flows={flows}
      annotations={[
        `Withdrawable: ${formatCurrency(oaAfter)}`,
        `Locked in RA: ${formatCurrency(raAfter)}`,
      ]}
    />
  )
}

interface Age65AnimatorProps {
  raBalance: number
  monthlyPayout: number
  bequestEstimate: number
  premiumDeducted: number
}

export function Age65TransitionAnimator({
  raBalance,
  monthlyPayout,
  bequestEstimate,
  premiumDeducted,
}: Age65AnimatorProps) {
  return (
    <TransitionAnimator
      title="Age 65 Transition: RA converts to CPF LIFE"
      leftBoxes={[
        { label: 'RA', amount: raBalance, color: '#dc2626' },
      ]}
      rightBoxes={[
        { label: 'Monthly', amount: monthlyPayout * 12, color: '#22c55e' },
        { label: 'Bequest', amount: bequestEstimate, color: '#6b7280' },
      ]}
      flows={[
        {
          from: 'RA',
          to: 'Monthly',
          amount: raBalance - premiumDeducted,
          color: '#22c55e',
          label: `~${formatCurrency(monthlyPayout, 0)}/month`,
        },
      ]}
      annotations={[
        `Monthly payout: ~${formatCurrency(monthlyPayout, 0)}`,
        `Est. bequest value: ~${formatCurrency(bequestEstimate, 0)}`,
      ]}
    />
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/tj/TJDevelopment/fireplanner && git add frontend/src/components/cpf-transition/TransitionAnimator.tsx && git commit -m "feat(cpf-transition): add TransitionAnimator inline Sankey component"
```

---

## Task 21: Visualization -- CpfMiniWaterfall (Summary Stacked Bar)

**Files:**
- Create: `frontend/src/components/cpf-transition/CpfMiniWaterfall.tsx`

- [ ] **Step 1: Implement CpfMiniWaterfall**

```tsx
// frontend/src/components/cpf-transition/CpfMiniWaterfall.tsx
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { formatCurrency } from '@/lib/utils'
import type { PlannerContext } from '@/lib/cpf-transition/types'
import {
  performAge55Transfer,
  getRetirementSumAmount,
  projectCpfBalances,
} from '@/lib/calculations/cpf'

interface MilestoneSnapshot {
  age: number
  label: string
  oa: number
  saOrRa: number
  ma: number
}

interface CpfMiniWaterfallProps {
  context: PlannerContext
}

/** Project CPF balances at milestone ages 50, 55, 60, 65, 70 */
function buildMilestones(ctx: PlannerContext): MilestoneSnapshot[] {
  const milestoneAges = [50, 55, 60, 65, 70].filter((a) => a >= ctx.profile.age)
  const snapshots: MilestoneSnapshot[] = []

  // Current state as the starting point
  let oa = ctx.accounts.oa
  let sa = ctx.accounts.sa
  let ra = ctx.accounts.ra
  let ma = ctx.accounts.ma
  const annualSalary = ctx.income.monthlySalary * 12

  for (const targetAge of milestoneAges) {
    if (targetAge === ctx.profile.age) {
      snapshots.push({
        age: targetAge,
        label: `Now (${targetAge})`,
        oa,
        saOrRa: ctx.profile.age >= 55 ? ra : sa,
        ma,
      })
      continue
    }

    // Simple projection: use projectCpfBalances from current to target
    if (targetAge <= 54 && ctx.profile.age < 55) {
      const projections = projectCpfBalances(
        ctx.profile.age,
        targetAge,
        oa,
        sa,
        ma,
        annualSalary,
        ctx.income.salaryGrowthRate,
      )
      const last = projections[projections.length - 1]
      if (last) {
        oa = last.oaBalance
        sa = last.saBalance
        ma = last.maBalance
      }
      snapshots.push({
        age: targetAge,
        label: `${targetAge}`,
        oa,
        saOrRa: sa,
        ma,
      })
    } else if (targetAge === 55 && ctx.profile.age < 55) {
      // Project to 54 first
      const projections = projectCpfBalances(
        ctx.profile.age,
        54,
        oa,
        sa,
        ma,
        annualSalary,
        ctx.income.salaryGrowthRate,
      )
      const last = projections[projections.length - 1]
      if (last) {
        oa = last.oaBalance
        sa = last.saBalance
        ma = last.maBalance
      }

      // Do the age-55 transfer
      const target = getRetirementSumAmount(ctx.cpfLife.retirementSum, ctx.profile.age)
      const transfer = performAge55Transfer(oa, sa, target)
      oa = transfer.newOA
      ra = transfer.newRA
      sa = 0
      snapshots.push({
        age: 55,
        label: '55',
        oa,
        saOrRa: ra,
        ma,
      })
    } else if (targetAge > 55) {
      // Simple compound growth for post-55
      const years = targetAge - Math.max(55, ctx.profile.age)
      if (years > 0) {
        oa = oa * Math.pow(1.025, years)
        ra = ra * Math.pow(1.04, years)
        ma = Math.min(ma * Math.pow(1.04, years), ctx.policy.bhs * 1.2)
      }
      snapshots.push({
        age: targetAge,
        label: `${targetAge}`,
        oa: Math.round(oa),
        saOrRa: Math.round(ra),
        ma: Math.round(ma),
      })
    }
  }

  return snapshots
}

const COLORS = {
  oa: '#3b82f6',    // Blue
  saOrRa: '#8b5cf6', // Purple
  ma: '#22c55e',    // Green
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload) return null
  return (
    <div className="bg-background border rounded-lg shadow-lg p-3 text-sm">
      <p className="font-medium mb-1">Age {label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name}: {formatCurrency(entry.value)}
        </p>
      ))}
      <p className="font-medium mt-1 pt-1 border-t">
        Total: {formatCurrency(payload.reduce((s, e) => s + e.value, 0))}
      </p>
    </div>
  )
}

export function CpfMiniWaterfall({ context }: CpfMiniWaterfallProps) {
  const milestones = buildMilestones(context)

  const data = milestones.map((m) => ({
    name: m.label,
    OA: m.oa,
    'SA/RA': m.saOrRa,
    MA: m.ma,
  }))

  return (
    <div className="my-6">
      <h4 className="text-sm font-semibold text-muted-foreground mb-3">
        CPF Balance Projection
      </h4>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis
            tickFormatter={(v: number) => `$${Math.round(v / 1000)}K`}
            tick={{ fontSize: 11 }}
            width={55}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="OA" stackId="cpf" fill={COLORS.oa} radius={[0, 0, 0, 0]} />
          <Bar dataKey="SA/RA" stackId="cpf" fill={COLORS.saOrRa} radius={[0, 0, 0, 0]} />
          <Bar dataKey="MA" stackId="cpf" fill={COLORS.ma} radius={[4, 4, 0, 0]} />
          {milestones.some((m) => m.age === 55) && (
            <ReferenceLine x="55" stroke="#f97316" strokeDasharray="4 4" label={{ value: 'RA Created', fontSize: 10 }} />
          )}
          {milestones.some((m) => m.age === 65) && (
            <ReferenceLine x="65" stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'CPF LIFE', fontSize: 10 }} />
          )}
        </ComposedChart>
      </ResponsiveContainer>
      <p className="text-xs text-muted-foreground text-center mt-1">
        Projected balances. Actual values depend on contributions, interest, and withdrawals.
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/tj/TJDevelopment/fireplanner && git add frontend/src/components/cpf-transition/CpfMiniWaterfall.tsx && git commit -m "feat(cpf-transition): add CpfMiniWaterfall summary stacked bar chart"
```

---

## Task 22: Final Verification

- [ ] **Step 1: Run full test suite**

```bash
cd /Users/tj/TJDevelopment/fireplanner/frontend && npx vitest run
```
Expected: All tests pass (existing + 17 new scheme test files)

- [ ] **Step 2: Run type-check**

```bash
cd /Users/tj/TJDevelopment/fireplanner/frontend && npm run type-check
```
Expected: Zero errors

- [ ] **Step 3: Run lint**

```bash
cd /Users/tj/TJDevelopment/fireplanner/frontend && npm run lint
```
Expected: Zero errors or warnings in new files

- [ ] **Step 4: Fix any issues found**

If any test, type-check, or lint errors are found, fix them and commit:
```bash
cd /Users/tj/TJDevelopment/fireplanner && git add -u && git commit -m "fix(cpf-transition): fix Plan 2 verification issues"
```

---

## Summary

**Plan 2 delivers:**
- 17 new schemes (property pledge, OA withdrawal, post-55 contributions, interest growth, MA BHS overflow, VHR, MRSS, MMSS, CPF LIFE deferral, RA lump sum, lease buyback, Silver Support, SRS withdrawal, spousal transfer, WIS/Workfare, nomination, healthcare deductions)
- TransitionAnimator component (inline Sankey for age 55 and 65 transitions using Framer Motion + SVG)
- CpfMiniWaterfall component (summary stacked bar chart using Recharts ComposedChart)
- Updated registry with all 22 total schemes
- 16 new citation entries

**Plan 3 will add:** Couples mode, couple-specific timeline interleaving, feedback API endpoint, share URL encoding/decoding, mobile polish, and e2e tests.
