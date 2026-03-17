import { Lightbulb } from 'lucide-react'

interface MobileNudgeBarProps {
  nudgeCount: number
  onTap: () => void
}

export function MobileNudgeBar({ nudgeCount, onTap }: MobileNudgeBarProps) {
  if (nudgeCount === 0) return null

  return (
    <button
      onClick={onTap}
      className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-center gap-2 bg-primary py-3 text-primary-foreground shadow-lg lg:hidden"
    >
      <Lightbulb className="h-4 w-4" />
      <span className="text-sm font-medium">
        {nudgeCount} way{nudgeCount > 1 ? 's' : ''} to improve your plan
      </span>
    </button>
  )
}
