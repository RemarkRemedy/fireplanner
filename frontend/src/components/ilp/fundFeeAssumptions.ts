export const DEFAULT_ILP_FUND_FEE = 0.015;

export const ILP_FUND_FEE_SUGGESTIONS = [
  {
    label: "Fixed income",
    value: 0.008,
    description: "Typical bond / income-fund range",
  },
  {
    label: "Multi-asset",
    value: 0.012,
    description: "Balanced / allocation-fund midpoint",
  },
  {
    label: "Equity",
    value: 0.015,
    description: "Typical active equity-fund midpoint",
  },
] as const;

export function scaleFundsToBlendedOcf<
  T extends { allocation: number; ocf: number },
>(funds: T[], targetBlendedOcf: number): T[] {
  if (funds.length === 0) return funds;

  const totalAllocation = funds.reduce((sum, fund) => sum + fund.allocation, 0);
  const currentBlendedOcf = funds.reduce(
    (sum, fund) => sum + fund.allocation * fund.ocf,
    0,
  );

  if (targetBlendedOcf <= 0) {
    return funds.map((fund) => ({ ...fund, ocf: 0 }));
  }

  if (currentBlendedOcf > 0) {
    const scaleFactor = targetBlendedOcf / currentBlendedOcf;
    return funds.map((fund) => ({ ...fund, ocf: fund.ocf * scaleFactor }));
  }

  const evenFallbackOcf =
    totalAllocation > 0 ? targetBlendedOcf / totalAllocation : targetBlendedOcf;
  return funds.map((fund) => ({ ...fund, ocf: evenFallbackOcf }));
}
