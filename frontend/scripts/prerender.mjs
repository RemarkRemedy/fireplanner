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
    title: 'Singapore Retirement Planner — CPF, SRS & FIRE Planning',
    heading: 'Singapore Retirement Planner',
    description: 'Plan retirement in Singapore with CPF, CPF LIFE, taxes, property, Monte Carlo stress tests, and withdrawal analysis in one free planner.',
    bodyHtml: `
      <p>Build a Singapore retirement plan that covers CPF, CPF LIFE, SRS, spending, portfolio withdrawals, and downside scenarios.</p>
      <p>Use the planner to answer when you can retire, how much CPF supports your retirement income, and how resilient your drawdown plan is.</p>
      <ul>
        <li><a href="/inputs">Start planning</a></li>
        <li><a href="/retirement-calculator">Singapore retirement calculator</a></li>
        <li><a href="/stress-test">Monte Carlo stress testing</a></li>
      </ul>
    `,
  },
  {
    path: '/retirement-calculator',
    title: 'Singapore Retirement Calculator — Estimate CPF-Aware Retirement Needs',
    heading: 'Singapore Retirement Calculator',
    description: 'Use this free Singapore retirement calculator to estimate your retirement target, timeline, CPF support, and required withdrawals.',
    bodyHtml: `
      <p>Estimate how much you may need for retirement in Singapore, then validate the result with CPF timing, withdrawal assumptions, and market stress tests.</p>
      <p>This calculator is designed to turn a quick estimate into a full plan instead of stopping at a single portfolio target.</p>
      <ul>
        <li><a href="/inputs">Start calculating</a></li>
        <li><a href="/retirement-planner">Singapore retirement planner</a></li>
        <li><a href="/reference">Retirement planning reference guide</a></li>
      </ul>
    `,
  },
  {
    path: '/inputs',
    title: 'Plan Inputs \u2014 SG FIRE Planner',
    heading: 'Plan Inputs',
    description: 'Configure your income, expenses, CPF, investments, and retirement assumptions for Singapore FIRE planning.',
  },
  {
    path: '/projection',
    title: 'Projection \u2014 SG FIRE Planner',
    heading: 'Projection',
    description: 'Year-by-year financial projection with net worth trajectory, CPF balances, and retirement milestones.',
  },
  {
    path: '/withdrawal',
    title: 'Withdrawal Strategies \u2014 SG FIRE Planner',
    heading: 'Withdrawal Strategies',
    description: 'Compare 12 retirement withdrawal strategies including the 4% rule, VPW, guardrails, and CAPE-based approaches.',
  },
  {
    path: '/stress-test',
    title: 'Stress Test \u2014 SG FIRE Planner',
    heading: 'Stress Test',
    description: 'Monte Carlo simulation, historical backtesting, and sequence risk analysis for your Singapore retirement plan.',
  },
  {
    path: '/dashboard',
    title: 'Dashboard \u2014 SG FIRE Planner',
    heading: 'Dashboard',
    description: 'Your FIRE dashboard with key metrics, risk assessment, and retirement readiness overview.',
  },
  {
    path: '/checklist',
    title: 'FIRE Checklist \u2014 SG FIRE Planner',
    heading: 'FIRE Checklist',
    description: 'Track your progress toward financial independence with this Singapore-specific FIRE checklist.',
  },
  {
    path: '/reference',
    title: 'Reference Guide \u2014 SG FIRE Planner',
    heading: 'Reference Guide',
    description: 'Comprehensive guide to Singapore retirement planning: CPF, tax, withdrawal strategies, Monte Carlo methods, and data sources.',
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
