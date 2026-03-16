import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Calculator, ChartColumn, PiggyBank, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { usePageMeta } from '@/hooks/usePageMeta'

const calculatorFeatures = [
  {
    title: 'Estimate your target portfolio',
    description: 'Start with spending, savings, and retirement age to size the portfolio you may need.',
    icon: Calculator,
  },
  {
    title: 'Adjust for Singapore realities',
    description: 'Factor in CPF, CPF LIFE, taxes, and housing instead of assuming a purely offshore retirement model.',
    icon: PiggyBank,
  },
  {
    title: 'Validate beyond the headline number',
    description: 'Push the result into Monte Carlo and backtesting so the calculator output becomes a usable plan.',
    icon: ShieldAlert,
  },
]

const calculatorSteps = [
  'Enter your current age, target retirement age, monthly income, expenses, and current investable assets.',
  'Review the calculated FIRE number, projected retirement age, and savings-rate implications.',
  'Open the full planner to refine CPF, property, healthcare, and withdrawal assumptions.',
]

const howToSchema = {
  '@context': 'https://schema.org',
  '@type': 'HowTo',
  name: 'How to use the Singapore retirement calculator',
  step: calculatorSteps.map((text, i) => ({
    '@type': 'HowToStep',
    position: i + 1,
    text,
  })),
}

export function RetirementCalculatorPage() {
  usePageMeta({
    title: 'Singapore Retirement Calculator — Estimate CPF-Aware Retirement Needs',
    description: 'Use this free Singapore retirement calculator to estimate your retirement target, timeline, CPF support, and required withdrawals.',
    path: '/retirement-calculator',
  })

  useEffect(() => {
    const howToScript = document.createElement('script')
    howToScript.type = 'application/ld+json'
    howToScript.textContent = JSON.stringify(howToSchema)
    document.head.appendChild(howToScript)

    const appSchema = {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'SG FIRE Planner — Retirement Calculator',
      url: 'https://sgfireplanner.com/retirement-calculator',
      applicationCategory: 'FinanceApplication',
      operatingSystem: 'Web',
      description: 'Free Singapore retirement calculator to estimate your retirement target, timeline, CPF support, and required withdrawals.',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'SGD' },
      browserRequirements: 'Requires JavaScript',
    }
    const appScript = document.createElement('script')
    appScript.type = 'application/ld+json'
    appScript.textContent = JSON.stringify(appSchema)
    document.head.appendChild(appScript)

    return () => {
      document.head.removeChild(howToScript)
      document.head.removeChild(appScript)
    }
  }, [])

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border bg-gradient-to-br from-emerald-50 via-background to-primary/10 p-8">
        <div className="max-w-3xl space-y-4">
          <div className="inline-flex items-center rounded-full border bg-background/80 px-3 py-1 text-sm text-muted-foreground">
            Singapore retirement calculator
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Singapore Retirement Calculator</h1>
          <p className="text-base text-muted-foreground sm:text-lg">
            Estimate how much you may need for retirement in Singapore, then test whether the number still holds up once CPF, drawdown risk, and real-world cash flow are added.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/">
                Start calculating
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/retirement-planner">Retirement planner</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {calculatorFeatures.map(({ title, description, icon: Icon }) => (
          <Card key={title} className="h-full">
            <CardHeader className="space-y-3">
              <div className="w-fit rounded-xl bg-primary/10 p-3">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-xl">{title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{description}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.95fr,1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">How to use the calculator</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            {calculatorSteps.map((step) => (
              <p key={step}>{step}</p>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Why calculators alone are not enough</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              A retirement calculator is useful for the first pass, but retirement outcomes usually change once you model CPF payout timing, withdrawal rules, inflation, and market volatility.
            </p>
            <p>
              This site lets you move from a quick estimate to a full retirement plan without re-entering everything.
            </p>
            <Link to="/stress-test" className="inline-flex items-center gap-2 font-medium text-primary hover:underline">
              Explore the stress-testing workflow
              <ChartColumn className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
