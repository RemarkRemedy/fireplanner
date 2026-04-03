import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { IlpLandingPage } from "./IlpLandingPage";

function LocationProbe() {
  const location = useLocation();
  return (
    <div data-testid="location">{`${location.pathname}${location.search}`}</div>
  );
}

describe("ILP guided entry flow", () => {
  it("routes the understand-product card into story mode", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<IlpLandingPage />} />
          <Route
            path="/ilp-fees/story/:productId"
            element={<LocationProbe />}
          />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(
      screen.getByRole("button", { name: /understand one ilp/i }),
    );
    const dialog = await screen.findByRole("dialog");
    await user.type(
      within(dialog).getByPlaceholderText(/search insurer or product name/i),
      "Wealth Voyage",
    );
    await user.click(
      within(dialog).getByRole("button", {
        name: /^USD \/ MIP 15Use template$/i,
      }),
    );

    expect(screen.getByTestId("location")).toHaveTextContent(
      "/ilp-fees/story/hsbc-life-wealth-voyage?variantId=usd-mip-15",
    );
  });

  it("routes the current-policy card straight into exit review", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<IlpLandingPage />} />
          <Route path="/ilp-fees/exit" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(
      screen.getByRole("button", { name: /review my current ilp/i }),
    );
    const dialog = await screen.findByRole("dialog");
    await user.type(
      within(dialog).getByPlaceholderText(/search insurer or product name/i),
      "Wealth Voyage",
    );
    await user.click(
      within(dialog).getByRole("button", {
        name: /^USD \/ MIP 15Use template$/i,
      }),
    );

    expect(screen.getByTestId("location")).toHaveTextContent(
      "/ilp-fees/exit?productId=hsbc-life-wealth-voyage&variantId=usd-mip-15",
    );
  });
});
