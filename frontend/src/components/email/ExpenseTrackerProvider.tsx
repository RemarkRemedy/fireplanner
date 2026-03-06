import { createContext, useContext, useState, useCallback, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { trackEvent } from '@/lib/analytics'
import { isCompanionMode } from '@/lib/companion/isCompanionMode'
import { readStorageValue, setStorageValue, setSessionFlag, readSessionFlag } from '@/lib/storageFlags'
import {
  EXPENSE_TRACKER_MODAL_DISMISSED_KEY,
  EXPENSE_TRACKER_MODAL_SESSION_KEY,
  type SourceSurface,
} from '@/lib/validation/emailConstants'
import { useExpenseTrackerSignup, type ExpenseTrackerSignupHook } from '@/hooks/useExpenseTrackerSignup'

const DISMISS_SUPPRESS_DAYS = 14

function isModalDismissedRecently(): boolean {
  const dismissed = readStorageValue(EXPENSE_TRACKER_MODAL_DISMISSED_KEY)
  if (!dismissed) return false
  const dismissedAt = new Date(dismissed).getTime()
  if (isNaN(dismissedAt)) return false
  return (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24) < DISMISS_SUPPRESS_DAYS
}

interface ExpenseTrackerContextValue {
  signup: ExpenseTrackerSignupHook
  isEligible: boolean
  modalOpen: boolean
  openModal: () => void
  closeModal: () => void
  dismissModal: (method?: 'overlay' | 'escape' | 'close_button') => void
  trackImpression: (surface: SourceSurface) => void
}

const ExpenseTrackerContext = createContext<ExpenseTrackerContextValue | null>(null)

export function ExpenseTrackerProvider({ children }: { children: React.ReactNode }) {
  const signup = useExpenseTrackerSignup()
  const location = useLocation()
  const companion = isCompanionMode()

  const isEligible = !signup.isSignedUp && !companion

  const [modalOpen, setModalOpen] = useState(false)
  const modalDismissedRecently = useRef(isModalDismissedRecently())
  const modalShownThisSession = useRef(readSessionFlag(EXPENSE_TRACKER_MODAL_SESSION_KEY))

  const impressionTracked = useRef<Record<string, boolean>>({})

  const openModal = useCallback(() => {
    if (!isEligible || modalDismissedRecently.current || modalShownThisSession.current) return
    setModalOpen(true)
    modalShownThisSession.current = true
    setSessionFlag(EXPENSE_TRACKER_MODAL_SESSION_KEY)
    trackEvent('expense_tracker_form_open', { surface: 'modal', page: location.pathname })
  }, [isEligible, location.pathname])

  const closeModal = useCallback(() => {
    setModalOpen(false)
  }, [])

  const dismissModal = useCallback((method: 'overlay' | 'escape' | 'close_button' = 'close_button') => {
    setModalOpen(false)
    setStorageValue(EXPENSE_TRACKER_MODAL_DISMISSED_KEY, new Date().toISOString())
    modalDismissedRecently.current = true
    trackEvent('expense_tracker_modal_dismiss', { page: location.pathname, method })
  }, [location.pathname])

  const trackImpression = useCallback((surface: SourceSurface) => {
    if (impressionTracked.current[surface]) return
    impressionTracked.current[surface] = true
    trackEvent('expense_tracker_impression', { surface, page: location.pathname })
  }, [location.pathname])

  return (
    <ExpenseTrackerContext.Provider value={{
      signup, isEligible, modalOpen, openModal, closeModal, dismissModal, trackImpression,
    }}>
      {children}
    </ExpenseTrackerContext.Provider>
  )
}

export function useExpenseTracker(): ExpenseTrackerContextValue {
  const ctx = useContext(ExpenseTrackerContext)
  if (!ctx) throw new Error('useExpenseTracker must be used within ExpenseTrackerProvider')
  return ctx
}
