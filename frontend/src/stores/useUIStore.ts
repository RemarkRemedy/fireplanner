import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { CHANGELOG, DATA_VINTAGE } from '@/lib/data/changelog'
import type { HouseholdSectionToggles } from '@/lib/household/sectionVisibility'
import type { SectionId, SectionOrderKey } from '@/lib/household/sectionOrder'

import type { NudgeFlowId } from '@/lib/data/nudgeFlows'
import { SNOOZE_DURATION_MS } from '@/lib/annualReview'

type StatsPosition = 'bottom' | 'top'

type DollarBasis = 'real' | 'nominal'

interface UIState {
  sectionOrder: SectionOrderKey
  statsPosition: StatsPosition
  cpfEnabled: boolean
  propertyEnabled: boolean
  healthcareEnabled: boolean
  protectionEnabled: boolean  // Show Protection section on InputsPage + Health Check in nav
  mode: 'simple' | 'advanced'
  sectionOverrides: Partial<Record<string, 'simple' | 'advanced'>>
  dismissedNudges: string[]
  helpPanelOpen: boolean
  dollarBasis: DollarBasis
  lastSeenChangelogDate: string | null
  lastSeenDataVintage: string | null
  showNewPurchase: boolean
  collapsedSections: string[]
  quickModeActive: boolean
  // Per-adult projection view: 'joint' or an adultId string
  projectionView: 'joint' | string
  // Transient (not persisted): true when a contextual engagement nudge is visible
  contextualNudgeActive: boolean
  /** Transient (not persisted): per-adult simulation view — 'joint' or an adultId string */
  simulationView: 'joint' | string
  setupCompleted: boolean
  setupPopulatedSections: SectionId[]
  completedNudgeFlows: NudgeFlowId[]
  dismissedSectionIntros: SectionId[]
  /** When true, the blended per-expense FIRE number overrides the dashboard primary FIRE number */
  useBlendedFireNumber: boolean
  /** ISO date string of the last completed annual review, or null if never reviewed */
  lastReviewDate: string | null
  /** ISO date string: suppress the annual review banner until this date */
  reviewSnoozeUntil: string | null
  /** IDs of annual review checklist items the user has checked off in the current review */
  reviewCheckedItems: string[]
}

interface UIActions {
  setField: <K extends keyof UIState>(field: K, value: UIState[K]) => void
  setSectionMode: (section: string, mode: 'simple' | 'advanced') => void
  clearSectionOverrides: () => void
  ensureHouseholdDataVisible: (required: HouseholdSectionToggles) => void
  dismissNudge: (nudgeId: string) => void
  toggleHelpPanel: () => void
  markChangelogSeen: () => void
  setShowNewPurchase: (value: boolean) => void
  toggleSection: (sectionId: string) => void
  expandSection: (sectionId: string) => void
  setContextualNudgeActive: (active: boolean) => void
  /** Toggle a review checklist item */
  toggleReviewItem: (itemId: string) => void
  /** Mark the annual review as complete (sets lastReviewDate, clears checklist) */
  completeReview: () => void
  /** Snooze the review banner for 30 days */
  snoozeReview: () => void
}

const DEFAULT_UI: UIState = {
  sectionOrder: 'goal-first',
  statsPosition: 'bottom',
  cpfEnabled: true,
  propertyEnabled: true,
  healthcareEnabled: true,
  protectionEnabled: true,
  mode: 'simple',
  sectionOverrides: {},
  dismissedNudges: [],
  helpPanelOpen: true,
  dollarBasis: 'nominal',
  lastSeenChangelogDate: null,
  lastSeenDataVintage: null,
  showNewPurchase: false,
  collapsedSections: [],
  quickModeActive: false,
  projectionView: 'joint',
  contextualNudgeActive: false,
  simulationView: 'joint',
  setupCompleted: false,
  setupPopulatedSections: [] as SectionId[],
  completedNudgeFlows: [] as NudgeFlowId[],
  dismissedSectionIntros: [] as SectionId[],
  useBlendedFireNumber: false,
  lastReviewDate: null,
  reviewSnoozeUntil: null,
  reviewCheckedItems: [] as string[],
}

export const useUIStore = create<UIState & UIActions>()(
  persist(
    (set) => ({
      ...DEFAULT_UI,

      setField: (field, value) => {
        if (field === 'mode') {
          set({ [field]: value, sectionOverrides: {} })
        } else {
          set({ [field]: value })
        }
      },

      setSectionMode: (section, mode) =>
        set((state) => ({
          sectionOverrides: { ...state.sectionOverrides, [section]: mode },
        })),

      clearSectionOverrides: () => set({ sectionOverrides: {} }),

      ensureHouseholdDataVisible: (required) =>
        set((state) => {
          return {
            cpfEnabled: state.cpfEnabled || required.cpfEnabled,
            propertyEnabled: state.propertyEnabled || required.propertyEnabled,
            healthcareEnabled: state.healthcareEnabled || required.healthcareEnabled,
            protectionEnabled: state.protectionEnabled || required.protectionEnabled,
          }
        }),

      dismissNudge: (nudgeId) =>
        set((state) => ({
          dismissedNudges: state.dismissedNudges.includes(nudgeId)
            ? state.dismissedNudges
            : [...state.dismissedNudges, nudgeId],
        })),

      toggleHelpPanel: () => set((state) => ({ helpPanelOpen: !state.helpPanelOpen })),

      markChangelogSeen: () =>
        set((state) => {
          const latestDate = CHANGELOG[0]?.date ?? null
          // Prune dismissed nudges for changelog entries now marked as seen
          const prunedNudges = state.dismissedNudges.filter(
            (id) => !id.startsWith('changelog-')
          )
          return {
            lastSeenChangelogDate: latestDate,
            lastSeenDataVintage: DATA_VINTAGE,
            dismissedNudges: prunedNudges,
          }
        }),

      setShowNewPurchase: (value) => set({ showNewPurchase: value }),

      toggleSection: (sectionId) =>
        set((state) => {
          const sections = [...state.collapsedSections]
          const idx = sections.indexOf(sectionId)
          if (idx >= 0) {
            sections.splice(idx, 1)
          } else {
            sections.push(sectionId)
          }
          return { collapsedSections: sections }
        }),

      expandSection: (sectionId) =>
        set((state) => ({
          collapsedSections: state.collapsedSections.filter((id) => id !== sectionId),
        })),

      setContextualNudgeActive: (active) => set({ contextualNudgeActive: active }),

      toggleReviewItem: (itemId) =>
        set((state) => {
          const items = state.reviewCheckedItems.includes(itemId)
            ? state.reviewCheckedItems.filter((id) => id !== itemId)
            : [...state.reviewCheckedItems, itemId]
          return { reviewCheckedItems: items }
        }),

      completeReview: () =>
        set({
          lastReviewDate: new Date().toISOString(),
          reviewCheckedItems: [],
          reviewSnoozeUntil: null,
        }),

      snoozeReview: () =>
        set({
          reviewSnoozeUntil: new Date(Date.now() + SNOOZE_DURATION_MS).toISOString(),
        }),
    }),
    {
      name: 'fireplanner-ui',
      version: 16,
      partialize: (state) => {
        // Exclude transient fields from persistence
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { contextualNudgeActive, quickModeActive, simulationView, ...persisted } = state
        return persisted
      },
      migrate: (persisted, version) => {
        const state = persisted as Record<string, unknown>
        if (version < 2) {
          state.cpfEnabled = true
          state.propertyEnabled = false
          state.healthcareEnabled = false
        }
        if (version < 3) {
          // Migrate allocationAdvanced → mode
          state.mode = state.allocationAdvanced ? 'advanced' : 'simple'
          delete state.allocationAdvanced
          // Migrate sidebar → bottom
          if (state.statsPosition === 'sidebar') {
            state.statsPosition = 'bottom'
          }
        }
        if (version < 4) {
          state.sectionOverrides = {}
          state.dismissedNudges = []
        }
        if (version < 5) {
          state.helpPanelOpen = false
        }
        if (version < 6) {
          state.dollarBasis = 'real'
        }
        if (version < 7) {
          state.dollarBasis = 'nominal'
        }
        if (version < 8) {
          state.lastSeenChangelogDate = state.lastSeenChangelogDate ?? null
          state.lastSeenDataVintage = state.lastSeenDataVintage ?? null
        }
        if (version < 9) {
          state.showNewPurchase = false
          state.collapsedSections = []
        }
        if (version < 10) {
          state.quickModeActive = false
        }
        if (version < 11) {
          state.protectionEnabled = false
        }
        if (version < 12) {
          state.setupCompleted = false
          state.setupPopulatedSections = []
          state.completedNudgeFlows = []
          state.dismissedSectionIntros = []
        }
        if (version < 13) {
          state.protectionEnabled = true
        }
        if (version < 14) {
          // healthcareEnabled was introduced as false in v2 and never migrated to true.
          // protectionEnabled was fixed in v13 but healthcareEnabled was missed.
          state.healthcareEnabled = true
        }
        if (version < 15) {
          state.useBlendedFireNumber = false
        }
        if (version < 16) {
          state.lastReviewDate = null
          state.reviewSnoozeUntil = null
          state.reviewCheckedItems = []
        }
        return state
      },
    }
  )
)
