import { FlaskConical } from 'lucide-react'

const TELEGRAM_URL = 'https://t.me/sgfireplannerann'
const FEEDBACK_URL =
  'https://www.reddit.com/r/singaporefi/comments/1rcdnl3/i_built_a_free_singapore_fire_calculator_cpf_srs/'

export function BetaBanner() {
  return (
    <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/50 p-3 text-sm mb-4">
      <FlaskConical className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="font-medium text-foreground">Beta</span>
        <span className="text-muted-foreground">
          {' '}· Values are estimates and may not be accurate. Verify important numbers independently.{' '}
        </span>
        <a
          href={TELEGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-amber-700 dark:text-amber-400 hover:underline font-medium"
        >
          Updates
        </a>
        <span className="text-muted-foreground"> · </span>
        <a
          href={FEEDBACK_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-amber-700 dark:text-amber-400 hover:underline font-medium"
        >
          Feedback
        </a>
      </div>
    </div>
  )
}
