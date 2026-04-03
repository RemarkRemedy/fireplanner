import { cloneElement, type ReactElement } from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { analyzeIlpPolicy } from "@/lib/calculations/ilp";
import { createDefaultPolicy } from "@/stores/useIlpStore";
import { FeeBreakdownSection } from "./FeeBreakdownSection";

vi.mock("recharts", async () => {
  const actual = await vi.importActual<typeof import("recharts")>("recharts");

  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactElement }) => (
      <div style={{ width: 960, height: 320 }}>
        {cloneElement(children, { width: 960, height: 320 })}
      </div>
    ),
  };
});

describe("FeeBreakdownSection", () => {
  it("renders visible annual-fee legend entries inside the chart", () => {
    const policy = createDefaultPolicy();
    const analysis = analyzeIlpPolicy(policy);

    if (analysis.mode !== "projected") {
      throw new Error(
        "Expected the default policy to produce a projected ILP analysis.",
      );
    }

    render(<FeeBreakdownSection policy={policy} analysis={analysis} />);

    const annualChart = screen.getByRole("img", {
      name: /stacked bar chart of annual ilp fees by category/i,
    });
    const renderedBars = annualChart.querySelectorAll(
      ".recharts-bar-rectangle, .recharts-rectangle",
    );

    expect(within(annualChart).getByText("Account Mgt")).toBeInTheDocument();
    expect(within(annualChart).getByText("Fund Mgt (OCF)")).toBeInTheDocument();
    expect(within(annualChart).getByText("Bonus Credits")).toBeInTheDocument();
    expect(renderedBars.length).toBeGreaterThan(1);
  });
});
