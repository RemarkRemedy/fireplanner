import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { ArrowRight, Calculator, Landmark, TrendingUp, Shield } from 'lucide-react'
import { usePageMeta } from '@/hooks/usePageMeta'
import { CpfMiniCalculator } from '@/components/cpf/CpfMiniCalculator'

// --- FAQ data (used for both schema and visual accordion) ---

const FAQ_ITEMS = [
  {
    question: 'How much CPF do I need to retire in Singapore?',
    answer:
      'It depends on your desired retirement lifestyle. CPF sets three tiers: Basic Retirement Sum (BRS) for members who own property, Full Retirement Sum (FRS) as the default target, and Enhanced Retirement Sum (ERS) for those who want higher payouts. For 2026, the FRS is $220,400. Most Singaporeans should aim for at least the FRS to receive a meaningful CPF LIFE monthly payout.',
  },
  {
    question: 'What is the difference between BRS, FRS, and ERS?',
    answer:
      'For 2026, the Basic Retirement Sum (BRS) is $110,200, available only if you pledge your property. The Full Retirement Sum (FRS) is $220,400 and is the default. The Enhanced Retirement Sum (ERS) is $440,800, which gives the highest monthly payout. These amounts grow at 3.5% per year, so your targets will be higher if you are younger than 55 today.',
  },
  {
    question: 'How much will I get from CPF LIFE per month?',
    answer:
      'Monthly payouts depend on your Retirement Account balance at 55, your chosen CPF LIFE plan, and when payouts start (typically age 65). For someone meeting the 2026 FRS of $220,400, the Standard plan pays roughly $1,400 to $1,500 per month. The Basic plan pays slightly less but leaves a larger bequest. The Escalating plan starts lower but increases 2% each year to hedge inflation.',
  },
  {
    question: 'Is CPF enough for retirement in Singapore?',
    answer:
      'For many Singaporeans, CPF LIFE covers basic living expenses but not a comfortable retirement. If your monthly expenses exceed $1,500 to $2,000, you will likely need additional income from your investment portfolio, rental income, or part-time work. A retirement planner helps you calculate exactly how large that gap is and build a plan to close it.',
  },
] as const

// --- Structured data schemas ---

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
  name: 'SG FIRE Planner CPF Calculator',
  url: 'https://sgfireplanner.com/cpf-planner',
  applicationCategory: 'FinanceApplication',
  operatingSystem: 'Any',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'SGD',
  },
  description:
    'Free CPF retirement calculator for Singapore. Estimate your OA/SA/MA balances at 55, compare BRS/FRS/ERS tiers, and see your projected CPF LIFE monthly payout.',
}

export function CpfPlannerPage() {
  usePageMeta({
    title: 'CPF Retirement Planner: Estimate Your CPF Balances, BRS/FRS/ERS, and CPF LIFE Payout',
    description:
      'Free CPF retirement calculator for Singapore. Estimate your OA/SA/MA balances at 55, compare BRS/FRS/ERS tiers, and see your projected CPF LIFE monthly payout.',
    path: '/cpf-planner',
  })

  // Inject structured data schemas
  useEffect(() => {
    const faqScript = document.createElement('script')
    faqScript.type = 'application/ld+json'
    faqScript.textContent = JSON.stringify(faqSchema)
    faqScript.id = 'cpf-faq-schema'
    document.head.appendChild(faqScript)

    const appScript = document.createElement('script')
    appScript.type = 'application/ld+json'
    appScript.textContent = JSON.stringify(webAppSchema)
    appScript.id = 'cpf-webapp-schema'
    document.head.appendChild(appScript)

    return () => {
      document.getElementById('cpf-faq-schema')?.remove()
      document.getElementById('cpf-webapp-schema')?.remove()
    }
  }, [])

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-16">
      {/* Hero Section */}
      <section className="text-center space-y-4 pt-8">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
          CPF Retirement Planner
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Your Central Provident Fund builds a retirement foundation, but for most Singaporeans, CPF LIFE alone
          will not cover a comfortable retirement. Estimate your CPF balances, see your projected monthly payout,
          and find out how much your portfolio needs to fill the gap.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Button asChild size="lg">
            <Link to="/">
              Start Full Retirement Plan
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* CPF Mini-Calculator */}
      <section>
        <CpfMiniCalculator />
      </section>

      {/* Content Section: CPF Explained */}
      <section className="space-y-8">
        <div className="prose prose-slate dark:prose-invert max-w-none">
          <h2 className="text-2xl font-bold">Understanding CPF Retirement Sums: BRS, FRS, and ERS</h2>
          <p>
            When you turn 55, CPF creates a Retirement Account (RA) by transferring savings from your
            Special Account first, then your Ordinary Account, up to the Full Retirement Sum. The RA is
            the pool that funds your CPF LIFE payouts starting at age 65.
          </p>
          <p>
            The three tiers serve different needs. The Basic Retirement Sum (BRS) is half of the FRS and
            requires you to pledge your property. It suits homeowners who want to keep more cash in their
            OA. The Full Retirement Sum (FRS) is the default target and provides the baseline for a
            decent monthly payout. The Enhanced Retirement Sum (ERS) is double the FRS, giving you the
            highest possible CPF LIFE income.
          </p>
          <p>
            These sums grow at 3.5% per year. For 2026, BRS is $110,200, FRS is $220,400, and ERS is
            $440,800. If you are 30 today, your FRS at 55 will be closer to $520,000 due to 25 years
            of compounding.
          </p>

          <h2 className="text-2xl font-bold mt-8">How CPF LIFE Works</h2>
          <p>
            CPF LIFE is a national longevity annuity. You pay in through your RA balance, and CPF pays
            you a monthly income for life starting at age 65 (you can defer up to 70 for higher payouts).
            There are three plan options:
          </p>
          <ul>
            <li>
              <strong>Standard Plan:</strong> Higher monthly payouts with a smaller bequest. Best for
              those who want to maximize monthly income.
            </li>
            <li>
              <strong>Basic Plan:</strong> Slightly lower payouts but a larger bequest to beneficiaries.
              Suitable if leaving money to family matters.
            </li>
            <li>
              <strong>Escalating Plan:</strong> Starts lower but increases 2% each year. Designed to
              hedge against inflation over a long retirement.
            </li>
          </ul>
          <p>
            For someone meeting the 2026 FRS on the Standard plan, expect roughly $1,400 to $1,500
            per month. This covers basic living costs but likely falls short of a comfortable
            retirement budget.
          </p>

          <h2 className="text-2xl font-bold mt-8">OA vs SA Interest Rates</h2>
          <p>
            Your Ordinary Account earns 2.5% per year, while your Special Account earns 4.0%. This
            difference compounds significantly over decades. A dollar in your SA grows 60% faster than
            the same dollar in your OA over 30 years.
          </p>
          <p>
            CPF also provides extra interest: an additional 1% on the first $60,000 of combined
            balances (with up to $20,000 from OA), and an additional 1% on the first $30,000 of
            combined balances for members aged 55 and above. This extra interest is credited to your
            SA (or RA after 55).
          </p>

          <h2 className="text-2xl font-bold mt-8">SA Voluntary Top-Up: A Tax-Efficient Strategy</h2>
          <p>
            The Retirement Sum Topping-Up Scheme (RSTU) lets you make voluntary top-ups to your SA
            (or RA if over 55) and claim tax relief of up to $8,000 per year for self top-ups, plus
            another $8,000 for topping up family members. At the highest marginal tax rate of 24%,
            that is $1,920 in annual tax savings for self top-ups alone.
          </p>
          <p>
            Your top-up earns 4.0% (SA rate) risk-free, making it one of the best guaranteed returns
            available in Singapore. The trade-off is liquidity: these funds are locked until 55. For
            younger workers with decades until retirement, RSTU is one of the most powerful
            wealth-building tools in the CPF system.
          </p>

          <h2 className="text-2xl font-bold mt-8">Housing Withdrawals and Their Impact</h2>
          <p>
            Using your OA for housing loan payments reduces the amount available for retirement. Every
            dollar withdrawn for housing is a dollar that no longer earns 2.5% compound interest. Over
            a 25-year loan, the opportunity cost can exceed the original withdrawal amount.
          </p>
          <p>
            When you sell your property, you must refund the principal plus accrued interest back to
            your OA. This means the housing "withdrawal" is more like a loan from your future self.
            Planning your property purchase with CPF impact in mind can save tens of thousands in
            retirement.
          </p>
          <p>
            Our full planner models housing withdrawals explicitly, showing you exactly how your
            property decisions affect your CPF balances at 55 and your CPF LIFE payout.
          </p>
        </div>
      </section>

      {/* Feature Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calculator className="h-4 w-4" />
              CPF Balance Projection
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Project your OA, SA, and MA balances year by year from now until 55, including
              contributions, interest, and extra interest on the first $60,000.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Landmark className="h-4 w-4" />
              CPF LIFE Payout Estimate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Compare Basic, Standard, and Escalating plan payouts based on your projected RA balance.
              See which plan fits your risk tolerance and bequest preferences.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4" />
              Gap Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Find out if CPF LIFE covers your retirement expenses. If not, see exactly how much
              your investment portfolio needs to bridge the gap over 25 years.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4" />
              12 Withdrawal Strategies
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              The full planner includes 12 withdrawal strategies (4% rule, VPW, guardrails, and more)
              to optimize how you draw down your portfolio alongside CPF LIFE.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* FAQ Accordion */}
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
          <Link
            to="/"
            className="flex items-center gap-2 p-4 rounded-lg border hover:bg-muted/50 transition-colors"
          >
            <ArrowRight className="h-4 w-4 text-primary" />
            <div>
              <p className="font-medium">Full Retirement Planner</p>
              <p className="text-sm text-muted-foreground">Comprehensive FIRE planning with Monte Carlo simulation</p>
            </div>
          </Link>
          <Link
            to="/compare"
            className="flex items-center gap-2 p-4 rounded-lg border hover:bg-muted/50 transition-colors"
          >
            <ArrowRight className="h-4 w-4 text-primary" />
            <div>
              <p className="font-medium">Compare Robo-Advisors</p>
              <p className="text-sm text-muted-foreground">Fee comparison across Singapore platforms</p>
            </div>
          </Link>
          <Link
            to="/retirement-planner"
            className="flex items-center gap-2 p-4 rounded-lg border hover:bg-muted/50 transition-colors"
          >
            <ArrowRight className="h-4 w-4 text-primary" />
            <div>
              <p className="font-medium">Singapore Retirement Planner</p>
              <p className="text-sm text-muted-foreground">Full CPF, SRS, and FIRE planning</p>
            </div>
          </Link>
          <Link
            to="/retirement-calculator"
            className="flex items-center gap-2 p-4 rounded-lg border hover:bg-muted/50 transition-colors"
          >
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
          CPF is just one piece of your retirement plan. Combine it with portfolio projections,
          property analysis, and withdrawal strategies for a complete picture.
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
