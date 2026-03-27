# Annual Data Maintenance Checklist

Every January, review and update these data files with the previous year's published values:

| File | What to Update | Official Source | Typical Publish Date |
|------|---------------|-----------------|---------------------|
| `lib/data/cpfRates.ts` | OW ceiling, contribution rates, BRS/FRS/ERS base values, `RETIREMENT_SUM_BASE_YEAR` | [CPF Board](https://www.cpf.gov.sg) | January |
| `lib/data/taxBrackets.ts` | Tax brackets, relief amounts, SRS caps | [IRAS](https://www.iras.gov.sg) | February (Budget) |
| `lib/data/momSalary.ts` | Salary benchmarks by education/age | [MOM Stats](https://stats.mom.gov.sg) | June (Labour Force Report) |
| `lib/data/healthcarePremiums.ts` | MediShield Life, ISP, CareShield premiums, `MEDISAVE_BHS` | [CPF Board](https://www.cpf.gov.sg), [MOH](https://www.moh.gov.sg) | April |
| `lib/data/stampDutyRates.ts` | BSD brackets, ABSD rates | [IRAS](https://www.iras.gov.sg/taxes/stamp-duty) | When revised (check Budget) |
| `lib/data/historicalReturnsFull.ts` | Add new year's data row, update `DATA_YEAR_RANGE` | [Damodaran](https://pages.stern.nyu.edu/~adamodar/), [FRED](https://fred.stlouisfed.org) | January |
| `lib/data/goal-defaults.ts` | EHG grant table, CPF LIFE estimates, HDB income ceilings, peer benchmarks, mortgage rates, HDB price ranges, COE premiums, condo/landed brackets | [HDB](https://www.hdb.gov.sg), [CPF Board](https://www.cpf.gov.sg), [IRAS](https://www.iras.gov.sg), [MOM](https://www.mom.gov.sg) | Annual (check after Budget and NDR). Note: EHG amounts need primary source verification |
| `lib/data/sources.ts` | Sync `period` labels with updated files above | N/A | After any data file update |

After updating any data file:
1. Update the header comment with new download date
2. Run `npm run test` — existing tests catch regressions
3. Update `sources.ts` period labels to match
4. Add an entry to `lib/data/changelog.ts` describing what changed (include `affectedSections`)
5. Bump `DATA_VINTAGE` in `lib/data/changelog.ts` to today's date
