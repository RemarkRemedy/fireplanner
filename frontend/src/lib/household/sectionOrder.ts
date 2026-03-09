/**
 * Section IDs used across InputsPage, Sidebar, and completion tracking.
 * Canonical definition lives here in lib/ — hooks re-export this type.
 */
export type SectionId =
  | 'section-personal'
  | 'section-fire-settings'
  | 'section-income'
  | 'section-expenses'
  | 'section-goals'
  | 'section-net-worth'
  | 'section-cpf'
  | 'section-healthcare'
  | 'section-property'
  | 'section-allocation'

export type SectionOrderKey = 'goal-first' | 'story-first' | 'already-fire'

/**
 * Section render order for each pathway. Matches the Sidebar arrays but as
 * bare IDs — excludes Goals and Healthcare (sub-items of Spending).
 *
 * One Accordion per section (not a shared root). Each section manages its
 * own expand/collapse state independently.
 */
export const SECTION_ORDERINGS: Record<SectionOrderKey, readonly SectionId[]> = {
  'goal-first': [
    'section-personal',
    'section-fire-settings',
    'section-income',
    'section-expenses',
    'section-net-worth',
    'section-cpf',
    'section-property',
    'section-allocation',
  ],
  'story-first': [
    'section-personal',
    'section-income',
    'section-expenses',
    'section-net-worth',
    'section-cpf',
    'section-property',
    'section-allocation',
    'section-fire-settings',
  ],
  'already-fire': [
    'section-personal',
    'section-net-worth',
    'section-property',
    'section-expenses',
    'section-allocation',
    'section-fire-settings',
    'section-cpf',
    'section-income',
  ],
} as const
