import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  TrendingUp,
  BarChart3,
  Shield,
  Users,
  Lock,
  ArrowRight,
} from 'lucide-react'
import { usePageMeta } from '@/hooks/usePageMeta'
import { PlatformComparisonTable } from '@/components/compare/PlatformComparisonTable'
import { FeeComparisonCalculator } from '@/components/compare/FeeComparisonCalculator'

// ---------------------------------------------------------------------------
// FAQ data (outside component for stable reference)
// ---------------------------------------------------------------------------

const FAQ_ITEMS = [
  {
    question:
      'Do I need a robo-advisor and a retirement planner?',
    answer:
      'Yes, they solve different problems. Robo-advisors automate investing: they allocate your money across funds, rebalance periodically, and keep you disciplined. A retirement planner models your full financial picture, including CPF, property, withdrawal strategies, and stress testing, to answer the question "do I have enough to retire?" You can use both together.',
  },
  {
    question:
      'How much do robo-advisors cost in Singapore?',
    answer:
      'Platform fees range from 0.2% to 0.8% of assets under management, plus fund-level costs (TER) of 0.1% to 0.3%. These may seem small, but over 30 years at 7% returns, even a 0.5% fee difference compounds to tens of thousands of dollars in lost portfolio growth.',
  },
  {
    question:
      'Can I use SGFirePlanner with my Endowus or StashAway portfolio?',
    answer:
      'Yes. Enter your robo portfolio value as part of your total investment assets. SGFirePlanner projects whether your combined assets (CPF + portfolio) are enough to retire. It does not manage your investments directly. It tells you whether the amount you are investing is on track.',
  },
] as const

const FAQ_SCHEMA = {
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

const WEB_APP_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'SGFirePlanner',
  url: 'https://sgfireplanner.com',
  applicationCategory: 'FinanceApplication',
  operatingSystem: 'Any',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'SGD',
  },
  description:
    'Free Singapore retirement planner with CPF integration, Monte Carlo stress testing, and 12 withdrawal strategies. Compare robo-advisor fees and plan your path to FIRE.',
}

// ---------------------------------------------------------------------------
// Feature cards data
// ---------------------------------------------------------------------------

const FEATURES = [
  {
    icon: TrendingUp,
    title: 'CPF + portfolio integrated projection',
    description:
      'Year-by-year projection that combines your CPF balances (OA, SA, MA, RA) with your investment portfolio. See exactly when CPF LIFE kicks in and how it offsets withdrawals.',
  },
  {
    icon: BarChart3,
    title: '12 withdrawal strategies compared',
    description:
      'From the classic 4% rule to Guyton-Klinger guardrails, VPW, and CAPE-based withdrawals. Compare them side by side with your actual numbers.',
  },
  {
    icon: Shield,
    title: 'Monte Carlo stress testing',
    description:
      '10,000 simulated market scenarios. See your probability of success across bull markets, bear markets, and everything in between.',
  },
  {
    icon: Users,
    title: 'Household and joint planning',
    description:
      'Model two adults with separate incomes, CPF accounts, and retirement ages. See how your combined finances work together.',
  },
  {
    icon: Lock,
    title: '100% private: no data leaves your browser',
    description:
      'No account needed. No server. Your financial data stays in your browser and never touches our servers. Export to JSON anytime.',
  },
]

// ---------------------------------------------------------------------------
// ComparePage
// ---------------------------------------------------------------------------

export function ComparePage() {
  usePageMeta({
    title:
      'Robo-Advisors vs DIY: Singapore Fee Comparison and Retirement Planning',
    description:
      'Compare Endowus, StashAway, Syfe, and DBS digiPortfolio fees. See the 30-year cost of each platform and what a free retirement planner adds that robo-advisors cannot.',
    path: '/compare',
  })

  // Inject structured data schemas
  useEffect(() => {
    const faqScript = document.createElement('script')
    faqScript.type = 'application/ld+json'
    faqScript.id = 'compare-faq-schema'
    faqScript.textContent = JSON.stringify(FAQ_SCHEMA)
    document.head.appendChild(faqScript)

    const webAppScript = document.createElement('script')
    webAppScript.type = 'application/ld+json'
    webAppScript.id = 'compare-webapp-schema'
    webAppScript.textContent = JSON.stringify(WEB_APP_SCHEMA)
    document.head.appendChild(webAppScript)

    return () => {
      document.getElementById('compare-faq-schema')?.remove()
      document.getElementById('compare-webapp-schema')?.remove()
    }
  }, [])

  return (
    <div className="mx-auto max-w-4xl space-y-12 px-4 py-12">
      {/* Hero */}
      <header className="space-y-3 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Robo-advisors manage your money. A planner helps you decide if it's
          enough.
        </h1>
        <p className="text-lg text-muted-foreground">
          They solve different problems. Here's how they work together.
        </p>
      </header>

      {/* Platform comparison table */}
      <section>
        <PlatformComparisonTable />
      </section>

      {/* What SGFirePlanner adds */}
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold text-center">
          What a retirement planner adds
        </h2>
        <p className="text-center text-muted-foreground max-w-2xl mx-auto">
          Robo-advisors handle investing. A planner answers the bigger question:
          is what you are investing enough to retire on?
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <Card key={title}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-base">{title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Fee impact calculator */}
      <section>
        <FeeComparisonCalculator />
      </section>

      {/* FAQ */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Frequently asked questions</h2>
        <Accordion type="single" collapsible className="w-full">
          {FAQ_ITEMS.map((item, i) => (
            <AccordionItem key={i} value={`faq-${i}`}>
              <AccordionTrigger>{item.question}</AccordionTrigger>
              <AccordionContent>{item.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* CTA + related tools */}
      <section className="space-y-6 text-center">
        <div className="space-y-3">
          <h2 className="text-2xl font-semibold">
            Ready to plan your retirement?
          </h2>
          <p className="text-muted-foreground">
            Free. No account needed. Your data stays in your browser.
          </p>
          <Button size="lg" asChild>
            <Link to="/">
              Start planning
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            Related tools
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button variant="outline" size="sm" asChild>
              <Link to="/">Home</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/cpf-planner">CPF Planner</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/retirement-planner">Retirement Planner</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/retirement-calculator">Retirement Calculator</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
