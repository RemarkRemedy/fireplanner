# Health Check MoneySense Upgrade — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the existing Health Check page to group 9 ratios under the 4 MoneySense Basic Financial Planning Guide areas, add educational context with cited sources, cross-link to Stress Test and external resources (CompareFIRST), and make Health Check always visible in nav (not gated behind Protection toggle).

**Architecture:** No new pages, no new stores. One prerequisite task (Task 0) ensures the fee-drag ratio exists in the calculation layer. The remaining tasks are presentation-only: the 9 ratios and insurance needs panel are regrouped into 4 MoneySense sections with quoted guidance above each group. A new data file (`moneySenseGuide.ts`) holds the quoted text and source URLs. The nav visibility gate is removed so all users see Health Check.

**Tech Stack:** React, TypeScript, Tailwind CSS, existing shadcn/ui components (Card, Accordion, Tabs).

---

## Task 0: Ensure fee-drag ratio exists (BLOCKING prerequisite)

**Files:**
- Check: `src/lib/data/healthBenchmarks.ts`
- Check: `src/lib/calculations/healthCheck.ts`
- Check: `src/hooks/useHealthCheckInputs.ts`

The 9th ratio (`fee-drag`) was added in commit `7d155c30` but may not be on the working tree. **This task MUST complete before Task 1.** The Investments group in `moneySenseGuide.ts` references `'fee-drag'` — if it doesn't exist, the group will silently show 3 cards instead of 4.

- [ ] **Step 1: Check if fee-drag exists**

```bash
grep 'fee-drag' frontend/src/lib/data/healthBenchmarks.ts
```

If found → skip to Task 1.
If NOT found → continue to Step 2.

- [ ] **Step 2: Cherry-pick the fee-drag commit (including its test changes)**

```bash
git cherry-pick 7d155c30 --no-commit
```

Verify which files were touched:

```bash
git diff --cached --name-only
```

Expected: only these 4 files:
- `frontend/src/lib/data/healthBenchmarks.ts`
- `frontend/src/lib/calculations/healthCheck.ts`
- `frontend/src/hooks/useHealthCheckInputs.ts`
- `frontend/src/lib/calculations/healthCheck.test.ts`

If extra files appear, reset them before staging:

```bash
git checkout HEAD -- <any-extra-file>
```

Then stage only the 4 expected files:

```bash
git add frontend/src/lib/data/healthBenchmarks.ts frontend/src/lib/calculations/healthCheck.ts frontend/src/hooks/useHealthCheckInputs.ts frontend/src/lib/calculations/healthCheck.test.ts
```

Note: Do NOT reset the test file — the cherry-pick commit updates test expectations from 8 to 9 ratios. Include the test changes. If the cherry-pick has merge conflicts, resolve them manually or apply the changes from `git show 7d155c30` by hand.

- [ ] **Step 3: Verify it compiles and tests pass**

Run: `cd frontend && npm run type-check && npm run lint && npm run test`
Expected: Zero errors, all tests pass

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: add Investment Fee Drag ratio to Health Check (cherry-pick 7d155c30)"
```

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/lib/data/moneySenseGuide.ts` | Create | MoneySense quoted text, source URLs, life-stage PDF links, ratio-to-area grouping |
| `src/lib/data/moneySenseGuide.test.ts` | Create | Tests for `getLifeStageGuide()` and exhaustive ratio-to-area mapping |
| `src/pages/HealthCheckPage.tsx` | Modify | Render 4 grouped sections instead of flat grid |
| `src/components/health/RatioGroup.tsx` | Create | Reusable section component: header + quote + RatioCards + action links |
| `src/components/health/RatioGrid.tsx` | Delete | Replaced by RatioGroup (only used in HealthCheckPage, 12 lines) |
| `src/components/layout/Sidebar.tsx` | Modify | Remove Protection gate on Health Check nav item |

---

## Chunk 1: Data + Components

### Task 1: Create MoneySense guide data file

**Files:**
- Create: `src/lib/data/moneySenseGuide.ts`

- [ ] **Step 1: Create the data file**

```typescript
// src/lib/data/moneySenseGuide.ts

/**
 * MoneySense Basic Financial Planning Guide — quoted text and source URLs.
 * Source: https://www.moneysense.gov.sg/planning-your-finances-well/
 * Published by MAS in collaboration with ABS, AFAS, and LIA Singapore.
 * Guide PDF (Sep 2023): https://www.moneysense.gov.sg/files/Streamlined_Basic_Financial_Planning_Guide__circulate_on_26_Sep_2023_.pdf
 */

export interface MoneySenseArea {
  id: string
  title: string
  /** Direct quote from MoneySense guide */
  quote: string
  /** Additional educational context (paraphrased, not a direct quote) */
  context: string
  /** Source attribution */
  source: string
  sourceUrl: string
  /** Ratio IDs from HEALTH_RATIOS that belong to this area */
  ratioIds: string[]
  /** Whether this area includes the InsuranceNeedsPanel instead of/alongside ratios */
  includesInsurance: boolean
  /** Cross-links to other pages in the app */
  actionLinks: { label: string; to: string; external?: boolean }[]
}

export const MONEYSENSE_AREAS: MoneySenseArea[] = [
  {
    id: 'emergency-funds',
    title: 'Emergency Funds',
    quote: 'Set aside at least 3 to 6 months\' worth of expenses.',
    context:
      'If your income is irregular, aim to have savings equivalent to 12 months of expenses. ' +
      'Consider keeping money in a combination of savings accounts and Singapore Savings Bonds (SSBs), ' +
      'which are guaranteed by the Government and can be exited any month without penalty.',
    source: 'MoneySense Basic Financial Planning Guide',
    sourceUrl: 'https://www.moneysense.gov.sg/planning-your-finances-well/',
    ratioIds: ['emergency-fund', 'savings-ratio'],
    includesInsurance: false,
    actionLinks: [],
  },
  {
    id: 'protection',
    title: 'Protection',
    quote:
      'Obtain insurance protection for Death & Total Permanent Disability: 9x annual income. ' +
      'Critical Illness: 4x annual income. Spend at most 15% of income on insurance protection.',
    context:
      'All Singapore Citizens and PRs are automatically covered by DPS ($70,000 until age 59), ' +
      'MediShield Life for large hospital bills, and CareShield Life for long-term care. ' +
      '"Consider Term Insurance Plans for affordable protection." — MoneySense',
    source: 'MoneySense Basic Financial Planning Guide; LIA Singapore',
    sourceUrl: 'https://www.moneysense.gov.sg/planning-your-finances-well/',
    ratioIds: [],
    includesInsurance: true,
    // NOTE: ILP Review page exists but has no route in production (hidden in commit eb555b98).
    // Add the '/ilp-review' link here when the route is re-enabled.
    actionLinks: [
      { label: 'CompareFIRST portal', to: 'https://www.comparefirst.sg/wap/homeEvent.action', external: true },
    ],
  },
  {
    id: 'debt-health',
    title: 'Debt Health',
    quote: 'Prioritise paying off high interest debts (e.g. credit card bills), to avoid high interest charges.',
    context:
      'MAS caps total debt servicing at 55% of gross income for lending decisions (TDSR framework). ' +
      'The thresholds below are stricter personal finance targets, not regulatory limits.',
    source: 'MoneySense Basic Financial Planning Guide; MAS TDSR framework',
    sourceUrl: 'https://www.moneysense.gov.sg/planning-your-finances-well/',
    ratioIds: ['tdsr', 'non-mortgage-dsr', 'debt-to-asset'],
    includesInsurance: false,
    actionLinks: [],
  },
  {
    id: 'investments',
    title: 'Investments',
    quote: 'Invest at least 10% of income for retirement and other financial goals.',
    context:
      'For short-term goals, MoneySense suggests Singapore Savings Bonds, T-bills, or fixed deposits. ' +
      'For long-term: CPF top-ups (up to $8,000/yr tax relief), ETFs, or unit trusts. ' +
      'Growing your CPF savings through cash top-ups to your Special/Retirement Account earns 4% risk-free ' +
      'with compounding interest and higher monthly payouts when you retire.',
    source: 'MoneySense Basic Financial Planning Guide',
    sourceUrl: 'https://www.moneysense.gov.sg/planning-your-finances-well/',
    ratioIds: ['liquid-to-nw', 'investment-to-nw', 'solvency', 'fee-drag'],
    includesInsurance: false,
    actionLinks: [
      { label: 'Run Monte Carlo simulation', to: '/stress-test' },
      { label: 'View year-by-year projection', to: '/projection' },
    ],
  },
]

/** Life-stage guide PDF links from MoneySense (Jan 2024 update, 6 variants). */
export const LIFE_STAGE_GUIDES: { minAge: number; maxAge: number; label: string; url: string }[] = [
  {
    minAge: 19,
    maxAge: 29,
    label: 'Working Adult (Starting Out)',
    url: 'https://www.moneysense.gov.sg/files/Basic%20Financial%20Planning%20Guide/english__working_adult__starting_out_.pdf',
  },
  {
    minAge: 25,
    maxAge: 39,
    label: 'Working Adult (Starting a Family)',
    url: 'https://www.moneysense.gov.sg/files/Basic%20Financial%20Planning%20Guide/english__working_adult__starting_a_family_.pdf',
  },
  {
    minAge: 35,
    maxAge: 59,
    label: 'Working Adult (Supporting Children & Parents)',
    url: 'https://www.moneysense.gov.sg/files/Basic%20Financial%20Planning%20Guide/english____working_adult__children__parents_.pdf',
  },
  {
    minAge: 55,
    maxAge: 120,
    label: 'Pre-Retiree / Retiree',
    url: 'https://www.moneysense.gov.sg/files/Basic%20Financial%20Planning%20Guide/english__retiree_.pdf',
  },
]

/** Returns the best-matching life-stage guide for a given age. */
export function getLifeStageGuide(age: number): typeof LIFE_STAGE_GUIDES[number] | null {
  // Prefer narrower ranges by iterating in order (starting-out < starting-family < supporting < retiree)
  for (const guide of LIFE_STAGE_GUIDES) {
    if (age >= guide.minAge && age <= guide.maxAge) return guide
  }
  return null
}

export const MONEYSENSE_DISCLAIMER =
  'This assessment uses rules of thumb from the Basic Financial Planning Guide, ' +
  'published by the Monetary Authority of Singapore in collaboration with ABS, AFAS, ' +
  'and LIA Singapore. It is for educational purposes only and does not constitute financial advice.'
```

- [ ] **Step 2: Write test for `getLifeStageGuide()`**

Create `src/lib/data/moneySenseGuide.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { getLifeStageGuide, MONEYSENSE_AREAS, LIFE_STAGE_GUIDES } from './moneySenseGuide'
import { HEALTH_RATIOS } from './healthBenchmarks'

describe('getLifeStageGuide', () => {
  it('returns starting-out guide for age 25', () => {
    expect(getLifeStageGuide(25)?.label).toContain('Starting Out')
  })

  it('returns retiree guide for age 60', () => {
    expect(getLifeStageGuide(60)?.label).toContain('Retiree')
  })

  it('returns null for age 0', () => {
    expect(getLifeStageGuide(0)).toBeNull()
  })
})

describe('MONEYSENSE_AREAS ratioIds coverage', () => {
  it('every ratio in HEALTH_RATIOS appears in exactly one area', () => {
    const allMappedIds = MONEYSENSE_AREAS.flatMap((a) => a.ratioIds)
    for (const ratio of HEALTH_RATIOS) {
      const count = allMappedIds.filter((id) => id === ratio.id).length
      expect(count, `ratio ${ratio.id} should appear in exactly 1 area`).toBe(1)
    }
  })

  it('no ratioId references a non-existent ratio', () => {
    const validIds = new Set(HEALTH_RATIOS.map((r) => r.id))
    for (const area of MONEYSENSE_AREAS) {
      for (const id of area.ratioIds) {
        expect(validIds.has(id), `ratioId '${id}' in area '${area.id}' does not exist in HEALTH_RATIOS`).toBe(true)
      }
    }
  })
})
```

- [ ] **Step 3: Verify type-check, lint, and tests pass**

Run: `cd frontend && npm run type-check && npm run lint && npm run test`
Expected: All pass

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/data/moneySenseGuide.ts frontend/src/lib/data/moneySenseGuide.test.ts
git commit -m "feat: add MoneySense guide data with quoted text, source URLs, and tests"
```

---

### Task 2: Create RatioGroup component

**Files:**
- Create: `src/components/health/RatioGroup.tsx`
- Read: `src/components/health/RatioCard.tsx` (existing, unchanged)
- Read: `src/components/health/InsuranceNeedsPanel.tsx` (existing, unchanged)

This component renders one MoneySense area: a header with the quoted rule of thumb, the filtered ratio cards, optionally the insurance panel, and action links.

- [ ] **Step 1: Create the component**

```tsx
// src/components/health/RatioGroup.tsx
import { Link } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import { type MoneySenseArea } from '@/lib/data/moneySenseGuide'
import { type HealthRatioResult } from '@/lib/calculations/healthCheck'
import { type InsuranceNeedsResult } from '@/lib/calculations/insuranceNeeds'
import { RatioCard } from './RatioCard'
import { InsuranceNeedsPanel } from './InsuranceNeedsPanel'

interface RatioGroupProps {
  area: MoneySenseArea
  ratios: HealthRatioResult[]
  insuranceNeeds: InsuranceNeedsResult | null
}

export function RatioGroup({ area, ratios, insuranceNeeds }: RatioGroupProps) {
  const filteredRatios = ratios.filter((r) => area.ratioIds.includes(r.id))

  return (
    <section className="space-y-3">
      {/* Section header */}
      <div>
        <h2 className="text-lg font-semibold">{area.title}</h2>
        <blockquote className="mt-1 border-l-2 border-primary/30 pl-3 text-sm text-muted-foreground italic">
          "{area.quote}"
        </blockquote>
      </div>

      {/* Educational context */}
      <p className="text-xs text-muted-foreground">{area.context}</p>

      {/* Ratio cards */}
      {filteredRatios.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredRatios.map((ratio) => (
            <RatioCard key={ratio.id} ratio={ratio} />
          ))}
        </div>
      )}

      {/* Insurance needs panel (Protection area only) */}
      {area.includesInsurance && insuranceNeeds && (
        <InsuranceNeedsPanel result={insuranceNeeds} />
      )}

      {/* Action links */}
      {area.actionLinks.length > 0 && (
        <div className="flex flex-wrap gap-3 pt-1">
          {area.actionLinks.map((link) =>
            link.external ? (
              <a
                key={link.to}
                href={link.to}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                {link.label}
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <Link
                key={link.to}
                to={link.to}
                className="text-sm text-primary hover:underline"
              >
                {link.label} →
              </Link>
            )
          )}
        </div>
      )}

      {/* Source */}
      <p className="text-[10px] text-muted-foreground/60">
        Source:{' '}
        <a href={area.sourceUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
          {area.source}
        </a>
      </p>
    </section>
  )
}
```

- [ ] **Step 2: Verify type-check and lint pass**

Run: `cd frontend && npm run type-check && npm run lint`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/health/RatioGroup.tsx
git commit -m "feat: add RatioGroup component for MoneySense-grouped health ratios"
```

---

## Chunk 2: Page Upgrade + Nav Fix

### Task 3: Upgrade HealthCheckPage to use grouped layout

**Files:**
- Modify: `src/pages/HealthCheckPage.tsx`
- Delete: `src/components/health/RatioGrid.tsx` (replaced by RatioGroup)

The page currently renders a flat `<RatioGrid>` followed by `<InsuranceNeedsPanel>` followed by an accordion. Replace with: 4 `<RatioGroup>` sections, keeping the existing accordion ("Understanding these ratios") at the bottom, and adding the MoneySense disclaimer + life-stage guide link.

- [ ] **Step 1: Rewrite HealthCheckPage**

Replace the entire content of `src/pages/HealthCheckPage.tsx` with:

```tsx
import { useMemo, useState } from 'react'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import { useHealthCheckInputs } from '@/hooks/useHealthCheckInputs'
import { computeHealthRatios, type HealthCheckResult } from '@/lib/calculations/healthCheck'
import { computeInsuranceNeeds, type InsuranceNeedsResult } from '@/lib/calculations/insuranceNeeds'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { RatioGroup } from '@/components/health/RatioGroup'
import { HEALTH_RATIOS } from '@/lib/data/healthBenchmarks'
import { MONEYSENSE_AREAS, MONEYSENSE_DISCLAIMER, getLifeStageGuide } from '@/lib/data/moneySenseGuide'
import { cn } from '@/lib/utils'
import { usePageMeta } from '@/hooks/usePageMeta'
import { ExternalLink } from 'lucide-react'

function formatThreshold(value: number, unit: string): string {
  if (unit === 'months') return `${value} mo`
  if (unit === '%') return `${(value * 100).toFixed(0)}%`
  return value.toFixed(2)
}

export function HealthCheckPage() {
  usePageMeta({
    title: 'Health Check — SG FIRE Planner',
    description:
      'Check your financial health against MoneySense guidelines: emergency funds, protection, debt health, and investment ratios.',
    path: '/health-check',
  })

  const adults = useHouseholdPlanStore((s) => s.plan.adults)
  const isMultiAdult = adults.length > 1
  const [selectedAdultId, setSelectedAdultId] = useState(adults[0]?.id ?? '')

  // Use the selected adult's age for life-stage guide (not useProfileStore, which is always the primary adult)
  const selectedAdult = adults.find((a) => a.id === selectedAdultId)
  const currentAge = selectedAdult?.currentAge ?? 30

  const inputs = useHealthCheckInputs(selectedAdultId)

  const healthCheck: HealthCheckResult | null = useMemo(() => {
    if (!inputs) return null
    return computeHealthRatios(inputs.ratioInputs)
  }, [inputs])

  const insuranceNeeds: InsuranceNeedsResult | null = useMemo(() => {
    if (!inputs) return null
    return computeInsuranceNeeds(inputs.insuranceInputs)
  }, [inputs])

  const lifeStageGuide = getLifeStageGuide(currentAge)

  if (!inputs?.isReady) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Financial Health Check</h1>
          <p className="text-muted-foreground mt-1">
            Enter your income and expenses to see your financial health assessment.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Financial Health Check</h1>
        <p className="text-muted-foreground mt-1">
          Your finances assessed against 4 key areas from the{' '}
          <a
            href="https://www.moneysense.gov.sg/planning-your-finances-well/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            MoneySense Basic Financial Planning Guide
          </a>
        </p>
        {healthCheck && (
          <p className="text-sm text-muted-foreground mt-1">
            {healthCheck.greenCount}/{healthCheck.ratios.length} ratios healthy
          </p>
        )}
      </div>

      {isMultiAdult && (
        <Tabs value={selectedAdultId} onValueChange={setSelectedAdultId}>
          <TabsList>
            {adults.map((adult) => (
              <TabsTrigger key={adult.id} value={adult.id}>
                {adult.displayName}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      {healthCheck && (
        <>
          {/* 4 MoneySense areas */}
          {MONEYSENSE_AREAS.map((area) => (
            <RatioGroup
              key={area.id}
              area={area}
              ratios={healthCheck.ratios}
              insuranceNeeds={insuranceNeeds}
            />
          ))}

          {/* Detailed ratio reference (collapsed) */}
          <Accordion type="single" collapsible>
            <AccordionItem value="ratio-guide">
              <AccordionTrigger className="text-sm font-medium">
                Understanding these ratios
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-2">
                  {HEALTH_RATIOS.map((meta) => {
                    const computed = healthCheck.ratios.find((r) => r.id === meta.id)
                    return (
                      <div key={meta.id} className="border-b pb-3 last:border-b-0 last:pb-0">
                        <div className="flex items-center gap-2 mb-1">
                          {computed?.status && (
                            <div
                              className={cn(
                                'h-2 w-2 rounded-full shrink-0',
                                computed.status === 'green' && 'bg-emerald-500',
                                computed.status === 'amber' && 'bg-amber-500',
                                computed.status === 'red' && 'bg-red-500'
                              )}
                            />
                          )}
                          <h4 className="text-sm font-semibold">{meta.label}</h4>
                          {computed?.displayValue && computed.displayValue !== '—' && (
                            <span className="text-xs text-muted-foreground tabular-nums">
                              ({computed.displayValue})
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">{meta.description}</p>
                        <div className="text-xs space-y-1">
                          <p>
                            <span className="font-medium">Formula: </span>
                            <code className="bg-muted px-1 py-0.5 rounded text-[11px]">{meta.formula}</code>
                          </p>
                          <p>
                            <span className="font-medium">Thresholds: </span>
                            <span className="inline-flex items-center gap-1">
                              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              {meta.direction === 'higher-is-better' ? '>=' : '<='}{' '}
                              {formatThreshold(meta.thresholds.greenBound, meta.unit)}
                            </span>
                            {' / '}
                            <span className="inline-flex items-center gap-1">
                              <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
                              {meta.direction === 'higher-is-better' ? '>=' : '<='}{' '}
                              {formatThreshold(meta.thresholds.amberBound, meta.unit)}
                            </span>
                            {' / '}
                            <span className="inline-flex items-center gap-1">
                              <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500" />
                              otherwise
                            </span>
                          </p>
                          <div className="mt-1.5 space-y-0.5">
                            <p>
                              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1" />
                              {meta.tip.green}
                            </p>
                            <p>
                              <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500 mr-1" />
                              {meta.tip.amber}
                            </p>
                            <p>
                              <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500 mr-1" />
                              {meta.tip.red}
                            </p>
                          </div>
                          <p className="text-[10px] text-muted-foreground/70 mt-1">Source: {meta.source}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </>
      )}

      {/* Life-stage guide link */}
      {lifeStageGuide && (
        <div className="rounded-lg border bg-muted/30 p-4">
          <p className="text-sm">
            <span className="font-medium">MoneySense guide for your life stage:</span>{' '}
            <a
              href={lifeStageGuide.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-1"
            >
              {lifeStageGuide.label} (PDF)
              <ExternalLink className="h-3 w-3" />
            </a>
          </p>
        </div>
      )}

      {/* Disclaimer */}
      <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
        {MONEYSENSE_DISCLAIMER}
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Delete RatioGrid.tsx**

```bash
git rm frontend/src/components/health/RatioGrid.tsx
```

Verify no other files import it:

Run: `cd frontend && grep -r "RatioGrid" src/ --include="*.ts" --include="*.tsx" | grep -v node_modules`
Expected: Zero results (the old HealthCheckPage import was replaced in Step 1)

- [ ] **Step 3: Verify compilation**

Run: `cd frontend && npm run type-check`
Expected: Zero errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/HealthCheckPage.tsx frontend/src/components/health/RatioGrid.tsx
git commit -m "feat: group Health Check ratios into 4 MoneySense areas with educational context"
```

---

### Task 4: Make Health Check always visible in nav

**Files:**
- Modify: `src/components/layout/Sidebar.tsx:188-200`

Currently Health Check only appears when `protectionEnabled` is true. It should always be visible — the page shows ratios regardless of whether the user has entered insurance data (insurance panel just won't render if no data).

- [ ] **Step 1: Move Health Check into the static AFTER_INPUTS_GROUPS**

In `src/components/layout/Sidebar.tsx`, move the Health Check nav item from the conditional block (lines 191-199) into the static `ANALYSIS` group in `AFTER_INPUTS_GROUPS` (around line 116-119):

Change the ANALYSIS group from:

```typescript
{
  title: 'ANALYSIS',
  items: [
    { label: 'Stress Test', path: '/stress-test', icon: <ShieldAlert className="h-4 w-4" /> },
  ],
},
```

to:

```typescript
{
  title: 'ANALYSIS',
  items: [
    { label: 'Stress Test', path: '/stress-test', icon: <ShieldAlert className="h-4 w-4" /> },
    { label: 'Health Check', path: '/health-check', icon: <HeartPulse className="h-4 w-4" /> },
  ],
},
```

Then remove the conditional injection block (lines ~188-200). Change:

```typescript
const afterInputGroups = (companionMode
  ? AFTER_INPUTS_GROUPS.filter((group) => group.title === 'PLAN' || group.title === 'ANALYSIS')
  : AFTER_INPUTS_GROUPS
).map((group) => {
  if (group.title !== 'ANALYSIS' || !protectionEnabled) return group
  return {
    ...group,
    items: [
      ...group.items,
      { label: 'Health Check', path: '/health-check', icon: <HeartPulse className="h-4 w-4" /> },
    ],
  }
})
```

to:

```typescript
const afterInputGroups = companionMode
  ? AFTER_INPUTS_GROUPS.filter((group) => group.title === 'PLAN' || group.title === 'ANALYSIS')
  : AFTER_INPUTS_GROUPS
```

- [ ] **Step 2: Verify compilation**

Run: `cd frontend && npm run type-check`
Expected: Zero errors

- [ ] **Step 3: Verify `protectionEnabled` is still needed**

**DO NOT remove `protectionEnabled`.** It is still used at line ~167 for hiding the Protection input section in the sidebar (`if (!protectionEnabled) hiddenSectionIds.add('section-protection')`). Only the `.map()` block that conditionally injects the Health Check nav item is removed — the variable itself stays.

Run: `cd frontend && npm run lint`
Expected: No new errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/layout/Sidebar.tsx
git commit -m "ux: always show Health Check in nav, remove Protection toggle gate"
```

---

### Task 5: Verify and clean up

- [ ] **Step 1: Run full type check**

Run: `cd frontend && npm run type-check`
Expected: Zero errors

- [ ] **Step 2: Run linter**

Run: `cd frontend && npm run lint`
Expected: No new errors

- [ ] **Step 3: Run tests**

Run: `cd frontend && npm run test`
Expected: All tests pass. No health check tests should break — `computeHealthRatios` and `computeInsuranceNeeds` are unchanged.

- [ ] **Step 4: Visual verification**

Start dev server: `cd frontend && npm run dev -- --port 5173`

Verify:
1. Health Check appears in sidebar nav without enabling Protection section
2. Page shows 4 grouped sections: Emergency Funds, Protection, Debt Health, Investments
3. Each section has a MoneySense blockquote and educational context
4. Emergency Funds group shows 2 ratio cards (Emergency Fund + Savings Ratio)
5. Protection group shows InsuranceNeedsPanel (if protection data entered), or just the educational text and links (if no data)
6. Protection group shows CompareFIRST external link (no ILP Review link — route is disabled in production)
7. Debt Health group shows 3 ratio cards (TDSR, Non-Mortgage DSR, Debt-to-Asset)
8. Investments group shows 4 ratio cards (Liquid/NW, Investment/NW, Solvency, Fee Drag)
9. Investments group shows "Run Monte Carlo simulation" and "View year-by-year projection" links
10. "Understanding these ratios" accordion still works with all 9 ratios
11. Life-stage guide link appears at bottom based on user's age
12. Disclaimer text appears at bottom
13. Per-adult tabs work in household mode

- [ ] **Step 5: Kill dev server**

---

## Notes for implementer

- **Do NOT change any calculation files.** This is purely a presentation refactor. `computeHealthRatios`, `computeInsuranceNeeds`, `HEALTH_RATIOS`, `HEALTH_RATIO_LOOKUP` are all unchanged.
- **RatioCard.tsx is unchanged.** It renders individual ratio cards exactly as before.
- **InsuranceNeedsPanel.tsx is unchanged.** It just moves from being a sibling of RatioGrid to being rendered inside the Protection `RatioGroup`.
- **The fee-drag ratio (9th)** was added in commit `7d155c30`. If it's not in `healthBenchmarks.ts` when you start, it needs to be there for the Investments group to show 4 cards. Check the current state of the file before starting.
- **`currentAge` for life-stage guide** comes from the selected adult in `useHouseholdPlanStore`, not from `useProfileStore`. This ensures the life-stage guide matches the adult currently selected in the per-adult tabs (household mode).
- **CompareFIRST URL:** `https://www.comparefirst.sg/wap/homeEvent.action` — verify this returns 200 before committing.
