import { useEffect, useState } from 'react'

const ILP_FEES_ILLUSTRATIVE_STORAGE_KEY = 'fireplanner-ilp-fees-illustrative-charts'

function readIlpFeesIllustrativeDisclosure() {
  if (typeof window === 'undefined') return false

  try {
    return window.localStorage.getItem(ILP_FEES_ILLUSTRATIVE_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function useIlpFeesIllustrativeDisclosure() {
  const [revealed, setRevealed] = useState(readIlpFeesIllustrativeDisclosure)

  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      if (revealed) {
        window.localStorage.setItem(ILP_FEES_ILLUSTRATIVE_STORAGE_KEY, '1')
      } else {
        window.localStorage.removeItem(ILP_FEES_ILLUSTRATIVE_STORAGE_KEY)
      }
    } catch {
      // Ignore storage failures; the UI can still function for the current session.
    }
  }, [revealed])

  return {
    revealed,
    setRevealed,
  }
}
