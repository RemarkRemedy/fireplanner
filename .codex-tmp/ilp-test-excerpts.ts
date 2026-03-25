## ilp.test.ts excerpt: original-single-premium-base tests
        {
          id: 'policy',
          label: 'Policy Account',
          feeRate: 0,
          currentValue: 0,
          contributionShare: 0,
          subjectToEec: false,
          postMipFeeRate: null,
          contributionRules: [
            { phase: 'during-icp', contributionShare: 1 },
            { phase: 'after-icp', contributionShare: 0 },
          ],
        },
      ],
      funds: [ZERO_RETURN_FUND],
      bonuses: [],
      exitChargeBasis: 'initial-single-premium-base',
      eecTable: [0.07, 0.056, 0.042, 0.028, 0.014, 0],
      chargeRules: [
        {
          id: 'establishment-charge',
          label: 'Establishment Charge',
          basis: 'initial-single-premium-base',
          activeWindow: 'policy-term',
          appliesTo: ['policy'],
          rate: 0,
          rateSchedule: [
            { startPolicyYear: 1, endPolicyYear: 5, rate: 0.014 },
          ],
          amount: 0,
          allocation: 'equal-split',
        },
      ],
    })

    const result = projectIlpPolicy(policy, 'mid')
    const summary = computeSummaryMetrics(policy, result)

    expect(accountRow(result.rows[0], 'policy').grossFee).toBeCloseTo(14, 6)
    expect(accountRow(result.rows[3], 'policy').grossFee).toBeCloseTo(14, 6)
    expect(accountRow(result.rows[4], 'policy').grossFee).toBeCloseTo(0, 6)
    expect(result.rows[3].cumulativeGrossFees).toBeCloseTo(70, 6)
    expect(result.rows[4].cumulativeGrossFees).toBeCloseTo(70, 6)
    expect(summary.currentSurrenderValue).toBeCloseTo(916, 6)
  })

  it('uses original initial single premium as the surrender base for open-ended exit charges', () => {
    const policy = makeOpenEndedPolicy({
      monthlyContribution: 0,
      initialSinglePremium: 1_000,
      monthsAlreadyPaid: 0,
      currentPolicyYear: 1,
      postMipYears: 6,
      accounts: [
        {
          id: 'policy',
          label: 'Policy Account',
          feeRate: 0,
          currentValue: 0,
          contributionShare: 0,
          subjectToEec: false,
          postMipFeeRate: null,
          contributionRules: [
            { phase: 'during-icp', contributionShare: 1 },
            { phase: 'after-icp', contributionShare: 0 },
          ],
        },
      ],
      eecTable: [0.07, 0.056, 0.042, 0.028, 0.014, 0],
      exitChargeBasis: 'initial-single-premium-base',
      funds: [ZERO_RETURN_FUND],
      bonuses: [],
      chargeRules: [],
    })

    const projection = projectIlpPolicy(policy, 'mid')
    const summary = computeSummaryMetrics(policy, projection)
    const npv = computeNpvAnalysis(policy, projection)

    expect(summary.cancelNowPenalty).toBeCloseTo(70, 6)
    expect(summary.currentSurrenderValue).toBeCloseTo(930, 6)
    expect(projection.rows[0].eecRate).toBeCloseTo(0.056, 6)
    expect(projection.rows[0].eecCharge).toBeCloseTo(56, 6)
    expect(projection.rows[0].surrenderValue).toBeCloseTo(944, 6)
    expect(projection.rows[4].eecRate).toBeCloseTo(0, 6)
    expect(projection.rows[4].eecCharge).toBeCloseTo(0, 6)
    expect(npv.surrenderNow.eecCharge).toBeCloseTo(70, 6)
  })

  it('floors negative close values at zero before EEC is applied', () => {
    const policy = makeDefaultPolicy({
      monthlyContribution: 0,
      monthsAlreadyPaid: 0,
      currentPolicyYear: 1,
      accounts: [
        {
          id: 'core',
          label: 'Core',
          feeRate: 0,

## ilp.test.ts excerpt: account-value surrender regression tests

describe('computeNpvAnalysis', () => {
  it('calculates surrender now EEC on subject accounts only', () => {
    const policy = makeDefaultPolicy()
    const projection = projectIlpPolicy(policy, 'mid')
    const npv = computeNpvAnalysis(policy, projection)

    expect(npv.surrenderNow.eecRate).toBe(0.96)
    expect(npv.surrenderNow.eecCharge).toBeCloseTo(29_000 * 0.96, 2)
    expect(npv.surrenderNow.netSurrenderValue).toBeCloseTo(29_000 - 29_000 * 0.96, 2)
  })

  it('keeps future exit options for post-MIP rows but caps bestExitYear to pre-MIP rows', () => {
    const policy = makeDefaultPolicy({ postMipYears: 5 })
    const projection = projectIlpPolicy(policy, 'mid')
    const npv = computeNpvAnalysis(policy, projection)

    expect(npv.futureExitOptions).toHaveLength(30)
    expect(npv.bestExitYear).toBeLessThanOrEqual(25)
    const minPreMip = Math.min(...npv.futureExitOptions.slice(0, 25).map((option) => option.totalNpvFees))
    expect(npv.bestExitNpvFees).toBeCloseTo(minPreMip, 2)
  })

  it('anchors hold-to-MIP metrics to the MIP end row, not the last projected row', () => {
    const policy = makeDefaultPolicy({ postMipYears: 10 })
    const projection = projectIlpPolicy(policy, 'mid')
    const npv = computeNpvAnalysis(policy, projection)

    expect(npv.holdToMip.finalValue).toBeCloseTo(projection.rows[24].combinedValue, 2)
    expect(npv.holdToMip.totalContributions).toBe(projection.rows[24].cumulativePremiums)
    expect(npv.holdToMip.totalNpvFees).toBeCloseTo(npv.futureExitOptions[24].totalNpvFees, 2)
