import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  navigate: vi.fn(),
  quote: vi.fn(),
  startCheckout: vi.fn(),
  getCards: vi.fn(),
  setDefaultCard: vi.fn(),
  pay: vi.fn(),
}));

vi.mock("react-router", async (orig) => ({
  ...(await orig<typeof import("react-router")>()),
  useNavigate: () => h.navigate,
}));
vi.mock("@blocks-identifier/services/billing.service", () => ({
  billingService: {
    quote: h.quote,
    startCheckout: h.startCheckout,
    getCards: h.getCards,
    setDefaultCard: h.setDefaultCard,
    pay: h.pay,
  },
}));

import { PurchaseSelection, useProjectPurchase } from "./use-project-purchase";

const checkout = (total: number, id = "ord-1") => ({
  isSuccess: true,
  orderId: id,
  idempotencyKey: `k-${id}`,
  market: "CHF",
  subtotal: total,
  vat: 0,
  total,
  recurringMonthly: total,
  lines: [],
  reason: "",
});
const card = (id: string, isDefault = true) => ({
  paymentMethodId: id,
  providerName: "adyen",
  brand: "visa",
  lastFour: "4242",
  expiryMonth: 1,
  expiryYear: 2031,
  isDefault,
  isExpired: false,
  addedByUserId: "u",
  createdAtUtc: "",
});

const add: PurchaseSelection = { environments: ["stg"], topUps: [] };

describe("useProjectPurchase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.quote.mockResolvedValue({ isSuccess: true, checkout: checkout(55.5, "") });
    h.startCheckout.mockResolvedValue({ isSuccess: true, checkout: checkout(55.5) });
    h.pay.mockResolvedValue({ isSuccess: true, order: { state: "paid" } });
  });

  it("shows the server's quote for the selection and nothing for an empty one", async () => {
    const { result, rerender } = renderHook(({ s }) => useProjectPurchase("grp", s), {
      initialProps: { s: add },
    });
    await waitFor(() => expect(result.current.quote?.total).toBe(55.5));
    expect(h.quote).toHaveBeenCalledWith({
      tenantGroupId: "grp",
      environments: ["stg"],
      topUps: [],
    });

    rerender({ s: { environments: [], topUps: [] } });
    await waitFor(() => expect(result.current.quote).toBeNull());
  });

  it("shows a refused quote in plain words", async () => {
    h.quote.mockResolvedValue({
      isSuccess: false,
      errors: { checkout: "checkout_environment_exists" },
      checkout: null,
    });
    const { result } = renderHook(() => useProjectPurchase("grp", add));
    await waitFor(() => expect(result.current.quoteError).toMatch(/already has/));
  });

  it("buys with the card on file and opens the order", async () => {
    h.getCards.mockResolvedValue({ cards: [card("pm-1")] });
    const { result } = renderHook(() => useProjectPurchase("grp", add));
    await act(() => result.current.buy());
    expect(h.pay).toHaveBeenCalledWith({
      tenantGroupId: "grp",
      orderId: "ord-1",
      idempotencyKey: "k-ord-1",
    });
    expect(h.navigate).toHaveBeenCalledWith("/app/project/grp/order?order=ord-1");
  });

  it("asks for a card when there is none, then pays with the new one made default", async () => {
    h.getCards
      .mockResolvedValueOnce({ cards: [] })
      .mockResolvedValue({ cards: [card("pm-9", false)] });
    const { result } = renderHook(() => useProjectPurchase("grp", add));
    await act(() => result.current.buy());
    expect(result.current.phase).toBe("needCard");
    await act(() => result.current.cardAdded());
    expect(h.setDefaultCard).toHaveBeenCalledWith("grp", "pm-9");
    expect(h.pay).toHaveBeenCalledTimes(1);
  });

  it("a decline charges nothing, stays on the page, and the next try opens a new order", async () => {
    h.getCards.mockResolvedValue({ cards: [card("pm-1")] });
    h.pay.mockResolvedValueOnce({
      isSuccess: false,
      errors: { checkout: "checkout_declined" },
      order: { state: "declined" },
    });
    const { result } = renderHook(() => useProjectPurchase("grp", add));
    await act(() => result.current.buy());
    expect(result.current.phase).toBe("declined");
    expect(result.current.message).toMatch(/not been charged/);
    expect(h.navigate).not.toHaveBeenCalled();

    await act(() => result.current.buy());
    expect(h.startCheckout.mock.calls[1][0].orderId).toBeUndefined();
  });

  it("free purchases skip the card", async () => {
    h.startCheckout.mockResolvedValue({ isSuccess: true, checkout: checkout(0) });
    const { result } = renderHook(() =>
      useProjectPurchase("grp", { environments: [], topUps: [], upgradeFreeTier: false }),
    );
    await act(() => result.current.buy());
    // empty selection: nothing happens at all
    expect(h.startCheckout).not.toHaveBeenCalled();
  });
});
