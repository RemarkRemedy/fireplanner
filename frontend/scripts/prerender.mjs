/**
 * Post-build prerender script.
 *
 * Reads dist/index.html as a template and writes route-specific copies with
 * correct <title>, meta description, canonical, OG, and Twitter tags baked in.
 * Social bots (Facebook, Slack, WhatsApp, Twitter/X) don't execute JavaScript,
 * so they need these tags in the static HTML.
 *
 * No new dependencies -- pure Node fs/path.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const distDir = join(__dirname, '..', 'dist')
const BASE_URL = 'https://sgfireplanner.com'

// Route meta map -- matches usePageMeta calls in each page component exactly
const routes = [
  {
    path: '/retirement-planner',
    title: 'Singapore FIRE Retirement Planner: CPF, SRS & Property in One Free Tool',
    heading: 'Singapore FIRE Retirement Planner',
    description: 'Free FIRE retirement planner for Singapore. Model CPF, SRS, property equity, taxes, and 12 withdrawal strategies. See when you can retire and how to make your money last.',
    bodyHtml: `
      <p>Build a Singapore retirement plan that covers CPF, CPF LIFE, SRS, spending, portfolio withdrawals, and downside scenarios.</p>
      <p>Use the planner to answer when you can retire, how much CPF supports your retirement income, and how resilient your drawdown plan is.</p>
      <ul>
        <li><a href="/">Start planning</a></li>
        <li><a href="/retirement-calculator">Singapore retirement calculator</a></li>
        <li><a href="/stress-test">Monte Carlo stress testing</a></li>
      </ul>
    `,
  },
  {
    path: '/retirement-calculator',
    title: 'FIRE Calculator Singapore: Find Your Retirement Number and Timeline',
    heading: 'FIRE Calculator for Singapore',
    description: 'Free FIRE calculator for Singapore. Calculate your FIRE number, estimate your retirement age, and project your net worth with CPF, SRS, and investment returns built in.',
    bodyHtml: `
      <p>Estimate how much you may need for retirement in Singapore, then validate the result with CPF timing, withdrawal assumptions, and market stress tests.</p>
      <p>This calculator is designed to turn a quick estimate into a full plan instead of stopping at a single portfolio target.</p>
      <ul>
        <li><a href="/">Start calculating</a></li>
        <li><a href="/retirement-planner">Singapore retirement planner</a></li>
        <li><a href="/reference">Retirement planning reference guide</a></li>
      </ul>
    `,
  },
  {
    path: '/inputs',
    title: 'FIRE Plan Inputs \u2014 Income, Expenses, CPF & Portfolio Setup',
    heading: 'Plan Your Singapore Retirement Inputs',
    description: 'Set up your income, expenses, CPF contributions, investment portfolio, and retirement assumptions. All calculations run in your browser with Singapore-specific defaults.',
    bodyHtml: `
      <p>Configure the key inputs for your Singapore retirement plan: salary and income streams, monthly expenses and goals, CPF contribution rates by age bracket, net worth and portfolio allocation across 8 asset classes.</p>
      <p>Every input has Singapore-specific defaults (MOM salary benchmarks, CPF rates, 2.5% inflation) so you can start with sensible values and refine from there.</p>
      <ul>
        <li><a href="/">Back to start</a></li>
        <li><a href="/projection">View your year-by-year projection</a></li>
        <li><a href="/reference">CPF rates and tax bracket reference</a></li>
      </ul>
    `,
  },
  {
    path: '/projection',
    title: 'Retirement Projection \u2014 Year-by-Year Net Worth & CPF Forecast',
    heading: 'Year-by-Year Retirement Projection',
    description: 'See your net worth trajectory from today to retirement and beyond. Tracks portfolio growth, CPF OA/SA/MA balances, income changes, and spending year by year.',
    bodyHtml: `
      <p>View a detailed year-by-year table showing how your net worth, CPF balances, and portfolio evolve from today through retirement and beyond.</p>
      <p>The projection accounts for salary growth, CPF contribution rate changes by age bracket, investment returns across 8 asset classes, inflation, and planned life events.</p>
      <ul>
        <li><a href="/inputs">Adjust your plan inputs</a></li>
        <li><a href="/stress-test">Run Monte Carlo stress tests</a></li>
        <li><a href="/withdrawal">Compare withdrawal strategies</a></li>
      </ul>
    `,
  },
  {
    path: '/withdrawal',
    title: '12 Retirement Withdrawal Strategies Compared \u2014 Singapore FIRE Planner',
    heading: 'Compare 12 Retirement Withdrawal Strategies',
    description: 'Compare the 4% rule, VPW, Guyton-Klinger guardrails, CAPE-based, Vanguard Dynamic, and 7 more withdrawal strategies side by side with your actual numbers.',
    bodyHtml: `
      <p>Not sure how to draw down your retirement portfolio? Compare 12 evidence-based withdrawal strategies using your own financial inputs:</p>
      <ul>
        <li>Constant Dollar (the classic 4% rule)</li>
        <li>Variable Percentage Withdrawal (VPW)</li>
        <li>Guyton-Klinger Guardrails</li>
        <li>Vanguard Dynamic Spending</li>
        <li>CAPE-Based Withdrawal</li>
        <li>Floor-and-Ceiling</li>
        <li>Percent of Portfolio</li>
        <li>1/N Remaining Years</li>
        <li>Sensible Withdrawals</li>
        <li>95% Rule</li>
        <li>Endowment (Yale Model)</li>
        <li>Hebeler Autopilot II</li>
      </ul>
      <p>Each strategy shows annual income, portfolio balance over time, and risk of depletion.</p>
      <ul>
        <li><a href="/stress-test">Stress test your chosen strategy</a></li>
        <li><a href="/reference">How each strategy works</a></li>
      </ul>
    `,
  },
  {
    path: '/stress-test',
    title: 'Monte Carlo Retirement Simulator \u2014 Backtest & Stress Test Your Plan',
    heading: 'Monte Carlo Simulation, Backtesting & Stress Testing',
    description: 'Run 10,000 Monte Carlo simulations, historical rolling-window backtests, and sequence-of-returns stress tests on your Singapore retirement plan.',
    bodyHtml: `
      <p>Test whether your retirement plan survives real-world uncertainty:</p>
      <ul>
        <li><strong>Monte Carlo simulation</strong> \u2014 10,000 randomized paths using parametric, historical bootstrap, or fat-tail (Student-t) methods</li>
        <li><strong>Historical backtesting</strong> \u2014 Bengen-style rolling window analysis across 98 years of market data (1928\u20132025)</li>
        <li><strong>Sequence-of-returns risk</strong> \u2014 stress test against specific crisis scenarios (GFC, dot-com, stagflation)</li>
        <li><strong>Safe withdrawal rate optimizer</strong> \u2014 binary search for the highest SWR at your target success rate</li>
      </ul>
      <p>All simulations run in your browser using a Web Worker. No data leaves your device.</p>
      <ul>
        <li><a href="/withdrawal">Choose a withdrawal strategy first</a></li>
        <li><a href="/dashboard">View your results dashboard</a></li>
      </ul>
    `,
  },
  {
    path: '/dashboard',
    title: 'FIRE Dashboard \u2014 Retirement Readiness & Risk Assessment',
    heading: 'Your FIRE Dashboard',
    description: 'See your FIRE number, years to retirement, portfolio at retirement, success probability, and risk assessment in one view. Updated live as you adjust inputs.',
    bodyHtml: `
      <p>Your retirement readiness at a glance: FIRE number, estimated retirement age, portfolio projection at retirement, Monte Carlo success rate, and safe withdrawal rate.</p>
      <p>The dashboard pulls from your inputs, projection, and simulation results to give a single-page summary of where you stand.</p>
      <ul>
        <li><a href="/inputs">Adjust your inputs</a></li>
        <li><a href="/stress-test">Run stress tests</a></li>
        <li><a href="/checklist">FIRE checklist</a></li>
      </ul>
    `,
  },
  {
    path: '/checklist',
    title: 'Singapore FIRE Checklist \u2014 Financial Independence Milestones',
    heading: 'Singapore FIRE Checklist',
    description: 'Track your progress toward financial independence with a Singapore-specific checklist covering CPF, insurance, emergency fund, estate planning, and portfolio milestones.',
    bodyHtml: `
      <p>A step-by-step checklist for reaching financial independence in Singapore. Covers:</p>
      <ul>
        <li>Emergency fund and insurance foundations</li>
        <li>CPF optimization (SA top-ups, voluntary contributions)</li>
        <li>Investment portfolio setup and rebalancing</li>
        <li>Debt elimination and housing planning</li>
        <li>Estate planning and nomination</li>
        <li>Pre-retirement transition steps</li>
      </ul>
      <p>Track your progress and see what percentage of milestones you have completed.</p>
      <ul>
        <li><a href="/inputs">Set up your financial plan</a></li>
        <li><a href="/dashboard">View your dashboard</a></li>
      </ul>
    `,
  },
  {
    path: '/reference',
    title: 'CPF Rates, BRS/FRS/ERS, Tax Brackets & Withdrawal Strategy Guide (2026)',
    heading: 'Singapore Retirement Planning Reference Guide',
    description: 'CPF contribution rates by age, BRS/FRS/ERS amounts, OA/SA/MA allocation, CPF LIFE payout tables, income tax brackets, SRS rules, and 12 withdrawal strategy formulas. Updated for 2026.',
    bodyHtml: `
      <p>A detailed reference guide covering everything behind the planner\u2019s calculations:</p>
      <ul>
        <li>CPF contribution rates by age bracket, OW/AW ceilings, BRS/FRS/ERS projections</li>
        <li>Singapore income tax brackets and personal relief categories</li>
        <li>SRS contribution limits and tax treatment</li>
        <li>12 withdrawal strategy formulas with worked examples</li>
        <li>Monte Carlo simulation methodology (parametric, bootstrap, fat-tail)</li>
        <li>Historical return data sources and methodology (1928\u20132025)</li>
        <li>Property stamp duty rates (BSD, ABSD) and Bala\u2019s Table</li>
      </ul>
      <ul>
        <li><a href="/">Start planning</a></li>
        <li><a href="/stress-test">Run simulations</a></li>
      </ul>
    `,
  },
  {
    path: '/health-check',
    title: 'Financial Health Check \u2014 Singapore Savings, Debt & Insurance Ratios',
    heading: 'Financial Health Check for Singapore Residents',
    description: 'Check your financial health with Singapore-specific ratios: savings rate, emergency fund, debt service (TDSR), liquidity, insurance coverage, and CPF adequacy.',
    bodyHtml: `
      <p>Assess your financial health using ratios calibrated for Singapore residents:</p>
      <ul>
        <li>Savings rate (net income basis)</li>
        <li>Emergency fund adequacy (months of expenses)</li>
        <li>Total debt service ratio (TDSR) against MAS guidelines</li>
        <li>Non-mortgage debt service ratio</li>
        <li>Liquidity ratio</li>
        <li>Insurance needs gap analysis (death, disability, critical illness)</li>
        <li>CPF retirement adequacy</li>
      </ul>
      <p>Each ratio shows where you stand (healthy, caution, or action needed) with Singapore-specific thresholds.</p>
      <ul>
        <li><a href="/inputs">Set up your financial profile</a></li>
        <li><a href="/dashboard">View your FIRE dashboard</a></li>
      </ul>
    `,
  },
  {
    path: '/cpf-planner',
    title: 'CPF Projection Calculator: OA/SA/MA Balances, BRS/FRS/ERS & CPF LIFE Payout',
    heading: 'CPF Projection Calculator',
    description: 'Free CPF projection calculator. Estimate your OA, SA, MA balances at 55, compare BRS/FRS/ERS tiers, project CPF LIFE monthly payout, and see how CPF fits your retirement plan.',
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
  {
    path: '/stamp-duty-calculator',
    title: 'Singapore Stamp Duty Calculator: BSD and ABSD for Property Buyers',
    heading: 'Singapore Stamp Duty Calculator',
    description: 'Free stamp duty calculator for Singapore property. Calculate BSD and ABSD instantly for citizens, PRs, and foreigners. See bracket breakdowns and effective rates.',
    bodyHtml: `
      <p>Calculate Buyer's Stamp Duty (BSD) and Additional Buyer's Stamp Duty (ABSD) for any Singapore residential property purchase. See the progressive bracket breakdown, ABSD rate for your buyer profile, and total upfront cost.</p>
      <p>BSD rates: 1% on first $180K, 2% on next $180K, 3% on next $640K, 4% on next $500K, 5% on next $1.5M, 6% on remainder.</p>
      <p>ABSD rates (2023): Citizens 0%/20%/30%, PRs 5%/30%/35%, Foreigners 60%.</p>
      <ul>
        <li><a href="/">Start full retirement planning</a></li>
        <li><a href="/cpf-planner">CPF retirement planner</a></li>
        <li><a href="/compare">Compare robo-advisors vs DIY</a></li>
        <li><a href="/retirement-calculator">Singapore retirement calculator</a></li>
      </ul>
    `,
  },
  {
    path: '/srs-calculator',
    title: 'SRS Calculator Singapore: Tax Savings, Contribution Cap, and Projected Balance',
    heading: 'SRS Tax Savings Calculator',
    description: 'Free SRS calculator for Singapore. See how much tax you save with SRS contributions, project your balance at 63, and compare SRS vs CPF SA top-up.',
    bodyHtml: `
      <p>Calculate your annual tax savings from SRS contributions, project your SRS balance at age 63, and compare SRS vs CPF SA top-up (RSTU) to see which gives you more benefit.</p>
      <p>SRS contribution cap: $15,300 for citizens/PRs, $35,700 for foreigners. Withdrawals from age 63 are taxed at 50% of the amount.</p>
      <ul>
        <li><a href="/">Start full retirement planning</a></li>
        <li><a href="/cpf-planner">CPF retirement planner</a></li>
        <li><a href="/stamp-duty-calculator">Stamp duty calculator</a></li>
        <li><a href="/retirement-calculator">Singapore retirement calculator</a></li>
      </ul>
    `,
  },
]

const template = readFileSync(join(distDir, 'index.html'), 'utf-8')

for (const route of routes) {
  const url = `${BASE_URL}${route.path}`
  let html = template
  const fallbackBody = `
    <main style="max-width: 960px; margin: 0 auto; padding: 2rem 1rem 3rem; font-family: ui-sans-serif, system-ui, sans-serif; line-height: 1.6;">
      <h1 style="font-size: 2rem; margin-bottom: 0.75rem;">${route.heading}</h1>
      <p style="margin-bottom: 1rem;">${route.description}</p>
      ${route.bodyHtml ?? `
        <p style="margin-bottom: 1rem;">Open the interactive planner to work with this page's tools and assumptions.</p>
        <p><a href="/">Return to the main planner</a></p>
      `}
    </main>
  `.trim()

  // <title>...</title>
  html = html.replace(
    /<title>[^<]*<\/title>/,
    `<title>${route.title}</title>`,
  )

  // <meta name="description" content="...">
  html = html.replace(
    /(<meta\s+name="description"\s+content=")[^"]*(")/,
    `$1${route.description}$2`,
  )

  // <link rel="canonical" href="...">
  html = html.replace(
    /(<link\s+rel="canonical"\s+href=")[^"]*(")/,
    `$1${url}$2`,
  )

  // OG tags
  html = html.replace(
    /(<meta\s+property="og:title"\s+content=")[^"]*(")/,
    `$1${route.title}$2`,
  )
  html = html.replace(
    /(<meta\s+property="og:description"\s+content=")[^"]*(")/,
    `$1${route.description}$2`,
  )
  html = html.replace(
    /(<meta\s+property="og:url"\s+content=")[^"]*(")/,
    `$1${url}$2`,
  )

  // Twitter tags
  html = html.replace(
    /(<meta\s+name="twitter:title"\s+content=")[^"]*(")/,
    `$1${route.title}$2`,
  )
  html = html.replace(
    /(<meta\s+name="twitter:description"\s+content=")[^"]*(")/,
    `$1${route.description}$2`,
  )

  html = html.replace(
    /<div id="root">[\s\S]*?<\/div>/,
    `<div id="root">${fallbackBody}</div>`,
  )

  // Write to dist/<route>/index.html
  const routeDir = join(distDir, route.path.slice(1))
  mkdirSync(routeDir, { recursive: true })
  writeFileSync(join(routeDir, 'index.html'), html)
  console.log(`  Pre-rendered: ${route.path}`)
}

console.log(`\nPre-rendered ${routes.length} routes.`)
