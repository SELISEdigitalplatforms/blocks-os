import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { SubscriptionUsagePage } from "./subscription-usage-page";
import { MemoryRouter, Route, Routes } from "react-router";
import { catalogueService } from "@blocks-identifier/services/catalogue.service";
import { billingService } from "@blocks-identifier/services/billing.service";
import { IEnvironmentUsage, IProjectUsage } from "@blocks-identifier/models/catalogue.model";

/**
 * The page must render whatever the catalogue defines, including a meter and a kind this build has
 * never seen. Nothing here asserts on a known meter name, because the page must not know any.
 *
 * Usage is read per project group and rendered one block per environment — the page is never given
 * a single environment, and never infers one from the session.
 */
const GROUP = "grp_01JB9K5S8TN2C7";

const environment: IEnvironmentUsage = {
  tenantId: "tnt_prod",
  environment: "prod",
  periodKey: "2026-09-12",
  catalogueVersion: "2026-09-24.1",
  notYetSeeded: ["search.queries"],
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
          included: 1_200_000,
          purchased: 200_000,
          used: 1_140_000,
          remaining: 260_000,
          percentUsed: 95,
          enforcement: "enforced",
          inCatalogue: true,
        },
      ],
    },
    {
      service: "release",
      label: "Release",
      meters: [
        {
          meter: "release.idleStopMinutes",
          label: "Idle stop",
          unit: "minute",
          kind: "policy",
          counts: false,
          included: -1,
          purchased: 0,
          used: 0,
          remaining: -1,
          percentUsed: 0,
          enforcement: "enforced",
          inCatalogue: true,
        },
      ],
    },
    {
      service: "vision",
      label: "Vision",
      meters: [
        {
          // a kind this build has never heard of — it must still render
          meter: "vision.frames",
          label: "Frames analysed",
          unit: "frame",
          kind: "gauge",
          counts: true,
          included: 500,
          purchased: 0,
          used: 100,
          remaining: 400,
          percentUsed: 20,
          enforcement: "enforced",
          inCatalogue: true,
        },
      ],
    },
  ],
};

const usage: IProjectUsage = {
  tenantGroupId: GROUP,
  catalogueVersion: "2026-09-24.1",
  environments: [environment],
};

/** The page takes its project from the route, exactly as the console gives it. */
const renderPage = () =>
  render(
    <MemoryRouter initialEntries={[`/projects/${GROUP}/usage`]}>
      <Routes>
        <Route path="/projects/:tenantGroupId/usage" element={<SubscriptionUsagePage />} />
      </Routes>
    </MemoryRouter>,
  );

describe("SubscriptionUsagePage", () => {
  beforeEach(() => {
    // Calls from an earlier test would otherwise count against the one asserting that nothing is
    // fetched without a project.
    vi.clearAllMocks();
    vi.spyOn(catalogueService, "getUsage").mockResolvedValue({ usage });
    // The quota screen now buys as well as reports, so the billing calls need stubbing. Quoting
    // must stay free of writes — that is asserted below.
    vi.spyOn(catalogueService, "getCatalogue").mockResolvedValue({
      catalogueVersion: "2026-09-24.1",
      priceBookVersion: "2026-09-24.1",
      market: "CHF",
      markets: ["CHF", "USD"],
      usagePeriodDays: 30,
      topUp: {
        requiresPaidEnvironment: true,
        maxMultipleOfIncluded: 2,
        roundDownToWholeStep: true,
        counterUnitsCarry: true,
        drainOrder: ["allowance", "purchased"],
        resourceUnitsRecurring: true,
        resourceDecreaseAt: "usagePeriodEnd",
      },
      services: {},
      environments: {},
      topUpSteps: { "api.calls": { step: 100000, billing: "oneOffCarries", price: 20 } },
    } as never);
    vi.spyOn(billingService, "getCards").mockResolvedValue({ cards: [] });
    vi.spyOn(billingService, "quote").mockResolvedValue({ checkout: {} } as never);
    vi.spyOn(billingService, "startCheckout").mockResolvedValue({ checkout: {} } as never);

    vi.spyOn(catalogueService, "syncUsage").mockResolvedValue({
      added: 1,
      updated: 0,
      unchanged: 20,
    });
  });

  it("renders every service the catalogue returned, without knowing any of them", async () => {
    renderPage();

    await waitFor(() => expect(screen.getByText("API")).toBeTruthy());
    expect(screen.getByText("Release")).toBeTruthy();
    expect(screen.getByText("Vision")).toBeTruthy();
    expect(screen.getByText("Frames analysed")).toBeTruthy();
  });

  it("shows purchased units separately, because they survive the period boundary", async () => {
    renderPage();

    await waitFor(() => expect(screen.getByText("+200,000 bought")).toBeTruthy());
    expect(screen.getByText("1,140,000 / 1,400,000")).toBeTruthy();
  });

  it("renders a policy meter as a value rather than a bar", async () => {
    renderPage();

    await waitFor(() => expect(screen.getByText("Idle stop")).toBeTruthy());
    expect(screen.getByText("Never")).toBeTruthy();
  });

  it("says when the catalogue has meters this environment has not been given yet", async () => {
    renderPage();

    await waitFor(() => expect(screen.getByText("1 not yet synced")).toBeTruthy());
    expect(screen.getByText(/search\.queries/)).toBeTruthy();
  });

  it("refuses to answer without a project rather than guessing one", async () => {
    render(
      <MemoryRouter initialEntries={["/usage"]}>
        <Routes>
          <Route path="/usage" element={<SubscriptionUsagePage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText("No project selected")).toBeTruthy());
    expect(catalogueService.getUsage).not.toHaveBeenCalled();
  });

  it("offers a top-up only for meters the catalogue sells", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("API calls")).toBeTruthy());

    // api.calls has a step in the catalogue; the policy meter and the unknown kind do not.
    expect(screen.getByLabelText(/Add a step of API calls/i)).toBeTruthy();
    expect(screen.queryByLabelText(/Add a step of Idle stop/i)).toBeNull();
  });

  it("prices a basket without creating an order", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("API calls")).toBeTruthy());

    await userEvent.click(screen.getByLabelText(/Add a step of API calls/i));

    await waitFor(() => expect(billingService.quote).toHaveBeenCalled());
    // Clicking around the meters must leave nothing behind.
    expect(billingService.startCheckout).not.toHaveBeenCalled();
  });

  it("syncs the environment against the catalogue on request", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("API")).toBeTruthy());

    await userEvent.click(screen.getByRole("button", { name: /sync with catalogue/i }));

    // Both identifiers travel: the group authorises the call, the tenant says which environment.
    expect(catalogueService.syncUsage).toHaveBeenCalledWith({
      tenantGroupId: GROUP,
      tenantId: "tnt_prod",
      environment: "prod",
      periodKey: "2026-09-12",
      freeTier: false,
    });
  });
});
