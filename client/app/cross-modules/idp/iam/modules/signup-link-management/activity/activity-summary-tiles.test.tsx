import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ActivitySummaryTiles, usedPercentageCaption } from "./activity-summary-tiles";
import type { ISignupLinkSummary } from "@blocks-idp/iam/models/signup-link-summary";

vi.mock("@/components/ui-kits/tooltip/tooltip", () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip-content">{children}</div>
  ),
}));

const base: ISignupLinkSummary = {
  configurationId: "c1",
  configurationName: "Partner onboarding",
  fromUtc: "2026-08-29T00:00:00Z",
  toUtc: "2026-09-28T00:00:00Z",
  totalGenerated: 40,
  used: 22,
  neverUsed: 18,
  neverUsedBreakdown: { active: 10, expired: 5, revoked: 3 },
  rejectedAttempts: 2,
};

describe("usedPercentageCaption", () => {
  it("omits the caption when totalGenerated is 0 (C6)", () => {
    expect(usedPercentageCaption(0, 0)).toBeNull();
  });

  it("formats percentage of generated", () => {
    expect(usedPercentageCaption(22, 40)).toBe("55% of generated");
  });
});

describe("ActivitySummaryTiles", () => {
  it("renders three tiles with captions and rejected attempts (H4, H5)", () => {
    render(<ActivitySummaryTiles summary={base} rangeLabel="Last 30 days" />);
    expect(screen.getByTestId("tile-generated").textContent).toBe("40");
    expect(screen.getByTestId("tile-used").textContent).toBe("22");
    expect(screen.getByText("55% of generated")).toBeTruthy();
    expect(screen.getByTestId("tile-never-used").textContent).toBe("18");
    expect(screen.getByText("10 still active · 5 expired · 3 revoked")).toBeTruthy();
    expect(screen.getByTestId("rejected-attempts").textContent).toContain("2 rejected attempts");
    expect(screen.getByTestId("never-used-help")).toBeTruthy();
  });

  it("omits rejected attempts when zero (H5)", () => {
    render(
      <ActivitySummaryTiles
        summary={{ ...base, rejectedAttempts: 0 }}
        rangeLabel="Last 30 days"
      />,
    );
    expect(screen.queryByTestId("rejected-attempts")).toBeNull();
  });

  it("omits used percentage when totalGenerated is 0 wherever tiles still render (C6)", () => {
    render(
      <ActivitySummaryTiles
        summary={{ ...base, totalGenerated: 0, used: 0, neverUsed: 0 }}
        rangeLabel="Last 30 days"
      />,
    );
    expect(screen.queryByText(/% of generated/)).toBeNull();
    expect(screen.queryByText("0%")).toBeNull();
    expect(screen.queryByText("NaN%")).toBeNull();
  });
});
