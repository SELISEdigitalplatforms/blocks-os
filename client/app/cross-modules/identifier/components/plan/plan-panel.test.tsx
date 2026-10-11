import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { catalogueMock } from "@/test-utils/__mocks__/catalogue.mock";
import { createWrapper } from "@/test-utils/test-providers/query-client";

vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

const h = vi.hoisted(() => ({
  subscription: null as unknown,
  purchaseArgs: [] as unknown[],
  buy: vi.fn(),
  removeEnvironment: vi.fn(),
  keepEnvironment: vi.fn(),
}));

vi.mock("@blocks-identifier/hooks/use-catalogue", () => ({
  useCatalogue: () => ({ data: catalogueMock(), loading: false, error: null }),
  useUsage: () => ({
    data: {
      tenantGroupId: "grp",
      catalogueVersion: "x",
      environments: [
        {
          tenantId: "T1",
          environment: "test",
          periodKey: "p",
          catalogueVersion: "x",
          notYetSeeded: [],
          services: [
            {
              service: "api",
              label: "API",
              meters: [
                {
                  meter: "api.calls",
                  label: "API calls",
                  unit: "call",
                  kind: "counter",
                  counts: true,
                  included: 100,
                  purchased: 0,
                  used: 95,
                  remaining: 5,
                  percentUsed: 95,
                  enforcement: "hard",
                  inCatalogue: true,
                },
              ],
            },
          ],
        },
      ],
    },
  }),
}));
vi.mock("@blocks-identifier/hooks/use-billing", () => ({
  useSubscription: () => ({ data: h.subscription, isLoading: false }),
}));
vi.mock("@blocks-identifier/hooks/use-project-purchase", () => ({
  useProjectPurchase: (...args: unknown[]) => {
    h.purchaseArgs = args;
    return {
      quote: { total: 54.05, recurringMonthly: 50, lines: [], market: "CHF" },
      quoteError: null,
      phase: "idle",
      message: null,
      busy: false,
      buy: h.buy,
      cardAdded: vi.fn(),
      cancelCard: vi.fn(),
      chooseAnotherCard: vi.fn(),
    };
  },
}));
vi.mock("@blocks-identifier/services/billing.service", () => ({
  billingService: { removeEnvironment: h.removeEnvironment, keepEnvironment: h.keepEnvironment },
}));
vi.mock("@/pages/billing/add-card-dialog", () => ({ AddCardDialog: () => null }));

import { PlanPanel } from "./plan-panel";

const line = (environment: string, amount: number, extra = {}) => ({
  environment,
  label: environment,
  meter: "",
  units: 0,
  amount,
  kind: "environment",
  billing: "rent",
  endsAtUtc: null,
  pendingRemoval: false,
  ...extra,
});

const renderPanel = (props: Partial<Parameters<typeof PlanPanel>[0]> = {}) => {
  const Wrapper = createWrapper();
  return render(
    <Wrapper>
      <MemoryRouter>
        <PlanPanel
          tenantGroupId="grp"
          isOwner
          existingEnvironments={["dev", "test"]}
          adding={false}
          onAddingChange={vi.fn()}
          {...props}
        />
      </MemoryRouter>
    </Wrapper>,
  );
};

describe("PlanPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.subscription = {
      tenantGroupId: "grp",
      market: "CHF",
      state: "active",
      monthlyBeforeTax: 80,
      monthlyTotal: 86.48,
      carriedBalance: 0,
      nextChargeAtUtc: new Date(Date.now() + 10 * 86400000).toISOString(),
      lines: [line("dev", 0), line("test", 80)],
    };
  });

  it("lists held environments with their price, free tier and the hottest meters", () => {
    renderPanel();
    expect(screen.getAllByText("Development").length).toBeGreaterThan(0);
    expect(screen.getByText("Free tier")).toBeTruthy();
    expect(screen.getAllByText("CHF 80").length).toBeGreaterThan(0);
    expect(screen.getByText("95%")).toBeTruthy();
    expect(screen.getByText("10 days")).toBeTruthy();
  });

  it("free development offers the upgrade and blocks top-ups until upgraded", async () => {
    const user = userEvent.setup();
    renderPanel();
    expect(screen.getByText(/can.t be topped up/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Upgrade to paid" }));
    expect((h.purchaseArgs[1] as { upgradeFreeTier: boolean }).upgradeFreeTier).toBe(true);
    expect(screen.getAllByRole("button", { name: /One step more/ }).length).toBeGreaterThan(0);
  });

  it("removing a paid environment needs confirmation and reports the end date", async () => {
    const user = userEvent.setup();
    h.removeEnvironment.mockResolvedValue({
      isSuccess: true,
      effectiveUtc: "2026-11-01T00:00:00Z",
    });
    renderPanel();
    await user.click(screen.getByRole("button", { name: /^Test/ }));
    await user.click(screen.getByRole("button", { name: "Remove at period end" }));
    expect(screen.getByText(/no refund for the days left/)).toBeTruthy();
    await user.click(screen.getAllByRole("button", { name: "Remove at period end" }).at(-1)!);
    expect(h.removeEnvironment).toHaveBeenCalledWith("grp", "test");
    expect(await screen.findByText(/scheduled to end on 1 Nov/)).toBeTruthy();
  });

  it("a pending removal shows a banner with Keep it", async () => {
    const user = userEvent.setup();
    h.keepEnvironment.mockResolvedValue({ isSuccess: true });
    h.subscription = {
      ...(h.subscription as object),
      lines: [
        line("dev", 0),
        line("test", 80, { pendingRemoval: true, endsAtUtc: "2026-11-01T00:00:00Z" }),
      ],
    };
    renderPanel();
    expect(screen.getByText(/is removed on 1 Nov/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Keep it" }));
    await waitFor(() => expect(h.keepEnvironment).toHaveBeenCalledWith("grp", "test"));
  });

  it("the add pane offers only environments the project does not hold", () => {
    renderPanel({ adding: true });
    expect(screen.getByRole("heading", { name: "Add an environment" })).toBeTruthy();
    expect(screen.getByLabelText(/Production/)).toBeTruthy();
    expect(screen.queryByLabelText(/^Test/)).toBeNull();
  });

  it("a refused removal is shown, not swallowed", async () => {
    const user = userEvent.setup();
    h.removeEnvironment.mockResolvedValue({
      isSuccess: false,
      errors: { billing: "billing_environment_not_found" },
    });
    renderPanel();
    await user.click(screen.getByRole("button", { name: /^Test/ }));
    await user.click(screen.getByRole("button", { name: "Remove at period end" }));
    await user.click(screen.getAllByRole("button", { name: "Remove at period end" }).at(-1)!);
    expect(await screen.findByText(/isn't billed on this project/)).toBeTruthy();
  });

  it("contributors see the plan but cannot buy or remove", () => {
    renderPanel({ isOwner: false });
    expect(screen.queryByRole("button", { name: /Add an environment/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Buy/ })).toBeNull();
  });
});
