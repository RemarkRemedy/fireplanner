import { createContext } from 'react'
import type { ExpenseTrackerSignupHook } from '@/hooks/useExpenseTrackerSignup'
import type { SourceSurface } from '@/lib/validation/emailConstants'

export interface ExpenseTrackerContextValue {
  signup: ExpenseTrackerSignupHook
  isEligible: boolean
  modalOpen: boolean
  openModal: () => void
  closeModal: () => void
  dismissModal: (method?: 'overlay' | 'escape' | 'close_button') => void
  trackImpression: (surface: SourceSurface) => void
}

export const ExpenseTrackerContext = createContext<ExpenseTrackerContextValue | null>(null)
