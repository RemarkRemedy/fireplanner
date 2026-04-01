import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Share2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { generateShareUrl } from '@/lib/shareUrl'
import { useUIStore } from '@/stores/useUIStore'
import { trackEvent } from '@/lib/analytics'
import { isIlpRouteFamily } from '@/lib/ilpRoutes'

export function MobileShareFab() {
  const { pathname } = useLocation()
  const dismissedNudges = useUIStore((s) => s.dismissedNudges)
  const dismissNudge = useUIStore((s) => s.dismissNudge)

  const nudgeId = 'share-fab-tooltip'
  const alreadyDismissed = dismissedNudges.includes(nudgeId)
  const isIlpPage = isIlpRouteFamily(pathname)
  const [tooltipOpen, setTooltipOpen] = useState(!alreadyDismissed && !isIlpPage)

  const handleDismiss = () => {
    setTooltipOpen(false)
    dismissNudge(nudgeId)
  }

  const handleShare = async () => {
    handleDismiss()
    const { url, tooLong } = generateShareUrl()

    if (tooLong) {
      toast.warning('URL is very long. Consider using JSON export for complex plans.', {
        duration: 5000,
      })
    }

    // Try native share first
    if (navigator.share) {
      try {
        await navigator.share({ url, title: 'My FIRE Plan' })
        trackEvent('plan_shared', { method: 'native-share' })
        return
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return
        // Fall through to clipboard
      }
    }

    // Clipboard fallback
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Share link copied to clipboard')
      trackEvent('plan_shared', { method: 'clipboard' })
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = url
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      toast.success('Share link copied to clipboard')
    }
  }

  return (
    <div className="fixed bottom-28 right-4 z-40 md:hidden">
      <Popover open={tooltipOpen} onOpenChange={(v) => { if (!v) handleDismiss() }}>
        <PopoverAnchor asChild>
          <Button
            size="icon"
            className="rounded-full shadow-lg h-11 w-11"
            onClick={handleShare}
            aria-label="Share your plan"
          >
            <Share2 className="h-5 w-5" />
          </Button>
        </PopoverAnchor>
        <PopoverContent
          side="left"
          sideOffset={8}
          className="w-auto max-w-[200px] px-3 py-2 text-sm"
        >
          Share your plan to continue on another device
        </PopoverContent>
      </Popover>
    </div>
  )
}
