import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UsageSummaryCard } from "./usage-summary-card";

const Icon = () => <span data-testid="icon" />;

describe("UsageSummaryCard", () => {
  it("hides the metric description while loading", () => {
    render(
      <UsageSummaryCard
        title="12"
        description="Total API calls"
        isLoading
        Icon={Icon}
      />,
    );
    expect(screen.queryByText("Total API calls")).toBeNull();
  });

  it("shows the metric description once loaded", () => {
    render(
      <UsageSummaryCard title="12" description="Total API calls" Icon={Icon} />,
    );
    expect(screen.getByText("Total API calls")).toBeTruthy();
  });
});
