import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { catalogueMock } from "@/test-utils/__mocks__/catalogue.mock";
import type { IEnvironmentUsage, IMeterUsage } from "@blocks-identifier/models/catalogue.model";

const h = vi.hoisted(() => ({
  usage: { data: null as unknown, loading: false, error: null as Error | null },
  reload: vi.fn(),
  sync: vi.fn(),
  subscription: null as unknown,
}));

vi.mock("@blocks-identifier/hooks/use-catalogue", () => ({
  useCatalogue: () => ({ data: catalogueMock(), loading: false, error: null }),
  useUsage: () => ({ ...h.usage, reload: h.reload, sync: h.sync }),
}));
vi.mock("@blocks-identifier/hooks/use-billing", () => ({
  useSubscription: () => ({ data: h.subscription }),
}));

import { SubscriptionUsagePage, usageCell } from "./subscription-usage-page";

const meter = (over: Partial<IMeterUsage> = {}): IMeterUsage => ({
  meter: "api.calls",
  label: "API calls",
  unit: "call",
  kind: "counter",
  counts: true,
  included: 1000,
  purchased: 0,
  used: 100,
  remaining: 900,
  percentUsed: 10,
  enforcement: "hard",
  inCatalogue: true,
  ...over,
});

const env = (
  environment: string,
  calls: Partial<IMeterUsage>,
  notYetSeeded: string[] = [],
): IEnvironmentUsage => ({
  tenantId: `T-${environment}`,
  environment,
  periodKey: "2026-10",
  catalogueVersion: "x",
  notYetSeeded,
  services: [
    {
      service: "api",
      label: "API",
      meters: [meter(calls)],
    },
  ],
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/app/project/grp/subscription-usage"]}>
      <Routes>
        <Route
          path="/app/project/:tenantGroupId/subscription-usage"
          element={<SubscriptionUsagePage />}
        />
      </Routes>
    </MemoryRouter>,
  );

describe("usageCell", () => {
  it("shows used against included, with bought units as their own segment", () => {
    const cell = usageCell(
      meter({ used: 950, included: 1000, purchased: 500, percentUsed: 95 }),
      false,
    );
    expect(cell.text).toBe("950 / 1,000");
    expect(cell.tone).toBe("hot");
    expect(cell.note).toBe("+500 bought");
    expect(cell.usedPct + cell.boughtPct).toBeLessThanOrEqual(100);
    expect(cell.boughtPct).toBeGreaterThan(0);
  });

  it("uncapped, settings and missing meters", () => {
    expect(usageCell(meter({ included: -1, used: 42 }), false).text).toBe("42 · no cap");
    expect(usageCell(meter({ counts: false, included: -1, kind: "policy" }), false).text).toBe(
      "Never stops",
    );
    expect(usageCell(meter({ counts: false, included: 15, unit: "minute" }), false).text).toBe(
      "15 min",
    );
    expect(usageCell(undefined, false).text).toBe("—");
  });

  it("compact mode shows percentages", () => {
    expect(usageCell(meter({ used: 700, included: 1000 }), true).text).toBe("70%");
  });
});

describe("SubscriptionUsagePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.subscription = {
      market: "CHF",
      nextChargeAtUtc: new Date(Date.now() + 5 * 86400000).toISOString(),
      lines: [{ environment: "dev", meter: "", amount: 0, label: "dev", units: 0 }],
    };
    h.usage = {
      data: {
        tenantGroupId: "grp",
        catalogueVersion: "x",
        environments: [
          env("prod", { used: 900, percentUsed: 90 }),
          env("dev", { used: 10, percentUsed: 1 }),
        ],
      },
      loading: false,
      error: null,
    };
  });

  it("one column per environment in catalogue order, the free tier tagged", () => {
    renderPage();
    const heads = screen.getAllByText(/^(dev|prod)$/).map((n) => n.textContent);
    expect(heads.indexOf("dev")).toBeLessThan(heads.indexOf("prod"));
    expect(screen.getAllByText("Free").length).toBeGreaterThan(0);
    expect(screen.getByText("5 days")).toBeTruthy();
  });

  it("calls out the meter nearest its hard stop, with a way to buy more", () => {
    renderPage();
    expect(screen.getByText(/Production has 100 api calls of its allowance left/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Buy more" }).getAttribute("href")).toBe(
      "/app/project/grp/environments",
    );
  });

  it("offers a sync for environments with unseeded meters, passing the free tier", async () => {
    const user = userEvent.setup();
    h.usage = {
      ...h.usage,
      data: {
        tenantGroupId: "grp",
        catalogueVersion: "x",
        environments: [env("dev", {}, ["ai.agents"])],
      },
    };
    renderPage();
    await user.click(screen.getByRole("button", { name: /Sync with catalogue/ }));
    expect(h.sync).toHaveBeenCalledWith("T-dev", "dev", "2026-10", true);
  });

  it("renders a service, meter and kind this build has never heard of", () => {
    const odd = env("prod", {});
    odd.services.push({
      service: "search",
      label: "Search",
      meters: [
        meter({
          meter: "search.queries",
          label: "Search queries",
          kind: "gauge",
          used: 3,
          included: 10,
        }),
      ],
    });
    h.usage = {
      data: { tenantGroupId: "grp", catalogueVersion: "x", environments: [odd] },
      loading: false,
      error: null,
    };
    renderPage();
    expect(screen.getByRole("region", { name: "Search" })).toBeTruthy();
    expect(screen.getByText("Search queries")).toBeTruthy();
    expect(screen.getByText("gauge")).toBeTruthy();
  });

  it("error → Try again", async () => {
    const user = userEvent.setup();
    h.usage = { data: null, loading: false, error: new Error("boom") };
    renderPage();
    expect(screen.getByText("Usage could not be loaded")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(h.reload).toHaveBeenCalled();
  });

  it("a project with no environments points to adding one", () => {
    h.usage = {
      data: { tenantGroupId: "grp", catalogueVersion: "x", environments: [] },
      loading: false,
      error: null,
    };
    renderPage();
    expect(screen.getByText(/no environments yet/)).toBeTruthy();
  });

  it("on a phone, the chip row picks which environment is shown", async () => {
    const user = userEvent.setup();
    renderPage();
    const prodTab = screen.getByRole("tab", { name: "prod" });
    await user.click(prodTab);
    expect(prodTab.getAttribute("aria-selected")).toBe("true");
  });
});
