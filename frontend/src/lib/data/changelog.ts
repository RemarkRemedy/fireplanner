export interface ChangelogEntry {
  date: string
  title: string
  description: string
  category: 'data-update' | 'feature' | 'fix'
  /** Optional section IDs for section-level nudges (e.g., 'section-cpf') */
  affectedSections?: string[]
  /** Optional deeper explanation of why this change matters */
  insight?: string
}

/** Newest first. */
export const CHANGELOG: ChangelogEntry[] = [
  {
    date: '2026-03-04',
    category: 'feature',
    title: 'Asset Breakdown column group in projection tables',
    description:
      'A new "Asset Breakdown" toggle in the Projection and Stress Test tables shows per-asset-class dollar values and weight percentages for each year. Zero-weight assets are auto-hidden. When CPF Virtual Rebalancing is active, effective weights are marked with * and a separate "Tgt%" column shows the original target allocation for comparison.',
    affectedSections: ['section-projection'],
    insight:
      'With CPF Virtual Rebalancing enabled, your liquid portfolio runs at different weights than your target allocation because uninvested CPF balances act as bond exposure. The effective (%) column shows what the liquid portfolio actually held, while the Tgt% column shows your intended allocation. The difference is the CPF bond substitution effect.',
  },
  {
    date: '2026-03-03',
    category: 'feature',
    title: 'Glide path allocation wired into all simulation engines',
    description:
      'Monte Carlo (parametric and bootstrap), historical backtest, and sequence risk stress tests now use per-year allocation weights from the glide path instead of a single static allocation. A new buildYearlyWeights() helper converts the glide path into a year-indexed vector that each engine consumes, ensuring asset-mix shifts are reflected in every simulation path.',
    affectedSections: ['section-allocation', 'section-stress-test'],
    insight:
      'Previously, glide path allocation only affected the deterministic projection. Simulations assumed a fixed weight vector for the entire horizon, which overstated equity exposure in late retirement for anyone with a declining equity glide path. Now the allocation gracefully shifts year by year across all engines.',
  },
  {
    date: '2026-03-03',
    category: 'feature',
    title: 'CPF PR graduated contribution rates and foreigner support',
    description:
      'CPF contributions now follow the Permanent Resident graduated schedule: Year 1 (9% total), Year 2 (24% total), and Year 3+ (full citizen rates). Foreigners receive zero CPF contributions. A new "PR months" input appears when residency is set to PR, letting users specify how long they have held PR status.',
    affectedSections: ['section-cpf', 'section-personal'],
    insight:
      'Singapore PRs do not receive full CPF contributions immediately. During the first two years, employer and employee contribution rates are lower, which significantly reduces OA/SA/MA accumulation. Modelling this correctly matters for recent PRs planning to buy property with CPF or targeting FRS.',
  },
  {
    date: '2026-03-03',
    category: 'fix',
    title: 'Post-retirement income integrated into backtest engine',
    description:
      'The historical backtest engine now subtracts post-retirement income (CPF LIFE payouts, rental income, part-time work) from the gross withdrawal before drawing from the portfolio. This matches the existing behaviour in Monte Carlo and sequence risk engines, reducing over-withdrawal in backtest results for users with retirement income streams.',
    affectedSections: ['section-stress-test'],
    insight:
      'Without this fix, the backtest engine treated the full withdrawal amount as coming from the portfolio, ignoring any retirement income that would offset it. Users with CPF LIFE or rental income saw artificially low backtest survival rates compared to Monte Carlo results.',
  },
  {
    date: '2026-03-03',
    category: 'fix',
    title: 'Removed vestigial existingRentalIncome field',
    description:
      'The property store\'s existingRentalIncome field was never read by any calculation or UI component. It has been removed from the store interface and migration upgraded to version 10 to clean up the dead field from persisted state.',
    affectedSections: ['section-property'],
  },
  {
    date: '2026-03-03',
    category: 'fix',
    title: 'CPF estimator now caps MA at Basic Healthcare Sum',
    description:
      'The CPF balance estimator now enforces the BHS cap during the year-by-year simulation. When MA exceeds the BHS for the simulated age, the excess automatically overflows to SA — matching actual CPF Board rules. Previously the estimator accumulated MA without limit, producing unrealistically high MA balances.',
    affectedSections: ['section-cpf'],
    insight:
      'The Basic Healthcare Sum (BHS) is $73,100 in 2025 and grows 4.5% per year, freezing at the value when you turn 65. In practice, once your MA hits BHS each year, subsequent MA contributions are redirected to your SA. This overflow is a significant source of SA growth for higher-income earners.',
  },
  {
    date: '2026-03-03',
    category: 'feature',
    title: 'CPF balances are now editable with BHS validation',
    description:
      'CPF OA, SA, RA, and MA balances can now be directly edited after estimation. A "Clear" link resets all balances to $0. The MA input validates against the current Basic Healthcare Sum — values exceeding the BHS are flagged with an inline error.',
    affectedSections: ['section-cpf'],
  },
  {
    date: '2026-03-03',
    category: 'fix',
    title: 'Removed "Include SA excess above FRS" toggle',
    description:
      'The SA account is closed at age 55 when balances transfer to the Retirement Account (RA). The toggle to include SA excess above FRS in auto-withdrawal was misleading for post-55 users and has been removed from the CPF section.',
    affectedSections: ['section-cpf'],
  },
  {
    date: '2026-03-02',
    category: 'feature',
    title: 'CPF LIFE bequest shown on projection chart',
    description:
      'The net worth projection chart now shows CPF LIFE bequest value as a separate light-green stacked area. Previously, annuitizing your RA into CPF LIFE caused a jarring visual cliff in the chart. The bequest area fills the gap, gradually declining as payouts accumulate. Tooltip shows the exact bequest value at each age.',
    affectedSections: ['section-projection'],
    insight:
      'CPF LIFE bequest is the unused premium returned to beneficiaries if the annuitant passes away. For Standard plan, the full RA is annuitized at the start age and the bequest equals the premium minus cumulative payouts received. After ~15 years of payouts, the bequest reaches $0, meaning CPF LIFE has paid for itself.',
  },
  {
    date: '2026-03-02',
    category: 'feature',
    title: 'CPF balance estimator from age and salary',
    description:
      'A new "Estimate from your age & salary" button in the CPF section back-projects your OA/SA/MA balances based on your current age and salary, assuming career start at 22 with 3% annual salary growth. Uses actual CPF contribution rates and age-bracket allocation rules.',
    affectedSections: ['section-cpf'],
    insight:
      'CPF had the highest section reset rate in analytics because most users don\'t know their exact OA/SA/MA split. This one-click estimate gives a reasonable starting point with BHS cap enforcement and SA overflow. Users should still refine with their actual CPF statement for age-55 RA transfer amounts.',
  },
  {
    date: '2026-03-02',
    category: 'feature',
    title: 'Mobile quick mode for first-time users',
    description:
      'First-time mobile visitors now see a streamlined 4-section view (Personal, Income, Expenses, Net Worth) instead of all 8 sections. An expander card reveals CPF, Property, Healthcare, and more. Quick mode auto-activates for mobile users with default profile values.',
    affectedSections: ['section-personal', 'section-income', 'section-expenses', 'section-net-worth'],
  },
  {
    date: '2026-03-02',
    category: 'feature',
    title: 'Inline FIRE CTA on inputs page',
    description:
      'A contextual card between the 3rd and 4th input sections shows your current FIRE age and number with a link to the full projection. Dismissible per session.',
    affectedSections: ['section-projection'],
  },
  {
    date: '2026-03-02',
    category: 'feature',
    title: 'Welcome banner for deep-linked visitors',
    description:
      'First-time visitors who land directly on the inputs page now see a blue info banner explaining what the tool is, with a link to the guided setup. Only shows when all profile fields are at defaults.',
  },
  {
    date: '2026-03-02',
    category: 'feature',
    title: 'Streamlined onboarding flow',
    description:
      'The "Continue to planning" button is now "Build my full plan" with a subtitle listing key features. Section toggles moved below the CTA. Users with expenses exceeding income see a helpful message instead of broken Infinity values.',
  },
  {
    date: '2026-03-02',
    category: 'feature',
    title: 'Email prompt moved to post-value moment',
    description:
      'First-time visitors no longer see an email signup form on the landing page. The email capture now appears at the bottom of the Projection page after users have seen their full year-by-year trajectory. Returning users still see it on the landing page.',
  },
  {
    date: '2026-03-02',
    category: 'fix',
    title: 'Projection chart Y-axis formatting and interpolation',
    description:
      'Y-axis ticks now show $1.5M instead of $1500k for values above $1M. Chart interpolation changed from monotone cubic to linear to prevent visual overlap artifacts at the CPF LIFE enrollment transition.',
    affectedSections: ['section-projection'],
  },
  {
    date: '2026-03-01',
    category: 'feature',
    title: 'Life events inline configurator with adjustable parameters',
    description:
      'The life events configurator now expands inline below the event chips bar instead of opening a side panel. All scenario parameters are adjustable via sliders: income level (0-100%), expense reduction (0-50%), additional annual expenses ($0-60K/yr), and one-time costs ($0-30K). The healthcare cost tier toggle (Subsidised/Private) now acts as a preset that pre-fills the cost sliders, and only appears for health and family scenarios. Career scenarios (Job Loss, Recession Pay Cut) now include a default expense reduction (10-20%) reflecting natural spending cuts during income disruption.',
    affectedSections: ['section-stress-test'],
    insight:
      'Templates provide sensible defaults from Singapore government data (MOM, MOH, SingStat), but everyone\'s situation is different. The sliders let you customize: maybe your employer offers 3 months severance (set income to 100% for the first year), or you have a large emergency fund that covers medical costs (set lump sum to $0). The delta cards update in real time as you drag.',
  },
  {
    date: '2026-03-01',
    category: 'feature',
    title: 'Portfolio trajectory chart on Dashboard',
    description:
      'The Dashboard now shows a portfolio trajectory chart plotting your projected net worth from today through retirement. The Projection page chart has been moved above the table for better visibility.',
    affectedSections: ['section-dashboard'],
  },
  {
    date: '2026-03-01',
    category: 'feature',
    title: 'Returning-user guidance and preliminary-results banner',
    description:
      'Returning users now see an amber banner on the Start page confirming they can safely switch paths or modes, with a direct link to the Dashboard. The Dashboard shows a preliminary-results advisory encouraging users to verify numbers in Projection and Stress Test. The advisory automatically disappears once you run your first simulation.',
    affectedSections: ['section-dashboard'],
  },
  {
    date: '2026-02-28',
    category: 'fix',
    title: 'CPF voluntary top-up calculations corrected',
    description:
      'Voluntary SA top-ups near the Full Retirement Sum were overstating tax relief and cash outflow. The RSTU tax deduction and savings calculation now use the actual capped amount deposited, not the full requested amount. Post-55 users routing SA top-ups to RA now correctly receive RSTU relief on the RA portion. Stale detection for Monte Carlo and Sequence Risk simulations also fixed to invalidate cached results when bonus months or retirement portfolio change.',
    affectedSections: ['section-cpf', 'section-income'],
    insight:
      'If your SA was $213K with FRS at $220K, requesting an $8K top-up only deposited ~$7K. The old code gave you $8K in tax relief and subtracted $8K from cash savings. Post-55, the SA top-up routes to RA instead, and the RA portion now correctly qualifies for RSTU relief (up to $8K cap).',
  },
  {
    date: '2026-02-28',
    category: 'feature',
    title: 'Bonus Months (AWS)',
    description:
      'Model your annual bonus as a number of months (e.g. 2.0 = 2 months AWS). Bonus is treated as Additional Wages for CPF, subject to the $102K annual ceiling. The "Annual Salary" field now clarifies it represents base salary only (12 months), excluding bonus.',
    affectedSections: ['section-income', 'section-cpf'],
    insight:
      'Singapore CPF treats bonus differently from regular salary. Ordinary Wages (OW) are capped at $8K/month ($96K/year from Jan 2026). Additional Wages like AWS are subject to a separate ceiling: $102K minus total OW for the year. This means high earners may not get full CPF contributions on their bonus.',
  },
  {
    date: '2026-02-28',
    category: 'feature',
    title: 'Explore + Stress Test redesign',
    description:
      'The navigation has been restructured into EXPLORE and ANALYSIS sections. The Withdrawal Strategies page now has its own Monte Carlo simulation tab for decumulation-only testing with a My Plan balance toggle. The Stress Test page now always uses your actual portfolio (My Plan) and adds a new "Expected vs Random" pre-retirement returns toggle to control whether accumulation uses average returns or randomized returns.',
    affectedSections: ['section-stress-test', 'section-withdrawal'],
    insight:
      'The old "My Plan / FIRE Target" toggle coupled two independent concerns: starting balance and stochastic vs deterministic pre-retirement returns. The redesign separates them: Withdrawal Strategies handles balance exploration (My Plan vs FIRE Target), while Stress Test focuses on simulation methodology (Expected vs Random pre-retirement returns).',
  },
  {
    date: '2026-02-28',
    category: 'feature',
    title: 'MC Projection Table',
    description:
      'The Stress Test page now includes a Projection Table tab that shows year-by-year portfolio, income, expenses, CPF, and tax projections driven by Monte Carlo representative paths. Switch between P10/P25/P50/P75/P90 percentiles to see how different market outcomes affect your financial trajectory. Pre-retirement rows use deterministic projections; post-retirement rows use the selected MC path.',
    affectedSections: ['section-stress-test'],
    insight:
      'Rather than showing 10,000 paths, the table picks 5 representative simulations closest to each percentile\'s terminal wealth. Switching percentiles changes portfolio and withdrawal columns but keeps income, CPF, and tax identical since those are deterministic.',
  },
  {
    date: '2026-02-28',
    category: 'feature',
    title: 'Pre-retirement returns: Expected vs Random with educational guide',
    description:
      'The pre-retirement returns toggle now uses plain labels ("Expected" and "Random" instead of "Stochastic") with inline helper text explaining what each mode does. An expandable "Learn more" section includes a comparison table, a note on volatility drag, and guidance on how to interpret your results when comparing both modes.',
    affectedSections: ['section-stress-test'],
    insight:
      'Expected mode uses the arithmetic mean return, which is slightly optimistic due to volatility drag (an 8% mean with 15% volatility compounds at ~6.9%). Random mode is the more complete analysis that captures pre-retirement sequence risk. If Expected shows high success but Random is much lower, pre-retirement market risk is your bottleneck.',
  },
  {
    date: '2026-02-28',
    category: 'fix',
    title: 'Simulation controls layout and consistency improvements',
    description:
      'Replaced the Radix ToggleGroup with pill-style toggles matching the rest of the site. Moved "My Expenses / Custom Rate" above the strategy parameters so the high-level basis choice comes before the rate fields. SWR and initial rate fields are now greyed out when "My Expenses" is selected since the rate is unused in that mode.',
    affectedSections: ['section-stress-test', 'section-withdrawal'],
  },
  {
    date: '2026-02-27',
    category: 'fix',
    title: 'FIRE Target mode disabled (incorrect simulation horizon)',
    description:
      'The FIRE Target analysis mode has been temporarily disabled on both Withdrawal and Stress Test pages. The simulation was using the profile retirement age (e.g. 65) as the start instead of the calculated FIRE age (e.g. 42), testing the FIRE number over a much shorter period than it was designed for. This produced artificially high success rates. Users who had FIRE Target selected are automatically switched to My Plan mode.',
    affectedSections: ['section-stress-test', 'section-withdrawal'],
    insight:
      'A FIRE number of $2.1M sized for 48 years of withdrawals (age 42→90) was being tested over only 25 years (age 65→90). The portfolio was nearly 2x oversized for that shorter period, so the simulation always showed ~100% success with large terminal values.',
  },
  {
    date: '2026-02-27',
    category: 'feature' as const,
    title: 'Withdrawal Basis Toggle',
    description:
      'New toggle on all simulation and projection pages: choose between "My Expenses" (withdrawals match your planned spending) or "Custom Rate" (withdrawals based on portfolio × strategy rate, e.g. the 4% rule). Previously, changing SWR had no effect on results when expenses were set. A contextual hint nudges you to switch modes when adjusting rate-based strategy parameters in expense mode.',
    affectedSections: ['section-stress-test', 'section-projection'],
    insight:
      'In "Custom Rate" mode, a 3.9% SWR on a $5M portfolio withdraws ~$201K/year. In "My Expenses" mode, your actual planned spending (e.g. ~$99K/year) drives the withdrawal. The same portfolio can show 93.8% vs 100% success rate depending on which basis you use.',
  },
  {
    date: '2026-02-27',
    category: 'fix',
    title: 'CPF OA mortgage shortfall now accounts for contributions',
    description:
      'The year-by-year projection was computing CPF OA mortgage shortfalls before adding your annual OA contributions, causing false shortfalls for employed users whose monthly contributions easily cover the mortgage. The housing deduction now runs after contributions, matching the real monthly co-flow of salary credits and mortgage debits.',
    affectedSections: ['section-cpf', 'section-projection'],
    insight:
      'In real life, CPF contributions and housing deductions both happen monthly. The old code deducted the full year\'s mortgage from the starting OA balance before adding any contributions, so someone with $11,500 OA and a $20,676/yr mortgage would show a $9,176 shortfall even though their $15,120/yr contributions more than cover it.',
  },
  {
    date: '2026-02-26',
    category: 'feature',
    title: 'SEO and social sharing previews',
    description:
      'Link previews now show the correct page title and description when shared on Facebook, Slack, WhatsApp, and Twitter/X. Each route has its own canonical URL, Open Graph tags, and Twitter Card tags. Added robots.txt, sitemap.xml, and structured data for search engines.',
    insight:
      'Social bots don\'t execute JavaScript, so client-side meta tag updates were invisible to them. A build-time pre-rendering step now generates a static index.html per route with the correct tags baked in. No SSR needed.',
  },
  {
    date: '2026-02-26',
    category: 'fix',
    title: 'Accessibility and input UX improvements',
    description:
      'Touch targets enlarged to 44px minimum across tooltips, dialog close buttons, gear menus, and pill buttons. ARIA roles added to tab-like controls. Number, currency, and percentage inputs now show validation errors only after you leave the field, not while typing. Feature toggles upgraded to proper switch controls, checkboxes to shadcn components, and the ownership percentage slider to a proper slider control.',
    insight:
      'The 44px minimum comes from WCAG 2.5.8 (Target Size). Blur-only validation prevents the frustrating pattern where an error flashes while you\'re still typing a valid number.',
  },
  {
    date: '2026-02-26',
    category: 'fix',
    title: 'Mobile layout and navigation fixes',
    description:
      'Bottom navigation now shows Withdrawal instead of Guide for faster access to a key page. Comparison table hides less-useful columns (Max, Std Dev, Total Withdrawn) on small screens. SWR heatmap scrolls horizontally. Income and life event name inputs use full width. Expense adjustments and locked assets grids switch to card layout on mobile.',
  },
  {
    date: '2026-02-26',
    category: 'feature',
    title: 'Residency status for tax calculations',
    description:
      'Added a residency status field (Citizen, PR, Foreigner) to the Personal section. A tooltip on marital status explains how it affects tax reliefs.',
    affectedSections: ['section-personal'],
  },
  {
    date: '2026-02-26',
    category: 'fix',
    title: 'Input page state now persists across sessions',
    description:
      'Collapsed sections and the "add new property" panel state are now saved to localStorage, so the Inputs page remembers your layout when you return.',
  },
  {
    date: '2026-02-26',
    category: 'feature',
    title: 'Usage analytics for feature insights',
    description:
      'Added anonymous event tracking across 22 interaction points using Umami. Tracks onboarding flow, simulation usage, feature toggles, data import/export, sharing, and strategy selection to understand which features people use and where they get stuck.',
    insight:
      'No new dependencies or data collection. Uses the existing Umami script tag already in index.html. Events are no-ops when Umami is blocked or unavailable.',
  },
  {
    date: '2026-02-26',
    category: 'fix',
    title: 'Share links now work correctly',
    description:
      'Shared plan URLs containing certain characters were silently failing to import, showing no error or import dialog. The share link feature now reliably decodes all plan data.',
    insight:
      'The compression library uses + as a literal character in its output, but the URL parser was decoding + as a space (per the HTML form encoding spec), corrupting the data before decompression.',
  },
  {
    date: '2026-02-26',
    category: 'feature',
    title: 'Mobile share button',
    description:
      'A floating Share button now appears on mobile devices, giving one-tap access to the native share sheet (AirDrop, iMessage, email, copy link). A tooltip explains the feature on your first visit.',
  },
  {
    date: '2026-02-26',
    category: 'fix',
    title: 'Share button tooltip now appears reliably on first visit',
    description:
      'The share button onboarding tooltip could occasionally fail to display due to a rendering timing issue. It now initializes correctly on the first page load.',
  },
  {
    date: '2026-02-26',
    category: 'fix',
    title: 'Monte Carlo and Sequence Risk simulations now match projection accuracy',
    description:
      'MC accumulation previously used raw annualSavings, missing 10 financial components (mortgage payments, parent support, healthcare, income shortfalls, financial goals, CPF OA shortfalls, downsizing rent, CPF OA withdrawals, locked asset unlocks, and HDB rental income scaling by ownership %). Sequence Risk was missing post-retirement mortgage deductions and downsizing equity injections. Both engines now mirror projection.ts calculations exactly.',
    affectedSections: ['section-property'],
    insight:
      'For users with mortgages, the old MC would overestimate the retirement portfolio by ignoring cash mortgage payments during accumulation. For co-owned HDB properties, rental income was counted at 100% instead of the ownership share. A double-counting warning now appears if both HDB subletting and a rental income stream are active.',
  },
  {
    date: '2026-02-26',
    category: 'fix',
    title: 'MediSave BHS now grows annually and freezes at age 65',
    description:
      'The Basic Healthcare Sum (MediSave cap) was frozen at $79,000 for all projection years. BHS now grows at 4.5% per year (based on 2013-2026 historical CAGR of ~4.7%) and permanently freezes at each member\'s age 65 cohort value, matching CPF Board policy.',
    affectedSections: ['section-cpf'],
    insight:
      'With a static $79K cap, overflow to SA/RA/OA started too early in multi-decade projections, overstating retirement account balances. The growing BHS also means MA interest (4%) no longer overflows for under-65 members since BHS growth (4.5%) outpaces the interest rate.',
  },
  {
    date: '2026-02-26',
    category: 'fix',
    title: 'HDB subletting income now included in Monte Carlo and stress tests',
    description:
      'HDB subletting rental income was missing from Monte Carlo survival rate calculations and sequence risk stress tests, making results pessimistic for users with room rentals. All simulation engines now include this income, and rental income correctly stops after a downsizing sale.',
    affectedSections: ['section-property'],
    insight:
      'Three separate files were independently summing post-retirement income components. When HDB subletting was added to the projection engine, the simulation hooks were never updated. We extracted a shared helper to prevent this class of bug from recurring.',
  },
  {
    date: '2026-02-26',
    category: 'feature',
    title: 'Privacy-friendly analytics added',
    description:
      'Added self-hosted Umami analytics to understand which features people actually use. No cookies, no personal data, no third-party tracking. The analytics server runs on our own infrastructure and all data stays under our control.',
    insight:
      'We chose Umami over Google Analytics specifically to keep our privacy-first promise. The tracking script loads from our own subdomain, so it is not blocked by ad blockers like third-party analytics scripts would be.',
  },
  {
    date: '2026-02-26',
    category: 'feature',
    title: 'Barista FIRE support: CPF top-ups and SRS during post-FIRE employment',
    description:
      'Voluntary CPF top-ups now continue automatically during post-FIRE working years (when you have employment income). SRS contributions during Barista FIRE are opt-in via a new toggle in the Net Worth section, since lower barista income may make SRS impractical.',
    affectedSections: ['section-net-worth'],
  },
  {
    date: '2026-02-26',
    category: 'fix',
    title: 'CPF contributions now work for Barista FIRE income streams',
    description:
      'Employment income streams added after your retirement age (e.g., a lower-paying job from 45-55 in a Barista FIRE plan) were not generating CPF contributions even with "CPF Applicable" checked. CPF now correctly populates for any active employment stream regardless of your FIRE age.',
    affectedSections: ['section-income'],
    insight:
      'The retirement age in FIRE Planner is your FIRE age, not when you stop working entirely. If you return to work after FIRE, your employment income stream should generate CPF just like any job would.',
  },
  {
    date: '2026-02-26',
    category: 'fix',
    title: 'Post-FIRE employment income now reduces portfolio withdrawals',
    description:
      'Employment income from Barista FIRE jobs was being ignored by the projection engine, Monte Carlo simulations, and sequence risk stress tests. Your portfolio was withdrawing the full expense amount instead of only the gap after employment income. All three engines now correctly account for salary from post-FIRE income streams.',
    affectedSections: ['section-income'],
    insight:
      'This also fixes missing business income and SRS withdrawals in Monte Carlo and sequence risk simulations, which were only counting rental, investment, and government income.',
  },
  {
    date: '2026-02-25',
    category: 'feature',
    title: 'Goal and withdrawal shortfall tracking in projection engine',
    description:
      'The projection engine now computes exact unfunded amounts for financial goals and one-time retirement withdrawals instead of silently clamping the portfolio to zero. When expenses exceed your portfolio, each expense type gets a proportional share of the deficit so you can see precisely how much went unfunded.',
    affectedSections: ['section-fire-settings'],
  },
  {
    date: '2026-02-25',
    category: 'feature',
    title: 'Shortfall warnings on projection table',
    description:
      'The projection page now shows amber warning banners when financial goals or retirement withdrawals cannot be fully funded, with affected ages and total shortfall amounts. Expense columns show a red asterisk on underfunded rows with a tooltip showing the unfunded amount.',
    affectedSections: ['section-fire-settings'],
  },
  {
    date: '2026-02-25',
    category: 'fix',
    title: 'Pre-retirement depletion now highlighted in projection table',
    description:
      'Portfolio depletion caused by large pre-retirement expenses (e.g., property purchases via financial goals) now correctly shows red highlighting on affected rows. Previously only post-retirement depletion was visually flagged.',
    affectedSections: ['section-fire-settings'],
  },
  {
    date: '2026-02-25',
    category: 'fix',
    title: 'Tax-exempt income streams now correctly excluded from tax',
    description:
      'Income streams marked as "Tax-Exempt" were still being taxed. The tax calculation was hardcoded by stream type (rental and business always taxable, investment and government always exempt) instead of reading the tax treatment you selected. Now your tax treatment choice is the single source of truth for every stream type.',
    affectedSections: ['section-income'],
    insight:
      'This also means investment streams marked "Taxable" (e.g., foreign dividends) will now correctly be included in taxable income, and government streams marked "Taxable" will too. Previously the type-based hardcoding overrode your selection in both directions.',
  },
  {
    date: '2026-02-25',
    category: 'fix',
    title: 'Per-stream CPF contribution control now works',
    description:
      'The "CPF Applicable" toggle on employment income streams was being ignored. All employment income generated CPF contributions regardless of the setting. Now only streams with CPF Applicable enabled attract CPF contributions. Your primary salary always generates CPF when employer CPF is enabled.',
    affectedSections: ['section-income'],
    insight:
      'This matters for freelance or contract income added as employment streams. A $40K side income with CPF Applicable off was previously generating ~$14,800 in phantom CPF contributions, inflating your projected CPF balances by $600K+ over a career.',
  },
  {
    date: '2026-02-25',
    category: 'fix',
    title: 'MediSave BHS overflow enforced on contributions and interest',
    description:
      'CPF MediSave (MA) is now capped at the Basic Healthcare Sum ($79,000). Mandatory contributions and interest that would push MA above BHS overflow to SA (pre-55), RA then OA (post-55 pre-LIFE), or OA (post-LIFE), matching CPF Board rules. Previously only voluntary top-ups were capped, causing SA/RA to be underfunded and CPF LIFE payouts underestimated.',
    affectedSections: ['section-cpf'],
    insight:
      'At age 30 with a $120K salary, MA receives ~$9,600/year in contributions. Without the cap, MA would reach $100K+ by age 33 instead of stopping at $79K. The excess now flows to SA at 4% interest instead of sitting in MA at 4%, which doesn\'t change interest earned but does increase the RA transfer at age 55, boosting CPF LIFE payouts.',
  },
  {
    date: '2026-02-25',
    category: 'data-update',
    title: 'CPF contribution rates corrected to 2026',
    description:
      'Senior worker CPF rates updated to reflect the 2023-2027 phased increases. Ages 55-60 now use 34% total (was 29.5%), ages 60-65 use 25% (was 20.5%), ages 65-70 use 16.5% (was 16%). Under-55 allocation now varies by sub-bracket: OA decreases and SA/MA increase as you age from 35 to 55.',
    affectedSections: ['section-cpf'],
    insight:
      'The allocation shift matters for projections: a 50-year-old gets 15% to OA vs 23% for someone under 35, meaning less OA available for housing but faster SA growth at the higher 4% interest rate.',
  },
  {
    date: '2026-02-25',
    category: 'data-update',
    title: 'Historical returns extended to 2025',
    description:
      'Added 2025 data row to historical returns dataset (now 1928-2025, 98 years). Notable 2025 returns: Gold +66.2% (multi-decade record), STI +28.6%, S&P 500 +17.7%, MSCI World +21.4%, US Bonds +7.8%, REITs +2.3%. SG CPI fell to 0.9%.',
    affectedSections: ['section-allocation'],
    insight:
      'Gold\'s 66% return is the largest single-year gain in the dataset. The previous record was 126.6% in 1979 during the Hunt brothers silver squeeze era. This year\'s surge was driven by central bank buying and geopolitical hedging.',
  },
  {
    date: '2026-02-25',
    category: 'data-update',
    title: 'MOM salary benchmarks updated to 2025',
    description:
      'Median gross income by age and education updated to 2025 Labour Force Survey (Table C7, including employer CPF). Degree-holder salaries rose 20-45% across age brackets, reflecting strong post-pandemic wage growth.',
    affectedSections: ['section-income'],
    insight:
      'The 20-24 belowSecondary cell is suppressed in the official 2025 data due to small sample size. An estimate derived from adjacent brackets is used.',
  },
  {
    date: '2026-02-25',
    category: 'feature',
    title: 'Expense adjustments',
    description:
      'Model changing expenses over your lifetime with named adjustments on top of your base spending. Each adjustment has a label, amount, start age, and optional end age. A live "Effective Spending by Phase" preview shows your total at each transition age. Adjustments flow through to every calculation: FIRE metrics, income projections, withdrawal comparisons, dashboard charts, What-If Explorer, One More Year Analysis, Disruption Impact, Stress Test portfolio projections, and Excel export.',
    affectedSections: ['section-expenses'],
    insight:
      'Adjustments use a half-open interval [startAge, endAge) and "ongoing" end ages resolve to lifeExpectancy at computation time, so they stay correct if you change your life expectancy later.',
  },
  {
    date: '2026-02-25',
    category: 'fix',
    title: 'Section reset only clears its own fields',
    description:
      'Reset buttons now only clear the fields displayed in that section, not the entire profile. Previously, clicking reset in CPF or Net Worth would also wipe your age, income, and expenses. The button is now consistently labelled "Reset Section" with a section-specific confirmation dialog.',
  },
  {
    date: '2026-02-25',
    category: 'feature',
    title: 'Expandable changelog in Reference Guide',
    description:
      'The "What\'s New" section in Reference Guide now groups entries by date, lets you expand each entry for details, and shows insight badges for entries with deeper explanations.',
  },
  {
    date: '2026-02-25',
    category: 'fix',
    title: 'Expense adjustment validation layout',
    description:
      'Validation errors in the expense adjustments list no longer break the grid layout or overlap adjacent rows.',
    affectedSections: ['section-expenses'],
  },
  {
    date: '2026-02-25',
    category: 'feature',
    title: 'Projection-derived FIRE number',
    description:
      'Dashboard and FIRE targets now show a projection-derived FIRE number alongside the simple formula when they differ by more than 5%. The projection number accounts for mortgage cash payments, CPF LIFE payouts, and rental income from your year-by-year plan.',
    affectedSections: ['section-fire-settings'],
  },
  {
    date: '2026-02-25',
    category: 'fix',
    title: 'FIRE number dollar-basis normalization',
    description:
      'The projection-derived FIRE number is now normalized to the same dollar basis as the simple FIRE number (today, retirement, or FIRE age dollars). Previously the deviation percentage could be inflated by the inflation gap between the projection year and the formula\'s basis year.',
    affectedSections: ['section-fire-settings'],
  },
  {
    date: '2026-02-25',
    category: 'feature',
    title: 'Property shortfall impacts projections',
    description:
      'When a downsizing sale doesn\'t cover the outstanding mortgage, the shortfall is now deducted from your portfolio in both the projection table and Monte Carlo simulations instead of being silently absorbed.',
    affectedSections: ['section-property'],
  },
  {
    date: '2026-02-25',
    category: 'feature',
    title: 'Property sale shortfall warning',
    description:
      'Downsizing analysis now warns when sale proceeds don\'t cover outstanding costs, showing the exact shortfall amount you would need to bring to settlement.',
    affectedSections: ['section-property'],
  },
  {
    date: '2026-02-25',
    category: 'feature',
    title: 'Retirement withdrawal underfunded warning',
    description:
      'One-time retirement withdrawals now warn when they exceed your available portfolio at the planned age, showing which ages are affected and the total shortfall.',
    affectedSections: ['section-fire-settings'],
  },
  {
    date: '2026-02-25',
    category: 'fix',
    title: 'Mobile UX improvements',
    description:
      'Informational (i) tooltips now work on mobile via tap-to-open popovers. Chart tooltips respond to tap instead of requiring hover. Number inputs trigger the numeric keyboard on mobile. Scenario delete buttons are always visible on touch devices. Pathway tabs and page layout improved for small screens.',
  },
  {
    date: '2026-02-25',
    category: 'fix',
    title: 'Earned income relief adjusts by age',
    description:
      'Earned income relief now only applies when salary or business income exists, and adjusts per-year as you cross age 55/60 brackets instead of being frozen at your current age.',
    affectedSections: ['section-income'],
  },
  {
    date: '2026-02-25',
    category: 'fix',
    title: 'SRS withdrawals visible in cash flow chart',
    description:
      'Cash flow chart now correctly shows SRS drawdowns as a visible series instead of hardcoding them to zero.',
    affectedSections: ['section-fire-settings'],
  },
  {
    date: '2026-02-25',
    category: 'fix',
    title: 'CPF milestones exclude MediSave',
    description:
      'CPF milestone comparisons (BRS/FRS/ERS) now exclude MediSave since MA cannot fund the retirement sum. Milestones trigger at the correct later ages.',
    affectedSections: ['section-cpf'],
  },
  {
    date: '2026-02-25',
    category: 'fix',
    title: 'MediSave depletion now reduces CPF MA',
    description:
      'Healthcare premiums (MediShield Life, ISP, CareShield Life) are now deducted from your MediSave balance in the projection. Previously, cpfMA only grew from contributions and interest but never shrank, overstating your CPF total. The projection summary now also reports MediSave depletion age when applicable.',
    insight:
      'The projectMediSaveTimeline() function existed and was fully tested, but was never called by the projection engine. This is a common "dead code" pattern: a feature is implemented in isolation, passes unit tests, but the integration point is missed. The fix was a single import and 8 lines of wiring code.',
    affectedSections: ['section-cpf'],
  },
  {
    date: '2026-02-25',
    category: 'fix',
    title: 'Locked asset unlocks now increase liquid NW',
    description:
      'Locked assets (employer RSUs, fixed deposits, endowments) that mature at a specific age now correctly flow into your liquid portfolio. Previously, the unlock value was computed but never added to liquidNW, understating your net worth at the unlock age.',
    insight:
      'The income engine computed lockedAssetUnlock per row, but the projection layer (which builds on top of income rows) never included `liquidNW += incomeRow.lockedAssetUnlock`. This meant setting a $100K endowment maturing at age 50 would show the unlock in income breakdowns but leave your portfolio balance unchanged.',
    affectedSections: ['section-net-worth'],
  },
  {
    date: '2026-02-25',
    category: 'feature',
    title: 'SRS and healthcare breakdown in projection table',
    description:
      'The year-by-year projection table now shows SRS balance, contributions, and taxable withdrawals under Income Breakdown, and healthcare premium breakdown (MediShield Life, ISP, CareShield Life, out-of-pocket, MediSave deductible) under Expenses Breakdown. Columns auto-hide when the feature is not enabled.',
    affectedSections: ['section-projection'],
  },
  {
    date: '2026-02-24',
    category: 'feature',
    title: 'Locked Assets',
    description:
      'Track illiquid holdings (employer RSUs, fixed deposits, foreign pensions) that become accessible at a specific age. Each asset grows at a configurable rate, contributes to total net worth but not accessible net worth for FIRE calculations, and flows into your liquid portfolio upon unlocking. Up to 10 locked assets supported.',
    affectedSections: ['section-net-worth'],
  },
  {
    date: '2026-02-24',
    category: 'feature',
    title: 'CPF Voluntary Top-Ups',
    description:
      'Model voluntary contributions to CPF OA, SA, and MA. SA top-ups qualify for RSTU tax relief (up to $8,000 deduction). Top-ups are capped at the Annual Limit ($37,740) and integrate into income projection, CPF balances, and tax calculations.',
    affectedSections: ['section-cpf'],
  },
  {
    date: '2026-02-24',
    category: 'fix',
    title: 'Simulations use actual retirement expenses',
    description:
      'Monte Carlo, backtest, and sequence risk engines now use your actual annual expenses at retirement for the initial withdrawal amount instead of portfolio × SWR. SWR optimizer and backtest heatmap continue to vary withdrawal rate independently for rate-sweeping analysis.',
    affectedSections: ['section-simulation'],
  },
  {
    date: '2026-02-24',
    category: 'fix',
    title: 'Percentage input display precision',
    description:
      'Fixed floating-point noise in percentage inputs (e.g. 1.7000000000000002% now displays correctly as 1.7%).',
  },
  {
    date: '2026-02-24',
    category: 'data-update',
    title: 'Medisave BHS corrected to $79,000',
    description:
      'Basic Healthcare Sum (BHS) updated to $79,000 for 2026. CPF Annual Limit constant ($37,740) added for voluntary top-up cap enforcement.',
    affectedSections: ['section-cpf'],
  },
  {
    date: '2026-02-24',
    category: 'fix',
    title: 'CPF interest uses mid-year approximation',
    description:
      'CPF interest is now computed on mid-year effective balances. Contributions and housing withdrawals are treated as spread evenly through the year, matching real-world monthly CPF mechanics more closely.',
    affectedSections: ['section-cpf'],
  },
  {
    date: '2026-02-24',
    category: 'feature',
    title: 'Dynamic property value in projection',
    description:
      'Property value now appreciates year-over-year at your configured rate. Leasehold properties optionally depreciate via Bala\'s Table curve as the remaining lease shortens (toggle on/off). Mortgage balance amortizes realistically. Mortgage cash payment appears as a default projection column, and a new Property column group shows property value, outstanding mortgage, equity, and total NW including property.',
    affectedSections: ['section-property'],
  },
  {
    date: '2026-02-24',
    category: 'feature',
    title: 'CPFIS invested amounts and additional return in projections',
    description:
      'Year-by-year CPF and income projection tables now show CPFIS-OA, CPFIS-SA (amounts above $20K/$40K retention invested at your custom rates), and CPFIS Add. Return (extra interest earned vs standard CPF rates). Columns appear only when CPFIS is enabled.',
    affectedSections: ['section-cpf'],
  },
  {
    date: '2026-02-24',
    category: 'feature',
    title: 'CPF OA Withdrawal modelling',
    description:
      'Model lump-sum withdrawals from CPF OA after age 55. Withdrawn amounts transfer into your liquid portfolio, improving post-retirement cashflow.',
    affectedSections: ['section-cpf'],
  },
  {
    date: '2026-02-24',
    category: 'feature',
    title: 'CPFIS (CPF Investment Scheme)',
    description:
      'Enable CPFIS to model investing CPF OA/SA balances above retention limits ($20K OA, $40K SA) at custom return rates. CPFIS automatically reverts to standard rates after age 55 when SA closes.',
    affectedSections: ['section-cpf'],
  },
  {
    date: '2026-02-24',
    category: 'fix',
    title: 'Mortgage now ends after loan term',
    description:
      'Mortgage payments in the projection now correctly stop after the remaining loan tenure instead of running forever. Fractional years (e.g. 25 years 3 months) are handled by rounding up.',
    affectedSections: ['section-property'],
  },
  {
    date: '2026-02-24',
    category: 'fix',
    title: 'CPF OA shortfall spills to cash expenses',
    description:
      'When your CPF OA is depleted and can no longer cover its share of mortgage payments, the shortfall now correctly increases your cash expenses and portfolio drawdown.',
    affectedSections: ['section-property'],
  },
  {
    date: '2026-02-24',
    category: 'fix',
    title: 'CPF SA excess at age 55 preserved',
    description:
      'When your SA balance exceeds the retirement sum at age 55, the excess now correctly transfers to OA instead of disappearing.',
    affectedSections: ['section-cpf'],
  },
  {
    date: '2026-02-24',
    category: 'feature',
    title: 'Update notifications',
    description:
      'You\'ll now see a banner when regulatory data or app features change. Section-level nudges highlight exactly which inputs to review. See the full changelog under Reference Guide > What\'s New.',
  },
  {
    date: '2026-02-24',
    category: 'data-update',
    title: 'CPF retirement sums updated to 2026',
    description:
      'BRS/FRS/ERS base values updated to 2026 published figures. Year-offset projection bug fixed.',
    affectedSections: ['section-cpf'],
  },
  {
    date: '2026-02-24',
    category: 'data-update',
    title: 'Default SWR lowered from 4.0% to 3.6%',
    description:
      'Safe withdrawal rate default lowered to 3.6% using forward-looking return estimates instead of full historical averages. Your existing SWR setting is preserved.',
    affectedSections: ['section-fire-settings'],
  },
  {
    date: '2026-02-24',
    category: 'data-update',
    title: 'Forward-looking return estimates',
    description:
      'Asset class expected returns now use forward-looking estimates rather than full historical averages, reflecting current market conditions.',
    affectedSections: ['section-allocation'],
  },
  {
    date: '2026-02-24',
    category: 'feature',
    title: 'Source citations in tooltips',
    description:
      'Regulatory value tooltips now cite the official source (IRAS, CPF Board, MOM) with clickable links to the relevant government pages.',
  },
  {
    date: '2026-02-24',
    category: 'feature',
    title: 'Property co-ownership support',
    description:
      'Set your ownership percentage to see proportionally scaled property values, mortgage deductions, and CPF OA housing usage.',
    affectedSections: ['section-property'],
  },
  {
    date: '2026-02-24',
    category: 'feature',
    title: 'Financial goals tracking',
    description:
      'Add one-off financial goals (wedding, renovation, education) with target dates and amounts. Goals appear as expense spikes in your projection.',
    affectedSections: ['section-fire-settings'],
  },
  {
    date: '2026-02-24',
    category: 'feature',
    title: 'CPF projection detail columns',
    description:
      'Projection table now shows OA/SA balances, contributions, and OA shortfall columns. CPF assumptions panel shows exact rates used.',
  },
  {
    date: '2026-02-24',
    category: 'feature',
    title: 'Robust JSON import with validation',
    description:
      'Import now validates data against schemas and runs store migrations automatically. Structured error reporting shows exactly what was imported or skipped.',
  },
  {
    date: '2026-02-24',
    category: 'feature',
    title: 'Portfolio depletion warning',
    description:
      'Start page and Dashboard now warn when your portfolio is projected to run out before life expectancy.',
  },
  {
    date: '2026-02-24',
    category: 'fix',
    title: 'Number input clamping',
    description:
      'Keyboard input and blur now correctly clamp values to min/max ranges instead of allowing out-of-bounds entries.',
  },
]

/** Bump this string whenever any data file is updated. Triggers the banner for returning users. */
export const DATA_VINTAGE = '2026-03-02'
