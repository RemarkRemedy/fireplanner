import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, BarChart3, BookOpen, Calculator, Search, ShieldCheck, WalletCards } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { ProductPickerDialog } from '@/components/ilp/catalog/ProductPickerDialog'
import { usePageMeta } from '@/hooks/usePageMeta'

const BLOG_URL = '/blog/ilp-questions'

export function IlpLandingPage() {
  usePageMeta({
    title: 'ILP Due Diligence: SG FIRE Planner',
    description: 'Compare policy charges, sub-fund fee disclosures, and benchmark-relative returns for Singapore ILPs in one place.',
    path: '/ilp-fees',
  })

  const navigate = useNavigate()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerMode, setPickerMode] = useState<'story' | 'exit' | null>(null)

  const directComparisonViews = [
    {
      title: 'Returns vs benchmark',
      description: 'Check how a fund has performed against its stated benchmark before drawing conclusions.',
      href: '/ilp-returns',
      icon: BarChart3,
    },
    {
      title: 'Policy charges',
      description: 'Compare policy-level charges across products on a shared basis, then follow through to sub-fund fees and benchmark-relative returns.',
      href: '/ilp-fees/compare',
      icon: WalletCards,
    },
    {
      title: 'Sub-fund fees',
      description: 'Review fee labels, source dates, and like-for-like sub-fund fee disclosures.',
      href: '/ilp-ocf',
      icon: Search,
    },
  ]

  const guidedDashboards = [
    {
      title: "I'm considering an ILP",
      description: 'See how policy charges build over time, how bonuses change the picture, and what assumptions drive the result.',
      cta: 'Pick a product',
      footnote: 'Start with one product, then compare it with the wider market.',
      eyebrow: 'Prospect path',
      icon: BarChart3,
      tone: 'border-sky-200 bg-sky-50/70 dark:border-sky-900/80 dark:bg-sky-950/20',
      accent: 'from-sky-500/15 via-sky-500/5 to-transparent',
      bullets: ['Fee story in minutes', 'Works with public product docs', 'No signup required'],
      action: () => {
        setPickerMode('story')
        setPickerOpen(true)
      },
    },
    {
      title: 'I have an ILP',
      description: 'Enter your current policy details to compare hold and exit scenarios using your own inputs and assumptions.',
      cta: 'Calculate exit options',
      footnote: 'You will need your latest policy statement.',
      eyebrow: 'Policyholder path',
      icon: Calculator,
      tone: 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/80 dark:bg-emerald-950/20',
      accent: 'from-emerald-500/15 via-emerald-500/5 to-transparent',
      bullets: ['Shows surrender charges', 'Compares hold vs exit paths', 'Uses your current policy inputs'],
      action: () => {
        setPickerMode('exit')
        setPickerOpen(true)
      },
    },
  ]

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <section className="overflow-hidden rounded-md border border-slate-200/80 bg-gradient-to-br from-slate-50 via-white to-sky-50/70 p-6 shadow-sm dark:border-slate-800 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 sm:p-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,1fr)] lg:items-end">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-300/80 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-600 backdrop-blur dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              Returns are not guaranteed, but fees are.
            </div>
            <div className="space-y-3">
              <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-5xl">
                ILP Due Diligence
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300 sm:text-lg">
                Compare policy charges, sub-fund fee disclosures, and benchmark-relative returns for Singapore ILPs in one place. Start with the view that matches what you are checking.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-sm">
              <div className="rounded-md border border-slate-200 bg-white/90 px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
                <div className="font-semibold text-slate-950 dark:text-white">92 products</div>
                <div className="text-slate-500 dark:text-slate-400">Catalogued for fee review</div>
              </div>
              <div className="rounded-md border border-slate-200 bg-white/90 px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
                <div className="font-semibold text-slate-950 dark:text-white">Year-by-year charges</div>
                <div className="text-slate-500 dark:text-slate-400">Not just a headline fee rate</div>
              </div>
              <div className="rounded-md border border-slate-200 bg-white/90 px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
                <div className="font-semibold text-slate-950 dark:text-white">Runs locally</div>
                <div className="text-slate-500 dark:text-slate-400">Your policy details stay in browser</div>
              </div>
            </div>
          </div>

          <div className="rounded-md border border-slate-200/80 bg-white/90 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
            <div className="flex items-start gap-3">
              <div className="rounded-md bg-slate-100 p-3 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                <WalletCards className="h-5 w-5" />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-950 dark:text-white">What this hub helps you check</p>
                <ul className="space-y-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  <li>Compare policy charges and bonuses on a shared basis.</li>
                  <li>Review sub-fund fee disclosures with labels and source dates intact.</li>
                  <li>Check returns against the stated benchmark before drawing conclusions.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="rounded-md border border-blue-200 bg-blue-50/70 px-4 py-3 text-center dark:border-blue-900 dark:bg-blue-950/30">
        <a
          href={`${BLOG_URL}?utm_source=dashboard&utm_content=landing_hero`}
          className="text-sm font-medium text-blue-700 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
        >
          New here? Read: questions to ask before you decide on an ILP &rarr;
        </a>
      </div>

      <section className="space-y-4">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-slate-950 dark:text-white">Choose how you want to review an ILP</h2>
          <p className="max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            Start with the guided dashboard that matches your situation. If you want market-wide side-by-side checks, use the direct comparison views below.
          </p>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-950 dark:text-white">Guided dashboards</h3>
              <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                Better visualizations and clearer interpretation when you want help understanding one product or your current policy.
              </p>
            </div>
            <div className="hidden rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-medium text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-950/80 dark:text-slate-300 sm:inline-flex">
              Recommended for most users
            </div>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {guidedDashboards.map((entry) => {
            const Icon = entry.icon
            return (
              <button key={entry.title} type="button" onClick={entry.action} className="group text-left">
              <Card className={`relative h-full overflow-hidden rounded-md border transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-lg ${entry.tone}`}>
                <div className={`absolute inset-x-0 top-0 h-24 bg-gradient-to-br ${entry.accent}`} />
                <CardContent className="relative flex h-full flex-col gap-5 p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                        {entry.eyebrow}
                      </p>
                      <h2 className="text-xl font-semibold text-slate-950 dark:text-white">{entry.title}</h2>
                    </div>
                    <div className="rounded-md bg-white/90 p-3 text-slate-700 shadow-sm dark:bg-slate-900/90 dark:text-slate-200">
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>

                  <p className="flex-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {entry.description}
                  </p>

                  <div className="space-y-2 rounded-md border border-white/70 bg-white/80 p-4 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
                    {entry.bullets.map((bullet) => (
                      <div key={bullet} className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                        <span>{bullet}</span>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
                      {entry.cta}
                      <ArrowRight className="h-4 w-4" />
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{entry.footnote}</p>
                  </div>
                </CardContent>
              </Card>
              </button>
            )
          })}
        </div>
      </section>

      <section className="space-y-4">
        <div className="rounded-md border border-slate-200/80 bg-slate-50/80 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">
          Comparing multiple products side by side? Start here, then follow through to sub-fund fee and benchmark checks.
        </div>
        <div className="space-y-2">
          <h3 className="text-base font-semibold text-slate-950 dark:text-white">Direct comparison views</h3>
          <p className="max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            Use these when you want standardized market-wide comparisons first, without the guided workflow framing.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {directComparisonViews.map((lens) => {
            const Icon = lens.icon
            return (
              <Link
                key={lens.title}
                to={lens.href}
                className="rounded-md border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-primary dark:border-slate-800 dark:bg-slate-950"
              >
                <div className="mb-3 inline-flex rounded-md bg-slate-100 p-3 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-slate-950 dark:text-white">{lens.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{lens.description}</p>
              </Link>
            )
          })}
        </div>
      </section>

      {/* CTA 2: educational guide card */}
      <a href={`${BLOG_URL}?utm_source=dashboard&utm_content=landing_guide`} className="group block">
        <Card className="transition-colors group-hover:border-primary group-hover:shadow-sm">
          <CardContent className="flex items-start gap-4 p-6">
            <BookOpen className="mt-0.5 h-6 w-6 shrink-0 text-muted-foreground group-hover:text-primary" />
            <div className="space-y-1">
              <p className="font-medium group-hover:text-primary">Questions to ask before you buy an ILP</p>
              <p className="text-sm text-muted-foreground">
                Seven questions to help you understand charges, coverage, and alternatives before you decide. Takes about 10 minutes.
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
          How does an ILP compare with standalone coverage plus separate investing on a pure-cost basis? See the interactive comparison &rarr;
        </a>
      </div>

      <div className="space-y-3 text-center text-xs text-muted-foreground">
        <p>
          These tools support due diligence. They show charge calculations and comparisons based on product documentation and standardized assumptions, but they do not replace product suitability advice.
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
          Read: When an ILP may make sense for some buyers &rarr;
        </a>
      </div>

      <ProductPickerDialog
        open={pickerOpen}
        onOpenChange={(open) => {
          setPickerOpen(open)
          if (!open) {
            setPickerMode(null)
          }
        }}
        onSelect={(product, variant) => {
          setPickerOpen(false)
          const variantId = encodeURIComponent(variant.id)
          if (pickerMode === 'exit') {
            navigate(`/ilp-fees/exit?productId=${product.id}&variantId=${variantId}`)
          } else {
            navigate(`/ilp-fees/story/${product.id}?variantId=${variantId}`)
          }
          setPickerMode(null)
        }}
      />
    </div>
  )
}
