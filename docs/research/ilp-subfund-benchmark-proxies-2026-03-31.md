# ILP Sub-Fund Benchmarks And ETF Proxies

Date: 2026-03-31

This is a current-source working dataset for Singapore ILP sub-funds.
It now includes all targeted insurer groups covered in this pass: AIA, Etiqa, FWD, Great Eastern, HSBC Life, Income, Manulife, Prudential, Singlife, and Tokio Marine.

Fee verification status: 535/535 populated fee rows are `verified_exact` with a cited source page or exact official source locator.

## Coverage

- AIA: 41 sub-funds, 41 benchmark fields extracted, 37 ETF proxies mapped, 41 annual fee fields extracted, 41 fee rows verified_exact
- Etiqa: 52 sub-funds, 34 benchmark fields extracted, 26 ETF proxies mapped, 52 annual fee fields extracted, 52 fee rows verified_exact
- FWD: 54 sub-funds, 48 benchmark fields extracted, 45 ETF proxies mapped, 54 annual fee fields extracted, 54 fee rows verified_exact
- Great Eastern: 36 sub-funds, 36 benchmark fields extracted, 25 ETF proxies mapped, 36 annual fee fields extracted, 36 fee rows verified_exact
- HSBC Life: 182 sub-funds, 5 benchmark fields extracted, 4 ETF proxies mapped, 0 annual fee fields extracted
- Income: 31 sub-funds, 31 benchmark fields extracted, 18 ETF proxies mapped, 31 annual fee fields extracted, 31 fee rows verified_exact
- Manulife: 48 sub-funds, 37 benchmark fields extracted, 34 ETF proxies mapped, 48 annual fee fields extracted, 48 fee rows verified_exact
- Prudential: 63 sub-funds, 44 benchmark fields extracted, 34 ETF proxies mapped, 63 annual fee fields extracted, 63 fee rows verified_exact
- Singlife: 148 sub-funds, 133 benchmark fields extracted, 83 ETF proxies mapped, 148 annual fee fields extracted, 148 fee rows verified_exact
- Tokio Marine: 68 sub-funds, 50 benchmark fields extracted, 26 ETF proxies mapped, 62 annual fee fields extracted, 62 fee rows verified_exact

## Fee Citation Fields

- `fee_source_page`: PDF page number where the fee appears when the official source is page-based.
- `fee_source_locator`: archived local artifact path or exact dynamic-source locator used for reproducible verification.
- `fee_source_url`: official online source URL to cite publicly. This is the insurer or fund-report URL, and where recoverable it points to the exact source PDF rather than only the landing page.
- `fee_source_metric`: fee label or machine field used for verification, such as `Expense Ratio`, `Continuing Investment Charge`, or `OngoingCostActual`.
- `fee_as_of_date`: date stated on the cited page or exact official source field when available.
- `fee_verification_status`: currently `verified_exact` for all populated fee rows in this file.
- `fee_verification_note`: short provenance note describing how the verification was done.

## Source Notes

- AIA source: https://www.aia.com.sg/content/dam/sg-wise/en/docs/our-products/save-and-invest/aia-annual-funds-reports/annual/aia-annual-funds-report-2025.pdf
- FWD sources:
  - https://www.fwd.com.sg/personalised-financial-advice/funds/
  - archived `fwd-mifid.json` and `fwd-screener-page1-100.json` in the repo source archive
- Great Eastern source: https://www.greateasternlife.com/content/dam/corp-site/great-eastern/sg/gels-ftrp-funds/annual-report/2025-greatlink-annual-report.pdf
- HSBC Life sources:
  - https://www.insurance.hsbc.com.sg/content/dam/hsbc/insn/documents/help/resource-library/ilp-sub-funds-for-life-variable-annuity-goal.pdf
  - https://www.insurance.hsbc.com.sg/content/dam/hsbc/insn/documents/help/resource-library/ilp-sub-funds-for-life-goal-builder-and-l.pdf
  - https://www.insurance.hsbc.com.sg/content/dam/hsbc/insn/documents/help/resource-library/investment-and-market-review-outlook-pulsar-sar25.pdf
  - https://www.insurance.hsbc.com.sg/content/dam/hsbc/insn/documents/help/resource-library/investment-and-market-review-outlook-inspire-sar25.pdf
- Manulife source: https://www.manulife.com.sg/content/dam/insurance/sg/funds/ML-Fund%20Report_SAR.pdf
- Singlife source: https://content.singlife.com/content/dam/public/sg/documents/investment/reports/semi-annual-ilp-funds-report-thick-31-dec-2025.pdf
- Tokio Marine sources:
  - https://www.tokiomarine.com/content/dam/tokiomarine/sg/life/resources/fund-reports/Semi-Annual%20ILP%20Fund%20Report%20%281Jan-30Jun%202025%29%20Non-Atlas.pdf
  - https://www.tokiomarine.com/content/dam/tokiomarine/sg/life/resources/fund-reports/Semi-Annual%20ILP%20Fund%20Report%20%281Jan-30Jun%202025%29%20Atlas.pdf
- Raw downloaded research artifacts are archived in `/Users/tj/TJDevelopment/fireplanner/docs/research/ilp-source-archive-2026-03-31`

## Notes

- `annual_fee_label` records the fee metric exposed by the current official source, for example `Continuing Investment Charge`, `Expense Ratio`, `Fund Management Fee`, `Management Fee`, or `Ongoing Cost`.
- For publishing, cite `fee_source_url` plus `fee_source_page` where available. Keep `fee_source_locator` as the internal archive reference rather than the public-facing citation.
- If these files are later pushed to GitHub, treat GitHub as a reproducibility mirror only, not as the primary source citation. The primary citation should stay with the official insurer or fund-report URL in `fee_source_url`.
- ETF proxies are nearest liquid listed proxies, not exact benchmark replications.
- Composite, hedged, multi-asset or rate-based benchmarks often require a basket or remain approximate.
- Some current official sources explicitly state that a fund has no benchmark.
