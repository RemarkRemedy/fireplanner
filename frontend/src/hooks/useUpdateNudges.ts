import { useMemo } from 'react'
import { useUIStore } from '@/stores/useUIStore'
import { CHANGELOG, DATA_VINTAGE } from '@/lib/data/changelog'
import { getDetectedMigrations } from '@/lib/migrationDetector'
import { STORE_REGISTRY } from '@/lib/storeRegistry'

/** Maps store keys to the section they affect on the Inputs page */
const STORE_TO_SECTION: Record<string, string> = {
  'fireplanner-household-plan-v1': 'section-personal',
  'fireplanner-profile': 'section-personal',
  'fireplanner-income': 'section-income',
  'fireplanner-allocation': 'section-allocation',
  'fireplanner-property': 'section-property',
  'fireplanner-withdrawal': 'section-fire-settings',
  'fireplanner-simulation': 'section-stress-test',
}

export interface UpdateNudge {
  id: string
  message: string
}

/**
 * Returns update nudges for a given section, combining:
 * 1. Changelog entries with matching affectedSections (unseen only)
 * 2. Migration-detected store upgrades (per-session only)
 */
export function useUpdateNudges(sectionId: string): UpdateNudge[] {
  const lastSeenDataVintage = useUIStore((s) => s.lastSeenDataVintage)
  const lastSeenDate = useUIStore((s) => s.lastSeenChangelogDate)
  const dismissedNudges = useUIStore((s) => s.dismissedNudges)

  return useMemo(() => {
    const nudges: UpdateNudge[] = []

    // 1. Changelog-driven nudges
    if (lastSeenDataVintage !== DATA_VINTAGE) {
      const unseenForSection = CHANGELOG.filter(
        (e) =>
          e.affectedSections?.includes(sectionId) &&
          e.category === 'data-update' &&
          (!lastSeenDate || e.date >= lastSeenDate)
      )
      for (const entry of unseenForSection) {
        const slug = entry.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)
        const nudgeId = `changelog-${entry.date}-${sectionId}-${slug}`
        if (!dismissedNudges.includes(nudgeId)) {
          nudges.push({
            id: nudgeId,
            message: `${entry.title} — review your inputs.`,
          })
        }
      }
    }

    // 2. Migration-detected nudges
    const migrations = getDetectedMigrations(STORE_REGISTRY)
    for (const m of migrations) {
      const mappedSection = STORE_TO_SECTION[m.storeKey]
      if (mappedSection !== sectionId) continue
      const nudgeId = `migration-${m.storeKey}-v${m.toVersion}`
      if (!dismissedNudges.includes(nudgeId)) {
        nudges.push({
          id: nudgeId,
          message:
            'Your settings were updated to a newer format. Review your inputs to ensure everything looks correct.',
        })
      }
    }

    return nudges
  }, [sectionId, lastSeenDataVintage, lastSeenDate, dismissedNudges])
}
