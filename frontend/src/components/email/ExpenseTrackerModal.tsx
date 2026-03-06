import { useEffect, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { ExpenseTrackerForm } from './ExpenseTrackerForm'
import { useExpenseTracker } from '@/hooks/useExpenseTracker'

export function ExpenseTrackerModal() {
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const { signup, modalOpen, closeModal, dismissModal, trackImpression } = useExpenseTracker()
  const location = useLocation()

  useEffect(() => {
    if (modalOpen) {
      trackImpression('modal')
    }
  }, [modalOpen, trackImpression])

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (!nextOpen && !signup.isSignedUp) {
      dismissModal('close_button')
    } else if (!nextOpen) {
      closeModal()
    }
  }, [dismissModal, closeModal, signup.isSignedUp])

  // Auto-close after successful signup
  useEffect(() => {
    if (signup.isSignedUp && modalOpen) {
      const timer = setTimeout(() => closeModal(), 2000)
      return () => clearTimeout(timer)
    }
  }, [signup.isSignedUp, modalOpen, closeModal])

  const title = "Want your real spending to update your FIRE plan?"
  const description = "I'm building a companion expense tracker for SGFirePlanner users. Join early access if you want a simpler way to keep your plan aligned with real-life spending."

  if (isDesktop) {
    return (
      <Dialog open={modalOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <ExpenseTrackerForm signup={signup} surface="modal" pagePath={location.pathname} />
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Sheet open={modalOpen} onOpenChange={handleOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <div className="mt-4">
          <ExpenseTrackerForm signup={signup} surface="modal" pagePath={location.pathname} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
