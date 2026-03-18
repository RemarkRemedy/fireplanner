import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { ArrowRight, Building2, Calculator, TrendingUp, Shield } from 'lucide-react'
import { usePageMeta } from '@/hooks/usePageMeta'
import { StampDutyCalculator } from '@/components/property/StampDutyCalculator'

// --- FAQ data ---

const FAQ_ITEMS = [
  {
    question: 'How much stamp duty do I pay when buying property in Singapore?',
    answer:
      'You pay Buyer\'s Stamp Duty (BSD) on all property purchases, calculated on a progressive scale from 1% to 6%. If you are a PR buying your first property, a citizen buying your second, or a foreigner, you also pay Additional Buyer\'s Stamp Duty (ABSD) ranging from 5% to 60% of the purchase price.',
  },
  {
    question: 'What is the difference between BSD and ABSD?',
    answer:
      'BSD (Buyer\'s Stamp Duty) is a progressive tax that every buyer pays, similar to income tax brackets. ABSD (Additional Buyer\'s Stamp Duty) is a flat-rate surcharge that depends on your residency status and how many properties you already own. Citizens pay no ABSD on their first property. PRs pay 5%. Foreigners pay 60%.',
  },
  {
    question: 'Are there any ABSD remissions or refunds?',
    answer:
      'Yes. Married couples may qualify for ABSD remission when buying a second property together, subject to conditions. Singaporeans upgrading from HDB to private property can apply for ABSD refund if they sell their HDB within 6 months. Check IRAS for current remission rules.',
  },
  {
    question: 'How does stamp duty affect my retirement plan?',
    answer:
      'Stamp duty is a large upfront cost that reduces the capital available for investment. For a $1.5M property, a citizen buying their second home pays $44,600 in BSD plus $300,000 in ABSD. That $344,600 could generate significant returns if invested instead. A retirement planner helps you model this trade-off over your full timeline.',
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
  name: 'Singapore Stamp Duty Calculator',
  url: 'https://sgfireplanner.com/stamp-duty-calculator',
  applicationCategory: 'FinanceApplication',
  operatingSystem: 'Any',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'SGD',
  },
  description:
    'Free Singapore stamp duty calculator. Calculate BSD and ABSD for citizens, PRs, and foreigners. See the full bracket breakdown and how property costs affect your retirement plan.',
}

export function StampDutyCalculatorPage() {
  usePageMeta({
    title: 'Singapore Stamp Duty Calculator: BSD and ABSD for Property Buyers',
    description:
      'Free stamp duty calculator for Singapore property. Calculate BSD and ABSD instantly for citizens, PRs, and foreigners. See bracket breakdowns and effective rates.',
    path: '/stamp-duty-calculator',
  })

  useEffect(() => {
    const faqScript = document.createElement('script')
    faqScript.type = 'application/ld+json'
    faqScript.id = 'stamp-duty-faq-schema'
    faqScript.textContent = JSON.stringify(faqSchema)
    document.head.appendChild(faqScript)

    const appScript = document.createElement('script')
    appScript.type = 'application/ld+json'
    appScript.id = 'stamp-duty-webapp-schema'
    appScript.textContent = JSON.stringify(webAppSchema)
    document.head.appendChild(appScript)

    return () => {
      document.getElementById('stamp-duty-faq-schema')?.remove()
      document.getElementById('stamp-duty-webapp-schema')?.remove()
    }
  }, [])

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-16">
      {/* Hero */}
      <section className="text-center space-y-4 pt-8">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
          Singapore Stamp Duty Calculator
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Calculate Buyer's Stamp Duty (BSD) and Additional Buyer's Stamp Duty (ABSD)
          for any residential property purchase. See the bracket breakdown, ABSD rate
          for your profile, and total upfront cost.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Button asChild size="lg">
            <Link to="/">
              Plan Your Full Retirement
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Calculator */}
      <section>
        <StampDutyCalculator />
      </section>

      {/* Content Section */}
      <section className="space-y-8">
        <div className="prose prose-slate dark:prose-invert max-w-none">
          <h2 className="text-2xl font-bold">How BSD Works in Singapore</h2>
          <p>
            Buyer's Stamp Duty is a progressive tax on all property purchases. It works like income
            tax brackets: you pay 1% on the first $180,000, 2% on the next $180,000, 3% on the next
            $640,000, and so on up to 6% on amounts above $3,000,000. For a $1 million HDB resale flat,
            the BSD is $24,600. For a $2 million condo, it is $64,600.
          </p>
          <p>
            BSD applies to everyone regardless of citizenship or how many properties you own. It is
            calculated on the purchase price or market value, whichever is higher.
          </p>

          <h2 className="text-2xl font-bold mt-8">Understanding ABSD Rates</h2>
          <p>
            Additional Buyer's Stamp Duty is a flat-rate surcharge introduced to cool the property
            market. The rate depends on two factors: your residency status and how many residential
            properties you already own.
          </p>
          <p>
            Singapore Citizens pay 0% ABSD on their first property, 20% on their second, and 30%
            on their third or subsequent. Permanent Residents pay 5% on their first, 30% on their
            second, and 35% on their third. Foreigners pay 60% on any property.
          </p>
          <p>
            These rates took effect on 27 April 2023. ABSD is payable in addition to BSD, making
            the total stamp duty burden significant for second properties and foreign buyers.
          </p>

          <h2 className="text-2xl font-bold mt-8">ABSD Remissions</h2>
          <p>
            Married couples where at least one spouse is a Singapore Citizen may apply for ABSD
            remission on a second property, subject to conditions including selling the first within
            6 months. Singaporeans upgrading from HDB to private property can also apply for a refund
            after selling their HDB.
          </p>
          <p>
            Remission eligibility changes over time. Always check the latest IRAS guidelines before
            making assumptions about your stamp duty liability.
          </p>

          <h2 className="text-2xl font-bold mt-8">Stamp Duty and Retirement Planning</h2>
          <p>
            Property is the largest asset for most Singaporeans, and stamp duty is a major upfront cost
            that is often underestimated. The stamp duty on a second property can exceed $300,000 for a
            $1.5M purchase. That capital, if invested instead, could grow significantly over a 20-30
            year retirement horizon.
          </p>
          <p>
            Our full retirement planner models property as part of your net worth, including purchase
            costs, mortgage payments, CPF housing withdrawals, and how property value appreciation
            (or decay for leaseholds via Bala's Table) affects your retirement timeline.
          </p>
        </div>
      </section>

      {/* Feature Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4" />
              Full Property Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Model purchase costs, mortgage, rental yield, leasehold decay (Bala's Table),
              and en-bloc scenarios in one integrated property section.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calculator className="h-4 w-4" />
              CPF Housing Withdrawal Impact
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              See exactly how using your CPF OA for housing reduces your retirement balances
              and CPF LIFE payout. The full planner tracks the opportunity cost year by year.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4" />
              Buy vs Invest Comparison
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Compare the long-term outcome of buying a second property (with ABSD) versus
              investing the same capital in a diversified portfolio.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4" />
              Stress Test Property Scenarios
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Run Monte Carlo simulations that include property value, mortgage obligations,
              and stamp duty costs to see how property decisions affect your retirement safety.
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
              <p className="text-sm text-muted-foreground">CPF, property, and portfolio planning</p>
            </div>
          </Link>
          <Link to="/cpf-planner" className="flex items-center gap-2 p-4 rounded-lg border hover:bg-muted/50 transition-colors">
            <ArrowRight className="h-4 w-4 text-primary" />
            <div>
              <p className="font-medium">CPF Retirement Planner</p>
              <p className="text-sm text-muted-foreground">Estimate CPF balances and LIFE payouts</p>
            </div>
          </Link>
          <Link to="/compare" className="flex items-center gap-2 p-4 rounded-lg border hover:bg-muted/50 transition-colors">
            <ArrowRight className="h-4 w-4 text-primary" />
            <div>
              <p className="font-medium">Compare Robo-Advisors</p>
              <p className="text-sm text-muted-foreground">Fee comparison across Singapore platforms</p>
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
          Stamp duty is just one property cost. Model the full picture with mortgage,
          CPF withdrawals, and retirement projections.
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
