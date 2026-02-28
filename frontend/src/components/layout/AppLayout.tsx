import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Toaster } from 'sonner'
import { HelpCircle } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { FireStatsStrip } from './FireStatsStrip'
import { SaveIndicator } from './SaveIndicator'
import { HelpPanel } from './HelpPanel'
import { PlanUrlHandler } from '@/components/shared/PlanUrlHandler'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { useUIStore } from '@/stores/useUIStore'
import { cn } from '@/lib/utils'
import { tryUndo } from '@/lib/undo'
import { BetaBanner } from '@/components/shared/BetaBanner'
import { DataUpdateBanner } from '@/components/shared/DataUpdateBanner'
import { MobileShareFab } from '@/components/shared/MobileShareFab'

// Pages that show the stats strip (inputs and analysis pages, not start/reference)
const STATS_ROUTES = ['/inputs', '/projection', '/withdrawal', '/stress-test', '/dashboard']

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 768px)').matches : true
  )
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 768px)')
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])
  return isDesktop
}

export function AppLayout() {
  const statsPosition = useUIStore((s) => s.statsPosition)
  const helpPanelOpen = useUIStore((s) => s.helpPanelOpen)
  const location = useLocation()
  const isDesktop = useIsDesktop()

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+Z / Cmd+Z undo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        const tag = (e.target as HTMLElement)?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA') return
        if (tryUndo()) {
          e.preventDefault()
        }
      }
      // Shift+? toggle help panel
      if (e.key === '?' && e.shiftKey) {
        const tag = (e.target as HTMLElement)?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA') return
        e.preventDefault()
        useUIStore.getState().toggleHelpPanel()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Scroll to top on route change (needed for mobile body scroll)
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  const showStats = STATS_ROUTES.includes(location.pathname)
  const isBottom = statsPosition === 'bottom'
  const isTop = statsPosition === 'top'

  return (
    <div className="flex min-h-dvh md:h-screen md:overflow-hidden">
      <Toaster position="bottom-right" />
      <SaveIndicator />
      <PlanUrlHandler />
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 md:min-h-0">
        {showStats && isTop && <FireStatsStrip position="top" />}
        <div className="flex flex-1 md:min-h-0 relative">
          <main
            className={cn(
              'flex-1 min-w-0 md:h-full md:overflow-auto',
              'pb-14 md:pb-0',
              showStats && isBottom && 'pb-24 md:pb-10'
            )}
          >
            <div className="@container container pt-14 md:pt-6 pb-6 max-w-6xl">
              <BetaBanner />
              <DataUpdateBanner />
              <Outlet />
            </div>
            <footer className="container max-w-6xl pb-6 px-6">
              <p className="text-xs text-muted-foreground text-center">
                This tool is for educational and planning purposes only. It does not constitute financial advice.
                Results are estimates based on historical data and assumptions that may not reflect future outcomes.
                Your financial data stays in your browser and is never sent to any server. Email addresses submitted for notifications are stored separately. Not affiliated with CPF Board or any government agency.
              </p>
            </footer>
          </main>
          {isDesktop && helpPanelOpen && <HelpPanel />}
        </div>
        {showStats && isBottom && <FireStatsStrip position="bottom" />}
      </div>

      {/* Mobile FABs: Share + Help */}
      {!isDesktop && (
        <>
          <MobileShareFab />
          <div className="fixed bottom-16 right-4 z-40 md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button size="icon" className="rounded-full shadow-lg h-10 w-10">
                  <HelpCircle className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-[70vh] overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Help</SheetTitle>
                </SheetHeader>
                <HelpPanel mobile />
              </SheetContent>
            </Sheet>
          </div>
        </>
      )}
    </div>
  )
}
