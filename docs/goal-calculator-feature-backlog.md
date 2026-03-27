# Goal Calculator Feature Backlog

**Date:** 2026-03-27
**Sources:** Internal brainstorm, Gemini, Codex
**Context:** Brainstorming session for goal calculator improvements. Features tagged by where they belong.

## Guiding Principle

The goal calculator is a **fun front door** to the full planner, not a separate product. Its job is to get users excited in under 60 seconds, be slightly inaccurate in their favor, and create urgency to continue to the full planner.

**Decision framework:** Does this feature fix a HARMFUL inaccuracy, drive virality, or just add complexity? If it adds complexity, it belongs in the full planner.

---

## Goal Calculator Features (keep it simple)

These features belong in the goal calculator because they reduce friction, drive sharing, or fix harmful UX issues without adding input complexity.

| # | Feature | Source | Priority | Notes |
|---|---------|--------|----------|-------|
| 1 | **Result-first flow** (show result before asking basics, use SG median defaults) | Internal | P0 | Biggest UX win. 2 clicks to a result, zero typing. |
| 2 | **Smart disclaimers** ("Excludes CPF OA, which could reduce your cash outlay. See full planner for details.") | Internal | P0 | Fixes harmful inaccuracy without adding inputs. Drives transfer to planner. |
| 3 | **Shareability** (copy results as image, shareable URL with encoded params) | Internal | P1 | Zero complexity, pure growth. Screenshot-worthy results. |
| 4 | **Lifestyle translation** ("$354/mo = $12/day = 2 fewer Grab rides/week") | Internal | P1 | One line of copy, massive impact for Gen Z audience. |
| 5 | **Peer benchmarking** ("Your savings rate is higher than 72% of Singaporeans your age") | Internal | P1 | One line, social proof. Source: DOS/MAS household surveys. |
| 6 | **Financial Freedom Age as a single number** ("Your Freedom Age: 47") | Gemini | P1 | More viral than "retirement impact +5 years." Screenshot-worthy. |
| 7 | **Wealth curve visualization** (net worth over time with goal icons, toggleable) | Internal | P2 (V2) | Modular component reusable in full planner. The "visual aha" moment. |
| 8 | **What-if sliders on results** (drag to adjust income/timeline/budget, instant recalc) | Internal | P2 (V2) | Engagement driver. Pairs with wealth curve. |
| 9 | **One-question basics** (only ask take-home pay, estimate expenses as 60% of income) | Internal | P2 | Most aggressive simplification. Age defaults to 25, savings to $0. |
| 10 | **Payday autopilot framing** ("When salary lands, move $650 to your goal first") | Codex | P3 | Behavioral nudge. Turns result into action. |

---

## Full Planner Features (complexity belongs here)

These features are valuable but add input complexity, calculation depth, or require data the goal calculator shouldn't ask for. They strengthen the "continue to planner" value proposition.

### Accuracy Improvements (make the planner trustworthy)

| # | Feature | Source | Notes |
|---|---------|--------|-------|
| 11 | **CPF OA for property** (down payment + monthly mortgage from CPF) | Internal | Biggest calculation gap. Planner already has CPF infrastructure. |
| 12 | **SG housing grants** (EHG $80K, Family Grant $50K, PHG $30K) | Internal | First-time buyer grants reduce effective cost by $50-130K. |
| 13 | **Couple/household mode** (2x income, 2x CPF for joint purchases) | Internal | Planner already supports household. Goal calc stays single-person. |
| 14 | **Income growth projection** (3-4% annual salary growth) | Internal | Removes systematic pessimism for 10-year goals. |
| 15 | **CPF LIFE offset** (reduces FIRE number by $800-2000/mo from age 65) | Internal | Retirement could be 5-8 years closer than goal calc shows. |
| 16 | **Goal dependencies** (HDB sale proceeds fund condo upgrade) | Internal | Most common SG property journey. V3 territory. |
| 17 | **Emergency fund floor** (3-6 months expenses before goal savings) | Internal | Responsible advice. Planner can model this properly. |
| 18 | **Recurring goals** (car COE 10-year cycle, annual travel) | Internal | Changes math fundamentally. Needs richer goal model. |
| 19 | **Property loan gatekeeper** (MSR/TDSR/LTV qualification check) | Codex | "Will I qualify for the loan?" is the real blocker, not the down payment. |
| 20 | **Student loan repayment lane** (TFL, CPF Education Loan as constraint) | Gemini + Codex | Common for local grads (~$20-30K debt). Affects goal feasibility. |
| 21 | **HDB income ceiling cliff warning** (promotion could disqualify from BTO) | Gemini | Strategic advice: "Ballot NOW before your raise pushes you over $14K." |
| 22 | **Income tax arrears warning** (Year 2 tax surprise, reserve for IRAS) | Gemini | Protective advice for first-time taxpayers. |
| 23 | **Offer-to-wallet decoder** (gross salary to actual take-home after CPF/tax) | Codex | Fresh grads anchor on headline salary. |
| 24 | **BTO timeline reality** (apply at 27 → ballot → wait 4 years → keys at 32) | Internal | Real timeline is longer than users assume. |

### Engagement and Growth Features

| # | Feature | Source | Notes |
|---|---------|--------|-------|
| 25 | **NS disruption for males** (2-year earning delay, adjusted timeline) | Internal | Makes male users feel seen. Affects timeline calculations. |
| 26 | **Parental allowance buffer** (filial piety 5-10% of income as fixed cost) | Gemini | Uniquely SG/Asian. Non-negotiable "hidden tax." |
| 27 | **Insurance agent shield** (ILP $300/mo vs term $50 + index $250/mo comparison) | Gemini | Trust-building. Fresh grads are targeted heavily. |
| 28 | **Goal-fund parking optimizer** (HYSA vs SSB vs fixed deposit by timeline) | Codex | Don't just say "save $X", say WHERE. |
| 29 | **HYSA stacking optimizer** (UOB One vs OCBC 360 vs Trust vs MariBank) | Gemini | SG grads love optimizing bank accounts. |
| 30 | **Rent vs buy comparison** (total cost over 10 years, equity building) | Internal | The #1 debate for fresh grads. |
| 31 | **BTO vs resale time-is-money toggle** (cost vs wait vs appreciation) | Gemini | BTO cheaper but 4-5 year wait, resale immediate but pricier. |
| 32 | **Degree/job-specific income pathing** (MOM occupational wage data) | Codex | Engineer vs teacher vs architect = very different trajectories. |
| 33 | **Side hustle income as retirement accelerator** ("$200/mo dividends = retire 2 years earlier") | Gemini | Gamifies saving. Highly shareable metric. |
| 34 | **Opportunity cost of splurges** ("$1,500 iPhone at 24 = $50K less at 65") | Gemini | Behavioral nudge. Doom-scrolling psychology. |
| 35 | **Credit health / debt trap warnings** (revolving credit, BNPL stacking) | Codex | Detect risky patterns before they derail goals. |
| 36 | **Streak design / milestone unlocks** (progress tracking, recovery prompts) | Codex | Turns one-time tool into something people revisit. |

### Data Sources Referenced

| Source | What it provides | Used by |
|--------|-----------------|---------|
| cpf.gov.sg | Contribution rates (OA/SA/MA splits by age), CPF LIFE estimates | #11, #15, #23 |
| IRAS | Tax brackets, BSD rates | #12, #22, #23 |
| HDB.gov.sg | BTO prices, resale price index, income ceilings, grant amounts | #12, #21, #24, #31 |
| Data.gov.sg | HDB resale transactions, COE bidding results | #7, #24 |
| MOM (stats.mom.gov.sg) | Occupational wage data, graduate employment survey | #5, #32 |
| DOS (singstat.gov.sg) | Household expenditure survey, savings rates by age | #5, #15 |
| MAS | TDSR/MSR rules, property cooling measures | #19 |
| SGFinDex | CPF balances, bank balances, loans, insurance (API) | Future integration |

---

## Versioned Roadmap (Draft)

| Version | Theme | Features | Goal |
|---------|-------|----------|------|
| V1 | Done | Goal tiles, smart config, basics form, results, transfer to planner | Ship it |
| V1.5 | Simplify + Share | Result-first flow, smart disclaimers, shareability, lifestyle translation, peer benchmarking, Freedom Age | Reduce friction, drive virality |
| V2 | Visualize | Wealth curve with goal icons, what-if sliders, modular chart component | Visual "aha", reusable in planner |
| V3 | Life paths (maybe) | Path generator OR toggle-based exploration on wealth curve | May not be needed if V2 toggles work well |
| Full planner | Everything else | CPF, grants, couple mode, income growth, loan gatekeeper, all the smart SG-specific features | The "real" product |
