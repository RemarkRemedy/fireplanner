# Advisory Landscape & Retirement Income Frameworks: Singapore Context

Research date: 2026-03-17

## Purpose

Gap analysis between Fireplanner's current capabilities and Singapore's fee-only advisory landscape, retirement income methodologies, factor-investing ecosystem, and DIY FIRE tools. Informs feature prioritisation for closing the advisory gap computationally.

---

## 1. Fee-Only Advisors in Singapore

The true fee-only (zero commissions, fully rebated) market in Singapore is small:

### Providend (est. 2001)
- First fee-only wealth advisory firm in Southeast Asia
- MAS-licensed fund management company
- Fee: 0.5-1%+ AUM annually
- Target: pre-retirees, retirees, HNW (~$500K+ investable)
- Services: retirement (RetireWell), investment, insurance, estate, education, corporate advisory
- Investment philosophy: evidence-based, DFA (Dimensional Fund Advisors) factor funds
- Insurance: needs-based gap analysis, all commissions rebated
- Estate: coordinates with lawyer/trustee network for wills, trusts, CPF/insurance nomination alignment
- Co-founded MoneyOwl (with NTUC Enterprise) for mass-market access
- Content: "Money Wisdom" podcast, educational blog (not sales funnel)
- Sources: https://providend.com/, https://providend.com/about/

### Endowus (est. 2017)
- Fee-only digital wealth platform, MAS-licensed
- Fee: 0.25-0.60% AUM (degressive), all trailer fees rebated
- Target: mass affluent, digital-first investors
- Only platform offering CPF + SRS + cash investing on one interface
- Investment philosophy: evidence-based (Fama-French factor research), broadly diversified, passive/systematic strategies tilted toward value, size, profitability
- Uses institutional funds (PIMCO, DFA, Amundi) rather than proprietary funds
- Lower minimums than Providend
- Sources: https://endowus.com/, https://endowus.com/how-we-invest

### Ascenta Wealth
- Fee-only, expat-focused
- Cross-border tax planning, repatriation strategies
- Source: https://www.ascentawealth.com/

### MoneyOwl (NTUC x Providend JV)
- Same philosophy as Providend, mass-market pricing
- Will-writing, DFA portfolios, commission-rebated insurance
- Target: working-class Singaporeans (NTUC members)

### Notable Fee-Based (Not Purely Fee-Only)
- Financial Alliance: Singapore's largest IFA, fee-based option exists but advisors can also earn commissions
- IPP Financial Advisers: commission-based with fee option
- StashAway / Syfe: AUM-fee robo-advisors, no commissions, but not full-service planning

---

## 2. Providend RetireWell Methodology

Proprietary time-segmented bucket strategy with 6-7 buckets:

| Bucket | Contents | Purpose |
|--------|----------|---------|
| Income Bucket | Annuities, direct bonds, CPF LIFE | Safe retirement income floor, monthly payouts regardless of markets |
| Bucket 1 | Cash, money market, short-term deposits | 5 years of immediate drawdown needs |
| Buckets 2-6 | Progressively higher-risk portfolios | Longer investment horizons, higher expected returns |
| Reserve Bucket | Conservative portfolio | Buffer to top up any underperforming bucket |

Key principle: never sell equities in a downturn because the next 5 years of spending are already in safe assets.

Risks mitigated: longevity, inflation, market (sequence of returns), and overspending.

Integrates: investment property, CPF LIFE, insurance endowments, private annuities, bonds, equities.

Sources:
- https://providend.com/retirewell-part-1-drawing-down-retirement-money/
- https://providend.com/retirewell-part-5/
- https://providend.com/retirewell-part-6/
- https://providend.com/episode-33-securing-a-reliable-income-stream-the-six-buckets/

---

## 3. All Major Retirement Income Frameworks

### Bucket / Time-Segmentation Strategies

| Approach | Origin | How It Works |
|----------|--------|-------------|
| Providend RetireWell | Providend (SG) | 6 buckets + reserve, annuity income floor, 5-year cash buffer |
| Evensky Two-Bucket | Harold Evensky (1985) | The original: cash bucket (2-5 yrs) + investment bucket |
| Morningstar Three-Bucket | Christine Benz | Near-term (1-2 yrs cash), intermediate (3-10 yrs bonds), long-term (10+ yrs equities) |
| DBS Time-Segmented | DBS Singapore | Phased retirement: accumulation, transition, decumulation with shifting allocations |
| Capital Group Bucket | Capital Group | Similar 3-bucket, emphasises dividend-paying equities in growth bucket |

### Guardrails / Dynamic Withdrawal Strategies

| Approach | Origin | How It Works |
|----------|--------|-------------|
| Guyton-Klinger Guardrails | Jonathan Guyton | Withdrawal rate hits upper/lower guardrail, triggers 10% spending cut or raise |
| Kitces Risk-Based Guardrails | Michael Kitces | Monte Carlo probability triggers instead of fixed rate guardrails |
| Vanguard Dynamic Spending | Vanguard | Spend % of current portfolio, cap annual changes (floor: -2.5%, ceiling: +5%) |
| Bengen Floor-Ceiling | William Bengen | Absolute dollar floor and ceiling on withdrawals |

### Safety-First / Income Floor Strategies

| Approach | Origin | How It Works |
|----------|--------|-------------|
| Wade Pfau Safety-First | Wade Pfau | Annuitize enough to cover essentials, invest remainder with higher risk |
| CPF LIFE as Floor | CPF Board (SG) | CPF LIFE guaranteed base from 65, layer private annuities + investments on top |
| Bond Ladder + TIPS | Various | Match bond maturities to future expense years, eliminates sequence risk for those years |
| Liability-Driven Investing | Institutional pensions | Treat future expenses as liabilities, match assets to each liability's duration |

### Variable Percentage / Amortization Strategies

| Approach | Origin | How It Works |
|----------|--------|-------------|
| RMD-style | IRS (US) | Divide portfolio by remaining life expectancy each year |
| Pye's Retrenchment Rule | Gordon Pye | Lower of last year's amount (inflation-adjusted) or amortized current portfolio |
| ERN Variable Percentage | Early Retirement Now | CAPE-based SWR that adjusts to market valuations |
| Bogleheads VPW | Bogleheads community | Recalculate annually using remaining portfolio and life expectancy table |

### Hybrid / Blended

| Approach | Origin | How It Works |
|----------|--------|-------------|
| Kitces Ratchet | Michael Kitces | Never cut below initial level; ratchet up when portfolio grows 50%+ above start |
| FirePathLion Variable SWR | FirePathLion (SG) | Per-expense-item SWR based on flexibility |

---

## 4. FirePathLion V2 Visual FIRE Budget Spreadsheet

A visual FIRE target calculator that assigns different SWR rates per expense item based on flexibility:

| Expense Type | SWR | Rationale |
|--------------|-----|-----------|
| Survival essentials (food, transport, insurance) | 3.25% | Must last indefinitely |
| Time-bounded costs (mortgage, childcare) | 4% | ~30 year horizon |
| Flexible/mid-term (parental support, discretionary) | 5%+ | 10-20 years, can cut if needed |

Key result: reduced the author's FIRE target from S$4.2M to S$3.66M (a $540K reduction).

Visual element: expenses get "crossed off" top to bottom as portfolio passive income covers each one.

This is a simplified DIY version of Providend's bucket system. Both share the same insight: not all expenses need the same level of safety.

Source: https://www.firepathlion.com/v2-visual-fire-budget-tracking-spreadsheet/

---

## 5. DFA Funds and Alternatives

### DFA (Dimensional Fund Advisors)
- Founded 1981, philosophy based on Fama-French factor research (Nobel Prize-winning)
- Targets size, value, profitability factor premiums
- Technically active management implementing passive philosophy
- Was advisor-only; now offers ETFs directly (US-domiciled)
- Partnered with Providend for Singapore's first CPFIS-eligible factor funds
- Singapore access: via Providend, Endowus, or direct ETFs (US-domiciled, 30% dividend WHT)

### Best Alternative: Avantis (ex-DFA team)
- Founded by DFA veterans who wanted ETF-first access
- Same factor methodology: size, value, profitability tilts
- Key funds: AVUV (US SCV), AVDV (Intl Value), AVSG (Global SCV UCITS)
- AVSG is Ireland-domiciled UCITS: 15% dividend WHT vs 30% for US-domiciled (tax-efficient for SG investors)
- Listed on LSE/XETRA, buyable via IBKR or Saxo
- Expense ratios: 0.25-0.36%
- Verdict: best DFA alternative for Singapore investors due to UCITS tax efficiency

### Other Factor Providers (Less Targeted)
| Provider | Key Funds | Expense Ratio | Notes |
|----------|-----------|---------------|-------|
| Vanguard | VBR (US SCV), VXUS (Intl) | 0.07-0.15% | Market-cap weighted with value screen, less targeted |
| iShares | IUSV, IWN, IVAL | 0.06-0.30% | Index-tracking, rules-based |
| SPDR | SLYV (SCV), SPYV (LCV) | 0.04-0.15% | Cheapest, pure index, no profitability factor |

### Practical Recommendations for SG DIY Investors
- Best factor tilt, tax-efficient: Avantis UCITS ETFs via IBKR (AVSG, AVES)
- Cheapest broad market: Vanguard/iShares UCITS ETFs (VWRA, EIMI)
- DFA without an advisor: Endowus platform (CPF/SRS/cash, institutional share class)

Sources:
- https://investmentmoats.com/money/avantis-ucits-etfs-europe-great-singaporean-investors/
- https://www.avantisinvestors.com/ucitsetf/avantis-global-small-cap-value-ucits-etf/
- https://www.optimizedportfolio.com/dfa-etfs/
- https://www.optimizedportfolio.com/avantis-etfs/
- https://www.optimizedportfolio.com/dfsv-vs-avuv/
- https://investmentmoats.com/money/invest-dimensional-fund-advisors-dfa-funds/
- https://investmentmoats.com/money/clients-providend-new-dimensional-cpf-funds/

---

## 6. Gap Analysis: Fireplanner vs Advisory Landscape

### What Fireplanner Already Covers Well
- Monte Carlo simulation with sequence risk
- 12 withdrawal strategies (including bucket, guardrails, floor-ceiling, ratchet, CAPE-based)
- CPF integration (OA/SA/MA/RA, CPF LIFE projections)
- Property analysis (HDB, private, ABSD)
- Historical backtesting
- SWR optimization

### Gaps Ranked by Impact and Feasibility

| # | Gap | What Others Have | Feasibility | Notes |
|---|-----|-----------------|-------------|-------|
| 1 | Per-expense SWR / expense itemisation | FirePathLion, Providend | High | Different expenses need different certainty levels. Reduces FIRE targets 10-15% |
| 2 | Income floor modeling | Providend, Pfau | Medium-High | Add annuity/endowment income streams beyond CPF LIFE |
| 3 | CPF/SRS tax optimisation recommender | Providend, Endowus | High | Pure computation: optimal contribution strategy based on marginal tax rate and $80K relief cap |
| 4 | Bucket visualisation with time-segmented allocation | Providend RetireWell | Medium | Per-bucket asset allocation + refill waterfall logic |
| 5 | Household survivor spending model | Providend | High | Already a known gap in CLAUDE.md. Survivor ratio ~70-80% |
| 6 | Dynamic guardrail dashboard | Kitces | Medium | Show current position relative to guardrails, not just simulate |
| 7 | Net estate at death projection | Providend | Low-Medium | Assets - liabilities - estate costs at projected death age |
| 8 | Annual review nudge/checklist | Providend annual reviews | High | Prompt users yearly to revisit assumptions, re-run simulations |
| 9 | Auto CPF OA withdrawal on portfolio depletion | N/A (SG-specific) | Medium | Bridge portfolio depletion to CPF LIFE start age |

**Previously listed, already implemented:**
- ~~Protection gap calculator~~ — Already built in Health Check page with both MoneySense quick estimate (income-multiple) and Capital Needs (detailed, obligation-based PV method). Covers funeral costs, mortgage, non-mortgage debt, children's expenses, education goals, household expense shortfall, parent support, and nets off liquid assets + all 4 CPF accounts. Minor follow-ups (term vs whole life expiry, ISP rider) are in the backlog.
- ~~Factor tilt modeling~~ — Replaced by Annual Review nudge (higher user impact). Factor tilts remain a future nice-to-have.

### What Fireplanner Cannot Replace
- Personalised advisory judgment
- Product selection (which specific annuity, insurer, fund)
- Estate/legal coordination (lawyer and trustee network)
- Behavioural coaching (the biggest value of a fee-only advisor)

### Strategic Observation
Fireplanner's 12 withdrawal strategies already cover the mechanics of most frameworks. The gap is not in withdrawal math but in:
1. Income floor modeling (guaranteed income sources beyond CPF LIFE)
2. Expense granularity (per-item SWR)
3. Asset-to-bucket mapping (which assets fund which time horizon)

These are presentation and input model changes that make the existing engine more powerful.

---

## 7. Software Competitors

| Tool | Focus | SG Support | Notes |
|------|-------|------------|-------|
| ProjectionLab | Closest to Fireplanner: MC, scenarios, visual timeline | No (US-centric) | Premium: $109/yr or $799 lifetime |
| Boldin (fka NewRetirement) | Comprehensive planning, Monte Carlo, what-if | No | $12/mo PlannerPlus |
| FireCalc | Historical backtesting with real market data | No | Free, long-standing FIRE favourite |
| ERN SWR Toolbox | CAPE-adjusted SWR, variable spending, glidepath | No | Free spreadsheet |
| CPF Retirement Planner | Official CPF projection tool | Yes, CPF-only | Limited to CPF LIFE projections |
| Endowus | Robo-advisor with CPF/SRS/cash | Yes | Manages money, doesn't plan (complementary to Fireplanner) |
