import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Calculator, ChartColumn } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { usePageMeta } from '@/hooks/usePageMeta'
import { QuickEstimateForm } from '@/components/shared/QuickEstimateForm'

const calculatorSteps = [
  'Enter your current age, monthly income, expenses, and current investable assets.',
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
      {/* SEO hero */}
      <section className="rounded-3xl border bg-gradient-to-br from-emerald-50 via-background to-primary/10 p-8">
        <div className="max-w-3xl space-y-3">
          <div className="inline-flex items-center rounded-full border bg-background/80 px-3 py-1 text-sm text-muted-foreground">
            <Calculator className="mr-1.5 h-3.5 w-3.5" />
            Singapore retirement calculator
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            How long until you can retire?
          </h1>
          <p className="text-base text-muted-foreground sm:text-lg">
            Get your FIRE number in 10 seconds, then refine with CPF, property, and Monte Carlo simulation.
          </p>
        </div>
      </section>

      {/* Calculator */}
      <QuickEstimateForm syncUrlParams />

      {/* SEO content below calculator */}
      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">How it works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            {calculatorSteps.map((step, i) => (
              <p key={i}>{step}</p>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Why calculators alone are not enough</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              A retirement calculator gives you a first pass, but outcomes change once you model CPF payout timing, withdrawal rules, inflation, and market volatility.
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
