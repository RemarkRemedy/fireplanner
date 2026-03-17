# SEO Landing Pages Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build two SEO landing pages (`/cpf-planner` and `/compare`) with interactive calculators, FAQ schema, and email capture.

**Architecture:** Two independent page components following the existing `RetirementPlannerPage` pattern. Each has a self-contained interactive calculator using local state (no Zustand stores). Shared infrastructure changes (email constants, routes, sitemap, prerender) are in a separate task.

**Tech Stack:** React 19, TypeScript, Vite, React Router 6, existing CPF calculation functions, existing UI components (Card, Button, CurrencyInput, NumberInput)

**Spec:** `docs/superpowers/specs/2026-03-17-seo-landing-pages-design.md`

**Parallelism:** Tasks 1-3 are independent and can run in parallel. Task 4 depends on all three completing.

---

## Chunk 1: Shared Infrastructure + `/cpf-planner`

### Task 1: Shared Infrastructure (email constants, routes, sitemap, prerender, PAGE_NAMES)

**Files:**
- Modify: `frontend/src/lib/validation/emailConstants.ts`
- Modify: `frontend/src/hooks/usePageMeta.ts`
- Modify: `frontend/src/router.tsx`
- Modify: `frontend/public/sitemap.xml`
- Modify: `frontend/scripts/prerender.mjs`

- [ ] **Step 1: Update emailConstants.ts**

Add `'cpf_planner'` and `'compare_page'` to `VALID_SOURCES`. Add `'portfolio_integration'` to `VALID_FEATURES`.

Read the file first. In `VALID_SOURCES` array (line 2), append the two new values. In `VALID_FEATURES` array (line 3), append `'portfolio_integration'`.

- [ ] **Step 2: Update usePageMeta.ts PAGE_NAMES**

Read `frontend/src/hooks/usePageMeta.ts`. Add to the `PAGE_NAMES` record (around line 21-34):
```typescript
'/cpf-planner': 'CPF Planner',
'/compare': 'Compare',
```

- [ ] **Step 3: Add routes to router.tsx**

Read `frontend/src/router.tsx`. Add lazy imports at the top:
```typescript
const CpfPlannerPage = lazy(() => import('@/pages/CpfPlannerPage').then(m => ({ default: m.CpfPlannerPage })))
const ComparePage = lazy(() => import('@/pages/ComparePage').then(m => ({ default: m.ComparePage })))
```

Add routes inside the `PlannerRouteShell` children, after the `/retirement-calculator` route (line 116):
```typescript
{ path: '/cpf-planner', element: page(CpfPlannerPage) },
{ path: '/compare', element: page(ComparePage) },
```

Check how existing pages are imported in the file. If they use direct imports (not lazy), follow the same pattern instead.

- [ ] **Step 4: Update sitemap.xml**

Read `frontend/public/sitemap.xml`. Add two entries before the closing `</urlset>`:
```xml
<url>
  <loc>https://sgfireplanner.com/cpf-planner</loc>
  <lastmod>2026-03-17</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.8</priority>
</url>
<url>
  <loc>https://sgfireplanner.com/compare</loc>
  <lastmod>2026-03-17</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.8</priority>
</url>
```

- [ ] **Step 5: Add prerender entries**

Read `frontend/scripts/prerender.mjs`. Add two route entries to the `routes` array, following the existing pattern:

For `/cpf-planner`:
```javascript
{
  path: '/cpf-planner',
  title: 'CPF Retirement Planner: Estimate Your CPF Balances, BRS/FRS/ERS, and CPF LIFE Payout',
  heading: 'CPF Retirement Planner',
  description: 'Free CPF retirement calculator for Singapore. Estimate your OA/SA/MA balances at 55, compare BRS/FRS/ERS tiers, and see your projected CPF LIFE monthly payout.',
  bodyHtml: `
    <p>Estimate your CPF balances at age 55 and see how much CPF LIFE will pay you each month. Then find out if CPF alone covers your retirement expenses, or if your portfolio needs to fill the gap.</p>
    <p>2026 Retirement Sums: BRS $110,200 / FRS $220,400 / ERS $440,800</p>
    <ul>
      <li><a href="/">Start full retirement planning</a></li>
      <li><a href="/retirement-planner">Singapore retirement planner</a></li>
      <li><a href="/retirement-calculator">Singapore retirement calculator</a></li>
      <li><a href="/compare">Compare robo-advisors vs DIY</a></li>
    </ul>
  `,
},
```

For `/compare`:
```javascript
{
  path: '/compare',
  title: 'Robo-Advisors vs DIY: Singapore Fee Comparison and Retirement Planning',
  heading: 'Robo-Advisors vs Retirement Planner',
  description: 'Compare Endowus, StashAway, Syfe, and DBS digiPortfolio fees. See the 30-year cost of each platform and what a free retirement planner adds that robo-advisors cannot.',
  bodyHtml: `
    <p>Robo-advisors manage your investments. A retirement planner tells you if those investments are enough. They solve different problems, and most people benefit from both.</p>
    <p>Compare fees across Endowus, StashAway, Syfe, DBS digiPortfolio, and DIY investing. Then see what SGFirePlanner adds: CPF projections, 12 withdrawal strategies, Monte Carlo stress testing, and household planning.</p>
    <ul>
      <li><a href="/">Start planning for free</a></li>
      <li><a href="/cpf-planner">CPF retirement planner</a></li>
      <li><a href="/retirement-planner">Singapore retirement planner</a></li>
      <li><a href="/retirement-calculator">Singapore retirement calculator</a></li>
    </ul>
  `,
},
```

- [ ] **Step 6: Run type-check and lint**

```bash
cd /Users/tj/TJDevelopment/fireplanner/frontend && npm run type-check && npm run lint
```

Confirm no new errors from our changes (pre-existing errors in test files are OK).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/lib/validation/emailConstants.ts frontend/src/hooks/usePageMeta.ts frontend/src/router.tsx frontend/public/sitemap.xml frontend/scripts/prerender.mjs
git commit -m "seo: add shared infrastructure for /cpf-planner and /compare pages"
```

---

### Task 2: CPF Mini-Calculator Component

**Files:**
- Create: `frontend/src/components/cpf/CpfMiniCalculator.tsx`

**Dependencies:** Read these files before writing code:
- `frontend/src/lib/calculations/cpf.ts` (lines 173-200 for `performAge55Transfer`, 275-340 for `projectCpfBalances`, 353-367 for `calculateBrsFrsErs`, 400-410 for `estimateCpfLifePayout`, 586-600 for `estimateCpfBalances`)
- `frontend/src/lib/data/cpfRates.ts` (for constants)
- `frontend/src/components/shared/CurrencyInput.tsx` (for input pattern)
- `frontend/src/components/shared/NumberInput.tsx` (for input pattern)

- [ ] **Step 1: Read the CPF function signatures**

Read `frontend/src/lib/calculations/cpf.ts` at the lines listed above. Confirm the exact signatures before writing code. List the parameter names and types for each function.

- [ ] **Step 2: Create CpfMiniCalculator.tsx**

Create `frontend/src/components/cpf/CpfMiniCalculator.tsx`. This is a self-contained component with local state. No Zustand store reads.

The component must:
- Accept no props
- Use `useState` for all inputs (age, monthlySalary, monthlyExpenses, cpfLifePlan, residencyStatus)
- Validate inputs before calculating (age 25-54, salary > 0, expenses >= 0)
- Show inline validation errors
- Run the 6-step calculation flow from the spec (estimate balances -> project to 55 -> age-55 transfer -> BRS/FRS/ERS -> CPF LIFE payout -> gap)
- Display results in a clean card layout
- Include the disclaimer text
- Use `CurrencyInput` for salary and expenses, `NumberInput` for age
- Use `formatCurrency(value, 0)` for all monetary displays
- No em dashes in any user-facing text

Key calculation details:
- `monthlySalary * 12` for annual salary (functions take annual)
- `estimateCpfLifePayout(newRA, plan)` returns annual, divide by 12 for monthly
- `calculateBrsFrsErs(currentAge)` takes current age, NOT 55
- Gap calculation in today's dollars: `monthlyExpenses - (annualCpfLifePayout / 12)`, years = 25

- [ ] **Step 3: Run type-check**

```bash
cd /Users/tj/TJDevelopment/fireplanner/frontend && npm run type-check 2>&1 | grep -E "CpfMini"
```

Confirm no type errors in the new file.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/cpf/CpfMiniCalculator.tsx
git commit -m "feat: add CPF mini-calculator component for /cpf-planner landing page"
```

---

### Task 3: CpfPlannerPage Route Component

**Files:**
- Create: `frontend/src/pages/CpfPlannerPage.tsx`

**Dependencies:** Read these files before writing code:
- `frontend/src/pages/RetirementPlannerPage.tsx` (pattern to follow exactly: hero, features, FAQ, schema injection, usePageMeta, useEffect cleanup)
- `frontend/src/components/cpf/CpfMiniCalculator.tsx` (from Task 2)

- [ ] **Step 1: Read RetirementPlannerPage.tsx**

Read the full file. Note the pattern: FAQ data + schema object defined outside component, `usePageMeta` call, `useEffect` for schema injection with cleanup, hero section, feature cards, FAQ accordion, CTA links.

- [ ] **Step 2: Create CpfPlannerPage.tsx**

Follow the RetirementPlannerPage pattern exactly. The page must include:

1. FAQ questions + schema object (defined outside the component):
   - "How much CPF do I need to retire in Singapore?"
   - "What is the difference between BRS, FRS, and ERS?"
   - "How much will I get from CPF LIFE per month?"
   - "Is CPF enough for retirement in Singapore?"

2. WebApplication schema object

3. `usePageMeta` call:
   ```typescript
   usePageMeta({
     title: 'CPF Retirement Planner: Estimate Your CPF Balances, BRS/FRS/ERS, and CPF LIFE Payout',
     description: 'Free CPF retirement calculator for Singapore. Estimate your OA/SA/MA balances at 55, compare BRS/FRS/ERS tiers, and see your projected CPF LIFE monthly payout.',
     path: '/cpf-planner',
   })
   ```

4. `useEffect` for FAQ + WebApplication schema injection (with cleanup on unmount)

5. Page sections:
   - Hero: headline "CPF Retirement Planner", subtitle, CTA to `/`
   - `<CpfMiniCalculator />` component
   - Content section: ~800-1000 words about BRS/FRS/ERS, CPF LIFE, SA top-up, housing withdrawal. Use H2 tags for each subsection.
   - FAQ accordion (render the FAQ questions/answers visually, same data as the schema)
   - Related tools links: `/`, `/retirement-planner`, `/retirement-calculator`, `/compare`

6. No em dashes in any user-facing text

- [ ] **Step 3: Run type-check and lint**

```bash
cd /Users/tj/TJDevelopment/fireplanner/frontend && npm run type-check 2>&1 | grep "CpfPlanner" && npm run lint 2>&1 | grep "CpfPlanner"
```

- [ ] **Step 4: Visual check**

```bash
cd /Users/tj/TJDevelopment/fireplanner/frontend && npm run dev -- --port 5173
```

Open `http://localhost:5173/cpf-planner`. Verify:
- Page loads without errors
- Calculator inputs work and produce results
- FAQ section renders
- Schema is in the `<head>` (inspect element)
- BreadcrumbList is injected

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/CpfPlannerPage.tsx
git commit -m "feat: add /cpf-planner SEO landing page with CPF mini-calculator"
```

---

## Chunk 2: `/compare` Page

### Task 4: Robo Fee Data

**Files:**
- Create: `frontend/src/lib/data/roboFees.ts`

- [ ] **Step 1: Create roboFees.ts**

Create `frontend/src/lib/data/roboFees.ts` with the `FeeTier`, `PlatformFees` interfaces and `ROBO_FEES` array. Include all 5 platforms (Endowus, StashAway, Syfe, DBS digiPortfolio, DIY) with verified fee data from the spec.

Type interface (from spec):
```typescript
export interface FeeTier { minAmount: number; rate: number }
export interface PlatformFees {
  id: string
  name: string
  tiers: FeeTier[]       // sorted ascending by minAmount
  estimatedTer: number   // average fund-level TER (0 for DIY ETFs)
  supportsSrs: boolean
  supportsCpfIs: boolean
  sourceUrl: string
  notes?: string
}
```

Include `export const ROBO_FEES_LAST_VERIFIED = '2026-03-17'` and source URLs per platform.

Also export a helper function:
```typescript
export function getFeeRate(platform: PlatformFees, portfolioSize: number): number
```
This returns the total annual fee (platform tier rate + estimatedTer) for the given portfolio size.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/lib/data/roboFees.ts
git commit -m "feat: add robo-advisor fee data for /compare page"
```

---

### Task 5: Fee Comparison Calculator Component

**Files:**
- Create: `frontend/src/components/compare/FeeComparisonCalculator.tsx`

**Dependencies:** Read `frontend/src/lib/data/roboFees.ts` (from Task 4).

- [ ] **Step 1: Create FeeComparisonCalculator.tsx**

Self-contained component with local state. No store reads.

Input: portfolio size slider ($50K - $2M, step $10K, default $500K)

Output for each platform: "Lost portfolio growth over 30 years (opportunity cost)" using formula:
```
portfolioSize * ((1 + 0.07) ** 30 - (1 + 0.07 - feeRate) ** 30)
```

Where `feeRate = getFeeRate(platform, portfolioSize)` from roboFees.ts.

Display requirements:
- Table or card grid showing each platform name, fee rate at selected portfolio size, and 30-year opportunity cost
- SGFirePlanner row showing $0
- Label output as "Lost portfolio growth over 30 years (opportunity cost)"
- One-line explainer: "This is the difference in portfolio value between paying this fee and paying nothing, assuming 7% annual returns."
- Disclaimer: "This assumes a constant fee tier. Actual costs may be lower as your portfolio grows into cheaper tiers."
- Disclaimer: "Fee structures change. Verify current rates on each platform's pricing page." with links.
- `formatCurrency(value, 0)` for all amounts
- No em dashes

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/compare/FeeComparisonCalculator.tsx
git commit -m "feat: add fee comparison calculator component for /compare page"
```

---

### Task 6: ComparePage Route Component

**Files:**
- Create: `frontend/src/pages/ComparePage.tsx`

**Dependencies:** Read `frontend/src/pages/RetirementPlannerPage.tsx` (pattern), `FeeComparisonCalculator.tsx` (from Task 5).

- [ ] **Step 1: Create ComparePage.tsx**

Follow RetirementPlannerPage pattern. Include:

1. FAQ questions + schema:
   - "Do I need a robo-advisor and a retirement planner?"
   - "How much do robo-advisors cost in Singapore?"
   - "Can I use SGFirePlanner with my Endowus or StashAway portfolio?"

2. WebApplication schema

3. `usePageMeta` call:
   ```typescript
   usePageMeta({
     title: 'Robo-Advisors vs DIY: Singapore Fee Comparison and Retirement Planning',
     description: 'Compare Endowus, StashAway, Syfe, and DBS digiPortfolio fees. See the 30-year cost of each platform and what a free retirement planner adds that robo-advisors cannot.',
     path: '/compare',
   })
   ```

4. Page sections:
   - Hero: "Robo-advisors manage your money. A planner helps you decide if it's enough."
   - Philosophy section: ~400 words, what robos do well vs what they don't
   - `<FeeComparisonCalculator />`
   - Feature cards: 5 unique SGFirePlanner capabilities
   - FAQ accordion
   - Related tools links

5. No em dashes

- [ ] **Step 2: Visual check**

Open `http://localhost:5173/compare`. Verify:
- Page loads, slider works, fee table updates
- Schema in `<head>`
- Links work

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/ComparePage.tsx
git commit -m "feat: add /compare SEO landing page with fee comparison calculator"
```

---

## Chunk 3: Cross-linking + Final Verification

### Task 7: Cross-link existing pages

**Files:**
- Modify: `frontend/src/pages/RetirementPlannerPage.tsx`
- Modify: `frontend/src/pages/RetirementCalculatorPage.tsx`

- [ ] **Step 1: Add links to existing SEO pages**

Read both files. Find their "Related tools" or link sections. Add links to `/cpf-planner` and `/compare`.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/RetirementPlannerPage.tsx frontend/src/pages/RetirementCalculatorPage.tsx
git commit -m "seo: add cross-links to /cpf-planner and /compare from existing SEO pages"
```

---

### Task 8: Final Verification

- [ ] **Step 1: Type-check**

```bash
cd /Users/tj/TJDevelopment/fireplanner/frontend && npm run type-check
```

No new errors from our files.

- [ ] **Step 2: Lint**

```bash
npm run lint
```

No new errors.

- [ ] **Step 3: Build**

```bash
npm run build
```

Build succeeds. Prerender creates `/cpf-planner/index.html` and `/compare/index.html` in `dist/`.

- [ ] **Step 4: Verify prerender output**

```bash
cat dist/cpf-planner/index.html | grep -i "BRS"
cat dist/compare/index.html | grep -i "robo"
```

Confirm static body HTML includes the SEO content.

- [ ] **Step 5: Test both pages in dev server**

```bash
npm run dev -- --port 5173
```

Open both pages, verify calculator interactions, schema injection, FAQ rendering, cross-links.

- [ ] **Step 6: Run tests**

```bash
npm run test
```

No regressions.

- [ ] **Step 7: Commit any remaining fixes**

- [ ] **Step 8: Final commit message**

```bash
git log --oneline -10
```

Verify all commits are clean and on main.

---

## Post-implementation

After deploying to production:
1. Update Cloudflare Redirect Rules:
   - cpfretirementplanner.com -> `https://sgfireplanner.com/cpf-planner`
   - sgroboadvisor.com -> `https://sgfireplanner.com/compare`
2. Validate structured data: paste URLs into https://search.google.com/test/rich-results
3. Submit both URLs in Google Search Console for indexing

## Agent Parallelism

Tasks 1-3 (`/cpf-planner` side) and Tasks 4-6 (`/compare` side) can run as two parallel agents. Task 1 (shared infrastructure) should run first or as part of Agent A. Task 7-8 (cross-linking + verification) runs after both agents complete.

Recommended split:
- **Agent A:** Tasks 1, 2, 3 (shared infra + CPF calculator + CPF page)
- **Agent B:** Tasks 4, 5, 6 (robo fees data + fee calculator + compare page)
- **Main thread:** Task 7, 8 after both agents merge
