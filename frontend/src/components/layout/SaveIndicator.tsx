import { useState, useEffect, useRef } from 'react'
import { Check } from 'lucide-react'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { useWithdrawalStore } from '@/stores/useWithdrawalStore'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'

export function SaveIndicator() {
  const [visible, setVisible] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const initialRef = useRef(true)

  useEffect(() => {
    // Skip the initial render to avoid flashing on mount
    const timer = setTimeout(() => {
      initialRef.current = false
    }, 1000)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    const show = () => {
      if (initialRef.current) return
      setVisible(true)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => setVisible(false), 2000)
    }

    const unsubs = [
      useAllocationStore.subscribe(show),
      useSimulationStore.subscribe(show),
      useWithdrawalStore.subscribe(show),
      useHouseholdPlanStore.subscribe(show),
    ]

    return () => {
      unsubs.forEach((unsub) => unsub())
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  if (!visible) return null

  return (
    <div className="fixed bottom-4 right-4 md:bottom-auto md:top-4 md:right-4 z-40 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-medium shadow-sm border border-green-200 dark:border-green-800 animate-in fade-in duration-200">
      <Check className="h-3 w-3" />
      Saved
    </div>
  )
}
