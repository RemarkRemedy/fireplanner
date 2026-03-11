import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useUIStore } from '@/stores/useUIStore'

/**
 * Tracks which input section is currently visible in the viewport
 * using IntersectionObserver. Returns null when not on the /inputs page.
 */
export function useActiveSection() {
  const location = useLocation()
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const isInputsPage = location.pathname === '/inputs'
  const cpfEnabled = useUIStore((s) => s.cpfEnabled)
  const healthcareEnabled = useUIStore((s) => s.healthcareEnabled)
  const propertyEnabled = useUIStore((s) => s.propertyEnabled)
  const protectionEnabled = useUIStore((s) => s.protectionEnabled)

  useEffect(() => {
    if (!isInputsPage) {
      return
    }

    const sectionIds = [
      'section-personal',
      'section-fire-settings',
      'section-income',
      'section-expenses',
      'section-net-worth',
      ...(cpfEnabled ? ['section-cpf'] : []),
      ...(healthcareEnabled ? ['section-healthcare'] : []),
      ...(protectionEnabled ? ['section-protection'] : []),
      ...(propertyEnabled ? ['section-property'] : []),
      'section-allocation',
    ]

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the most visible section in the viewport
        const visible = entries.filter((e) => e.isIntersecting)
        if (visible.length > 0) {
          // Pick the one closest to the top of viewport
          const top = visible.reduce((a, b) =>
            a.boundingClientRect.top < b.boundingClientRect.top ? a : b
          )
          setActiveSection(top.target.id)
        }
      },
      { rootMargin: '-20% 0px -70% 0px', threshold: 0 }
    )

    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter(Boolean) as Element[]

    elements.forEach((el) => observer.observe(el))

    // Also listen for focus/click events — when a user clicks into an input
    // within a section, immediately switch to that section's help content
    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null
      const section = target?.closest('[id^="section-"]')
      if (section && sectionIds.includes(section.id)) {
        setActiveSection(section.id)
      }
    }
    document.addEventListener('focusin', onFocusIn)

    return () => {
      observer.disconnect()
      document.removeEventListener('focusin', onFocusIn)
    }
  }, [isInputsPage, cpfEnabled, healthcareEnabled, protectionEnabled, propertyEnabled])

  // When not on inputs page, don't report any active section
  return { activeSection: isInputsPage ? activeSection : null, isInputsPage }
}
