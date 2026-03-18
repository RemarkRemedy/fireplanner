# Singapore Actuarial Data for Life Event Stress Testing

Research conducted 2026-02-27. All sources are official Singapore government publications.

## 1. Death Rates (SingStat 2024)

Source: [Age-Specific Death Rates, Annual](https://data.gov.sg/datasets/d_0d64da52342e43d864bc84898ba6835f/view)
- Downloaded CSV from data.gov.sg API: `d_0d64da52342e43d864bc84898ba6835f`
- These are **annual** central death rates (mx) per 1,000 residents, NOT cumulative over the 5-year band
- Same rate applies each year within the band; switch to next band rate when aging into it
- To convert to annual probability: `q ≈ mx/1000` for small rates, or `q = 1 - exp(-mx/1000)` for precision

### 2024 Rates (per 1,000 residents)

| Age Group | Total | Male | Female |
|-----------|-------|------|--------|
| Under 1 | 2.3 | 1.8 | 2.8 |
| 1-4 | 0.1 | 0.1 | 0.1 |
| 5-9 | 0.1 | 0.1 | 0.1 |
| 10-14 | 0.1 | 0.1 | 0.1 |
| 15-19 | 0.2 | 0.2 | 0.3 |
| 20-24 | 0.3 | 0.4 | 0.2 |
| 25-29 | 0.3 | 0.4 | 0.2 |
| 30-34 | 0.4 | 0.5 | 0.2 |
| 35-39 | 0.5 | 0.7 | 0.4 |
| 40-44 | 0.8 | 1.0 | 0.6 |
| 45-49 | 1.3 | 1.7 | 1.0 |
| 50-54 | 2.2 | 2.8 | 1.6 |
| 55-59 | 3.5 | 4.5 | 2.4 |
| 60-64 | 5.7 | 7.5 | 3.9 |
| 65-69 | 9.5 | 12.6 | 6.6 |
| 70-74 | 14.9 | 19.3 | 10.9 |
| 75-79 | 25.0 | 32.3 | 18.8 |
| 80-84 | 48.7 | 62.1 | 38.9 |
| 85-89 | 85.5 | 103.5 | 74.3 |
| 90+ | 160.8 | 178.5 | 152.8 |

### Complete Life Tables (qx values)
SingStat publishes Complete Life Tables 2023-2024 with single-year-of-age qx values, but only as PDF:
- URL: `https://www.singstat.gov.sg/-/media/files/publications/population/lifetable23-24.ashx`
- Life expectancy at birth (2024): Male 81.2, Female 85.6, Overall 83.5

## 2. Retrenchment / Job Loss (MOM Q3 2025)

Source: [MOM Labour Market Report Q3 2025](https://stats.mom.gov.sg/iMAS_PdfLibrary/mrsd-Labour-Market-Report-3Q-2025.pdf), Table 3.5 (page A10)
- Downloaded full PDF (3.4MB, 55+ pages)
- **Rates are QUARTERLY** (per 1,000 resident employees per quarter)
- To annualize: multiply by ~4, or `annual = 1 - (1 - quarterly/1000)^4`
- The annual columns (2022-2024) in the table are already full-year totals

### By Age Group (per 1,000 resident employees)

| Age Group | 2022 | 2023 | 2024 | Q3'25 | Annual Prob (2024) |
|-----------|------|------|------|-------|-------------------|
| Below 30 | 2.5 | 5.3 | 3.9 | 0.8/q | 0.39% |
| 30-39 | 2.7 | 6.9 | 7.2 | 1.9/q | 0.72% |
| 40-49 | 3.5 | 9.3 | 8.1 | 2.6/q | 0.81% |
| 50-59 | 5.3 | 10.1 | 9.0 | 2.6/q | 0.90% |
| 60 & Over | 2.8 | 4.0 | 4.2 | 1.0/q | 0.42% |

### By Education (per 1,000, annual 2024)

| Education | Rate | Note |
|-----------|------|------|
| Below Secondary | 4.2 | Lowest |
| Secondary | 2.6 | |
| Post-Secondary | 1.9 | |
| Diploma & Prof | 4.5 | |
| Degree | 11.5 | Highest! Tech restructuring |

### By Occupation (per 1,000, annual 2024)

| Occupation | Rate |
|------------|------|
| PMETs | 8.6 |
| Clerical, Sales & Service | 3.1 |
| Prod & Transport | 3.0 |

### Key Patterns
- 2023 saw a massive spike (2-3x normal) due to tech layoffs; 2024 normalized
- Degree holders and PMETs have the HIGHEST rates (restructuring in Finance, IT, Prof Services)
- 60+ has the LOWEST rate (those still working are in stable roles)
- Retrenchment spikes are correlated with market downturns (joint probability matters for MC)
- Re-entry rate: 55.4% within 6 months, 74.2% within 12 months (Q3 2025)

## 3. Heart Attack / AMI (NRDO 2021)

Source: [Singapore Myocardial Infarction Registry Annual Report 2021](https://www.nrdo.gov.sg/docs/librariesprovider3/default-document-library/smir-annual-report-2021-(web)_final.pdf), Table 5.1.3
- Downloaded PDF (1.2MB, 59 pages)
- Crude Incidence Rate (CIR) per 100,000 population

### Age-Specific AMI Incidence (per 100,000, 2021)

| Age Group | CIR | Annual Probability |
|-----------|-----|-------------------|
| 15-29 | 1.7 | 0.002% |
| 30-39 | 32.2 | 0.032% |
| 40-49 | 126.0 | 0.126% |
| 50-59 | 340.3 | 0.340% |
| 60-69 | 616.6 | 0.617% |
| 70-79 | 1,038.9 | 1.039% |
| 80+ | 2,622.0 | 2.622% |

Overall CIR trend: 254.2 (2011) -> 363.8 (2021), significant upward trend (p<0.001)

## 4. Stroke (NRDO 2022)

Source: [Singapore Stroke Registry Annual Report 2022](https://www.nrdo.gov.sg/docs/librariesprovider3/default-document-library/ssr-annual-report-2022_web.pdf), Table 5.1.3
- Downloaded PDF (1.3MB, 55 pages)
- Crude Incidence Rate (CIR) per 100,000 population

### Age-Specific Stroke Incidence (per 100,000, 2022)

| Age Group | CIR | Annual Probability |
|-----------|-----|-------------------|
| 15-29 | 5.3 | 0.005% |
| 30-39 | 25.3 | 0.025% |
| 40-49 | 99.1 | 0.099% |
| 50-59 | 226.7 | 0.227% |
| 60-69 | 494.8 | 0.495% |
| 70-79 | 869.3 | 0.869% |
| 80+ | 1,734.6 | 1.735% |

Overall CIR: 277.9 per 100,000 (2022). Males: 332.3, Females: 226.7
Median age at onset increased from 67.6 (2012) to 70.2 (2022)

## 5. Cancer (NRDO Cancer Registry 2022)

Source: [Singapore Cancer Registry Annual Report 2022](https://www.nrdo.gov.sg/docs/librariesprovider3/default-document-library/scr-ar-2022_web-report6c6e8522-cf39-416f-9390-5fe903065927.pdf), Tables 1.3.1(a) and 1.3.1(b)
- Downloaded PDF (3.2MB)
- Age-specific incidence per 100,000, averaged over 2018-2022

### Age-Specific Cancer Incidence (per 100,000, 2018-2022)

| Age Group | Male | Female |
|-----------|------|--------|
| 0-29 | 24.1 | 30.2 |
| 30-39 | 65.8 | 138.3 |
| 40-49 | 157.2 | 363.4 |
| 50-59 | 409.3 | 585.3 |
| 60-69 | 1,063.8 | 867.5 |
| 70-79 | 2,091.5 | 1,281.1 |
| 80+ | 2,913.4 | 1,803.2 |

Lifetime risk: 1 in 4 males, 1 in 5 females
Top cancers: Colorectum (15.9%), Breast (14.1%), Lung (11.6%)
GLOBOCAN 2022 ASIR: Males 235.9, Females 231.0 per 100,000

## 6. Combined Critical Illness Proxy

Summing Cancer + AMI + Stroke gives ~90% of CI insurance claims:

| Age Group | Cancer* | AMI | Stroke | Total/100K | Annual Prob |
|-----------|---------|-----|--------|-----------|-------------|
| 15-29 | 27 | 2 | 5 | 34 | 0.03% |
| 30-39 | 102 | 32 | 25 | 159 | 0.16% |
| 40-49 | 260 | 126 | 99 | 485 | 0.49% |
| 50-59 | 497 | 340 | 227 | 1,064 | 1.06% |
| 60-69 | 966 | 617 | 495 | 2,078 | 2.08% |
| 70-79 | 1,686 | 1,039 | 869 | 3,594 | 3.59% |
| 80+ | 2,358 | 2,622 | 1,735 | 6,715 | 6.72% |

*Cancer combined = rough average of male/female rates

## 7. MC Integration Design Notes

### Recommended approach (from discussion):

**Tier 1: Stochastic Mortality (low effort, high value)**
- Add `mortalityTable` param to MonteCarloEngineParams
- Pre-roll `deathAge[s]` for each sim before main loop
- Sims past deathAge count as "succeeded" (didn't run out of money)
- Use SingStat death rates above

**Tier 2: Income Disruption Toggle (medium effort)**
- Optional `lifeEventConfig` param with toggles per event type
- During accumulation: random shocks to `annualSavings[t]`
- Retrenchment: 0.4-0.9% annual probability depending on age, ~6 month income gap
- Critical illness: 0.03-1.06% annual probability depending on age, longer income gap + medical costs
- Show distribution of "FIRE delay due to life events"

### Key design considerations:
1. Retrenchment correlates with market downturns (joint probability matters)
2. Not every CI event causes permanent disability; need "work impact" assumption
3. Should be opt-in (most users want optimistic base case)
4. Illness/disability rates are for incidence (first occurrence), not recurrence
5. Death rates are the most reliable; illness is proxy-quality; retrenchment is official but volatile

### Data quality assessment:
| Event | Quality | Source | Usability |
|-------|---------|--------|-----------|
| Death | Excellent | SingStat official | Direct use |
| Retrenchment | Good | MOM official | Direct use, but volatile year-to-year |
| AMI | Excellent | NRDO registry | Direct use |
| Stroke | Excellent | NRDO registry | Direct use |
| Cancer | Excellent | NRDO registry | Direct use |
| Disability | Good | Census 2020 + PMC survey + CareShield Life claims + insurer data | Triangulated; see docs/research/ |
| Hospital bills | Excellent | MOH DRG/TOSP 2023 transacted bills | Direct use |
| MediShield Life | Excellent | MOH benefits table (Oct 2025) | Direct use |
| Care costs | Good | Singlife LTC study, NTUC Health, MOH nursing home benchmarks | Multiple cross-validated |
| Life table (qx) | Excellent | SingStat Complete Life Tables 2023-2024 | Already in mortalityTable.ts |

## 8. Hospital Bill Sizes (MOH 2023 Transacted Bills)

Source: [MOH Hospital Bills & Fee Benchmarks](https://www.moh.gov.sg/managing-expenses/bills-and-fee-benchmarks/hospital-bills-and-fee-benchmarks/) (published Aug 2025)
Full XLSX: `https://go.gov.sg/2023hospitalbillsizes`
All figures are median, post-government-subsidy (B2/C ward), before insurance payout.

### Summary OOP Estimates After MediShield Life + MediSave (Subsidised Ward)

| Condition | Total Subsidised Bill (B2) | Estimated OOP (B2/C) | Private/A Ward OOP |
|-----------|---------------------------|---------------------|--------------------|
| AMI, medical only (F60B) | $1,948 | $200-$800 | $5K-$15K |
| AMI + PCI stenting (SD714H) | $7,842 | $500-$2,500 | $20K-$50K |
| AMI + CABG (SD742H) | $10,840 | $1K-$4K | $60K-$120K |
| Stroke moderate (B70B) | $2,795 | $300-$1,500 | $10K-$35K |
| Stroke catastrophic (B70A) | $4,409 | $500-$3K | $25K-$75K |
| Stroke rehab 3-4wk (Z60A) | $5,058 | $1K-$4K | $20K-$33K |
| Chemo per cycle (R63Z) | $485/visit | $0-$300 | $8K-$14K |
| Cancer drugs monthly | varies by drug tier | $100-$2K | $3K-$9.6K |

### MediShield Life Key Limits (Oct 2025)
- Normal ward: $830/day + $800 extra first 2 days
- ICU: $5,140/day
- Surgical Table 7 (CABG): $3,900
- Implants: $7,000/treatment
- Annual max: $200,000
- Cancer drugs: $200-$9,600/month by category tier
- Deductible (B2 and below): $3,500/year
- Co-insurance: 10% of first $5K above deductible

### Recommended Stress Test Financial Shocks

| Event | Conservative (subsidised) | Aggressive (private) |
|-------|--------------------------|---------------------|
| AMI + PCI | $5,000 lump | $50,000 lump |
| AMI + CABG | $8,000 lump | $120,000 lump |
| Stroke moderate + rehab | $3,000-$8,000 lump | $25,000-$75,000 lump |
| Cancer 1yr treatment | $5K-$15K | $50K-$150K |
| Cancer advanced 2+yr | $20K-$50K | $200K+ |

### Recovery Duration for Income Disruption
- AMI with PCI: 4-8 weeks
- CABG: 8-12 weeks
- Stroke moderate: 3-6 months to partial return
- Stroke severe: 12+ months or permanent
- Cancer active treatment: 6-18 months

### Ongoing Annual Medication Costs (subsidised)
- Post-AMI: $200-$600/yr
- Post-stroke anticoagulation: $200-$2,000/yr
- Cancer maintenance: $2K-$50K/yr (highly variable)

Full detail: agent research output (not saved to file; re-run MOH hospital bills agent if needed)

## 9. Disability Incidence (Triangulated from Multiple Sources)

Full detail: `docs/research/singapore-disability-incidence-research.md`

### Key Prevalence Data
- Census 2020 severe activity limitation: ages 45-64 ~2.9%, ages 65-74 5.1%
- PMC Survey 2021 (Washington Group): ages 50-64 3.8%, ages 65+ 8.4%
- MOH: "1 in 2 will develop severe disability at some point" (mostly post-65 onset)
- Median disability duration: ~4 years; 3 in 10 disabled for 10+ years

### CareShield Life Claims (MOH Parliamentary QA, Nov 2025)
- 2,179 active claimants as of Jun 2025
- 61% under age 60 (enrollment artifact: mandatory for post-1980 cohorts)
- Main causes: stroke, fracture accidents (sudden), chronic conditions + dementia (gradual)

### Insurance TPD Claims
- TPD = only 2.81% of all life insurance claims (~81/year at one insurer)
- Average TPD payout: $63,798; peak claim age: 56-60

### Return to Work After Critical Illness (international meta-analysis)
- 12 months: ~40% still unable to work
- 3-5 years: ~32% still unable to work

### Recommended MC Disability Incidence Rates

| Age Band | Annual Rate |
|----------|------------|
| 25-34 | 0.08-0.10% |
| 35-44 | 0.10-0.15% |
| 45-54 | 0.20-0.30% |
| 55-64 | 0.40-0.60% |
| 65+ | 1.50-3.00% |

Cumulative probability ages 30-65: ~4-7% (midpoint ~5.5%)
Stress test range: 2.5% (low) / 5% (base) / 10% (high)

## 10. Disability Care Costs

### The $30K/yr Assumption: Verdict
- **Accurate for:** non-subsidised nursing home, or home care with professional nursing + FDW without grants
- **Overstated for:** middle-income subsidised nursing home with CareShield Life (~$12K/yr net)
- **Understated for:** professional home care without subsidies (~$36K-$48K/yr gross)

### Net Annual Cost by Care Mode (middle-income SC, 2025)

| Tier | Annual Net | Scenario |
|------|-----------|---------|
| Conservative | $10K-$14K | Home FDW + CareShield Life + HCG + MediSave Care |
| Base case | $14K-$20K | Subsidised nursing home, 40-60% subsidy |
| Severe | $40K-$80K | Private nursing home or no subsidy access |

### Key Cost Components
- FDW (concessionary levy): $955-$1,370/month total
- Nursing home VWO: $1,300-$3,500/month gross
- CareShield Life payout: $662/month (2025), growing 4%/yr until age 67
- Home Caregiving Grant: $250-$400/month (rising to $600 from Apr 2026)
- MediSave Care: $200/month withdrawal
- Assistive devices one-time: $1K-$3K (after 90% SMF/ATF subsidy)
- Care cost inflation: ~4%/year (Singlife 2024 study)

### Recommended Stress Test Parameters
- Lump sum at onset: $8K-$15K (devices + home mods + FDW placement)
- Annual ongoing: $14K (base) / $10K (conservative) / $50K (severe)
- Duration: median ~5 years, fat tail to 15-20 years
- CareShield Life offset: model as $662/month constant (simplified)

## 11. Single-Year Life Table (mortalityTable.ts)

**File created:** `frontend/src/lib/data/mortalityTable.ts`
Source: SingStat Complete Life Tables 2023-2024 (period table, 3-year rolling avg 2022-2024)
ZIP download: `https://www.singstat.gov.sg/-/media/files/publications/population/excel/lifetable2003-2024.ashx`

Contains:
- `maleLifeTable2024`, `femaleLifeTable2024`, `totalLifeTable2024` — 101 rows each (ages 0-100)
- `getQx(age, sex)` — look up annual death probability
- `getEx(age, sex)` — look up life expectancy
- `survivalProbability(fromAge, toAge, sex)` — probability of surviving between ages

### Key qx Values (2024)
| Age | Male | Female |
|-----|------|--------|
| 30 | 0.00047 | 0.00020 |
| 40 | 0.00084 | 0.00050 |
| 50 | 0.00232 | 0.00131 |
| 60 | 0.00650 | 0.00329 |
| 70 | 0.01682 | 0.00902 |
| 80 | 0.05057 | 0.03088 |

Cross-validated against PDF narrative (e0, e65, survival to 65/85 all match)

## 12. Assessment: What This Data Is Actually Useful For

### What actually moves the needle in a retirement MC simulation

| Factor | Impact on outcomes | Already modeled? |
|--------|-------------------|-----------------|
| Market returns & volatility | Massive | Yes (3 methods) |
| Inflation | Large | Yes |
| Withdrawal strategy | Large | Yes (12 strategies) |
| Sequence of returns | Large | Yes (stress test) |
| **How long you live** | **Large** | **No - this is the gap** |
| One-time medical costs ($5-50K) | Tiny vs $1M+ portfolio | No |
| Funeral costs ($10K) | Negligible | No |
| 6-month income gap from retrenchment | Small | No |
| Wage scarring | Small | No |

### The honest assessment

**Stochastic mortality is the only MC integration worth building.** If someone dies at 75 instead of 95, that's 20 fewer years of drawdown. It fundamentally changes what "success" means. Right now every sim assumes you live to your fixed `lifeExpectancy`, which overstates the required nest egg for most paths. The life table data (already in `mortalityTable.ts`) is ready for this and it was always the Tier 1 plan.

**Everything else is noise in MC terms.** A 0.9% chance of 6-month income loss, or a 1.06% chance of a $10K medical bill, on a portfolio targeting $1M+... those shift your success rate from maybe 87% to 85%. The user can't act on that. It's not a decision-changing insight.

**The retrenchment correlation is intellectually cool but practically marginal.** Yes, you lose your job AND the market crashes simultaneously. But the MC already generates terrible market years. Adding a simultaneous income hit on top barely changes the distribution when you're running 10K paths.

### Where this data IS valuable

It's already being used in the right place: **the deterministic life events feature**. A user manually adding "Critical Illness at age 55, $50K lump sum + $15K/year ongoing" to their projection and seeing the impact on their FIRE date is **far more actionable** than a 1% random event buried in 10K simulations.

The stress test templates (Job Loss, Critical Illness, Death of Spouse, Permanent Disability) with pre-filled Singapore-specific costs let users ask "what if this happens to ME?" That's a concrete planning decision. "Your success rate dropped 2% due to illness shocks across 10K paths" is not.

### Recommendation

1. **Build stochastic mortality into MC** - the life table is ready, the design is in stressresearch.md Tier 1, and it genuinely changes results
2. **Skip MC integration for illness/retrenchment/disability** - the juice isn't worth the squeeze
3. **Keep the research for the life event templates** - the hospital bill data, disability costs, and funeral costs are perfect for pre-filling realistic defaults in the existing stress test scenarios
4. **The market-retrenchment correlation and wage scarring research** - useful reference material if you ever want Phase 2, but don't prioritize it
