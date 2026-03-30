import { useEffect } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, BookOpenText, Calculator, ChartNoAxesColumnIncreasing, FileSpreadsheet, ShieldCheck } from 'lucide-react'
import { Toaster } from 'sonner'
import { cn } from '@/lib/utils'

const feeNav = [
  { to: '/ilp-fees', label: 'Overview', icon: BookOpenText },
  { to: '/ilp-fees/compare', label: 'Compare', icon: ChartNoAxesColumnIncreasing },
  { to: '/ilp-fees/exit', label: 'Exit', icon: Calculator },
  { to: '/ilp-review', label: 'Review', icon: FileSpreadsheet },
]

export function FeeDashboardLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const isStoryRoute = location.pathname.startsWith('/ilp-fees/story/')

  useEffect(() => {
    if (location.pathname !== '/' && location.pathname.endsWith('/')) {
      navigate(location.pathname.slice(0, -1) + location.search + location.hash, { replace: true })
    }
  }, [location.pathname, location.search, location.hash, navigate])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  return (
    <div className="min-h-dvh bg-[#f6f9fc] text-[#0f1724]">
      <Toaster position="bottom-right" />

      <header className="sticky top-0 z-40 border-b border-[#d9e4f2] bg-[#f6f9fc]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <Link
                to="/"
                className="inline-flex items-center gap-2 text-sm font-medium text-[#5f6877] transition-colors hover:text-[#0f1724]"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to FIRE Planner
              </Link>
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#d9e4f2] bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#5f6877]">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Independent fee investigation
                </div>
                <div>
                  <div className="font-serif text-3xl leading-none text-[#0f1724] sm:text-4xl">
                    ILP Fee Dashboard
                  </div>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5f6877] sm:text-base">
                    Compare gross fees, bonus support, and exit timing without the planner chrome getting in the way.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-2 text-sm text-[#5f6877] sm:grid-cols-2">
              <div className="rounded-2xl border border-[#d9e4f2] bg-white px-4 py-3">
                <div className="font-mono text-[11px] uppercase tracking-[0.18em]">Point of view</div>
                <div className="mt-1 font-medium text-[#0f1724]">Fees are certain. Sales framing is not.</div>
              </div>
              <div className="rounded-2xl border border-[#d9e4f2] bg-white px-4 py-3">
                <div className="font-mono text-[11px] uppercase tracking-[0.18em]">Privacy</div>
                <div className="mt-1 font-medium text-[#0f1724]">Policy details stay in your browser.</div>
              </div>
            </div>
          </div>

          <nav className="flex flex-wrap gap-2">
            {feeNav.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/ilp-fees'}
                  className={({ isActive }) =>
                    cn(
                      'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'border-[#174a7c] bg-[#174a7c] text-white'
                        : 'border-[#d9e4f2] bg-white text-[#5f6877] hover:border-[#174a7c]/40 hover:text-[#0f1724]',
                    )
                  }
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              )
            })}
          </nav>
        </div>
      </header>

      <main className="min-h-[calc(100dvh-17rem)]">
        <div className={cn('mx-auto max-w-7xl px-4 sm:px-6 lg:px-8', isStoryRoute ? '' : 'py-8 sm:py-10')}>
          <Outlet />
        </div>
      </main>

      <footer className="border-t border-[#d9e4f2] bg-[#eef4fb]/80">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6 lg:flex-row lg:items-start lg:justify-between lg:px-8">
          <div className="max-w-2xl">
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#5f6877]">Not financial advice</div>
            <p className="mt-2 text-sm leading-6 text-[#5f6877]">
              This dashboard models fee structures from product documents and standardized assumptions. Check your own policy documents and speak to a licensed adviser before making policy decisions.
            </p>
          </div>
          <div className="max-w-xl">
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#5f6877]">What stays true here</div>
            <p className="mt-2 text-sm leading-6 text-[#5f6877]">
              Bonus support is shown separately from gross fees, exit scenarios are basis-dependent, and unsupported catalog notes should not be read as product-scope claims.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
