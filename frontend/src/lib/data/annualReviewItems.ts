/**
 * Annual review checklist items (Advisory Gap Feature 8).
 * Inspired by Providend's annual client review meetings.
 *
 * NOTE: Verify all #section-* anchors exist in InputsPage before shipping.
 */

export interface ReviewItemDef {
  id: string
  label: string
  description: string
  link: string
}

export const ANNUAL_REVIEW_ITEMS: ReviewItemDef[] = [
  { id: 'income', label: 'Update salary and income', description: 'Verify current salary, bonus, and any new income streams', link: '/inputs#section-income' },
  { id: 'expenses', label: 'Review expense assumptions', description: 'Check if spending has changed from last year', link: '/inputs#section-expenses' },
  { id: 'cpf', label: 'Check CPF balances', description: 'Update OA/SA/MA with latest CPF statement', link: '/inputs#section-cpf' },
  { id: 'srs', label: 'Review SRS contributions', description: 'Optimise SRS for this tax year', link: '/health-check' },
  { id: 'insurance', label: 'Check insurance coverage', description: 'Verify coverage still matches needs', link: '/health-check' },
  { id: 'goals', label: 'Update financial goals', description: 'Add new goals, remove completed ones', link: '/inputs#section-expenses' },
  { id: 'retirement-age', label: 'Reassess retirement age target', description: 'Still on track? Need to adjust?', link: '/inputs#section-personal' },
  { id: 'simulation', label: 'Re-run Monte Carlo simulation', description: 'See updated success probability', link: '/stress-test' },
  { id: 'property', label: 'Update property valuation', description: 'Check current market value estimate', link: '/inputs#section-property' },
]
