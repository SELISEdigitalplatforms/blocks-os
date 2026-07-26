import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

// The tooltip ui-kit re-exports blocks-kit, which touches process.env via
// motion-utils at module load; a passthrough keeps the tree renderable.
vi.mock("@/components/ui-kits/tooltip/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { UsageServiceCard } from "./usage-service-card";

const matrix = (over: Record<string, number> = {}) => ({
  TotalRequests: 1200,
  successRate: 98,
  errorRate: 2,
  Status1xx: 1,
  Status2xx: 1100,
  Status3xx: 10,
  Status4xx: 80,
  Status5xx: 9,
  AverageDuration: 120,
  callsPerMinute: 20,
  PeakDuration: 500,
  TotalThroughput: 2048,
  ...over,
});

const metrics = { api: matrix(), worker: matrix({ TotalRequests: 50 }) } as never;

const renderCard = (props: Record<string, unknown> = {}) =>
  render(
    <MemoryRouter>
      <UsageServiceCard isLoading={false} name="Auth" metrics={metrics} {...props} />
    </MemoryRouter>,
  );

describe("UsageServiceCard", () => {
  it("renders a skeleton with the service name while loading", () => {
    renderCard({ isLoading: true });
    expect(screen.getByText("Auth")).toBeTruthy();
    expect(screen.queryByText("API Calls")).toBeNull();
  });

  it("renders API metrics with the success and error rates by default", () => {
    renderCard();
    expect(screen.getByText("API Calls")).toBeTruthy();
    expect(screen.getByText("98% ok")).toBeTruthy();
    expect(screen.getByText("2% err")).toBeTruthy();
    expect(screen.getByText("Avg Duration")).toBeTruthy();
  });

  it("renders a working log link when a logLink is provided", () => {
    renderCard({ logLink: "/logs/auth" });
    const link = screen.getByTitle("View logs") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toContain("/logs/auth");
  });

  it("renders a disabled logs placeholder when no logLink is provided", () => {
    renderCard();
    expect(screen.getByTitle("Logs unavailable")).toBeTruthy();
  });

  it("switches to worker metrics and hides the api-only success rate", async () => {
    const user = userEvent.setup();
    renderCard();
    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Worker" }));
    // Worker view does not render the api success/error rate line.
    expect(screen.queryByText("98% ok")).toBeNull();
  });
});
