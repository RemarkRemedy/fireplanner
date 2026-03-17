# SEO Landing Pages Design: /cpf-planner and /compare

**Date:** 2026-03-17
**Status:** Draft

## Overview

Two new SEO landing pages to capture search traffic from redirect domains and provide standalone value with email capture.

## Page 1: `/cpf-planner`

**Search intent:** "CPF retirement planning", "CPF calculator Singapore", "CPF LIFE payout calculator"
**Redirect domain:** cpfretirementplanner.com (101 visitors)
**Goal:** Standalone value (B) with email capture (C). Not competing with geek.sg on month-by-month CPF granularity. Instead: "CPF is step 1, here's step 2-10."

### Page structure

**1. Hero section**
- Headline: "CPF Retirement Planner"
- Subtitle: explains what CPF does for retirement and why it's not the full picture
- CTA button to main app

**2. Interactive mini-calculator**
- Inputs (local state, no store dependency):
  - Age (number input, default 30, valid range 25-54)
  - Monthly salary (currency input, default $6,000)
  - Monthly expenses (currency input, default $3,000, used for gap calculation)
  - CPF LIFE plan (radio: Basic/Standard/Escalating, default Standard)
  - Residency (radio: Citizen/PR, default Citizen. Required because CPF contribution rates differ.)
- **Input validation:** All inputs must be validated before calculation runs. Show inline errors for out-of-range values. Do not run calculations on invalid inputs (per CLAUDE.md validation-before-calculation rule).
- Outputs (recalculated when all inputs are valid):
  - Projected OA/SA/MA balances at age 55
  - BRS/FRS/ERS comparison (which tier you'll hit)
  - Estimated CPF LIFE monthly payout at 65
  - The gap: "CPF LIFE gives you $X/month. If your expenses are $Y/month, your portfolio needs to cover the difference for N years."
  - **Disclaimer:** "This is a rough estimate based on heuristic assumptions. For a precise projection, enter your actual CPF balances in the full planner."
- **Important:** Monthly salary input must be multiplied by 12 before passing to CPF functions (they all take annual salary).
- **Calculation flow (actual function signatures):**
  1. `const balances = estimateCpfBalances(currentAge, monthlySalary * 12, residencyStatus)` -> returns `CpfBalanceEstimate { oa, sa, ma, ra, total }`. Destructure `.oa`, `.sa`, `.ma` for step 2. This is a heuristic estimate (setup wizard level), not a precise projection.
  2. `const projections = projectCpfBalances(currentAge, 55, balances.oa, balances.sa, balances.ma, monthlySalary * 12, 0.03, residencyStatus)` -> returns `CpfProjection[]`. Extract final row: `const lastRow = projections[projections.length - 1]`. Get `lastRow.oaBalance`, `lastRow.saBalance`, `lastRow.maBalance`.
  3. **Age-55 transfer:** `const { newRA } = performAge55Transfer(lastRow.oaBalance, lastRow.saBalance, frs)` where `frs` is from step 4. SA is capped at FRS and transferred to RA. Excess returns to OA. The `newRA` value is what feeds CPF LIFE.
  4. `const { brs, frs, ers } = calculateBrsFrsErs(currentAge)` -> **takes current age, not 55.** The function internally calculates years-until-55 and applies 3.5% growth.
  5. CPF LIFE payout: `estimateCpfLifePayout(newRA, plan)` returns the **annual** payout. Divide by 12 for monthly display. **Note:** this is a simplified estimate that applies the payout rate directly to the age-55 RA balance. The real engine grows RA from 55 to 65 before applying rates, so this understates payouts by roughly 40-55%. For the landing page, this approximation is acceptable with the disclaimer. The function's payout rates (5.4% Basic, 6.3% Standard, 4.8% Escalating) are calibrated to the balance at 55.
  6. Gap calculation: all values in **today's dollars** (real terms). Monthly expenses stay as entered (no inflation). CPF LIFE monthly = step 5 / 12. Gap = expenses - cpfLifeMonthly. Years = 90 - 65 = 25. This avoids the mixed-dollar-basis violation (CLAUDE.md).
- Self-contained component, no Zustand store reads
- Use `formatCurrency(value, 0)` for all displays (whole dollars for clarity)

**3. Content section (~800-1000 words)**
- What BRS/FRS/ERS means and which one to target
- When CPF LIFE kicks in and how payouts work
- Why OA/SA split matters (interest rate differential)
- SA voluntary top-up as a tax strategy (link to SRS too)
- Housing withdrawal impact on retirement adequacy
- Each subsection is an H2 for SEO crawlability

**4. FAQ schema (4 questions)**
- "How much CPF do I need to retire in Singapore?"
- "What is the difference between BRS, FRS, and ERS?"
- "How much will I get from CPF LIFE per month?"
- "Is CPF enough for retirement in Singapore?"

**5. Email capture**
- "Get notified when we add CPF optimization features"
- Reuses existing email signup pattern (POST /api/email-signup with source='cpf_planner', feature_interest='cpf_optimization')

**6. Structured data**
- FAQPage schema (4 questions above)
- WebApplication schema (CPF retirement planner tool)
- BreadcrumbList (via usePageMeta)

### What we reuse
- `estimateCpfBalances(currentAge, grossAnnualIncome, residencyStatus, prMonths?, oaMortgageUsed?)` from `lib/calculations/cpf.ts` (heuristic estimate of current balances)
- `projectCpfBalances(startAge, endAge, initialOA, initialSA, initialMA, annualSalary, salaryGrowth, residencyStatus?, prMonths?)` from `lib/calculations/cpf.ts` (year-by-year forward projection)
- `calculateBrsFrsErs(currentAge, currentYear?)` from `lib/calculations/cpf.ts` (takes current age, not target age)
- `performAge55Transfer(oaBalance, saBalance, retirementSumTarget)` from `lib/calculations/cpf.ts` (SA->RA transfer at 55, returns `{ newOA, newRA }`)
- `estimateCpfLifePayout(retirementSumAt55, plan)` from `lib/calculations/cpf.ts` (returns annual payout, divide by 12)
- CPF rate constants from `lib/data/cpfRates.ts`
- `CurrencyInput` / `NumberInput` from `components/shared/`
- Email signup: requires changes to `emailConstants.ts` (new source/feature values), `LandingEmailSection.tsx` (parameterize source), and `useEmailSignup.ts` (add optional `defaultFeatureInterest` param that auto-fires the feature-select step after email submission, skipping the dropdown). The current flow uses `EMAIL_WORKER_URL` + double opt-in + a separate feature-select POST. Server-side validation in `functions/api/email-signup.ts` also needs the new values.
- `usePageMeta` hook for meta tags + breadcrumb

### Required updates to existing files
- `src/lib/validation/emailConstants.ts`: add `'cpf_planner'` and `'compare_page'` to `VALID_SOURCES`, add `'portfolio_integration'` to `VALID_FEATURES`
- `src/hooks/usePageMeta.ts`: add `'/cpf-planner': 'CPF Planner'` and `'/compare': 'Compare'` to `PAGE_NAMES`
- `src/components/email/LandingEmailSection.tsx`: accept `source` and `featureInterest` as props instead of hardcoding `'landing_page'`
- `router.tsx`: add routes for both pages
- `public/sitemap.xml`: add both routes
- `scripts/prerender.mjs`: add prerender entries for both routes

### What we create
- `src/pages/CpfPlannerPage.tsx` - route component
- `src/components/cpf/CpfMiniCalculator.tsx` - self-contained interactive calculator
- Route entry in `router.tsx`
- Sitemap entry in `public/sitemap.xml`
- Prerender entry in `scripts/prerender.mjs`

---

## Page 2: `/compare`

**Search intent:** "Singapore robo advisor comparison", "Endowus vs DIY", "do I need a financial planner Singapore"
**Redirect domain:** sgroboadvisor.com (127 visitors)
**Goal:** Standalone value (B) with email capture (C). Positioned as complementary to robo-advisors, not adversarial.
**Tone:** "Robo-advisors are great for investing. A planner helps you decide if it's enough. Use both."

### Page structure

**1. Hero section**
- Headline: "Robo-advisors manage your money. A planner helps you decide if it's enough."
- Subtitle: "They solve different problems. Here's how they work together."

**2. Philosophy section (~400 words)**
- What robos do well: automated rebalancing, low barrier to entry, disciplined investing, SRS/CPF-IS access
- What they don't do: tell you when you can retire, model CPF LIFE + portfolio together, stress-test against crashes, compare withdrawal strategies, project year-by-year cash flow
- Framing: different tools for different jobs, not better/worse

**3. Cost comparison (interactive)**
- Input: portfolio size slider ($50K - $2M)
- Output: 30-year fee drag for each platform, calculated as lost portfolio growth

Verified fee data (March 2026):

| Platform | Fee structure | Source |
|----------|-------------|--------|
| Endowus | 0.40% (SRS/CPF) or 0.25-0.60% (Cash, tiered by AUM) + ~0.20-0.40% fund TER. Fund Smart single fund: 0.30%. 100% trailer fee cashback. | endowus.com/pricing |
| StashAway | 0.20-0.80% (tiered by total invested) + ~0.15-0.25% ETF TER. $1 USD per invest/withdraw action. | stashaway.sg/pricing |
| Syfe | 0.25-0.65% (5 tiers: Blue 0.65%, Black 0.55% at $50K+, Gold 0.45% at $250K+, Platinum 0.35% at $1M+, Diamond 0.25% at $5M+). UCITS ETFs: $0 per trade. | syfe.com/pricing |
| DIY (IBKR) | $0 platform fee. ETF TER only: 0.03-0.22%. Cannot use for SRS. | N/A |
| DBS digiPortfolio | 0.25% (Saveup Portfolio) or 0.75% (all other portfolios). No sales charges, platform fees, switching/withdrawal/closure fees. **No SRS or CPF-IS support.** No minimum investment. | dbs.com.sg/personal/investments/other-investments/dbs-digiportfolio |
| SGFirePlanner | $0 (planning tool, not investment platform) | N/A |

Fee drag formula: `portfolioSize * ((1 + returnRate) ^ years - (1 + returnRate - feeRate) ^ years)`
where returnRate = 0.07 (7% nominal), years = 30.

**Output labeling:** Display the result as "Lost portfolio growth over 30 years (opportunity cost)" not just "fee drag". Include a one-line explainer: "This is the difference in portfolio value between paying this fee and paying nothing, assuming 7% annual returns." Without this framing, the large numbers (often exceeding the initial portfolio) will seem unbelievable and erode trust.

Tier selection: the calculator auto-selects the correct fee tier based on the slider value for each platform.

**Data location:** Fee structures go in `lib/data/roboFees.ts` (not hardcoded in the component). Per CLAUDE.md: Singapore-specific financial data belongs in `lib/data/`.

**Tier simplification:** The fee drag formula uses a constant fee rate over 30 years. In reality, as portfolios grow, users move to lower fee tiers. Display a note: "This assumes a constant fee tier. Actual costs may be lower as your portfolio grows into cheaper tiers."

**Disclaimer:** Display: "Fee structures change. Verify current rates on each platform's pricing page." with links. Last verified: March 2026.

**Slider range:** $50K-$2M. Syfe's Diamond tier ($5M+) is excluded since most visitors are not $5M+ investors.

**4. What SGFirePlanner uniquely does (feature cards)**
- CPF + portfolio integrated year-by-year projection
- 12 withdrawal strategies compared side by side
- Monte Carlo stress testing (10,000 scenarios)
- Household/joint planning
- 100% private: no data leaves your browser, no account needed

**5. FAQ schema (3 questions)**
- "Do I need a robo-advisor and a retirement planner?"
- "How much do robo-advisors cost in Singapore?"
- "Can I use SGFirePlanner with my Endowus or StashAway portfolio?"

**6. Email capture**
- "Get notified when we add portfolio integration features"
- source='compare_page', feature_interest='portfolio_integration'

**7. Structured data**
- FAQPage schema
- WebApplication schema
- BreadcrumbList

### What we reuse
- UI components (Card, Button, etc.)
- Email signup endpoint
- `usePageMeta` hook
- `formatCurrency` from `lib/utils`

### What we create
- `src/pages/ComparePage.tsx` - route component
- `src/components/compare/FeeComparisonCalculator.tsx` - interactive fee drag calculator
- `src/lib/data/roboFees.ts` - fee tier data for ALL platforms in the comparison (Endowus, StashAway, Syfe, DBS digiPortfolio, DIY). Per CLAUDE.md: all Singapore-specific financial data in `lib/data/`, not inline in components. Include `lastVerified: '2026-03-17'` and source URLs per platform. Type interface:
  ```typescript
  interface FeeTier { minAmount: number; rate: number }
  interface PlatformFees {
    id: string
    name: string
    tiers: FeeTier[]       // sorted ascending by minAmount
    estimatedTer: number   // average fund-level TER (0 for DIY ETFs)
    supportsSrs: boolean
    supportsCpfIs: boolean
    sourceUrl: string
    notes?: string
  }
  export const ROBO_FEES: PlatformFees[]
  export const ROBO_FEES_LAST_VERIFIED = '2026-03-17'
  ```
- Route entry in `router.tsx`
- Sitemap entry
- Prerender entry

---

## Shared patterns for both pages

### Architecture
- Both are route components in `pages/`, following existing SEO page pattern (RetirementPlannerPage, RetirementCalculatorPage)
- Interactive components are self-contained with local state (no Zustand stores)
- Schema injected via useEffect, cleaned up on unmount (same pattern as existing pages)
- Both use `usePageMeta` for title, description, canonical, OG tags, breadcrumb

### Prerender
Both need entries in `scripts/prerender.mjs` for:
- Route-specific `<title>` and meta description
- Static body HTML with H1, feature list, and internal links (for crawlers that don't execute JS)
- `/cpf-planner` prerender body should include current BRS/FRS/ERS values as static text (e.g. "2026 BRS: $110,200 / FRS: $220,400 / ERS: $440,800") since these are high-value SEO keywords that users searching "CPF retirement sum" want to find without JS execution

### Sitemap
Add both routes to `public/sitemap.xml` with appropriate `<lastmod>`, `<changefreq>monthly`, and `<priority>0.8`.

### Domain redirects
After deploying, update the Cloudflare Redirect Rules:
- cpfretirementplanner.com -> `https://sgfireplanner.com/cpf-planner`
- sgroboadvisor.com -> `https://sgfireplanner.com/compare`

### Cross-linking
Both new pages should include a "Related tools" section linking to:
- Each other (`/cpf-planner` <-> `/compare`)
- `/retirement-planner`
- `/retirement-calculator`
- The main app (`/`)

Update `RetirementPlannerPage` and `RetirementCalculatorPage` to add links to the new pages in their existing "Related tools" sections.

### No em dashes
Per project conventions, all user-facing copy uses commas, periods, and colons instead of em dashes.
