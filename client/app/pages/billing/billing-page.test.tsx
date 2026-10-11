import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router";
import { billingService } from "@blocks-identifier/services/billing.service";
import {
  IInvoiceView,
  IPaymentMethodView,
  ISubscriptionView,
} from "@blocks-identifier/models/billing.model";
import { BillingPage } from "./billing-page";

/** Billing is per project: the page reads :tenantGroupId from the route and sends it on every call. */
const GROUP = "grp_01JB9K5S8TN2C7";

const subscription: ISubscriptionView = {
  tenantGroupId: GROUP,
  market: "CHF",
  state: "active",
  monthlyBeforeTax: 400,
  monthlyTotal: 432.4,
  carriedBalance: 0,
  nextChargeAtUtc: "2026-10-12T00:00:00Z",
  lines: [
    { environment: "prod", label: "Production", meter: "", units: 0, amount: 300, billing: "rent" },
    {
      environment: "stg",
      label: "Staging",
      meter: "",
      units: 0,
      amount: 100,
      billing: "rent",
      pendingRemoval: true,
      endsAtUtc: "2026-10-12T00:00:00Z",
    },
  ],
};

const invoice: IInvoiceView = {
  invoiceId: "inv_1",
  number: "BLK-2026-0912",
  market: "CHF",
  subtotal: 460,
  vat: 37.26,
  total: 497.26,
  carriedIn: 0,
  state: "paid",
  issuedAtUtc: "2026-09-12T00:00:00Z",
  periodStartUtc: "2026-09-12T00:00:00Z",
  periodEndUtc: "2026-10-12T00:00:00Z",
  lines: [
    { label: "Production", environment: "prod", units: 0, amount: 400, billing: "rent" },
    { label: "API calls", environment: "prod", units: 200000, amount: 60, billing: "once" },
  ],
};

const card: IPaymentMethodView = {
  paymentMethodId: "pm_1",
  providerName: "adyen",
  brand: "visa",
  lastFour: "4242",
  expiryMonth: 4,
  expiryYear: 2029,
  isDefault: true,
  isExpired: false,
  addedByUserId: "u1",
  createdAtUtc: "2026-08-01T00:00:00Z",
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={[`/app/project/${GROUP}/billing`]}>
      <Routes>
        <Route path="/app/project/:tenantGroupId/billing" element={<BillingPage />} />
        <Route
          path="/app/project/:tenantGroupId/billing/invoices/:invoiceId"
          element={<p>invoice route</p>}
        />
      </Routes>
    </MemoryRouter>,
  );

describe("BillingPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(billingService, "getSubscription").mockResolvedValue({ subscription });
    vi.spyOn(billingService, "getInvoices").mockResolvedValue({ invoices: [invoice] });
    vi.spyOn(billingService, "getCards").mockResolvedValue({ cards: [card] });
  });

  it("shows a skeleton, then the next charge, lines, invoices and the default card", async () => {
    renderPage();
    expect(screen.getByLabelText("Loading the next charge")).toBeTruthy();

    expect(await screen.findByText("CHF 432.40")).toBeTruthy();
    expect(billingService.getSubscription).toHaveBeenCalledWith(GROUP);
    expect(billingService.getInvoices).toHaveBeenCalledWith(GROUP);

    const lines = screen.getByRole("list", { name: "Subscription lines" });
    expect(within(lines).getAllByText("Recurring")).toHaveLength(2);

    expect(screen.getByRole("link", { name: "BLK-2026-0912" }).getAttribute("href")).toBe(
      `/app/project/${GROUP}/billing/invoices/inv_1`,
    );
    expect(screen.getByText("CHF 400.00")).toBeTruthy();
    expect(screen.getByText("CHF 60.00")).toBeTruthy();
    expect(screen.getByText("Paid")).toBeTruthy();
    expect(await screen.findByText("•••• 4242")).toBeTruthy();
  });

  it("marks a line that is being removed with the date it ends", async () => {
    renderPage();
    expect(await screen.findByText("ends 12 Oct 2026")).toBeTruthy();
  });

  it("shows an error with Try again when loading fails, and recovers", async () => {
    vi.mocked(billingService.getSubscription).mockRejectedValueOnce(new Error("network down"));
    renderPage();

    expect((await screen.findByRole("alert")).textContent).toContain("network down");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("CHF 432.40")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("says so when the project has no subscription and no invoices", async () => {
    vi.mocked(billingService.getSubscription).mockResolvedValue({ subscription: null });
    vi.mocked(billingService.getInvoices).mockResolvedValue({ invoices: [] });
    vi.mocked(billingService.getCards).mockResolvedValue({ cards: [] });
    renderPage();

    expect(await screen.findByText(/Nothing recurring on this project yet/)).toBeTruthy();
    expect(screen.getByText("Nothing has been billed on this project yet.")).toBeTruthy();
    expect(await screen.findByText(/No default card on file/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Unsubscribe" })).toBeNull();
  });

  describe("past due", () => {
    beforeEach(() => {
      vi.mocked(billingService.getSubscription).mockResolvedValue({
        subscription: { ...subscription, state: "pastDue", carriedBalance: 497.26 },
      });
    });

    it("states what is owed, calmly, and Pay now reloads on success", async () => {
      const retry = vi.spyOn(billingService, "retryPayment").mockResolvedValue({
        isSuccess: true,
        state: "active",
      });
      renderPage();

      const banner = await screen.findByRole("region", { name: "Payment owed" });
      expect(banner.textContent).toContain("CHF 497.26 is owed");
      expect(banner.textContent).toContain("every environment keeps running");

      vi.mocked(billingService.getSubscription).mockResolvedValue({ subscription });
      await userEvent.click(within(banner).getByRole("button", { name: "Pay now" }));

      expect(retry).toHaveBeenCalledWith(GROUP);
      await waitFor(() =>
        expect(screen.queryByRole("region", { name: "Payment owed" })).toBeNull(),
      );
      expect(billingService.getSubscription).toHaveBeenCalledTimes(2);
    });

    it("shows the refusal in plain words when Pay now is refused", async () => {
      vi.spyOn(billingService, "retryPayment").mockResolvedValue({
        isSuccess: false,
        errors: { billing: "billing_payment_declined" },
      });
      renderPage();

      const banner = await screen.findByRole("region", { name: "Payment owed" });
      await userEvent.click(within(banner).getByRole("button", { name: "Pay now" }));

      expect(
        await within(banner).findByText("The bank refused the payment. Nothing was charged."),
      ).toBeTruthy();
      expect(billingService.getSubscription).toHaveBeenCalledTimes(1);
    });
  });

  it("shows an inline error when a PDF download fails", async () => {
    vi.spyOn(billingService, "downloadInvoice").mockRejectedValue(
      new Error("The invoice could not be downloaded."),
    );
    renderPage();

    await userEvent.click(
      await screen.findByRole("button", { name: "Download PDF of BLK-2026-0912" }),
    );
    expect((await screen.findByRole("alert")).textContent).toContain(
      "The invoice could not be downloaded.",
    );
  });

  it("asks before unsubscribing and says environments keep running", async () => {
    const unsubscribe = vi
      .spyOn(billingService, "unsubscribe")
      .mockResolvedValue({ outstandingBalance: 0 });
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: "Unsubscribe" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toContain("environments keep running");
    expect(unsubscribe).not.toHaveBeenCalled();

    vi.mocked(billingService.getSubscription).mockResolvedValue({
      subscription: { ...subscription, state: "cancelled" },
    });
    await userEvent.click(within(dialog).getByRole("button", { name: "Unsubscribe" }));

    expect(unsubscribe).toHaveBeenCalledWith(GROUP);
    expect(await screen.findByText("This project is no longer billed")).toBeTruthy();
  });
});
