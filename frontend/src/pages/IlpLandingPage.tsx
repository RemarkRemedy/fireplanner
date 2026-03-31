import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, BarChart3, BookOpen, Calculator, Search, ShieldCheck, WalletCards } from 'lucide-react'
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

  const entryCards = [
    {
      title: "I'm considering an ILP",
      description: 'See the real fee cost of any ILP product in 4 screens. Year-by-year fee decomposition, how bonuses affect fees, and exit math.',
      cta: 'Pick a product',
      footnote: 'Select your product and see its fee story.',
      eyebrow: 'Prospect path',
      icon: BarChart3,
      tone: 'border-sky-200 bg-sky-50/70 dark:border-sky-900/80 dark:bg-sky-950/20',
      accent: 'from-sky-500/15 via-sky-500/5 to-transparent',
      bullets: ['Fee story in minutes', 'Works with public product docs', 'No signup required'],
      action: () => setPickerOpen(true),
      kind: 'button' as const,
    },
    {
      title: 'I have an ILP',
      description: 'Enter your current policy details and find out if staying or exiting makes more financial sense under your circumstances.',
      cta: 'Calculate exit options',
      footnote: 'You will need your latest policy statement.',
      eyebrow: 'Policyholder path',
      icon: Calculator,
      tone: 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/80 dark:bg-emerald-950/20',
      accent: 'from-emerald-500/15 via-emerald-500/5 to-transparent',
      bullets: ['Shows surrender charges', 'Compares hold vs exit paths', 'Uses your current policy inputs'],
      href: '/ilp-fees/exit',
      kind: 'link' as const,
    },
    {
      title: "I'm researching",
      description: 'Compare fee drag across all products. Sortable, filterable, and standardized for apples-to-apples comparison.',
      cta: 'Open the leaderboard',
      footnote: 'Standardized at S$350/mo, mid return scenario.',
      eyebrow: 'Research path',
      icon: Search,
      tone: 'border-violet-200 bg-violet-50/70 dark:border-violet-900/80 dark:bg-violet-950/20',
      accent: 'from-violet-500/15 via-violet-500/5 to-transparent',
      bullets: ['Filter by insurer and premium type', 'Compare net fees vs premiums', 'Open exact product variants'],
      href: '/ilp-fees/compare',
      kind: 'link' as const,
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
                ILP Fee Transparency
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300 sm:text-lg">
                Independent, privacy-first fee analysis for 92 Singapore ILP products. See where charges stack up, how bonuses really behave, and when exit math changes the decision.
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
                <p className="text-sm font-semibold text-slate-950 dark:text-white">What this dashboard is good for</p>
                <ul className="space-y-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  <li>Compare ILP fee drag without a sales pitch.</li>
                  <li>Inspect bonuses separately from gross fees.</li>
                  <li>Check surrender timing before you cancel.</li>
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
          New here? Read: 7 questions to ask your FA before signing an ILP &rarr;
        </a>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {entryCards.map((entry) => {
          const Icon = entry.icon
          const content = (
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
          )

          if (entry.kind === 'button') {
            return (
              <button key={entry.title} type="button" onClick={entry.action} className="group text-left">
                {content}
              </button>
            )
          }

          return (
            <Link key={entry.title} to={entry.href!} className="group">
              {content}
            </Link>
          )
        })}
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
        onSelect={(product, variant) => {
          setPickerOpen(false)
          navigate(`/ilp-fees/story/${product.id}?variantId=${encodeURIComponent(variant.id)}`)
        }}
      />
    </div>
  )
}
