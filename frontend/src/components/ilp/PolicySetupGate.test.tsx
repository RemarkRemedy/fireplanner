import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PolicySetupGate } from "@/components/ilp/PolicySetupGate";
import { getIlpCatalog } from "@/lib/ilp-catalog/getIlpCatalog";
import { templateVariantToPolicySeed } from "@/lib/ilp-catalog/templateToPolicy";

function getAiaEliteSecureIncomeSeed() {
  const { manifest, products } = getIlpCatalog();
  const product = products.find(
    (entry) => entry.id === "aia-elite-secure-income-5-pay",
  );
  expect(product).toBeDefined();

  const variant = product?.variants.find((entry) => entry.id === "sgd-mip-5");
  expect(variant).toBeDefined();

  return templateVariantToPolicySeed(product!, variant!, manifest);
}

describe("PolicySetupGate", () => {
  it("defaults the fund management fee to 1.5% and keeps it editable", async () => {
    const user = userEvent.setup();
    const seed = getAiaEliteSecureIncomeSeed();
    const onConfirm = vi.fn();

    render(
      <PolicySetupGate
        seed={{
          ...seed,
          funds: seed.funds.map((fund) => ({ ...fund, ocf: 0.0075 })),
        }}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByDisplayValue("1.5")).toBeEnabled();
    expect(
      screen.getByRole("button", { name: /fixed income 0.8%/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /multi-asset 1.2%/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /equity 1.5%/i }),
    ).toBeInTheDocument();

    expect(screen.getByLabelText(/monthly premium/i)).toBeEnabled();
    expect(screen.getByLabelText(/current policy year/i)).toBeEnabled();
    expect(screen.getByLabelText(/months already paid/i)).toBeEnabled();

    await user.click(screen.getByRole("button", { name: /multi-asset 1.2%/i }));
    await user.click(
      screen.getByRole("button", { name: /load this product/i }),
    );

    expect(onConfirm).toHaveBeenCalledTimes(1);
    const adjustedSeed = onConfirm.mock.calls[0]?.[0];
    const blendedOcf = adjustedSeed.funds.reduce(
      (sum: number, fund: { allocation: number; ocf: number }) =>
        sum + fund.allocation * fund.ocf,
      0,
    );

    expect(blendedOcf).toBeCloseTo(0.012, 6);
  });
});
