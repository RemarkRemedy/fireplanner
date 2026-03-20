import { useEffect, useRef } from 'react'
import { readSessionFlag, setSessionFlag, readStorageValue } from '@/lib/storageFlags'
import {
  FEEDBACK_SESSION_KEY,
  FEEDBACK_DISMISSED_KEY,
  FEEDBACK_SUBMITTED_FLAG,
} from '@/lib/validation/emailConstants'
import { readFlag } from '@/lib/storageFlags'

const DISMISS_SUPPRESS_DAYS = 14

function isDismissedRecently(): boolean {
  const dismissed = readStorageValue(FEEDBACK_DISMISSED_KEY)
  if (!dismissed) return false
  const dismissedAt = new Date(dismissed).getTime()
  if (isNaN(dismissedAt)) return false
  return (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24) < DISMISS_SUPPRESS_DAYS
}

/**
 * Detects exit intent (mouse leaving viewport upward) and calls onOpen
 * to show the feedback modal. Fires once per session. Desktop only.
 * Suppressed for 14 days after dismiss or if already submitted feedback.
 */
export function useExitIntent(onOpen: () => void) {
  const firedRef = useRef(false)

  useEffect(() => {
    if (firedRef.current) return
    if (readSessionFlag(FEEDBACK_SESSION_KEY)) return
    if (isDismissedRecently()) return
    if (readFlag(FEEDBACK_SUBMITTED_FLAG)) return

    const handler = (e: MouseEvent) => {
      if (e.clientY <= 0 && !firedRef.current) {
        firedRef.current = true
        setSessionFlag(FEEDBACK_SESSION_KEY)
        onOpen()
      }
    }

    document.documentElement.addEventListener('mouseleave', handler)
    return () => document.documentElement.removeEventListener('mouseleave', handler)
  }, [onOpen])
}
