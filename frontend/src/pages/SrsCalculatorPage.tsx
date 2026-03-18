import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { ArrowRight, PiggyBank, Calculator, TrendingUp, Shield } from 'lucide-react'
import { usePageMeta } from '@/hooks/usePageMeta'
import { SrsMiniCalculator } from '@/components/srs/SrsMiniCalculator'

// --- FAQ data ---

const FAQ_ITEMS = [
  {
    question: 'How much tax do I save with SRS contributions?',
    answer:
      'Your SRS contribution is deducted from taxable income dollar for dollar, up to the annual cap ($15,300 for citizens/PRs, $35,700 for foreigners). The actual savings depend on your marginal tax rate. At 15%, a full $15,300 contribution saves $2,295 per year. At 22%, it saves $3,366.',
  },
  {
    question: 'What is the SRS contribution cap for 2026?',
    answer:
      'The SRS annual contribution cap is $15,300 for Singapore Citizens and Permanent Residents, and $35,700 for foreigners. These caps have remained unchanged since SRS was introduced. Contributions exceeding the cap are not eligible for tax deduction.',
  },
  {
    question: 'When can I withdraw from SRS without penalty?',
    answer:
      'You can make penalty-free withdrawals from SRS starting at the statutory retirement age, which is currently 63. Withdrawals must be spread over 10 years. Only 50% of each withdrawal is taxable, and you pay tax at prevailing income tax rates. Early withdrawals before 63 incur a 5% penalty, and 100% of the amount is taxable.',
  },
  {
    question: 'Should I contribute to SRS or do a CPF SA top-up?',
    answer:
      'Both reduce your taxable income. RSTU (CPF SA top-up) gives a full tax deduction with no withdrawal tax, but funds are locked until 55 and earn a fixed 4%. SRS lets you invest in any approved instrument and withdraw from 63 with only 50% taxed, but there is no guaranteed return. If liquidity before 55 matters, SRS is more flexible. If you want risk-free compounding, RSTU is better.',
  },
] as const

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ_ITEMS.map((item) => ({
    '@type': 'Question',
    name: item.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: item.answer,
    },
  })),
}

const webAppSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Singapore SRS Tax Savings Calculator',
  url: 'https://sgfireplanner.com/srs-calculator',
  applicationCategory: 'FinanceApplication',
  operatingSystem: 'Any',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'SGD',
  },
  description:
    'Free SRS calculator for Singapore. See your annual tax savings, projected balance at 63, and whether SRS or CPF SA top-up gives you more benefit.',
}

export function SrsCalculatorPage() {
  usePageMeta({
    title: 'SRS Calculator Singapore: Tax Savings, Contribution Cap, and Projected Balance',
    description:
      'Free SRS calculator for Singapore. See how much tax you save with SRS contributions, project your balance at 63, and compare SRS vs CPF SA top-up.',
    path: '/srs-calculator',
  })

  useEffect(() => {
    const faqScript = document.createElement('script')
    faqScript.type = 'application/ld+json'
    faqScript.id = 'srs-faq-schema'
    faqScript.textContent = JSON.stringify(faqSchema)
    document.head.appendChild(faqScript)

    const appScript = document.createElement('script')
    appScript.type = 'application/ld+json'
    appScript.id = 'srs-webapp-schema'
    appScript.textContent = JSON.stringify(webAppSchema)
    document.head.appendChild(appScript)

    return () => {
      document.getElementById('srs-faq-schema')?.remove()
      document.getElementById('srs-webapp-schema')?.remove()
    }
  }, [])

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-16">
      {/* Hero */}
      <section className="text-center space-y-4 pt-8">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
          SRS Tax Savings Calculator
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          See exactly how much tax you save by contributing to the Supplementary Retirement Scheme.
          Project your SRS balance at retirement and compare SRS vs CPF SA top-up.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Button asChild size="lg">
            <Link to="/">
              Full Retirement Plan with SRS
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Calculator */}
      <section>
        <SrsMiniCalculator />
      </section>

      {/* Content Section */}
      <section className="space-y-8">
        <div className="prose prose-slate dark:prose-invert max-w-none">
          <h2 className="text-2xl font-bold">How SRS Tax Savings Work</h2>
          <p>
            Every dollar you contribute to SRS reduces your taxable income by the same amount, up
            to the annual cap. Singapore Citizens and PRs can contribute up to $15,300 per year.
            Foreigners can contribute up to $35,700. The contribution is deducted from your
            assessable income in the Year of Assessment following the contribution.
          </p>
          <p>
            The tax savings scale with your marginal rate. At a marginal rate of 7%, a full contribution
            saves $1,071. At 15%, it saves $2,295. At 22%, it saves $3,366. Higher earners get
            proportionally larger benefits from SRS.
          </p>

          <h2 className="text-2xl font-bold mt-8">SRS Contribution Cap and Eligibility</h2>
          <p>
            Any Singapore tax resident can open an SRS account at DBS, OCBC, or UOB. You can
            contribute any amount up to the annual cap. There is no minimum contribution. The cap
            has remained at $15,300 (citizens/PRs) and $35,700 (foreigners) since the scheme's
            inception.
          </p>
          <p>
            SRS funds can be invested in a wide range of approved instruments: stocks, bonds, ETFs,
            unit trusts, fixed deposits, and even insurance products. Unlike CPF, you have full
            control over your investment strategy. The trade-off is that returns are not guaranteed.
          </p>

          <h2 className="text-2xl font-bold mt-8">Withdrawal Rules: The 50% Tax Concession</h2>
          <p>
            From age 63 (the statutory retirement age), you can withdraw SRS funds penalty-free over
            a 10-year window. Only 50% of each withdrawal is taxable, and it is taxed at your
            prevailing income tax rate. If you have little other income in retirement, the effective
            tax on withdrawals can be very low or even zero.
          </p>
          <p>
            Early withdrawals (before 63) incur a 5% penalty on the withdrawal amount, and 100% of
            the withdrawal is taxable with no 50% concession. The penalty makes early access costly,
            so SRS works best for money you do not need until retirement.
          </p>

          <h2 className="text-2xl font-bold mt-8">SRS vs CPF SA Top-Up (RSTU)</h2>
          <p>
            Both SRS and RSTU reduce your taxable income. RSTU contributions to your CPF SA earn
            a guaranteed 4% with no withdrawal tax, but funds are locked until 55. SRS lets you
            invest flexibly and withdraw from 63, but returns depend on your investment choices and
            withdrawals are partially taxed.
          </p>
          <p>
            For most people, the optimal strategy is to max out RSTU first (guaranteed 4%, no
            withdrawal tax), then contribute to SRS for additional tax savings. However, if you
            need access to funds between 55 and 63, SRS fills that gap.
          </p>
        </div>
      </section>

      {/* Feature Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PiggyBank className="h-4 w-4" />
              SRS + CPF Integrated Planning
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              The full planner models SRS contributions, CPF balances, and portfolio
              withdrawals together so you can see how all three income streams combine
              in retirement.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calculator className="h-4 w-4" />
              Tax-Aware Year-by-Year Projection
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              See your income tax, CPF contributions, SRS deductions, and RSTU
              relief calculated year by year as your salary grows and tax brackets change.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4" />
              12 Withdrawal Strategies
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              When you retire, how you draw down SRS alongside your portfolio matters.
              Compare 12 withdrawal strategies to find the one that maximizes income and
              minimizes tax over your retirement horizon.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4" />
              Monte Carlo Stress Testing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Test whether your combined SRS + CPF + portfolio plan survives 10,000
              simulated market scenarios, including crashes in your first years of retirement.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* FAQ */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Frequently Asked Questions</h2>
        <Accordion type="single" collapsible className="w-full">
          {FAQ_ITEMS.map((item, i) => (
            <AccordionItem key={i} value={`faq-${i}`}>
              <AccordionTrigger className="text-left">{item.question}</AccordionTrigger>
              <AccordionContent>
                <p className="text-muted-foreground">{item.answer}</p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* Related Tools */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Related Tools</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link to="/" className="flex items-center gap-2 p-4 rounded-lg border hover:bg-muted/50 transition-colors">
            <ArrowRight className="h-4 w-4 text-primary" />
            <div>
              <p className="font-medium">Full Retirement Planner</p>
              <p className="text-sm text-muted-foreground">CPF, SRS, property, and portfolio planning</p>
            </div>
          </Link>
          <Link to="/cpf-planner" className="flex items-center gap-2 p-4 rounded-lg border hover:bg-muted/50 transition-colors">
            <ArrowRight className="h-4 w-4 text-primary" />
            <div>
              <p className="font-medium">CPF Retirement Planner</p>
              <p className="text-sm text-muted-foreground">Estimate CPF balances and LIFE payouts</p>
            </div>
          </Link>
          <Link to="/stamp-duty-calculator" className="flex items-center gap-2 p-4 rounded-lg border hover:bg-muted/50 transition-colors">
            <ArrowRight className="h-4 w-4 text-primary" />
            <div>
              <p className="font-medium">Stamp Duty Calculator</p>
              <p className="text-sm text-muted-foreground">BSD and ABSD for property buyers</p>
            </div>
          </Link>
          <Link to="/retirement-calculator" className="flex items-center gap-2 p-4 rounded-lg border hover:bg-muted/50 transition-colors">
            <ArrowRight className="h-4 w-4 text-primary" />
            <div>
              <p className="font-medium">Retirement Calculator</p>
              <p className="text-sm text-muted-foreground">Quick FIRE number estimate</p>
            </div>
          </Link>
        </div>
      </section>

      {/* Final CTA */}
      <section className="text-center space-y-4 pt-4">
        <p className="text-muted-foreground">
          SRS is one piece of the puzzle. Combine it with CPF, property, and portfolio
          projections for a complete retirement plan.
        </p>
        <Button asChild size="lg">
          <Link to="/">
            Start Planning for Free
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </section>
    </div>
  )
}
