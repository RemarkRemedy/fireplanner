import { z } from 'zod'

export const SetupDraftSchema = z
  .object({
    currentAge: z.number().int().min(18).max(100),
    retirementAge: z.number().int().min(18).max(100),
    annualIncome: z.number().min(0),
    incomeType: z.enum(['gross', 'take-home']),
    annualExpenses: z.number().min(0),
    liquidNetWorth: z.number().min(0),
    residency: z.enum(['citizen', 'pr', 'foreigner']),
    cpfKnown: z.boolean(),
    ownsProperty: z.enum(['owns', 'planning', 'no']),
    healthcareEnabled: z.boolean(),
    isRedo: z.boolean(),
  })
  .passthrough()
