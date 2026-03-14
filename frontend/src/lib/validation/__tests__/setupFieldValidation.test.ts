import { describe, expect, it } from 'vitest'
import { validateSetupField } from '../setupFieldValidation'
import { MEDISAVE_BHS } from '@/lib/data/healthcarePremiums'
import { RSTU_TAX_RELIEF_CAP } from '@/lib/data/cpfRates'
import { SRS_ANNUAL_CAP } from '@/lib/data/taxBrackets'

describe('validateSetupField', () => {
  // -------------------------------------------------------------------
  // Age fields
  // -------------------------------------------------------------------
  describe('currentAge', () => {
    it('rejects age below 18', () => {
      expect(validateSetupField('currentAge', 15)).not.toBeNull()
    })

    it('rejects age above 100', () => {
      expect(validateSetupField('currentAge', 105)).not.toBeNull()
    })

    it('rejects non-integer', () => {
      expect(validateSetupField('currentAge', 30.5)).not.toBeNull()
    })

    it('accepts valid age', () => {
      expect(validateSetupField('currentAge', 30)).toBeNull()
    })
  })

  describe('retirementAge', () => {
    it('rejects retirement age <= currentAge', () => {
      const err = validateSetupField('retirementAge', 40, { currentAge: 45 })
      expect(err).toBe('Retirement age must be greater than current age')
    })

    it('rejects retirement age equal to currentAge', () => {
      const err = validateSetupField('retirementAge', 45, { currentAge: 45 })
      expect(err).toBe('Retirement age must be greater than current age')
    })

    it('accepts retirement age > currentAge', () => {
      expect(validateSetupField('retirementAge', 55, { currentAge: 30 })).toBeNull()
    })

    it('rejects retirement age below schema min (30)', () => {
      expect(validateSetupField('retirementAge', 25)).not.toBeNull()
    })
  })

  // -------------------------------------------------------------------
  // Income / expenses
  // -------------------------------------------------------------------
  describe('annualIncome', () => {
    it('rejects negative income', () => {
      expect(validateSetupField('annualIncome', -5000)).not.toBeNull()
    })

    it('accepts zero income', () => {
      expect(validateSetupField('annualIncome', 0)).toBeNull()
    })

    it('accepts positive income', () => {
      expect(validateSetupField('annualIncome', 72000)).toBeNull()
    })
  })

  describe('annualExpenses', () => {
    it('rejects negative expenses', () => {
      expect(validateSetupField('annualExpenses', -1000)).not.toBeNull()
    })

    it('rejects zero expenses (must be positive)', () => {
      expect(validateSetupField('annualExpenses', 0)).not.toBeNull()
    })

    it('accepts positive expenses', () => {
      expect(validateSetupField('annualExpenses', 48000)).toBeNull()
    })
  })

  // -------------------------------------------------------------------
  // Net worth
  // -------------------------------------------------------------------
  describe('liquidNetWorth', () => {
    it('accepts negative net worth (net debt)', () => {
      expect(validateSetupField('liquidNetWorth', -50000)).toBeNull()
    })

    it('accepts zero', () => {
      expect(validateSetupField('liquidNetWorth', 0)).toBeNull()
    })

    it('accepts positive', () => {
      expect(validateSetupField('liquidNetWorth', 500000)).toBeNull()
    })
  })

  // -------------------------------------------------------------------
  // CPF fields
  // -------------------------------------------------------------------
  describe('cpfMA (MediSave BHS cap)', () => {
    it('rejects balance above BHS', () => {
      const err = validateSetupField('cpfMA', 80000)
      expect(err).toContain('Basic Healthcare Sum')
      expect(err).toContain(`$${MEDISAVE_BHS.toLocaleString()}`)
    })

    it('accepts balance at BHS exactly', () => {
      expect(validateSetupField('cpfMA', MEDISAVE_BHS)).toBeNull()
    })

    it('rejects negative', () => {
      expect(validateSetupField('cpfMA', -100)).not.toBeNull()
    })
  })

  describe('cpfRA (age-gated)', () => {
    it('rejects non-zero RA when age < 55', () => {
      const err = validateSetupField('cpfRA', 50000, { currentAge: 30 })
      expect(err).toContain('age 55')
    })

    it('accepts non-zero RA when age >= 55', () => {
      expect(validateSetupField('cpfRA', 50000, { currentAge: 55 })).toBeNull()
    })

    it('accepts zero RA regardless of age', () => {
      expect(validateSetupField('cpfRA', 0, { currentAge: 30 })).toBeNull()
    })

    it('accepts non-zero RA when no context provided', () => {
      // No context = can't enforce age rule, so pass through
      expect(validateSetupField('cpfRA', 50000)).toBeNull()
    })
  })

  // -------------------------------------------------------------------
  // Property / mortgage cross-field
  // -------------------------------------------------------------------
  describe('mortgageBalance', () => {
    it('rejects mortgage > property value', () => {
      const err = validateSetupField('mortgageBalance', 600000, { propertyValue: 500000 })
      expect(err).toContain('cannot exceed property value')
    })

    it('accepts mortgage <= property value', () => {
      expect(validateSetupField('mortgageBalance', 400000, { propertyValue: 500000 })).toBeNull()
    })

    it('accepts mortgage equal to property value', () => {
      expect(validateSetupField('mortgageBalance', 500000, { propertyValue: 500000 })).toBeNull()
    })

    it('rejects negative mortgage', () => {
      expect(validateSetupField('mortgageBalance', -100)).not.toBeNull()
    })
  })

  // -------------------------------------------------------------------
  // SA top-up (RSTU cap)
  // -------------------------------------------------------------------
  describe('annualSaTopUp', () => {
    it('rejects amount exceeding RSTU cap', () => {
      const err = validateSetupField('annualSaTopUp', RSTU_TAX_RELIEF_CAP + 1)
      expect(err).toContain('RSTU')
    })

    it('accepts amount at cap', () => {
      expect(validateSetupField('annualSaTopUp', RSTU_TAX_RELIEF_CAP)).toBeNull()
    })
  })

  // -------------------------------------------------------------------
  // SRS contribution cap
  // -------------------------------------------------------------------
  describe('annualSrsContribution', () => {
    it('rejects amount exceeding SRS annual cap', () => {
      const err = validateSetupField('annualSrsContribution', SRS_ANNUAL_CAP + 1)
      expect(err).toContain('SRS')
      expect(err).toContain('annual cap')
    })

    it('accepts amount at cap', () => {
      expect(validateSetupField('annualSrsContribution', SRS_ANNUAL_CAP)).toBeNull()
    })
  })

  // -------------------------------------------------------------------
  // Interest / mortgage rate
  // -------------------------------------------------------------------
  describe('mortgageRatePercent', () => {
    it('rejects rate above 20%', () => {
      expect(validateSetupField('mortgageRatePercent', 0.25)).not.toBeNull()
    })

    it('rejects negative rate', () => {
      expect(validateSetupField('mortgageRatePercent', -0.01)).not.toBeNull()
    })

    it('accepts valid rate', () => {
      expect(validateSetupField('mortgageRatePercent', 0.035)).toBeNull()
    })
  })

  // -------------------------------------------------------------------
  // Unknown fields pass through
  // -------------------------------------------------------------------
  describe('unknown field', () => {
    it('returns null for unrecognized field name', () => {
      expect(validateSetupField('nonExistentField', 'anything')).toBeNull()
    })
  })

  // -------------------------------------------------------------------
  // Partner fields
  // -------------------------------------------------------------------
  describe('partnerRetirementAge', () => {
    it('rejects partner retirement age <= currentAge context', () => {
      const err = validateSetupField('partnerRetirementAge', 40, { currentAge: 45 })
      expect(err).toBe('Retirement age must be greater than current age')
    })

    it('accepts valid partner retirement age', () => {
      expect(validateSetupField('partnerRetirementAge', 55, { currentAge: 30 })).toBeNull()
    })
  })

  // -------------------------------------------------------------------
  // MediSave top-up (BHS cap)
  // -------------------------------------------------------------------
  describe('annualMaTopUp', () => {
    it('rejects amount exceeding BHS', () => {
      const err = validateSetupField('annualMaTopUp', MEDISAVE_BHS + 1)
      expect(err).toContain('Basic Healthcare Sum')
    })

    it('accepts amount at BHS', () => {
      expect(validateSetupField('annualMaTopUp', MEDISAVE_BHS)).toBeNull()
    })
  })

  // -------------------------------------------------------------------
  // CPF LIFE payout start age
  // -------------------------------------------------------------------
  describe('cpfPayoutStartAge', () => {
    it('rejects age below 65', () => {
      expect(validateSetupField('cpfPayoutStartAge', 60)).not.toBeNull()
    })

    it('rejects age above 75', () => {
      expect(validateSetupField('cpfPayoutStartAge', 80)).not.toBeNull()
    })

    it('accepts age 65', () => {
      expect(validateSetupField('cpfPayoutStartAge', 65)).toBeNull()
    })
  })
})
