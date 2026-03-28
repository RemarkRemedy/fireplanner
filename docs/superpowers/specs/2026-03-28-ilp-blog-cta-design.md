# ILP Blog Post + Fee Dashboard CTAs

## Summary

Create an educational blog post ("Questions to Ask Before You Buy an ILP") with 3 interactive React components, add 4 CTAs in the ILP fee dashboard linking to the post, add a backlink from the blog to the fee calculator, and restructure the `/ilp` URL namespace.

**Target audience:** Fresh graduates about to start working, likely being approached by FAs pitching ILPs.

**Editorial stance:** Skeptical but fair. Default position is "BTIR + DIY investing is more cost-effective for most people," but honestly acknowledges when ILPs can make sense. Stays below the FAA financial advisory threshold by using educational framing ("consider whether...", "many planners suggest...") and citing MoneySense as the authoritative source.

## Blog Post

### Location

`blog/src/content/blog/ilp-questions.mdx`

### Frontmatter

```yaml
title: "Questions to Ask Before You Buy an ILP"
description: "7 questions to ask your financial adviser about ILP fees, with plain-English explanations. Plus an interactive quiz to help you decide."
pubDate: 2026-03-28
category: insurance
tags: [ilp, insurance, fees, financial-adviser]
intent: how_to
keyword: "ilp questions to ask singapore"
readingTime: "10 min"
```

### Outline

**1. Opening hook**
"Your financial adviser just pitched you an ILP. Before you sign, here's what to ask." Establishes the audience (fresh grad, first job, first FA meeting) and the tone (we're here to help you ask better questions, not tell you what to do).

**2. What is an ILP, actually?**
Plain-English explanation. Insurance + investment bundled. Premiums split between insurance coverage and investment sub-funds. Not inherently bad, but the structure has cost implications most buyers don't understand upfront.

Contains: **PA Rate Visualizer** (Interactive Component A).

**3. 7 Questions to Ask Your FA**
The core of the post. Each question includes: the question itself, what the common answer sounds like, what it actually means, and what to look out for.

Questions (refined with MoneySense source material):

1. **"What is the Premium Allocation Rate, and when does it reach 100%?"** — Most shocking for fresh grads. At 20% PA, only $200 of a $1,000 premium buys units. The rest is distribution cost. MoneySense highlights this explicitly.

2. **"What are the total fees I'll pay over the full policy term?"** — Distribution costs, fund management fees, insurance charges, bid-offer spread, surrender penalties. Ask for a breakdown, not just the projected return.

3. **"What funds am I invested in, and what are their expense ratios?"** — Compare sub-fund OCFs to equivalent market ETFs (e.g., a global equity sub-fund at 1.5% vs VWRA at 0.22%).

4. **"What happens if I can't keep up with premium payments?"** — Very relevant for fresh grads with unstable early-career income. Understand premium holidays, reduced paid-up, lapse conditions.

5. **"What happens if I want to stop early? What's the surrender value?"** — Surrender charges in early years can mean getting back significantly less than you paid in.

6. **"Can I get the same insurance coverage with term life for less?"** — The BTIR question. Ask the FA to quote term life separately and compare.

7. **"What commission do you earn from this sale?"** — Transparency question. FA is not obligated to answer, but their reaction is informative. MoneySense's "financial advisory process" page establishes that consumers should understand how their FA is compensated.

**4. When an ILP might actually make sense**
Objective counterweight. Legitimate scenarios:
- You genuinely lack the discipline to invest on your own and need forced savings (be honest with yourself)
- You want insurance + investment in one product for simplicity and accept the cost premium for convenience
- Your FA offers a low-cost ILP with competitive sub-funds (they exist, but they're rare)
- You value the ongoing advisory relationship and portfolio management

**5. When it probably doesn't make sense**
- You're comfortable buying term life and investing via a brokerage (or even a robo-advisor)
- The fee drag over 20-30 years significantly erodes your returns
- You're being pressured to decide quickly (legitimate products survive a week of thinking)

Contains: **Fee Comparison Slider** (Interactive Component B) with CTA to full fee calculator.

**6. A framework to decide**
Not a binary yes/no. A spectrum based on self-knowledge.

Contains: **"Is an ILP right for you?" Quiz** (Interactive Component C). Shareable result card.

**7. Sources**
Citations to MoneySense pages:
- "What To Ask When Buying An Investment Product" (moneysense.gov.sg)
- "What To Ask Before Buying Life Insurance" (moneysense.gov.sg)
- "Investment Linked Policies: Guide To Fees And Pricing" (moneysense.gov.sg)

**8. CTA back to fee calculator**
"Want to see the actual fees on a specific ILP? Try the fee calculator." Uses existing `CTA.astro` component pointed at `/ilp-fees`.

### Regulatory Compliance

- MAS disclaimer rendered automatically via `Disclaimer.astro` (top + bottom of post)
- No personalized recommendations ("you should buy/not buy")
- Educational framing throughout: "consider whether...", "many financial planners suggest..."
- MoneySense cited as authoritative source for questions
- Decision framework is self-assessment, not advice

## Interactive Components

Three self-contained React components, embedded as Astro islands in the MDX blog post. No shared state, no connection to fireplanner stores. Pure props-in, UI-out.

### Component A: PA Rate Visualizer

**Location:** `blog/src/components/interactive/PaRateVisualizer.tsx`

**Astro island directive:** `client:visible` (hydrates when scrolled into view)

**Inputs:**
- Slider: Premium Allocation Rate (20% to 100%, default 30%)
- Number input: Monthly premium (default $200)

**Output:**
- Animated horizontal bar split into two segments: "Goes to your investment" vs "Deducted as charges"
- Dollar amounts shown on each segment
- Text below: "In Year 1, only $X of your $Y premium is invested"

**Design:** Minimal. Matches blog typography. No chart library needed, pure CSS + React state.

### Component B: Fee Comparison Slider

**Location:** `blog/src/components/interactive/FeeComparisonSlider.tsx`

**Astro island directive:** `client:visible`

**Inputs:**
- Monthly premium: number input (default $200)
- Policy term: dropdown (15, 20, 25, 30 years)

**Output:**
- Two bars or a simple line chart:
  - ILP path: total fees paid over term (simplified model using average fee percentages)
  - BTIR + ETF path: term life premium + ETF expense ratio over same term
- Difference highlighted: "You'd keep $X more with BTIR + ETF"

**Assumptions (hardcoded, disclosed):**
- ILP average annual fee: ~3% of fund value (insurance charges + fund management + distribution amortized)
- Term life: $30/month for $200K coverage (typical fresh grad quote)
- ETF expense ratio: 0.22% (VWRA)
- Expected return: 6% nominal for both paths (same investment performance)

Assumptions displayed as a collapsible "How we calculated this" section below the component.

**Footer CTA:** "Want the full breakdown with your actual ILP? Try the fee calculator" → `/ilp-fees`

### Component C: ILP Suitability Quiz

**Location:** `blog/src/components/interactive/IlpQuiz.tsx`

**Astro island directive:** `client:visible`

**Questions (6):**
1. "Would you invest regularly on your own without a policy forcing you to?" (Yes/No)
2. "Are you comfortable opening a brokerage account and buying ETFs?" (Yes/No)
3. "Do you already have term life or other insurance coverage?" (Yes/No)
4. "Would you keep up with managing insurance and investments separately?" (Yes/No)
5. "Has your FA shown you the total fees over the full policy term?" (Yes/No)
6. "Do you have an emergency fund of 3-6 months' expenses?" (Yes/No)

**Scoring:**
- Each "Yes" to Q1-4 and Q6 adds 1 point toward "BTIR + DIY likely better"
- Q5 "No" adds 1 point toward "BTIR + DIY likely better" (FA hasn't been transparent)
- Q5 "Yes" is neutral

**Results (spectrum, not binary):**
- 5-6 points: "Based on your answers, a BTIR + DIY approach is likely more cost-effective. You have the discipline and knowledge to manage insurance and investments separately."
- 3-4 points: "It's a close call. Consider comparing the specific ILP fees against a DIY approach before deciding."
- 0-2 points: "An ILP's structure may genuinely help you stay disciplined. But still ask your FA the 7 questions above to make sure you're getting a fair deal."

**Shareable result card:**
- Generates a styled card (similar aesthetic to the ILP receipt) with the result text
- "Share your result" button → copies image or opens share sheet
- Card includes `sgfireplanner.com/ilp` branding

**Disclaimer under results:** "This quiz is for educational purposes. It does not constitute financial advice. Consider consulting a fee-only financial adviser for personalised guidance."

## Fee Dashboard CTAs

Four CTAs in the ILP fee dashboard (`fireplanner-ilp-fee-dashboard` repo). All link to the blog post at `/blog/ilp-questions` (reached via `sgfireplanner.com/ilp` redirect).

### CTA 1: After Fee Summary Totals

**Location:** `IlpReviewPage.tsx`, below the fee summary numbers

**Style:** Subtle inline link with dotted underline. Does not compete with the fee total.

**Copy:** "Are these fees worth it? A framework to decide →"

**Link:** `/blog/ilp-questions`

### CTA 2: Below Fee Breakdown Charts

**Location:** `FeeBreakdownSection.tsx`, after the annual stacked bar chart and cumulative fees line chart

**Style:** Blue callout card with speech bubble icon. Most prominent CTA — the user is in analysis mode here.

**Copy:**
- Heading: "Questions to ask your financial adviser about these fees"
- Subtext: "7 questions from MoneySense and industry experts, with plain-English explanations of common answers."
- Link text: "Read the questions →"

**Link:** `/blog/ilp-questions#questions` (anchor to the questions section)

### CTA 3: Receipt Footer

**Location:** `ReceiptCanvas.tsx`, bottom of receipt on both 9:16 (story) and 1:1 (square) formats

**Style:** Subtle branded footer strip. Light blue URL, grey handle.

**Content:**
- Line 1: `sgfireplanner.com/ilp` (primary, more prominent)
- Line 2: `@sgfireplanner` (secondary, smaller, greyed out until account exists)

**Note:** The `@sgfireplanner` Instagram handle is a dependency. Render the handle placeholder in code but only display it once the account is live. Use a config flag or environment variable so it can be toggled without a code change.

### CTA 4: Page Footer — "Still not sure?"

**Location:** `IlpReviewPage.tsx`, bottom of the page after all other content

**Style:** Warm yellow callout card. Softer, reassuring tone. Centered text with button-style link.

**Copy:**
- Heading: "ILPs aren't always a bad deal"
- Subtext: "The numbers above show the cost. But cost isn't the only factor. Discipline, convenience, and your personal situation all matter."
- Button: "Read: When an ILP actually makes sense →"

**Link:** `/blog/ilp-questions#when-ilp-makes-sense` (anchor to section 4)

## URL Restructure

### Route change

Move the ILP fee calculator from `/ilp` to `/ilp-fees`:
- Update the route definition in `fireplanner-ilp-fee-dashboard`'s router
- Update any internal links that reference `/ilp`

### Redirects

Add to `frontend/public/_redirects` (Cloudflare Pages):

```
/ilp  /blog/ilp-questions  301
```

This makes `sgfireplanner.com/ilp` → `sgfireplanner.com/blog/ilp-questions`.

No redirect needed for the old `/ilp` → `/ilp-fees` because `/ilp` is being repurposed as the blog redirect. Users who bookmarked `/ilp` for the calculator will land on the blog post, which has a prominent CTA back to the calculator at `/ilp-fees`.

### Blog CTA to Calculator

The blog post includes 2 links back to `/ilp-fees`:
1. Fee Comparison Slider component footer: "Want the full breakdown? Try the fee calculator"
2. End-of-post CTA via `CTA.astro`: "See the actual fees on a specific ILP"

## Dependencies

| Dependency | Status | Blocker? |
|-----------|--------|----------|
| `insurance` category in blog content schema | Exists, unused | No |
| `CTA.astro` component | Exists | No |
| `Disclaimer.astro` component | Exists, auto-renders | No |
| `@sgfireplanner` Instagram account | Does not exist | No — show URL only, toggle handle via config |
| Astro React integration | Needs `@astrojs/react` added to blog `astro.config.mjs` and `react`/`react-dom` as blog dependencies | No — standard Astro integration |
| MoneySense content verification | Fetched and verified | No |

## Out of Scope

- Writing the actual blog post prose (content writing is a separate task after the implementation plan)
- Instagram account creation and content strategy
- SEO optimization beyond the frontmatter keyword
- Analytics event tracking for CTA clicks (can be added later via Umami custom events)
- Mobile-responsive testing of interactive components (handled during implementation)
