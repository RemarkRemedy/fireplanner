import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Info, X } from 'lucide-react'
import { useProfileStore } from '@/stores/useProfileStore'
import { trackEvent } from '@/lib/analytics'

const SESSION_KEY = 'fireplanner-welcome-dismissed'

export function WelcomeBanner() {
  const currentAge = useProfileStore((s) => s.currentAge)
  const annualIncome = useProfileStore((s) => s.annualIncome)
  const liquidNetWorth = useProfileStore((s) => s.liquidNetWorth)

  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(SESSION_KEY) === '1'
    } catch {
      return false
    }
  })

  // Only show when all three profile fields are at their defaults
  const isDefaults =
    currentAge === 30 && annualIncome === 72000 && liquidNetWorth === 0

  if (dismissed || !isDefaults) return null

  function handleDismiss() {
    setDismissed(true)
    try {
      sessionStorage.setItem(SESSION_KEY, '1')
    } catch {
      // sessionStorage unavailable (private browsing, etc.)
    }
  }

  return (
    <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/50 p-3 text-sm mb-4">
      <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <span className="text-foreground">
          Welcome to SG FIRE Planner, a free retirement planning tool for Singapore.
          Your data stays in your browser.
        </span>
        <span className="text-muted-foreground"> · </span>
        <Link
          to="/"
          onClick={() => trackEvent('welcome_banner_cta_clicked')}
          className="text-blue-600 dark:text-blue-400 hover:underline"
        >
          Take the guided setup
        </Link>
      </div>
      <button
        onClick={handleDismiss}
        className="text-muted-foreground hover:text-foreground shrink-0"
        aria-label="Dismiss welcome banner"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
