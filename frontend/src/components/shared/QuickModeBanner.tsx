import { useUIStore } from '@/stores/useUIStore'
import { trackEvent } from '@/lib/analytics'

export function QuickModeBanner() {
  const setField = useUIStore((s) => s.setField)

  return (
    <div className="flex items-center justify-between gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg text-sm">
      <span className="text-blue-800 dark:text-blue-200">
        Quick Plan mode — showing essentials only.
      </span>
      <button
        className="text-blue-600 dark:text-blue-400 hover:underline font-medium whitespace-nowrap"
        onClick={() => {
          setField('quickModeActive', false)
          trackEvent('quick_mode_expanded')
        }}
      >
        Show all sections
      </button>
    </div>
  )
}
