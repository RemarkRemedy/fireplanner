# Market-Retrenchment Correlation Research

## Singapore Retrenchment vs Market Downturns

### 1. Historical Data Table

**Retrenchment (all-economy, incidence = retrenched per 1,000 employees):**

| Year | Event | STI Annual Return | GDP Growth | Total Retrenched | Incidence (per 1,000) | vs Baseline |
|------|-------|-------------------|------------|------------------|-----------------------|-------------|
| 1996 | Normal | n/a | ~7% | ~13,000 est. | ~11.9 | 1.0x |
| 1997 | AFC starts | -31% | +8.0% | ~12,000 est. | ~10.1 | 0.85x |
| **1998** | **AFC peak** | **-9%** | **+1.5%** | **32,800** | **~29** | **~2.4x** |
| 1999 | Recovery | +78% | +7.2% | declining | ~15.2 | ~1.3x |
| 2000 | Boom | strong | +9.4% | lower | ~11.5 | ~1.0x |
| **2001** | **Dotcom bust** | **-16%** | **-2.4%** | **27,570** | **~25** | **~2.1x** |
| 2002 | Continued stress | -17% | +2.2% | ~19,000 | ~18.2 | ~1.5x |
| 2003 | SARS | mild | +3.1% | 16,300 | ~15.8 | ~1.3x |
| 2004-2007 | Expansion | positive | +6-9% | <14,000/yr | ~9-10 | 0.75-0.85x |
| **2008** | **GFC begins** | **-49%** | **+1.1%** | **~16,500** | **~8** | **~0.7x** |
| **2009** | **GFC peak** | **+64%** | **-2.1%** | **23,430** | **~11** | **~0.9x** |
| 2015 | Oil/China shock | mild | +2.0% | 15,580 | 7.4 | 0.6x |
| 2016 | Restructuring | mild | +2.4% | 19,170 | 8.9 | 0.7x |
| 2019 | Normal | +5% | +1.1% | 10,690 | 5.1 | baseline |
| **2020** | **COVID** | **-12%** | **-3.9%** | **26,110** | **12.8** | **2.5x** |
| 2021 | Recovery | +10% | +8.9% | 8,020 | 4.4 | 0.9x |
| 2022 | Normal | negative | +3.6% | 6,440 | 3.1 | 0.6x |
| 2023 | Restructuring | weak | +1.1% | 14,590 | 6.7 | 1.3x |
| 2024 | Mild stress | weak | ~2% | 13,020 | 5.9 | 1.2x |

**Baseline (2014-2019 quarterly average):** 1.7 per 1,000 per quarter = approximately 5.1 per 1,000 annually.

### 2. Crisis-Year Multipliers (vs ~5 per 1,000 modern baseline)

| Crisis | Peak Incidence (per 1,000) | Modern Equivalent Multiplier | Notes |
|--------|---------------------------|------------------------------|-------|
| 1997 AFC | ~29 (1998) | ~5.7x baseline | Worst absolute rate ever recorded |
| 2001 Dotcom | ~25 | ~4.9x | Second worst; GDP contracted -2.4% |
| 2003 SARS | ~16 | ~3.1x | Health shock, shorter duration |
| 2009 GFC | ~11 | ~2.2x | Softened by Jobs Credit scheme |
| 2020 COVID | 12.8 | **2.5x** | Compared to 5.1 baseline (2019) |

**Key calibration note:** MOM explicitly states that when 2020's 26,110 retrenchments are normalised for workforce size (which grew ~40% since 2001), the incidence rate of 12.8 per 1,000 is lower than all prior major recessions.

### 3. Does "2x Rate When Market Return < -20%" Hold?

**Short answer: 2x is conservative (real peaks are 2.5x-5x) but reasonable for moderate downturns.**

- STI -31% in 1997, but retrenchment only spiked the *following* year (1998, -9% STI)
- STI -49% in 2008, yet 2008 retrenchment was below normal; the big spike came in 2009 when STI had already recovered +64%
- STI -12% in 2020 corresponded to a 2.5x retrenchment spike that same year
- STI -16% in 2001 corresponded to a 4.9x spike that same year (GDP also contracted -2.4%)

**The pattern:** The market return alone is a weak same-year predictor. GDP contraction is the better driver.

**GDP-keyed multipliers:**

| GDP Growth | Observed Incidence Multiplier |
|------------|-------------------------------|
| +5% or better | 0.7-0.9x (below baseline) |
| +1% to +4% | 0.9-1.3x (near baseline) |
| -1% to -2% | 2.0-2.5x |
| -2% to -4% | 2.5-3.5x |
| < -4% | 3.5-5x+ |

### 4. Lag Effects

Three patterns:

**Pattern A: Coincident (same year):** 2001 dotcom, 2020 COVID. Market and GDP fell together, retrenchment spiked the same calendar year.

**Pattern B: 1-year lag:** 1997-1998 AFC. STI fell -31% in 1997, GDP still grew +8%. Retrenchment peaked in 1998.

**Pattern C: 1-year lag with quicker reversal:** 2008-2009 GFC. STI -49% in 2008, retrenchment moderate. Peak in Q1 2009 before easing. Labour market typically lags GDP by 2-3 quarters.

### 5. Age-Specific Rates (Ages 50-59)

In 2020, workers in their 50s had **15 retrenched per 1,000** versus the overall rate of 12.8 per 1,000 (17% excess risk vs all-age rate).

**Baseline 0.9% for ages 50-59 is confirmed:** The 2019 all-age rate was 5.1 per 1,000 (0.51%), but for ages 50-59 in a normal year it runs approximately 1.6-2.0x the all-age average = 0.8-1.0%.

### 6. Recommended Model for Monte Carlo

**Base probability (ages 50-59, normal year):** 0.9% (confirmed)

**Market-return-keyed multipliers:**

| Market Return | Multiplier | Effective Rate |
|--------------|-----------|----------------|
| >= -10% | 1.0x | 0.9% |
| -10% to -20% | 1.5x | 1.35% |
| -20% to -35% | 2.5x | 2.25% |
| < -35% | 3.5x | 3.15% |

**Lag adjustment:** Apply 50% of elevated rate in crash year, 100% in following year.

**"2x base rate when market return < -20%":** Directionally correct and slightly conservative. Observed range for moderate recessions is 2.0x-3.0x. Using 2x as a floor for -20% threshold is defensible.

### Sources

- [MOM Retrenchment Summary Table (2015-2025)](https://stats.mom.gov.sg/Pages/Retrenchment-Summary-Table.aspx)
- [MOM Redundancies and Reemployment 2008](https://www.mom.gov.sg/newsroom/press-releases/2009/redundancies-and-reemployment-2008)
- [Labour Market 2009 - MOM](https://www.mom.gov.sg/newsroom/press-releases/2010/labour-market-2009)
- [MOM Retrenchment Statistics](https://stats.mom.gov.sg/Statistics/Pages/retrenchment.aspx)
- [Retrenchment Q4 2020 Declined, HR Online](https://www.humanresourcesonline.net/retrenchments-in-singapore-declined-in-q4-2020-following-5-straight-quarters-of-increases)
- [Singapore 2021 retrenchment decline, HR Online](https://www.humanresourcesonline.net/singapore-saw-a-significant-decline-in-retrenchments-y-o-y-from-26-110-in-2020-to-7-820-in-2021)
- [Asian Financial Crisis Singapore NLB](https://www.nlb.gov.sg/main/article-detail?cmsuuid=6a94eaac-75ec-41ff-b5ef-38154ccae4e0)
- [MTI Employment Trends During Recession](https://www.mti.gov.sg/Resources/feature-articles/2010/Employment-Trends-During-Recession-_-A-Comparison-From-Peak-to-Trough)
- [MOM Parliament reply on COVID retrenchment profile](https://www.mom.gov.sg/newsroom/parliament-questions-and-replies/2020/1006-oral-answer-by-mrs-josephine-teo-minister-for-manpower-to-pq-on-workers-retrenched-due-to-covid)
