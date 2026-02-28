import { useState } from 'react'
import { X, FlaskConical } from 'lucide-react'
import { useUIStore } from '@/stores/useUIStore'

const DISMISS_KEY = 'fireplanner-beta-banner-dismissed-v2'
const TELEGRAM_URL = 'https://t.me/sgfireplannerann'
const FEEDBACK_URL =
  'https://www.reddit.com/r/singaporefi/comments/1rcdnl3/i_built_a_free_singapore_fire_calculator_cpf_srs/'

export function BetaBanner() {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISS_KEY) === '1'
  )
  const nudgeActive = useUIStore((s) => s.contextualNudgeActive)

  if (dismissed) return null

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1')
    setDismissed(true)
  }

  return (
    <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/50 p-3 text-sm mb-4">
      <FlaskConical className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="font-medium text-foreground">Beta</span>
        <span className="text-muted-foreground">
          {' '}· Thanks for trying FIRE Planner! We're actively improving based on user feedback.{' '}
        </span>
        {!nudgeActive && (
          <>
            <a
              href={TELEGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-700 dark:text-amber-400 hover:underline font-medium"
            >
              Follow updates on Telegram
            </a>
            <span className="text-muted-foreground"> · </span>
          </>
        )}
        <a
          href={FEEDBACK_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-amber-700 dark:text-amber-400 hover:underline font-medium"
        >
          Share feedback on Reddit
        </a>
      </div>
      <button
        onClick={handleDismiss}
        className="text-muted-foreground hover:text-foreground shrink-0"
        aria-label="Dismiss beta banner"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
