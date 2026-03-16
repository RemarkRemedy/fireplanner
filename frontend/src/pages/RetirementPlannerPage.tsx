import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Landmark, LineChart, ShieldCheck, WalletCards } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { usePageMeta } from '@/hooks/usePageMeta'

const plannerHighlights = [
  {
    title: 'CPF-aware retirement planning',
    description: 'Model CPF balances, retirement sums, CPF LIFE payouts, and the years before payouts begin.',
    icon: Landmark,
  },
  {
    title: 'Cash flow and portfolio timeline',
    description: 'Project income, expenses, net worth, and drawdown needs year by year instead of relying on a single ratio.',
    icon: WalletCards,
  },
  {
    title: 'Stress testing built in',
    description: 'Compare Monte Carlo, backtesting, sequence risk, and multiple withdrawal strategies in one workflow.',
    icon: ShieldCheck,
  },
]

const plannerQuestions = [
  {
    question: 'What makes this a Singapore retirement planner instead of a generic FIRE calculator?',
    answer: 'It layers CPF, CPF LIFE, SRS, Singapore-style taxes, and property decisions into the retirement timeline so the plan reflects how retirement actually works in Singapore.',
  },
  {
    question: 'Is this page only for early retirement?',
    answer: 'No. You can use it for standard retirement, semi-retirement, or FIRE. The planner works whether you expect to stop work at 65 or much earlier.',
  },
  {
    question: 'What should I do after landing here?',
    answer: 'Start with the interactive planner, enter your age, income, expenses, and current assets, then refine CPF, withdrawal, and stress-test assumptions.',
  },
]

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: plannerQuestions.map(({ question, answer }) => ({
    '@type': 'Question',
    name: question,
    acceptedAnswer: { '@type': 'Answer', text: answer },
  })),
}

export function RetirementPlannerPage() {
  usePageMeta({
    title: 'Singapore Retirement Planner — CPF, SRS & FIRE Planning',
    description: 'Plan retirement in Singapore with CPF, CPF LIFE, taxes, property, Monte Carlo stress tests, and withdrawal analysis in one free planner.',
    path: '/retirement-planner',
  })

  useEffect(() => {
    const faqScript = document.createElement('script')
    faqScript.type = 'application/ld+json'
    faqScript.textContent = JSON.stringify(faqSchema)
    document.head.appendChild(faqScript)

    const appSchema = {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'SG FIRE Planner — Retirement Planner',
      url: 'https://sgfireplanner.com/retirement-planner',
      applicationCategory: 'FinanceApplication',
      operatingSystem: 'Web',
      description: 'Plan retirement in Singapore with CPF, CPF LIFE, taxes, property, Monte Carlo stress tests, and withdrawal analysis.',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'SGD' },
      browserRequirements: 'Requires JavaScript',
    }
    const appScript = document.createElement('script')
    appScript.type = 'application/ld+json'
    appScript.textContent = JSON.stringify(appSchema)
    document.head.appendChild(appScript)

    return () => {
      document.head.removeChild(faqScript)
      document.head.removeChild(appScript)
    }
  }, [])

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border bg-gradient-to-br from-primary/10 via-background to-amber-50 p-8">
        <div className="max-w-3xl space-y-4">
          <div className="inline-flex items-center rounded-full border bg-background/80 px-3 py-1 text-sm text-muted-foreground">
            Singapore retirement planning
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Singapore Retirement Planner</h1>
          <p className="text-base text-muted-foreground sm:text-lg">
            Build a retirement plan that includes CPF, CPF LIFE, SRS, spending, portfolio drawdown, and downside scenarios instead of using a single back-of-the-envelope number.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/">
                Start planning
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/stress-test">See stress testing</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {plannerHighlights.map(({ title, description, icon: Icon }) => (
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

      <section className="grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">What this retirement planner helps you answer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>Can I retire at my target age without running out of money?</p>
            <p>How much of my retirement income is covered by CPF LIFE versus portfolio withdrawals?</p>
            <p>What changes if I work one more year, reduce spending, or use a different withdrawal rule?</p>
            <p>How exposed is my plan to bad early retirement market returns?</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Related tools</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Link to="/retirement-calculator" className="flex items-center justify-between rounded-xl border px-4 py-3 hover:border-primary/60 hover:bg-muted/40">
              <span>Singapore retirement calculator</span>
              <LineChart className="h-4 w-4 text-muted-foreground" />
            </Link>
            <Link to="/reference" className="flex items-center justify-between rounded-xl border px-4 py-3 hover:border-primary/60 hover:bg-muted/40">
              <span>Retirement planning reference guide</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Common questions</h2>
        <div className="grid gap-4">
          {plannerQuestions.map(({ question, answer }) => (
            <Card key={question}>
              <CardHeader>
                <CardTitle className="text-lg">{question}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{answer}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}
