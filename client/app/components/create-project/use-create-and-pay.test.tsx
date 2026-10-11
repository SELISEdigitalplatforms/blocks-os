import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { catalogueMock } from "@/test-utils/__mocks__/catalogue.mock";
import { createWrapper } from "@/test-utils/test-providers/query-client";

const h = vi.hoisted(() => ({
  navigate: vi.fn(),
  setTenantGroup: vi.fn(),
  createProject: vi.fn(),
  startCheckout: vi.fn(),
  getCards: vi.fn(),
  setDefaultCard: vi.fn(),
  pay: vi.fn(),
}));

vi.mock("react-router", async (orig) => ({
  ...(await orig<typeof import("react-router")>()),
  useNavigate: () => h.navigate,
}));
vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ setTenantGroup: h.setTenantGroup }),
}));
vi.mock("@blocks-identifier/services/project.service", () => ({
  projectService: { createProject: h.createProject },
}));
vi.mock("@blocks-identifier/services/billing.service", () => ({
  billingService: {
    startCheckout: h.startCheckout,
    getCards: h.getCards,
    setDefaultCard: h.setDefaultCard,
    pay: h.pay,
  },
}));

import { useCreateAndPay } from "./use-create-and-pay";
import { useCreateProjectFormState } from "./utils";

const order = (total: number, id = "ord-1") => ({
  isSuccess: true,
  orderId: id,
  idempotencyKey: `key-${id}`,
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
  expiryMonth: 11,
  expiryYear: 2030,
  isDefault,
  isExpired: false,
  addedByUserId: "u",
  createdAtUtc: "",
  lastChargedAtUtc: null,
});

const setup = () =>
  renderHook(() => useCreateAndPay(catalogueMock()), { wrapper: createWrapper() });

describe("useCreateAndPay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const s = useCreateProjectFormState.getState();
    s.resetFormData();
    s.setNaming({
      name: "Northwind",
      description: "",
      isAcceptBlocksTerms: true,
      isUseBlocksExclusively: true,
    });
    s.setSelection({
      environments: ["dev", "prod"],
      devTier: "free",
      topUps: { prod: { "api.calls": 2 } },
    });
    s.setRepositories({
      assets: [
        { id: 7, name: "web", full_name: "acme/web", html_url: "https://github.com/acme/web" },
      ],
      deployments: { "7": ["dev"] },
    });
    h.createProject.mockResolvedValue({ isSuccess: true, errors: {}, tenantGroupId: "grp-1" });
    h.pay.mockResolvedValue({ isSuccess: true, order: { state: "paid" } });
  });

  it("creates the project with no environments, then opens an order with the free tier and top-ups", async () => {
    h.startCheckout.mockResolvedValue({ isSuccess: true, checkout: order(0) });
    const { result } = setup();
    await act(() => result.current.run());

    const created = h.createProject.mock.calls[0][0];
    expect(created.applicationContexts).toEqual([]);
    expect(created.resources).toEqual([
      { name: "acme/web", link: "https://github.com/acme/web", resourceId: "7" },
    ]);
    expect(created.repositoryDeployments).toEqual([{ resourceId: "7", environments: ["dev"] }]);
    expect(h.startCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantGroupId: "grp-1",
        environments: ["dev", "prod"],
        freeTier: true,
        topUps: [{ environment: "prod", meter: "api.calls", steps: 2 }],
      }),
    );
  });

  it("a free order needs no card: pays and opens the order page, wizard reset", async () => {
    h.startCheckout.mockResolvedValue({ isSuccess: true, checkout: order(0) });
    const { result } = setup();
    await act(() => result.current.run());
    expect(h.getCards).not.toHaveBeenCalled();
    expect(h.pay).toHaveBeenCalledWith({
      tenantGroupId: "grp-1",
      orderId: "ord-1",
      idempotencyKey: "key-ord-1",
    });
    expect(h.navigate).toHaveBeenCalledWith("/app/creating/grp-1?order=ord-1");
    expect(useCreateProjectFormState.getState().selection.environments).toEqual([]);
  });

  it("a paid order with no card asks for one, then pays once the card arrives", async () => {
    h.startCheckout.mockResolvedValue({ isSuccess: true, checkout: order(420) });
    h.getCards.mockResolvedValueOnce({ cards: [] }).mockResolvedValue({ cards: [card("pm-1")] });
    const { result } = setup();
    await act(() => result.current.run());
    expect(result.current.phase).toBe("needCard");
    expect(h.pay).not.toHaveBeenCalled();

    await act(() => result.current.cardAdded());
    expect(h.pay).toHaveBeenCalledTimes(1);
    expect(h.navigate).toHaveBeenCalledWith("/app/creating/grp-1?order=ord-1");
  });

  it("a decline keeps the project, charges nothing, and the next card pays a NEW order", async () => {
    h.startCheckout
      .mockResolvedValueOnce({ isSuccess: true, checkout: order(420, "ord-1") })
      .mockResolvedValueOnce({ isSuccess: true, checkout: order(420, "ord-2") });
    h.getCards.mockResolvedValueOnce({ cards: [card("pm-1")] });
    h.pay.mockResolvedValueOnce({
      isSuccess: false,
      errors: { checkout: "declined" },
      order: { state: "declined" },
    });
    const { result } = setup();
    await act(() => result.current.run());
    expect(result.current.phase).toBe("declined");
    expect(result.current.message).toMatch(/not been charged/);
    expect(h.navigate).not.toHaveBeenCalled();

    act(() => result.current.chooseAnotherCard());
    expect(result.current.phase).toBe("needCard");
    h.getCards.mockResolvedValue({ cards: [card("pm-1"), card("pm-2", false)] });
    await act(() => result.current.cardAdded());

    expect(h.setDefaultCard).toHaveBeenCalledWith("grp-1", "pm-2");
    expect(h.startCheckout).toHaveBeenCalledTimes(2);
    expect(h.startCheckout.mock.calls[1][0].orderId).toBeUndefined();
    expect(h.pay).toHaveBeenLastCalledWith(expect.objectContaining({ orderId: "ord-2" }));
    expect(h.createProject).toHaveBeenCalledTimes(1);
  });

  it("pressing again after a refusal reuses the created project", async () => {
    h.startCheckout
      .mockResolvedValueOnce({
        isSuccess: false,
        errors: { checkout: "checkout_cap_exceeded" },
        checkout: null,
      })
      .mockResolvedValueOnce({ isSuccess: true, checkout: order(0) });
    const { result } = setup();
    await act(() => result.current.run());
    expect(result.current.phase).toBe("failed");
    expect(result.current.message).toMatch(/goes past/);

    await act(() => result.current.run());
    expect(h.createProject).toHaveBeenCalledTimes(1);
    expect(h.navigate).toHaveBeenCalled();
  });

  it("reports a failed project creation and opens no order", async () => {
    h.createProject.mockResolvedValue({
      isSuccess: false,
      errors: { Name: "taken" },
      tenantGroupId: "",
    });
    const { result } = setup();
    await act(() => result.current.run());
    expect(result.current.phase).toBe("failed");
    expect(result.current.message).toMatch(/taken/);
    expect(h.startCheckout).not.toHaveBeenCalled();
  });

  it("a closed card form says nothing was charged", async () => {
    h.startCheckout.mockResolvedValue({ isSuccess: true, checkout: order(420) });
    h.getCards.mockResolvedValue({ cards: [] });
    const { result } = setup();
    await act(() => result.current.run());
    act(() => result.current.cancelCard());
    await waitFor(() => expect(result.current.phase).toBe("idle"));
    expect(result.current.message).toMatch(/nothing has been charged/);
  });
});
