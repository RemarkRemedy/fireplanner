/**
 * Shared demo-loading logic used by both StartPage and QuickEstimateForm.
 * Accepts dependencies as params to avoid coupling to React hooks.
 */

import { createElement } from 'react'
import { toast } from 'sonner'
import { DEMO_SCENARIO_DRAFT, DEMO_PLAN_TYPE } from '@/lib/data/demoScenario'
import { applySetupDraft } from '@/lib/household/setupDraft'
import { saveScenario } from '@/lib/scenarios'
import { setDemoActive, clearDemoActive, clearFireplannerData } from '@/components/shared/DemoBadge'
import { trackEvent } from '@/lib/analytics'
import type { SectionId } from '@/lib/household/sectionOrder'

const ALL_DEMO_SECTIONS: SectionId[] = [
  'section-personal', 'section-fire-settings', 'section-income',
  'section-expenses', 'section-net-worth', 'section-cpf',
  'section-healthcare', 'section-property', 'section-allocation',
]

interface LoadDemoDeps {
  hasExistingData: boolean
  setSetupCompleted: (value: boolean) => void
  setPopulatedSections: (sections: SectionId[]) => void
  navigate: (path: string) => void
}

export function loadDemoData({ hasExistingData, setSetupCompleted, setPopulatedSections, navigate }: LoadDemoDeps) {
  if (hasExistingData) {
    try { saveScenario('Auto-save before demo') } catch { /* max scenarios reached */ }
  }
  applySetupDraft(DEMO_SCENARIO_DRAFT, DEMO_PLAN_TYPE)
  setSetupCompleted(true)
  setPopulatedSections(ALL_DEMO_SECTIONS)
  trackEvent('demo_loaded')
  setDemoActive()
  navigate('/projection')
  setTimeout(() => {
    toast('You are viewing demo data', {
      description: createElement('div', { className: 'flex flex-col gap-2 mt-1' },
        createElement('p', { className: 'text-sm' }, 'This is sample data. Start your own plan when ready.'),
        createElement('button', {
          className: 'inline-flex items-center rounded-md bg-white border border-amber-400 px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-50',
          onClick: () => { toast.dismiss(); clearDemoActive(); clearFireplannerData(); window.location.href = '/setup' },
        }, 'Start your own plan'),
      ),
      duration: Infinity,
      style: { backgroundColor: '#f59e0b', color: '#451a03', border: '1px solid #d97706' },
    })
  }, 500)
}
