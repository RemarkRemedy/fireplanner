import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BarChart3, BookOpen, Calculator, Search } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { ProductPickerDialog } from '@/components/ilp/catalog/ProductPickerDialog'
import { usePageMeta } from '@/hooks/usePageMeta'

const BLOG_URL = '/blog/ilp-questions'

export function IlpLandingPage() {
  usePageMeta({
    title: 'ILP Fee Transparency: SG FIRE Planner',
    description: 'Independent ILP fee analysis for Singapore. Year-by-year fee decomposition, exit math, and product comparison for 92 products.',
    path: '/ilp-fees',
  })

  const navigate = useNavigate()
  const [pickerOpen, setPickerOpen] = useState(false)

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

      {/* CTA 1: educational hook below hero */}
      <div className="rounded-lg border border-blue-200 bg-blue-50/50 px-4 py-3 text-center dark:border-blue-900 dark:bg-blue-950/30">
        <a
          href={`${BLOG_URL}?utm_source=dashboard&utm_content=landing_hero`}
          className="text-sm font-medium text-blue-700 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
        >
          New here? Read: 7 questions to ask your FA before signing an ILP &rarr;
        </a>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {/* Mode 1: Prospects — opens product picker, then navigates to story mode */}
        <button type="button" onClick={() => setPickerOpen(true)} className="group text-left">
          <Card className="h-full transition-colors group-hover:border-primary group-hover:shadow-sm">
            <CardContent className="flex h-full flex-col gap-4 p-6">
              <BarChart3 className="h-8 w-8 text-primary" />
              <div className="flex-1 space-y-2">
                <h2 className="text-lg font-semibold">I'm considering an ILP</h2>
                <p className="text-sm text-muted-foreground">
                  See the real fee cost of any ILP product in 4 screens. Year-by-year fee decomposition, bonus reality check, and exit math.
                </p>
              </div>
              <div>
                <span className="text-sm font-medium text-primary group-hover:underline">
                  Pick a product
                </span>
                <p className="mt-1 text-xs text-muted-foreground">Select your product and see its fee story.</p>
              </div>
            </CardContent>
          </Card>
        </button>

        {/* Mode 2: Existing holders */}
        <Link to="/ilp-fees/exit" className="group">
          <Card className="h-full transition-colors group-hover:border-primary group-hover:shadow-sm">
            <CardContent className="flex h-full flex-col gap-4 p-6">
              <Calculator className="h-8 w-8 text-primary" />
              <div className="flex-1 space-y-2">
                <h2 className="text-lg font-semibold">I have an ILP</h2>
                <p className="text-sm text-muted-foreground">
                  Enter your current policy details and find out if staying or exiting makes more financial sense under your circumstances.
                </p>
              </div>
              <div>
                <span className="text-sm font-medium text-primary group-hover:underline">
                  Calculate exit options
                </span>
                <p className="mt-1 text-xs text-muted-foreground">You will need your latest policy statement.</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Mode 3: Researchers */}
        <Link to="/ilp-fees/compare" className="group">
          <Card className="h-full transition-colors group-hover:border-primary group-hover:shadow-sm">
            <CardContent className="flex h-full flex-col gap-4 p-6">
              <Search className="h-8 w-8 text-primary" />
              <div className="flex-1 space-y-2">
                <h2 className="text-lg font-semibold">I'm researching</h2>
                <p className="text-sm text-muted-foreground">
                  Compare fee drag across all products. Sortable, filterable, and standardized for apples-to-apples comparison.
                </p>
              </div>
              <div>
                <span className="text-sm font-medium text-primary group-hover:underline">
                  Open the leaderboard
                </span>
                <p className="mt-1 text-xs text-muted-foreground">Standardized at S$350/mo, mid return scenario.</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* CTA 2: educational guide card */}
      <a href={`${BLOG_URL}?utm_source=dashboard&utm_content=landing_guide`} className="group block">
        <Card className="transition-colors group-hover:border-primary group-hover:shadow-sm">
          <CardContent className="flex items-start gap-4 p-6">
            <BookOpen className="mt-0.5 h-6 w-6 shrink-0 text-muted-foreground group-hover:text-primary" />
            <div className="space-y-1">
              <p className="font-medium group-hover:text-primary">Questions to ask before you buy an ILP</p>
              <p className="text-sm text-muted-foreground">
                7 specific questions, what your FA might say, what that actually means, and interactive tools to visualise the fees. Takes 10 minutes.
              </p>
            </div>
          </CardContent>
        </Card>
      </a>

      {/* CTA 3: fee comparison hook */}
      <div className="text-center">
        <a
          href={`${BLOG_URL}?utm_source=dashboard&utm_content=landing_compare#2-what-are-the-total-annual-fees-including-fund-level-charges`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          How do ILP fees compare to buying term life + ETFs? See the interactive comparison &rarr;
        </a>
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

      {/* CTA 4: footer link */}
      <div className="text-center">
        <a
          href={`${BLOG_URL}?utm_source=dashboard&utm_content=landing_footer#when-an-ilp-might-actually-make-sense`}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Read: When an ILP might actually make sense &rarr;
        </a>
      </div>

      <ProductPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={(product, _variant) => {
          setPickerOpen(false)
          navigate(`/ilp-fees/story/${product.id}`)
        }}
      />
    </div>
  )
}
