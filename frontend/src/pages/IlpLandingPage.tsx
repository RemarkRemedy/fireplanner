import { Link } from 'react-router-dom'
import { BarChart3, Calculator, Search } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { usePageMeta } from '@/hooks/usePageMeta'

const MODES = [
  {
    title: "I'm considering an ILP",
    description: 'See the real fee cost of any ILP product in 4 screens. Year-by-year fee decomposition, bonus reality check, and exit math.',
    icon: BarChart3,
    href: '/ilp/compare',
    cta: 'Browse products',
    note: 'Pick a product, confirm your premium, see the story.',
  },
  {
    title: 'I have an ILP',
    description: 'Enter your current policy details and find out if staying or exiting makes more financial sense under your circumstances.',
    icon: Calculator,
    href: '/ilp/exit',
    cta: 'Calculate exit options',
    note: 'You will need your latest policy statement.',
  },
  {
    title: "I'm researching",
    description: 'Compare fee drag across 92 products from 11 insurers. Sortable, filterable, and standardized for apples-to-apples comparison.',
    icon: Search,
    href: '/ilp/compare',
    cta: 'Browse the leaderboard',
    note: 'Standardized at S$350/mo, mid return scenario.',
  },
] as const

export function IlpLandingPage() {
  usePageMeta({
    title: 'ILP Fee Transparency: SG FIRE Planner',
    description: 'Independent ILP fee analysis for Singapore. Year-by-year fee decomposition, exit math, and product comparison for 92 products.',
    path: '/ilp',
  })

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <div className="space-y-3 text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Returns are not guaranteed, but fees are.
        </p>
        <h1 className="text-3xl font-bold sm:text-4xl">
          ILP Fee Transparency
        </h1>
        <p className="mx-auto max-w-xl text-muted-foreground">
          Independent, privacy-first fee analysis for 92 Singapore ILP products.
          Your data never leaves the browser. No sales agenda. Open source.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {MODES.map((mode) => (
          <Link key={mode.href + mode.title} to={mode.href} className="group">
            <Card className="h-full transition-colors group-hover:border-primary group-hover:shadow-sm">
              <CardContent className="flex h-full flex-col gap-4 pt-6">
                <mode.icon className="h-8 w-8 text-primary" />
                <div className="flex-1 space-y-2">
                  <h2 className="text-lg font-semibold">{mode.title}</h2>
                  <p className="text-sm text-muted-foreground">{mode.description}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-primary group-hover:underline">
                    {mode.cta}
                  </span>
                  <p className="mt-1 text-xs text-muted-foreground">{mode.note}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="space-y-3 text-center text-xs text-muted-foreground">
        <p>
          Not financial advice. This tool provides fee calculations based on product documentation
          and standardized assumptions. Consult a licensed financial adviser before making policy decisions.
        </p>
        <p>
          Privacy-first. All computation runs in your browser. No data is sent to any server.
        </p>
      </div>
    </div>
  )
}
