import { useContext } from 'react'
import { ExpenseTrackerContext } from '@/components/email/ExpenseTrackerContext'

export function useExpenseTracker() {
  const ctx = useContext(ExpenseTrackerContext)
  if (!ctx) throw new Error('useExpenseTracker must be used within ExpenseTrackerProvider')
  return ctx
}
