import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router";
import { billingService } from "@blocks-identifier/services/billing.service";
import { IPaymentMethodView } from "@blocks-identifier/models/billing.model";
import { CardsPage } from "./cards-page";

/**
 * The provider form is replaced by a button that reports success: the card itself is filed from
 * the provider's notification, so all the page can do afterwards is poll until it appears.
 */
vi.mock("./add-card-dialog", () => ({
  AddCardDialog: ({ open, onCompleted }: { open: boolean; onCompleted?: () => void }) =>
    open ? (
      <button type="button" onClick={() => onCompleted?.()}>
        provider says done
      </button>
    ) : null,
}));

const GROUP = "grp_01JB9K5S8TN2C7";

const card = (id: string, lastFour: string, extra: Partial<IPaymentMethodView> = {}) => ({
  paymentMethodId: id,
  providerName: "adyen",
  brand: "visa",
  lastFour,
  expiryMonth: 4,
  expiryYear: 2029,
  isDefault: false,
  isExpired: false,
  addedByUserId: "u1",
  createdAtUtc: "2026-08-01T00:00:00Z",
  lastChargedAtUtc: null,
  ...extra,
});

const visa = card("pm_1", "4242", { isDefault: true, lastChargedAtUtc: "2026-09-12T00:00:00Z" });
const mc = card("pm_2", "8891", { brand: "mc", isExpired: true });

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={[`/app/project/${GROUP}/billing/cards`]}>
      <Routes>
        <Route path="/app/project/:tenantGroupId/billing" element={<p>billing route</p>} />
        <Route path="/app/project/:tenantGroupId/billing/cards" element={<CardsPage />} />
      </Routes>
    </MemoryRouter>,
  );

describe("CardsPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(billingService, "getCards").mockResolvedValue({ cards: [visa, mc] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("lists the project's cards with default and expired badges", async () => {
    renderPage();

    expect(await screen.findByText("•••• 4242")).toBeTruthy();
    expect(billingService.getCards).toHaveBeenCalledWith(GROUP);
    expect(screen.getByText("default")).toBeTruthy();
    expect(screen.getByText("expired")).toBeTruthy();
    expect(screen.getByText("12 Sep 2026")).toBeTruthy();
    expect(screen.getByText("The card number never reaches Blocks")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to billing" }).getAttribute("href")).toBe(
      `/app/project/${GROUP}/billing`,
    );
  });

  it("says so when there is no card", async () => {
    vi.mocked(billingService.getCards).mockResolvedValue({ cards: [] });
    renderPage();
    expect(await screen.findByText("No card on this project yet")).toBeTruthy();
  });

  it("shows an error with Try again when the cards cannot be read", async () => {
    vi.mocked(billingService.getCards).mockRejectedValueOnce(new Error("down"));
    renderPage();

    expect((await screen.findByRole("alert")).textContent).toContain(
      "The cards could not be loaded.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("•••• 4242")).toBeTruthy();
  });

  it("makes another card the default", async () => {
    const setDefault = vi.spyOn(billingService, "setDefaultCard").mockResolvedValue({});
    renderPage();

    await userEvent.click(
      await screen.findByRole("button", { name: "Make the card ending 8891 the default" }),
    );
    expect(setDefault).toHaveBeenCalledWith(GROUP, "pm_2");
  });

  it("asks before removing the default and explains another is promoted", async () => {
    const removeCard = vi.spyOn(billingService, "removeCard").mockResolvedValue({});
    renderPage();

    await userEvent.click(
      await screen.findByRole("button", { name: "Remove the card ending 4242" }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toContain("Another card on this project becomes the default");
    expect(removeCard).not.toHaveBeenCalled();

    await userEvent.click(within(dialog).getByRole("button", { name: "Remove" }));
    expect(removeCard).toHaveBeenCalledWith(GROUP, "pm_1");
  });

  it("warns that renewals need a card when removing the only one", async () => {
    vi.mocked(billingService.getCards).mockResolvedValue({ cards: [visa] });
    renderPage();

    await userEvent.click(
      await screen.findByRole("button", { name: "Remove the card ending 4242" }),
    );
    expect((await screen.findByRole("dialog")).textContent).toContain("Renewals need a card");
  });

  it("polls after the provider form completes until the new card appears", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Add a card" }));
    await user.click(screen.getByRole("button", { name: "provider says done" }));
    expect(screen.getByRole("status").textContent).toContain("Waiting for the payment provider");

    const calls = () => vi.mocked(billingService.getCards).mock.calls.length;
    const before = calls();

    // Two ticks with nothing new, then the notification lands.
    await act(() => vi.advanceTimersByTimeAsync(1500));
    await act(() => vi.advanceTimersByTimeAsync(1500));
    expect(calls()).toBe(before + 2);

    vi.mocked(billingService.getCards).mockResolvedValue({
      cards: [visa, mc, card("pm_3", "1881")],
    });
    await act(() => vi.advanceTimersByTimeAsync(1500));

    expect(await screen.findByText("•••• 1881")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("Card added.");

    const after = calls();
    await act(() => vi.advanceTimersByTimeAsync(6000));
    expect(calls()).toBe(after);
  });

  it("gives up after 30 seconds and says the card may still be on its way", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Add a card" }));
    await user.click(screen.getByRole("button", { name: "provider says done" }));
    const before = vi.mocked(billingService.getCards).mock.calls.length;

    await act(() => vi.advanceTimersByTimeAsync(31_000));

    expect(vi.mocked(billingService.getCards).mock.calls.length - before).toBe(20);
    expect(screen.getByRole("status").textContent).toContain("The card has not appeared yet");
  });
});
