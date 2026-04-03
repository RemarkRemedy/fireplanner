import { useCallback, useEffect, useState } from 'react'

const ILP_FEES_ILLUSTRATIVE_STORAGE_KEY = 'fireplanner-ilp-fees-illustrative-charts'
const ILP_FEES_ILLUSTRATIVE_EVENT = 'fireplanner:ilp-fees-illustrative-charts-change'

export function readIlpFeesIllustrativeDisclosure() {
  if (typeof window === 'undefined') return false

  try {
    return window.localStorage.getItem(ILP_FEES_ILLUSTRATIVE_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function writeIlpFeesIllustrativeDisclosure(revealed: boolean) {
  if (typeof window === 'undefined') return

  try {
    if (revealed) {
      window.localStorage.setItem(ILP_FEES_ILLUSTRATIVE_STORAGE_KEY, '1')
    } else {
      window.localStorage.removeItem(ILP_FEES_ILLUSTRATIVE_STORAGE_KEY)
    }
    window.dispatchEvent(new Event(ILP_FEES_ILLUSTRATIVE_EVENT))
  } catch {
    // Ignore storage failures; the UI can still function for the current session.
  }
}

export function useIlpFeesIllustrativeDisclosure(enabled = true) {
  const [revealed, setRevealedState] = useState(() => enabled ? readIlpFeesIllustrativeDisclosure() : false)

  useEffect(() => {
    if (!enabled) return
    setRevealedState(readIlpFeesIllustrativeDisclosure())
  }, [enabled])

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return

    const sync = () => {
      setRevealedState(readIlpFeesIllustrativeDisclosure())
    }

    window.addEventListener('storage', sync)
    window.addEventListener(ILP_FEES_ILLUSTRATIVE_EVENT, sync)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener(ILP_FEES_ILLUSTRATIVE_EVENT, sync)
    }
  }, [enabled])

  const setRevealed = useCallback((value: boolean) => {
    if (!enabled) {
      setRevealedState(value)
      return
    }

    writeIlpFeesIllustrativeDisclosure(value)
    setRevealedState(value)
  }, [enabled])

  return {
    revealed,
    setRevealed,
  }
}
