import { describe, expect, it } from 'vitest'
import {
  HSBC_FLEXI_DEATH_TI_RATE_TABLE,
  PRUVANTAGE_ASSURE_II_COMBINED_RATE_TABLE,
  PRUVANTAGE_PROSPER_ACCIDENTAL_DEATH_RATE_TABLE,
  PRUVANTAGE_PROSPER_DEATH_RATE_TABLE,
} from './ilpAssuranceTables'

describe('ilpAssuranceTables', () => {
  it('parses the full Prudential Prosper death table', () => {
    expect(PRUVANTAGE_PROSPER_DEATH_RATE_TABLE['male-non-smoker']).toHaveLength(120)
    expect(PRUVANTAGE_PROSPER_DEATH_RATE_TABLE['male-non-smoker'][49]).toBe(2.79)
    expect(PRUVANTAGE_PROSPER_DEATH_RATE_TABLE['female-non-smoker'][119]).toBe(611.88)
  })

  it('parses the full Prudential Prosper accidental death table', () => {
    expect(PRUVANTAGE_PROSPER_ACCIDENTAL_DEATH_RATE_TABLE['male-non-smoker']).toHaveLength(120)
    expect(PRUVANTAGE_PROSPER_ACCIDENTAL_DEATH_RATE_TABLE['male-non-smoker'][49]).toBe(0.27)
    expect(PRUVANTAGE_PROSPER_ACCIDENTAL_DEATH_RATE_TABLE['female-non-smoker'][119]).toBe(1.75)
  })

  it('parses the full Prudential Assure II combined table', () => {
    expect(PRUVANTAGE_ASSURE_II_COMBINED_RATE_TABLE['male-non-smoker']).toHaveLength(120)
    expect(PRUVANTAGE_ASSURE_II_COMBINED_RATE_TABLE['male-non-smoker'][49]).toBe(2.94)
    expect(PRUVANTAGE_ASSURE_II_COMBINED_RATE_TABLE['male-non-smoker'][69]).toBe(18.84)
    expect(PRUVANTAGE_ASSURE_II_COMBINED_RATE_TABLE['male-non-smoker'][70]).toBe(23.04)
    expect(PRUVANTAGE_ASSURE_II_COMBINED_RATE_TABLE['female-non-smoker'][119]).toBe(611.88)
  })

  it('parses the HSBC Flexi death and terminal illness table', () => {
    expect(HSBC_FLEXI_DEATH_TI_RATE_TABLE['male-non-smoker']).toHaveLength(99)
    expect(HSBC_FLEXI_DEATH_TI_RATE_TABLE['male-non-smoker'][29]).toBe(0.86)
    expect(HSBC_FLEXI_DEATH_TI_RATE_TABLE['female-smoker'][69]).toBe(11.9)
    expect(HSBC_FLEXI_DEATH_TI_RATE_TABLE['female-non-smoker'][98]).toBe(431.31)
  })
})
