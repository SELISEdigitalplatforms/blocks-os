import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router";
import { billingService } from "@blocks-identifier/services/billing.service";
import { IInvoiceView } from "@blocks-identifier/models/billing.model";
import { InvoicePage } from "./invoice-page";

const GROUP = "grp_01JB9K5S8TN2C7";

const paid: IInvoiceView = {
  invoiceId: "inv_1",
  number: "BLK-2026-0813",
  market: "CHF",
  subtotal: 460,
  vat: 37.26,
  total: 497.26,
  carriedIn: 0,
  state: "paid",
  issuedAtUtc: "2026-08-13T00:00:00Z",
  paidAtUtc: "2026-08-13T00:00:00Z",
  periodStartUtc: "2026-08-13T00:00:00Z",
  periodEndUtc: "2026-09-12T00:00:00Z",
  paymentMethodBrand: "Visa",
  paymentMethodLastFour: "4242",
  lines: [
    { label: "Production", environment: "prod", units: 0, amount: 400, billing: "rent" },
    { label: "API calls", environment: "prod", units: 200000, amount: 60, billing: "once" },
  ],
};

const failed: IInvoiceView = {
  ...paid,
  invoiceId: "inv_2",
  number: "BLK-2026-0912",
  state: "unpaid",
  paidAtUtc: null,
  carriedIn: 120,
  declinedAtUtc: "2026-09-12T00:00:00Z",
  nextRetryUtc: "2026-09-15T00:00:00Z",
};

const renderPage = (invoiceId = "inv_1") =>
  render(
    <MemoryRouter initialEntries={[`/app/project/${GROUP}/billing/invoices/${invoiceId}`]}>
      <Routes>
        <Route path="/app/project/:tenantGroupId/billing" element={<p>billing route</p>} />
        <Route
          path="/app/project/:tenantGroupId/billing/invoices/:invoiceId"
          element={<InvoicePage />}
        />
      </Routes>
    </MemoryRouter>,
  );

describe("InvoicePage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(billingService, "getInvoice").mockResolvedValue({ isSuccess: true, invoice: paid });
  });

  it("loads the invoice of this project and shows lines, kinds and totals", async () => {
    renderPage();
    expect(screen.getByLabelText("Loading the invoice")).toBeTruthy();

    expect(await screen.findByRole("heading", { name: "Invoice" })).toBeTruthy();
    expect(billingService.getInvoice).toHaveBeenCalledWith(GROUP, "inv_1");
    expect(screen.getByText("Paid")).toBeTruthy();
    const lines = screen.getByRole("region", { name: "Lines" });
    expect(within(lines).getByText("Recurring")).toBeTruthy();
    expect(within(lines).getByText("One-off")).toBeTruthy();
    expect(screen.getByText("CHF 497.26")).toBeTruthy();
    expect(screen.getByText("13 Aug 2026 – 12 Sep 2026")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Retry payment" })).toBeNull();
    expect(screen.getByRole("link", { name: "Back to billing" }).getAttribute("href")).toBe(
      `/app/project/${GROUP}/billing`,
    );
  });

  it("says not found when the invoice is not this project's", async () => {
    vi.mocked(billingService.getInvoice).mockResolvedValue({
      isSuccess: false,
      errors: { invoice: "billing_invoice_not_found" },
      invoice: null,
    });
    renderPage("inv_other");

    expect(await screen.findByText("Invoice not found")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Download PDF" })).toBeNull();
  });

  it("shows an error with Try again when the request fails", async () => {
    vi.mocked(billingService.getInvoice).mockRejectedValueOnce(new Error("timeout"));
    renderPage();

    expect((await screen.findByRole("alert")).textContent).toContain("timeout");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Paid")).toBeTruthy();
  });

  describe("unpaid after a decline", () => {
    beforeEach(() => {
      vi.mocked(billingService.getInvoice).mockResolvedValue({ isSuccess: true, invoice: failed });
    });

    it("shows Payment failed, the card, the decline and next retry, and the carried amount", async () => {
      renderPage("inv_2");

      expect(await screen.findByText("Payment failed")).toBeTruthy();
      expect(screen.getByText("4242")).toBeTruthy();
      expect(screen.getByText("Declined 12 Sep 2026")).toBeTruthy();
      expect(screen.getByText("Next retry 15 Sep 2026")).toBeTruthy();
      expect(screen.getByText("Carried from an earlier period")).toBeTruthy();
    });

    it("retries the payment and reloads on success", async () => {
      const retry = vi.spyOn(billingService, "retryPayment").mockResolvedValue({ isSuccess: true });
      renderPage("inv_2");

      vi.mocked(billingService.getInvoice).mockResolvedValue({ isSuccess: true, invoice: paid });
      await userEvent.click(await screen.findByRole("button", { name: "Retry payment" }));

      expect(retry).toHaveBeenCalledWith(GROUP);
      expect(await screen.findByText("Paid")).toBeTruthy();
    });

    it("shows a refusal in plain words", async () => {
      vi.spyOn(billingService, "retryPayment").mockResolvedValue({
        isSuccess: false,
        errors: { billing: "billing_no_card_on_file" },
      });
      renderPage("inv_2");

      await userEvent.click(await screen.findByRole("button", { name: "Retry payment" }));
      expect((await screen.findByRole("status")).textContent).toContain("Add a card first.");
      await waitFor(() => expect(billingService.getInvoice).toHaveBeenCalledTimes(1));
    });
  });

  it("shows an error when the PDF download fails", async () => {
    vi.spyOn(billingService, "downloadInvoice").mockRejectedValue(new Error("no pdf"));
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: "Download PDF" }));
    expect((await screen.findByRole("alert")).textContent).toContain("no pdf");
  });
});
