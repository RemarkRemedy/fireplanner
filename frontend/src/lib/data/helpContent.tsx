/**
 * Context-aware FAQ content for the Help Panel.
 * Keyed by route path OR section ID (for /inputs sub-sections).
 * Content guides first-time users through filling out each section.
 *
 * Answers use JSX for structured formatting (bullet points, bold terms,
 * cross-references to other sections/pages).
 */
import type { ReactNode } from 'react'

export interface HelpFaqItem {
  question: string
  answer: ReactNode
}

/* ── Shared Tailwind class sets for consistency ─────────────── */
const ul = 'mt-2 space-y-1.5 list-disc pl-4'
const tip = 'mt-3 text-xs border-l-2 border-primary/20 pl-2 py-0.5'

export const HELP_FAQ: Record<string, HelpFaqItem[]> = {
  '/': [
    {
      question: 'What is FIRE?',
      answer: (
        <>
          <p>
            FIRE stands for <strong>Financial Independence, Retire Early</strong>. It means
            building enough savings and investments so your investment returns cover your living
            expenses indefinitely — freeing you from needing employment income.
          </p>
          <p className="mt-2">
            There are several flavours of FIRE (you'll choose one in the
            {' '}<strong>FIRE Settings</strong> section):
          </p>
          <ul className={ul}>
            <li><strong>Regular FIRE</strong> — fully cover expenses from investments</li>
            <li><strong>Lean FIRE</strong> — minimal, frugal lifestyle expenses</li>
            <li><strong>Fat FIRE</strong> — comfortable or luxury-level expenses</li>
            <li><strong>Coast FIRE</strong> — enough invested that growth alone reaches your target</li>
            <li><strong>Barista FIRE</strong> — part-time work covers the remaining gap</li>
          </ul>
        </>
      ),
    },
    {
      question: 'How does this tool work?',
      answer: (
        <>
          <p>You'll move through these pages in order:</p>
          <ol className="mt-2 space-y-1.5 list-decimal pl-4">
            <li><strong>Inputs</strong> — enter your income, expenses, savings, CPF, and other financial details across several sections</li>
            <li><strong>Projection</strong> — see a year-by-year table of your financial trajectory from now to life expectancy</li>
            <li><strong>Stress Test</strong> — run Monte Carlo simulations to see how your plan holds up across thousands of market scenarios</li>
            <li><strong>Dashboard</strong> — view a summary of key metrics, risk assessment, and progress toward FIRE</li>
          </ol>
          <p className={tip}>
            All data stays in your browser — nothing is sent to a server.
            You can export/import your data as JSON for backup.
          </p>
        </>
      ),
    },
    {
      question: 'What is the 4% rule?',
      answer: (
        <>
          <p>
            A guideline from William Bengen's 1994 study: if you withdraw 4% of your portfolio
            in year one and adjust for inflation each year, your money should last at least 30
            years.
          </p>
          <p className="mt-2">
            This tool uses the 4% SWR as a default, but you can customise it in the
            {' '}<strong>FIRE Settings</strong> section and test different rates in the
            {' '}<strong>Stress Test</strong> page.
          </p>
        </>
      ),
    },
  ],

  // ─── Input sections ───────────────────────────────────────

  'section-personal': [
    {
      question: 'What retirement age should I use?',
      answer: (
        <>
          <p>Use the age you plan to stop working full-time.</p>
          <ul className={ul}>
            <li>Singapore's re-employment age is 68</li>
            <li>FIRE planners often target <strong>40–55</strong></li>
            <li>You can always adjust later — the projection updates instantly</li>
          </ul>
        </>
      ),
    },
    {
      question: 'How does life expectancy affect my plan?',
      answer: (
        <>
          <p>
            Life expectancy determines how many years your portfolio must last. A longer life
            expectancy means a larger FIRE number.
          </p>
          <ul className={ul}>
            <li>Singapore average: ~84 years</li>
            <li>Planning to <strong>90–95</strong> adds a safety margin against longevity risk</li>
            <li>You can see the impact of different values instantly in the <strong>Projection</strong> page</li>
          </ul>
        </>
      ),
    },
    {
      question: 'What life stage should I pick?',
      answer: (
        <>
          <ul className={ul}>
            <li>
              <strong>Pre-FIRE (Accumulating):</strong> you're still saving toward your target.
              The tool focuses on how fast your portfolio grows.
            </li>
            <li>
              <strong>Post-FIRE (Decumulating):</strong> you've already retired and are drawing
              down. The tool focuses on whether your portfolio lasts.
            </li>
          </ul>
          <p className={tip}>
            Your life stage also affects the sidebar ordering — sections are prioritised for
            your situation.
          </p>
        </>
      ),
    },
    {
      question: 'What does marital status affect?',
      answer: (
        <>
          <p>Marital status influences tax calculations:</p>
          <ul className={ul}>
            <li><strong>Married:</strong> eligible for Spouse Relief ($2,000) if spouse earns below $4,000/year</li>
            <li>Unlocks Working Mother's Child Relief (WMCR) for qualifying mothers</li>
          </ul>
          <p className={tip}>
            You can configure detailed tax reliefs in the <strong>Income</strong> section
            (Advanced mode → Detailed tax reliefs).
          </p>
        </>
      ),
    },
  ],

  'section-fire-settings': [
    {
      question: 'What SWR (Safe Withdrawal Rate) should I use?',
      answer: (
        <>
          <ul className={ul}>
            <li><strong>4%</strong> — classic rule, works for ~30-year retirements</li>
            <li><strong>3–3.5%</strong> — safer for early retirees (40+ year horizons)</li>
            <li><strong>5%+</strong> — higher income but greater depletion risk</li>
          </ul>
          <p className="mt-2">
            A lower SWR means a larger FIRE number but higher safety.
          </p>
          <p className={tip}>
            You can test exactly how different rates perform in the <strong>Stress Test</strong> page
            using Monte Carlo simulation.
          </p>
        </>
      ),
    },
    {
      question: 'What FIRE type is right for me?',
      answer: (
        <>
          <ul className={ul}>
            <li><strong>Regular FIRE:</strong> fully cover expenses from investments</li>
            <li><strong>Lean FIRE:</strong> frugal lifestyle, lower target number</li>
            <li><strong>Fat FIRE:</strong> comfortable/luxury expenses, higher target</li>
            <li><strong>Coast FIRE:</strong> enough invested that growth alone reaches your target by retirement — you only need to cover current expenses</li>
            <li><strong>Barista FIRE:</strong> part-time or low-stress work covers the gap between investment income and expenses</li>
          </ul>
          <p className={tip}>
            In Simple mode, only Regular FIRE is shown. Switch to <strong>Advanced</strong> to
            see all FIRE types, number basis options, and manual return overrides.
          </p>
        </>
      ),
    },
    {
      question: 'Nominal vs Real (inflation-adjusted) basis?',
      answer: (
        <>
          <ul className={ul}>
            <li>
              <strong>Real (today's dollars):</strong> adjusts for inflation so you can compare
              future values to what money buys today — easier to understand
            </li>
            <li>
              <strong>Nominal (future dollars):</strong> the actual dollar amounts you'll see in
              the future
            </li>
          </ul>
          <p className="mt-2">
            At 2.5% inflation, $100K in 20 years is only worth ~$61K in today's dollars.
            We recommend <strong>Real</strong> for planning.
          </p>
          <p className={tip}>
            This is an Advanced setting. In Simple mode, the tool defaults to Real basis.
          </p>
        </>
      ),
    },
    {
      question: 'What do the Assumptions fields mean?',
      answer: (
        <>
          <ul className={ul}>
            <li>
              <strong>Expected Nominal Return:</strong> average annual portfolio growth before
              inflation. By default, this is auto-derived from your
              {' '}<strong>Allocation</strong> weights. You can switch to manual override.
            </li>
            <li>
              <strong>Inflation Rate:</strong> expected annual price increase (default 2.5%).
              Affects how much your expenses grow each year.
            </li>
            <li>
              <strong>Expense Ratio:</strong> annual investment fees (default 0.3%). Deducted
              from returns — lower is better.
            </li>
          </ul>
          <p className="mt-2">
            <strong>Net real return</strong> = Nominal Return − Inflation − Expense Ratio. This
            is the actual growth in purchasing power.
          </p>
        </>
      ),
    },
  ],

  'section-income': [
    {
      question: 'Which salary model should I pick?',
      answer: (
        <>
          <ul className={ul}>
            <li>
              <strong>Simple:</strong> a fixed annual growth rate (e.g., 3%/year).
              Best if you expect steady, predictable raises.
            </li>
            <li>
              <strong>Realistic:</strong> models career phases with promotion jumps at specific
              ages. Good for PMETs who expect step-changes in pay.
            </li>
            <li>
              <strong>Data-Driven:</strong> uses MOM (Ministry of Manpower) salary benchmarks
              matched to your education level. Great if you're unsure about future growth.
            </li>
          </ul>
        </>
      ),
    },
    {
      question: 'What are income streams?',
      answer: (
        <>
          <p>
            Income streams let you model any regular income beyond your primary salary:
          </p>
          <ul className={ul}>
            <li>Rental income</li>
            <li>Dividends or investment income</li>
            <li>Freelance or side-hustle income</li>
            <li>Spouse's income</li>
            <li>Part-time work in retirement</li>
          </ul>
          <p className="mt-2">
            Each stream has its own start/end age, so you can model income changes over your
            lifetime.
          </p>
          <p className={tip}>
            Income streams are an <strong>Advanced</strong> feature. Switch to Advanced mode
            in this section to add them.
          </p>
        </>
      ),
    },
    {
      question: 'How are bonuses and variable pay handled?',
      answer: (
        <>
          <p>
            Enter your expected annual bonus as a number of bonus months (e.g., 2 months = 2.0).
            The tool adds it to your annual income for projection purposes.
          </p>
          <p className="mt-2">
            If your bonus varies year to year, use a conservative estimate — you can always adjust.
          </p>
          <p className={tip}>
            Advanced mode also lets you configure <strong>tax reliefs</strong> and
            {' '}<strong>life events</strong> (e.g., career breaks, sabbaticals) that affect your income timeline.
          </p>
        </>
      ),
    },
    {
      question: 'What are tax reliefs and how do they work?',
      answer: (
        <>
          <p>
            Tax reliefs reduce your chargeable income, lowering your SG tax bill. The tool
            offers two sub-modes:
          </p>
          <ul className={ul}>
            <li><strong>Simple:</strong> enter a single total reliefs amount (default $20,000)</li>
            <li>
              <strong>Detailed:</strong> configure individual reliefs — Earned Income, NSman,
              Spouse, Qualifying Child (QCR), Parent Relief, and others
            </li>
          </ul>
          <p className="mt-2">
            The tool auto-calculates <strong>CPF Relief</strong> (employee portion) and
            {' '}<strong>SRS deductions</strong> on top of your personal reliefs.
          </p>
          <p className={tip}>
            Tax reliefs are an <strong>Advanced</strong> feature. The SRS Tax Planning card
            (also Advanced) shows how much tax you'd save by contributing to SRS.
          </p>
        </>
      ),
    },
  ],

  'section-expenses': [
    {
      question: 'Should I include mortgage payments?',
      answer: (
        <p>
          For mortgage modelling, use the <strong>Property</strong> section (further down in the
          sidebar). It handles loan amortization, CPF usage for repayment, stamp duties, and
          property equity — giving you a more complete picture.
        </p>
      ),
    },
    {
      question: 'How do I estimate retirement expenses?',
      answer: (
        <>
          <p>
            A common guideline: <strong>70–80%</strong> of pre-retirement expenses. Typical
            changes in retirement:
          </p>
          <ul className={ul}>
            <li><strong>Spend less on:</strong> commuting, work clothes, meals out</li>
            <li><strong>Spend more on:</strong> healthcare, leisure, travel</li>
          </ul>
          <p className="mt-2">
            The tool lets you set a separate retirement expense figure that kicks in at your
            retirement age.
          </p>
          <p className={tip}>
            For healthcare specifically, you can model it separately in the
            {' '}<strong>Healthcare</strong> section with its own inflation rate.
          </p>
        </>
      ),
    },
    {
      question: 'What about inflation on expenses?',
      answer: (
        <>
          <p>
            The tool applies your configured inflation rate (default <strong>2.5%</strong>) to
            expenses each year.
          </p>
          <p className="mt-2">
            Note that certain costs inflate faster:
          </p>
          <ul className={ul}>
            <li><strong>Healthcare:</strong> 5–8% p.a. — model this separately in the Healthcare section</li>
            <li><strong>Education:</strong> 3–5% p.a.</li>
            <li><strong>Housing:</strong> varies by market cycle</li>
          </ul>
        </>
      ),
    },
    {
      question: 'What withdrawal strategies are available?',
      answer: (
        <>
          <p>In Simple mode, you can compare these 4 strategies:</p>
          <ul className={ul}>
            <li><strong>Constant Dollar (4% rule):</strong> fixed initial amount, adjusted for inflation yearly</li>
            <li><strong>VPW (Variable Percentage):</strong> recalculates withdrawal as a percentage of remaining portfolio each year</li>
            <li><strong>Guardrails (Guyton-Klinger):</strong> adjusts spending up/down based on portfolio performance bands</li>
            <li><strong>Vanguard Dynamic:</strong> blends a fixed percentage with a ceiling/floor adjustment</li>
          </ul>
          <p className={tip}>
            Advanced mode adds 8 more strategies and comparison charts. All strategies are also
            tested in the <strong>Stress Test</strong> page.
          </p>
        </>
      ),
    },
    {
      question: 'What is Aging Parent Support?',
      answer: (
        <>
          <p>
            Model ongoing financial support for parents or dependants. Each entry has:
          </p>
          <ul className={ul}>
            <li>A <strong>monthly amount</strong> you provide</li>
            <li>An <strong>annual growth rate</strong> (e.g., 3% for inflation)</li>
            <li><strong>Start and end ages</strong> — your age when support begins and ends</li>
          </ul>
          <p className="mt-2">
            This is added to your expenses and reduces your savings rate. The tool shows the
            total parent support at retirement age.
          </p>
        </>
      ),
    },
    {
      question: 'What is the Retirement Spending Adjustment?',
      answer: (
        <>
          <p>
            The percentage of your current expenses you expect to spend in retirement.
          </p>
          <ul className={ul}>
            <li><strong>100%:</strong> same spending level as today</li>
            <li><strong>70–80%:</strong> common rule of thumb (less commuting, work costs)</li>
            <li><strong>120%+:</strong> if you plan to travel more or upgrade lifestyle</li>
          </ul>
          <p className="mt-2">
            This directly affects your FIRE number — a lower adjustment means you need less.
          </p>
        </>
      ),
    },
    {
      question: 'What are one-time retirement withdrawals?',
      answer: (
        <>
          <p>
            Large planned expenses during retirement that aren't part of your regular annual spending:
          </p>
          <ul className={ul}>
            <li>Home renovation or repairs</li>
            <li>Major travel plans</li>
            <li>Children's wedding or education support</li>
            <li>Medical procedures not covered by insurance</li>
          </ul>
          <p className="mt-2">
            Each withdrawal has a start age, duration, and optional inflation adjustment. These
            are deducted from your portfolio in the <strong>Projection</strong>.
          </p>
        </>
      ),
    },
  ],

  'section-net-worth': [
    {
      question: 'What counts as liquid net worth?',
      answer: (
        <>
          <p><strong>Include:</strong></p>
          <ul className={ul}>
            <li>Cash and savings accounts</li>
            <li>Stocks, bonds, ETFs</li>
            <li>Unit trusts and robo-advisor portfolios</li>
            <li>Any investment you can sell and access within days</li>
          </ul>
          <p className="mt-2"><strong>Do NOT include:</strong></p>
          <ul className={ul}>
            <li>CPF balances (enter these in the <strong>CPF</strong> section)</li>
            <li>Your home (unless you plan to sell — use the <strong>Property</strong> section)</li>
            <li>Illiquid assets like private equity</li>
          </ul>
        </>
      ),
    },
    {
      question: 'Should I include CPF balances here?',
      answer: (
        <>
          <p>
            <strong>No</strong> — enter CPF OA, SA, and MA in their dedicated fields in the
            {' '}<strong>CPF</strong> section.
          </p>
          <p className="mt-2">
            CPF is tracked separately because it:
          </p>
          <ul className={ul}>
            <li>Grows at guaranteed rates (OA: 2.5%, SA: 4%)</li>
            <li>Has withdrawal restrictions until age 55</li>
            <li>Converts to CPF LIFE annuity payouts at age 65</li>
          </ul>
        </>
      ),
    },
    {
      question: 'What is SRS and should I contribute?',
      answer: (
        <>
          <p>
            SRS (Supplementary Retirement Scheme) is a voluntary savings scheme with tax
            benefits:
          </p>
          <ul className={ul}>
            <li>Contributions are <strong>tax-deductible</strong> up to $15,300/year</li>
            <li>Withdrawals after age 62 are <strong>50% tax-free</strong></li>
            <li>Penalty-free withdrawal starts 10 years after first contribution</li>
            <li>Especially valuable if you're in a higher tax bracket (17.5%+)</li>
          </ul>
          <p className="mt-2">
            Enter your current SRS balance and planned annual contribution here.
          </p>
          <p className={tip}>
            Advanced mode lets you set a custom SRS return assumption and drawdown age.
            The tool auto-calculates your SRS tax deduction in the income projection.
          </p>
        </>
      ),
    },
  ],

  'section-cpf': [
    {
      question: 'How do CPF contribution rates change with age?',
      answer: (
        <>
          <p>Total contribution rate (employer + employee) drops at age milestones:</p>
          <ul className={ul}>
            <li><strong>Up to 55:</strong> 37% (employee 20% + employer 17%)</li>
            <li><strong>55–60:</strong> 29.5%</li>
            <li><strong>60–65:</strong> 20.5%</li>
            <li><strong>65–70:</strong> 16.5%</li>
            <li><strong>70+:</strong> 12.5%</li>
          </ul>
          <p className="mt-2">
            The employer share reduces more than the employee share. The tool applies the
            correct rates automatically at each age.
          </p>
          <p className={tip}>
            The OW (Ordinary Wages) ceiling is $8,000/month. Income above this does not attract
            CPF contributions.
          </p>
        </>
      ),
    },
    {
      question: 'What is CPF LIFE and when does it start?',
      answer: (
        <>
          <p>CPF LIFE is a national annuity providing <strong>monthly payouts for life</strong>. Three plan types:</p>
          <ul className={ul}>
            <li><strong>Basic Plan:</strong> lower monthly payouts, preserves more for beneficiaries</li>
            <li><strong>Standard Plan:</strong> higher monthly payouts, less bequest value</li>
            <li><strong>Escalating Plan:</strong> starts lower but payouts increase 2% yearly — good hedge against inflation</li>
          </ul>
          <p className="mt-2">
            You can start payouts anytime from <strong>age 65 to 70</strong>. Deferring gives
            higher monthly payouts (~6–7% more per year of deferral).
          </p>
          <p className={tip}>
            CPF LIFE payouts reduce how much you need to withdraw from your investment
            portfolio in retirement. The tool factors this into the <strong>Projection</strong> and
            {' '}<strong>Stress Test</strong> automatically.
          </p>
        </>
      ),
    },
    {
      question: 'What are BRS, FRS, and ERS?',
      answer: (
        <>
          <p>At age 55, your CPF Retirement Account (RA) is set up. The retirement sums are:</p>
          <ul className={ul}>
            <li><strong>BRS (Basic):</strong> ~$99K — minimum, lowest CPF LIFE payout</li>
            <li><strong>FRS (Full):</strong> ~$198K — standard target</li>
            <li><strong>ERS (Enhanced):</strong> ~$298K — highest CPF LIFE payout</li>
          </ul>
          <p className="mt-2">
            These are 2024 values and grow at <strong>3.5%/year</strong>. The tool projects
            them forward to your age 55.
          </p>
        </>
      ),
    },
    {
      question: 'How does the OA housing deduction work?',
      answer: (
        <>
          <p>
            If you use CPF OA for your mortgage, enter the monthly deduction here. This
            reduces OA growth during your working years.
          </p>
          <p className={tip}>
            For a complete mortgage model — including loan tenure, interest rate, and
            amortization schedule — use the <strong>Property</strong> section instead. The OA
            housing deduction here is for a simple monthly estimate.
          </p>
        </>
      ),
    },
  ],

  'section-healthcare': [
    {
      question: 'How should I estimate healthcare costs?',
      answer: (
        <>
          <p>
            Healthcare costs typically rise with age. The tool lets you set:
          </p>
          <ul className={ul}>
            <li>A <strong>base annual cost</strong> (current out-of-pocket spending)</li>
            <li>A <strong>healthcare-specific inflation rate</strong> (typically 5–8%, much higher than general inflation)</li>
          </ul>
          <p className="mt-2">
            Even with MediShield Life, out-of-pocket costs for specialist care, dental, and
            outpatient treatment can be significant.
          </p>
        </>
      ),
    },
    {
      question: 'What does MediShield Life cover?',
      answer: (
        <>
          <p>MediShield Life covers large hospital bills and selected outpatient treatments, but has limits:</p>
          <ul className={ul}>
            <li>Deductibles and co-insurance apply</li>
            <li>Coverage caps on certain procedures</li>
            <li>Private Integrated Shield Plans (IPs) extend coverage for private hospitals</li>
          </ul>
          <p className="mt-2">
            Model your expected <strong>out-of-pocket</strong> portion here — the amount not
            covered by insurance.
          </p>
        </>
      ),
    },
    {
      question: 'Why model healthcare separately?',
      answer: (
        <>
          <p>
            Healthcare inflation (<strong>5–8%</strong>) far outpaces general inflation
            (<strong>2–3%</strong>). The compounding difference is dramatic over a long retirement:
          </p>
          <ul className={ul}>
            <li>$5K/year at age 65 → $10K+ at age 80 → $15K+ at age 85</li>
            <li>This can add $200K–$400K to your total retirement needs</li>
          </ul>
          <p className="mt-2">
            Modelling it separately gives a more realistic picture than bundling it with
            general expenses.
          </p>
        </>
      ),
    },
    {
      question: 'What ISP tier should I choose?',
      answer: (
        <>
          <p>
            Integrated Shield Plans (ISPs) extend MediShield Life coverage to private hospitals.
            Choose based on your budget and preference:
          </p>
          <ul className={ul}>
            <li><strong>None:</strong> rely on MediShield Life only — lowest premiums, public hospitals</li>
            <li><strong>Basic:</strong> covers B1 ward in public hospitals</li>
            <li><strong>Standard:</strong> covers restructured hospital private rooms</li>
            <li><strong>Enhanced:</strong> covers private hospital stays — highest premiums</li>
          </ul>
          <p className="mt-2">
            You can also model <strong>downgrading</strong> your ISP tier at a future age to
            reduce premiums in later retirement.
          </p>
        </>
      ),
    },
    {
      question: 'What is CareShield LIFE?',
      answer: (
        <>
          <p>
            CareShield LIFE is a long-term care insurance scheme providing monthly payouts if
            you become severely disabled.
          </p>
          <ul className={ul}>
            <li>Mandatory for those born in 1980 or later</li>
            <li>Premiums are paid from age 30 to 67 (payable by MediSave)</li>
            <li>Payouts start at <strong>$600/month</strong> and increase 2% yearly</li>
            <li>Covers you for life once activated</li>
          </ul>
          <p className="mt-2">
            Toggle this on if applicable — the tool includes the premiums in your healthcare
            cost projection.
          </p>
        </>
      ),
    },
    {
      question: 'What are the out-of-pocket (OOP) presets?',
      answer: (
        <>
          <p>
            The tool offers preset models for estimating out-of-pocket healthcare costs:
          </p>
          <ul className={ul}>
            <li><strong>Bottom-Up:</strong> build your estimate from individual cost components</li>
            <li><strong>World Bank Nominal:</strong> based on World Bank healthcare expenditure data for Singapore</li>
            <li><strong>SingStat HES:</strong> based on Singapore Household Expenditure Survey data</li>
            <li><strong>World Bank PPP:</strong> World Bank data adjusted for purchasing power parity</li>
          </ul>
          <p className="mt-2">
            You can also choose between <strong>age-dependent</strong> (costs rise with age) or
            {' '}<strong>fixed</strong> annual out-of-pocket amounts.
          </p>
        </>
      ),
    },
  ],

  'section-property': [
    {
      question: 'Should I include my home in the plan?',
      answer: (
        <>
          <p>It depends on your retirement strategy:</p>
          <ul className={ul}>
            <li>
              <strong>Plan to downsize or sell:</strong> include it — the sale proceeds become
              investable assets at the planned age
            </li>
            <li>
              <strong>Plan to rent it out:</strong> include it — rental income adds to your
              retirement cash flow
            </li>
            <li>
              <strong>Plan to live in it forever:</strong> the property doesn't contribute to
              investable assets, but the tool can still model mortgage payments reducing your
              savings rate during accumulation
            </li>
          </ul>
        </>
      ),
    },
    {
      question: 'How does lease decay work for HDB/leasehold?',
      answer: (
        <>
          <p>
            Leasehold properties lose value as the lease shortens, following
            {' '}<strong>Bala's Table</strong> (used by IRAS for valuation):
          </p>
          <ul className={ul}>
            <li>99-year lease at 60 years remaining → retains ~80% of freehold value</li>
            <li>At 40 years remaining → ~60% of value</li>
            <li>Drops sharply below 30 years — this affects resale significantly</li>
          </ul>
          <p className="mt-2">
            The tool applies this decay automatically based on your property's remaining lease.
          </p>
          <p className={tip}>
            Advanced mode shows the full Bala's Table lookup and amortization schedule.
          </p>
        </>
      ),
    },
    {
      question: 'What are BSD and ABSD?',
      answer: (
        <>
          <p><strong>BSD (Buyer's Stamp Duty)</strong> — progressive tax on all purchases:</p>
          <ul className={ul}>
            <li>1% on first $180K, 2% on next $180K, 3% on next $640K, then 4–6% above</li>
          </ul>
          <p className="mt-2"><strong>ABSD (Additional BSD)</strong> — depends on residency and property count:</p>
          <ul className={ul}>
            <li><strong>Citizens:</strong> 0% on 1st, 20% on 2nd, 30% on 3rd+</li>
            <li><strong>PRs:</strong> 5% on 1st, 30% on 2nd+</li>
            <li><strong>Foreigners:</strong> 60% on any purchase</li>
          </ul>
          <p className={tip}>
            The tool calculates both automatically. Advanced mode shows the full stamp duty
            breakdown.
          </p>
        </>
      ),
    },
    {
      question: 'What is the downsizing scenario?',
      answer: (
        <>
          <p>Model what happens to your finances when you sell your current property:</p>
          <ul className={ul}>
            <li>
              <strong>Sell & Downsize:</strong> sell current home and buy a smaller/cheaper
              property. The net equity becomes investable assets.
            </li>
            <li>
              <strong>Sell & Rent:</strong> sell and switch to renting. All sale proceeds
              become investable, but you take on ongoing rental expenses.
            </li>
          </ul>
          <p className="mt-2">
            Set the age you plan to sell and the expected sale price. The tool calculates
            mortgage payoff, net proceeds, and the impact on your FIRE plan.
          </p>
        </>
      ),
    },
    {
      question: 'What is HDB monetization?',
      answer: (
        <>
          <p>
            Two ways to unlock value from your HDB flat without selling:
          </p>
          <ul className={ul}>
            <li>
              <strong>Sublet room(s):</strong> rent out 1–3 rooms for additional monthly
              income. The tool estimates annual rental income based on your flat type.
            </li>
            <li>
              <strong>Lease Buyback Scheme (LBS):</strong> sell part of your remaining lease
              back to HDB. You retain 20–35 years of lease to live in, and receive cash
              proceeds plus a CPF RA top-up that boosts your CPF LIFE payouts.
            </li>
          </ul>
          <p className={tip}>
            HDB monetization options appear only when your property type is set to HDB.
          </p>
        </>
      ),
    },
  ],

  'section-allocation': [
    {
      question: 'What allocation is right for me?',
      answer: (
        <>
          <p>Choose from 6 templates or build a custom allocation:</p>
          <ul className={ul}>
            <li><strong>Conservative (30/70):</strong> near-retirees or in retirement — stability first</li>
            <li><strong>Balanced (60/40):</strong> 10–20 year horizon — classic moderate mix</li>
            <li><strong>Aggressive (80/20):</strong> 20+ years — higher growth, more volatility</li>
            <li><strong>All Weather:</strong> diversified across stocks, bonds, gold, REITs — inspired by Ray Dalio's approach</li>
            <li><strong>Singapore Centric:</strong> heavier weighting to SG equities, REITs, and CPF</li>
            <li><strong>Custom:</strong> set your own weights across 8 asset classes</li>
          </ul>
        </>
      ),
    },
    {
      question: 'What is a glide path?',
      answer: (
        <>
          <p>
            A glide path gradually shifts your allocation from aggressive to conservative as you
            approach retirement. For example:
          </p>
          <ul className={ul}>
            <li>Age 30: 80% stocks / 20% bonds</li>
            <li>Age 45: 60% stocks / 40% bonds</li>
            <li>Age 60: 40% stocks / 60% bonds</li>
          </ul>
          <p className="mt-2">
            This reduces sequence-of-returns risk near retirement, when your portfolio is
            largest and most vulnerable to downturns.
          </p>
          <p className={tip}>
            Glide path is an <strong>Advanced</strong> feature. Switch to Advanced mode in this
            section to configure it.
          </p>
        </>
      ),
    },
    {
      question: 'How do I read the correlation matrix?',
      answer: (
        <>
          <p>
            The correlation matrix shows how asset classes move relative to each other.
            Values range from <strong>-1</strong> to <strong>+1</strong>:
          </p>
          <ul className={ul}>
            <li><strong>Near +1:</strong> assets move together (e.g., US and SG equities)</li>
            <li><strong>Near 0:</strong> no relationship — good for diversification</li>
            <li><strong>Near -1:</strong> assets move opposite — excellent hedge</li>
          </ul>
          <p className="mt-2">
            For example, bonds and equities often have low correlation, so holding both reduces
            overall portfolio volatility.
          </p>
          <p className={tip}>
            The correlation matrix is an <strong>Advanced</strong> feature, along with custom
            return overrides.
          </p>
        </>
      ),
    },
    {
      question: 'What is Current vs Target allocation?',
      answer: (
        <>
          <ul className={ul}>
            <li>
              <strong>Current %:</strong> your actual portfolio allocation today. Used for
              near-term projections and stress tests.
            </li>
            <li>
              <strong>Target %:</strong> the allocation you're transitioning toward (or will
              hold in retirement). Used for long-term projections.
            </li>
          </ul>
          <p className="mt-2">
            If you've configured a <strong>glide path</strong> (Advanced), the tool gradually
            shifts from Current to Target over the specified age range.
          </p>
          <p className={tip}>
            Use "Copy to Target" to quickly set Target equal to Current.
          </p>
        </>
      ),
    },
    {
      question: 'What does expected return/volatility mean?',
      answer: (
        <>
          <ul className={ul}>
            <li>
              <strong>Expected return:</strong> the average annual gain based on historical data
              for your chosen allocation
            </li>
            <li>
              <strong>Volatility (std dev):</strong> how much returns swing year to year — higher
              volatility = more risk
            </li>
            <li>
              <strong>Sharpe ratio:</strong> return per unit of risk — higher is better, meaning
              more efficient risk-taking
            </li>
          </ul>
          <p className="mt-2">
            These stats update in real-time as you adjust your allocation weights.
          </p>
        </>
      ),
    },
  ],

  // ─── Non-input pages ──────────────────────────────────────

  '/inputs': [
    {
      question: 'How is my FIRE number calculated?',
      answer: (
        <>
          <p><strong>FIRE Number = Annual Expenses ÷ Safe Withdrawal Rate</strong></p>
          <p className="mt-2">
            For example, $48,000 expenses with a 4% SWR gives a FIRE number of
            {' '}<strong>$1,200,000</strong>. This is the portfolio size needed to sustain your
            lifestyle from investment returns.
          </p>
          <p className="mt-2">
            You set your expenses in the <strong>Expenses</strong> section and your SWR in
            {' '}<strong>FIRE Settings</strong>.
          </p>
        </>
      ),
    },
    {
      question: 'How does CPF affect my plan?',
      answer: (
        <>
          <p>CPF affects both accumulation and retirement:</p>
          <ul className={ul}>
            <li>
              <strong>During working years:</strong> contributions reduce take-home pay but
              grow at guaranteed rates (OA: 2.5%, SA: 4%)
            </li>
            <li>
              <strong>At age 55:</strong> your Retirement Account (RA) is set up from SA + OA
            </li>
            <li>
              <strong>At age 65:</strong> CPF LIFE provides monthly payouts that reduce how
              much you need from your portfolio
            </li>
          </ul>
          <p className={tip}>
            Enable the <strong>CPF</strong> section in the sidebar to model this in detail.
          </p>
        </>
      ),
    },
    {
      question: 'What are the salary models?',
      answer: (
        <>
          <ul className={ul}>
            <li><strong>Simple:</strong> fixed annual growth rate</li>
            <li><strong>Realistic:</strong> career phases with promotion jumps at configurable ages</li>
            <li><strong>Data-Driven:</strong> uses MOM (Ministry of Manpower) salary benchmarks by age and education level</li>
          </ul>
          <p className="mt-2">
            Choose your model in the <strong>Income</strong> section.
          </p>
        </>
      ),
    },
    {
      question: 'Should I include property?',
      answer: (
        <>
          <p>Enable the <strong>Property</strong> section if you want to model any of these:</p>
          <ul className={ul}>
            <li>Mortgage payments reducing your savings rate</li>
            <li>Rental income in retirement</li>
            <li>Property equity as part of net worth</li>
            <li>Stamp duties (BSD + ABSD) on purchases</li>
            <li>Leasehold decay via Bala's Table</li>
          </ul>
          <p className={tip}>
            Property is an optional section — toggle it on in the sidebar or on the Start page.
          </p>
        </>
      ),
    },
  ],

  '/projection': [
    {
      question: 'What does the projection table show?',
      answer: (
        <>
          <p>
            A year-by-year breakdown from your current age to life expectancy, including:
          </p>
          <ul className={ul}>
            <li>Income (salary + streams) and expenses</li>
            <li>Annual savings and investment growth</li>
            <li>CPF balances (OA, SA, MA, RA)</li>
            <li>Total net worth and FIRE progress</li>
          </ul>
          <p className="mt-2">
            Toggle between today's dollars (real) and future dollars (nominal) using the
            controls at the top.
          </p>
          <p className={tip}>
            Advanced mode adds more columns and lets you toggle individual columns on/off.
          </p>
        </>
      ),
    },
    {
      question: 'What is the difference between nominal and real dollars?',
      answer: (
        <>
          <ul className={ul}>
            <li>
              <strong>Nominal (future dollars):</strong> the actual amounts you'll see in your
              account — includes inflation
            </li>
            <li>
              <strong>Real (today's dollars):</strong> adjusted for inflation so you can compare
              to what money buys today
            </li>
          </ul>
          <p className="mt-2">
            At 2.5% inflation, $100K in 20 years is worth about <strong>$61K</strong> in
            today's dollars. We recommend Real for planning because it's more intuitive.
          </p>
        </>
      ),
    },
    {
      question: 'Why does my portfolio drop at retirement?',
      answer: (
        <>
          <p>
            In retirement years, you're <strong>withdrawing</strong> from your portfolio to
            cover expenses instead of adding savings. The projection applies your chosen
            withdrawal strategy (e.g., 4% rule) starting at your retirement age.
          </p>
          <p className="mt-2">
            This is expected. The key question is whether your portfolio lasts until your life
            expectancy — which the <strong>Stress Test</strong> page helps you evaluate across
            thousands of scenarios.
          </p>
        </>
      ),
    },
  ],

  '/stress-test': [
    {
      question: 'What is Monte Carlo simulation?',
      answer: (
        <>
          <p>
            The tool runs <strong>10,000 random market scenarios</strong> to see how often your
            plan survives. Each scenario generates different annual returns based on historical
            data.
          </p>
          <ul className={ul}>
            <li><strong>95%+ success rate:</strong> very robust plan</li>
            <li><strong>80–95%:</strong> generally good, but consider adjustments</li>
            <li><strong>Below 80%:</strong> significant risk of running out — adjust SWR, expenses, or allocation</li>
          </ul>
        </>
      ),
    },
    {
      question: 'Parametric vs Bootstrap vs Fat-tail?',
      answer: (
        <>
          <p>Three methods for generating random market returns:</p>
          <ul className={ul}>
            <li>
              <strong>Parametric:</strong> generates returns from a bell curve using historical
              mean and volatility — smoothest results
            </li>
            <li>
              <strong>Bootstrap:</strong> randomly samples actual historical years — preserves
              real-world return patterns
            </li>
            <li>
              <strong>Fat-tail (Student-t):</strong> produces more extreme events (crashes and
              booms) than a normal bell curve — most conservative
            </li>
          </ul>
          <p className={tip}>
            If unsure, start with <strong>Parametric</strong> (the default). Try Fat-tail for a
            more stress-tested view.
          </p>
        </>
      ),
    },
    {
      question: 'What is sequence of returns risk?',
      answer: (
        <>
          <p>
            The risk that bad market returns happen <strong>early in your retirement</strong>,
            when your portfolio is largest and withdrawals have the biggest impact.
          </p>
          <p className="mt-2">
            A 30% crash in year 1 of retirement is far more damaging than the same crash in
            year 20, because early losses compound against you for the entire retirement.
          </p>
          <p className={tip}>
            The Sequence Risk tab (Advanced mode) lets you stress-test against specific crisis
            scenarios like the GFC, dot-com crash, and Asian Financial Crisis.
          </p>
        </>
      ),
    },
    {
      question: 'What is historical backtesting?',
      answer: (
        <>
          <p>
            Tests your plan against <strong>every possible starting year</strong> in history.
            If your plan is 30 years long, it tests starting in 1928, 1929, 1930… through the
            most recent possible window.
          </p>
          <p className="mt-2">
            This shows which historical periods would have failed and how your plan compares to
            the worst decades on record.
          </p>
          <p className={tip}>
            Historical Backtest is an <strong>Advanced</strong> feature on the Stress Test page.
          </p>
        </>
      ),
    },
    {
      question: 'What mitigations reduce sequence risk?',
      answer: (
        <>
          <p>Three strategies to protect against early-retirement market crashes:</p>
          <ul className={ul}>
            <li>
              <strong>Bond tent:</strong> temporarily hold more bonds around retirement age
              (e.g., 60% bonds at retirement, glide back to 40% over 5–10 years)
            </li>
            <li>
              <strong>Cash buffer:</strong> keep 1–3 years of expenses in cash so you don't
              have to sell equities during a downturn
            </li>
            <li>
              <strong>Flexible spending:</strong> reduce withdrawals by 10–25% when the
              portfolio drops below a threshold
            </li>
          </ul>
          <p className={tip}>
            Test these mitigations in the Sequence Risk tab (Advanced mode) to see their
            impact on survival rates.
          </p>
        </>
      ),
    },
  ],

  '/withdrawal': [
    {
      question: 'What is this page?',
      answer: (
        <>
          <p>
            This page lets you <strong>compare all withdrawal strategies</strong> side by side
            using deterministic projections. It shows how each strategy would perform given
            your retirement portfolio, expenses, and assumptions.
          </p>
          <p className={tip}>
            The active strategy you selected on the Inputs page is used in Projection and
            Stress Tests. Use this page to explore alternatives before changing your pick.
          </p>
        </>
      ),
    },
    {
      question: 'What are the strategy categories?',
      answer: (
        <>
          <p>Strategies are grouped into three categories by how they adapt:</p>
          <ul className={ul}>
            <li>
              <strong>Basic:</strong> simple rules that don't react to market conditions
              — Constant Dollar (4% rule), Percent of Portfolio, 1/N
            </li>
            <li>
              <strong>Adaptive:</strong> adjust withdrawals based on portfolio performance
              — VPW, Guardrails, Vanguard Dynamic, 95% Rule
            </li>
            <li>
              <strong>Smoothed:</strong> blend market signals with spending stability
              — CAPE-Based, Floor & Ceiling, Endowment, Sensible Withdrawals, Hebeler Autopilot
            </li>
          </ul>
        </>
      ),
    },
    {
      question: 'What do the comparison charts show?',
      answer: (
        <>
          <p>Two charts help you visualise the trade-offs:</p>
          <ul className={ul}>
            <li>
              <strong>Withdrawal Chart:</strong> year-by-year income from each strategy.
              Volatile strategies show wider swings; smoothed ones stay flatter.
            </li>
            <li>
              <strong>Portfolio Chart:</strong> how your portfolio balance evolves under each
              strategy. Aggressive strategies deplete faster; conservative ones leave more legacy.
            </li>
          </ul>
          <p className={tip}>
            The comparison table above the charts summarises average, min, max, and standard
            deviation for each strategy — useful for quick ranking.
          </p>
        </>
      ),
    },
    {
      question: 'What is "My Plan" vs "FIRE Target" mode?',
      answer: (
        <>
          <p>The toggle at the top controls what starting portfolio is used:</p>
          <ul className={ul}>
            <li>
              <strong>My Plan:</strong> uses your projected portfolio at retirement age,
              based on current savings, income, and growth
            </li>
            <li>
              <strong>FIRE Target:</strong> uses your FIRE number (expenses ÷ SWR) as the
              starting portfolio — tests whether the target amount itself is sufficient
            </li>
          </ul>
        </>
      ),
    },
    {
      question: 'How do I tune strategy parameters?',
      answer: (
        <>
          <p>
            Each strategy has configurable parameters (e.g., guardrail thresholds,
            ceiling/floor limits, smoothing weights). The <strong>Strategy Parameters</strong> section
            lets you adjust these for each strategy individually.
          </p>
          <ul className={ul}>
            <li><strong>Guardrails:</strong> upper/lower rails and cut/raise percentages</li>
            <li><strong>Vanguard Dynamic:</strong> ceiling and floor change limits</li>
            <li><strong>CAPE-Based:</strong> base rate, weight, and min/max bounds</li>
            <li><strong>Floor & Ceiling:</strong> absolute dollar bounds on annual withdrawals</li>
          </ul>
          <p className={tip}>
            Parameters only appear for strategies that have them. Basic strategies like
            Constant Dollar and Percent of Portfolio use the SWR from your FIRE Settings.
          </p>
        </>
      ),
    },
  ],

  '/dashboard': [
    {
      question: 'How is the risk score calculated?',
      answer: (
        <>
          <p>The risk assessment scores 6 dimensions:</p>
          <ol className="mt-2 space-y-1.5 list-decimal pl-4">
            <li><strong>Withdrawal rate sustainability</strong> — is your SWR safe for your timeline?</li>
            <li><strong>Portfolio diversification</strong> — are you well-diversified across asset classes?</li>
            <li><strong>Sequence risk exposure</strong> — how vulnerable are you to early downturns?</li>
            <li><strong>Income stability</strong> — do you have multiple income sources?</li>
            <li><strong>CPF/annuity coverage</strong> — how much of your retirement is covered by guaranteed income?</li>
            <li><strong>Expense flexibility</strong> — can you cut spending if needed?</li>
          </ol>
          <p className="mt-2">
            Each dimension is rated and combined into an overall score.
          </p>
        </>
      ),
    },
    {
      question: 'What does "years to FIRE" mean?',
      answer: (
        <>
          <p>
            The number of years until your projected net worth reaches your FIRE number,
            assuming your current savings rate and expected investment returns continue.
          </p>
          <ul className={ul}>
            <li><strong>Shows 0:</strong> you've already reached your FIRE number</li>
            <li><strong>Shows N years:</strong> estimated time to reach FIRE at your current pace</li>
          </ul>
          <p className="mt-2">
            Increase your savings rate or expected returns to bring this number down.
          </p>
        </>
      ),
    },
    {
      question: 'What is Coast FIRE?',
      answer: (
        <>
          <p>
            The portfolio size where, even if you <strong>stop saving entirely</strong>,
            compound growth alone will reach your FIRE number by retirement age.
          </p>
          <p className="mt-2">
            Once you hit Coast FIRE, you only need to earn enough to cover current expenses —
            your investments do the rest.
          </p>
          <p className={tip}>
            Coast FIRE number depends on your expected return and years to retirement. The
            Dashboard shows whether you've reached it.
          </p>
        </>
      ),
    },
    {
      question: 'What is the What-If panel?',
      answer: (
        <>
          <p>
            An interactive scenario explorer with 6 sliders. Adjust any variable to instantly
            see how it affects your plan:
          </p>
          <ul className={ul}>
            <li>Annual Expenses, Annual Income</li>
            <li>SWR, Expected Return</li>
            <li>Retirement Age, Liquid Net Worth</li>
          </ul>
          <p className="mt-2">
            The delta summary shows the change in FIRE Number, Years to FIRE, FIRE Age, and
            Portfolio at Retirement compared to your current inputs.
          </p>
          <p className={tip}>
            Changes here are for exploration only — they don't modify your saved inputs.
          </p>
        </>
      ),
    },
    {
      question: 'What is One More Year analysis?',
      answer: (
        <>
          <p>
            Shows the financial impact of <strong>working one more year</strong> beyond your
            planned retirement age:
          </p>
          <ul className={ul}>
            <li>Extra savings from one more year of income</li>
            <li>Additional portfolio growth (one more year compounding)</li>
            <li>One fewer year of withdrawals needed</li>
            <li>Net impact on portfolio at life expectancy</li>
          </ul>
          <p className="mt-2">
            This helps you evaluate whether delaying retirement by a year significantly
            improves your financial security.
          </p>
        </>
      ),
    },
  ],

  '/health-check': [
    {
      question: 'What is the Financial Health Check?',
      answer: (
        <>
          <p>
            The Health Check evaluates <strong>8 financial health ratios</strong> and estimates
            insurance coverage gaps. It gives you a quick snapshot of how well your finances
            are balanced across savings, debt, liquidity, and protection.
          </p>
          <p className={tip}>
            Emergency fund should cover 3-6 months of expenses in accessible cash.
          </p>
        </>
      ),
    },
    {
      question: 'What are the TDSR thresholds?',
      answer: (
        <>
          <p>
            The tool uses two debt-service thresholds: <strong>35%</strong> (healthy) and{' '}
            <strong>50%</strong> (caution) of gross income. These are personal finance targets,
            not the MAS regulatory limit of 60%.
          </p>
          <ul className={ul}>
            <li><strong>Below 35%:</strong> healthy debt load</li>
            <li><strong>35-50%:</strong> manageable but watch for increases</li>
            <li><strong>Above 50%:</strong> high risk, consider reducing debt</li>
          </ul>
        </>
      ),
    },
    {
      question: 'How are insurance needs estimated?',
      answer: (
        <>
          <p>Two methods are provided:</p>
          <ul className={ul}>
            <li>
              <strong>MoneySense multiples:</strong> quick estimate using 9x annual income for death
              coverage and 4x for critical illness
            </li>
            <li>
              <strong>Capital Needs Analysis:</strong> detailed breakdown based on income replacement,
              outstanding debts, dependants, and existing coverage
            </li>
          </ul>
          <p className={tip}>
            Insurance gaps show the difference between your current coverage and estimated needs.
          </p>
        </>
      ),
    },
  ],

  '/reference': [],
  '/checklist': [],
}
