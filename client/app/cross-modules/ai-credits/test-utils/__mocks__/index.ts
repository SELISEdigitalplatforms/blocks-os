import type { IAgentCreditsUsage, ICreateTopUpResponse } from "../../models/ai-credits.model";

// Mirrors the blocks-agents dev response of GET /api/agent-credits/usage/current.
export const mockUsage: IAgentCreditsUsage = {
  enabled: true,
  allowed: true,
  remaining: 6360,
  free: { included: 100, used: 40, expired: 0, remaining: 60 },
  paid: {
    included: 6500,
    used: 200,
    expired: 0,
    remaining: 6300,
    expiries: [
      { credits: 2300, expiresAtUtc: "2026-10-26T09:12:00Z" },
      { credits: 500, expiresAtUtc: "2026-11-02T14:00:00Z" },
    ],
  },
  canTopUp: true,
  billingProfileComplete: true,
  creditsPerChf: 100,
  minTopUpChf: 1,
  currency: "CHF",
  openTopUp: null,
  lastTopUp: {
    topUpId: "0c7d6a9e",
    state: "Paid",
    creditsGranted: 2500,
    failureReason: null,
    createdDate: "2026-10-11T10:00:00Z",
  },
};

export const mockPaidTopUp: ICreateTopUpResponse = {
  topUpId: "b2d5c0b0",
  state: "Paid",
  flow: "Coupon",
  creditsGranted: 2500,
  validUntil: "2026-10-27T09:12:00Z",
  checkoutUrl: null,
  checkoutExpiresAtUtc: null,
  listAmountMinor: 2500,
  discountMinor: 2500,
  payableMinor: 0,
  currencyCode: "CHF",
};

export const mockCheckoutTopUp: ICreateTopUpResponse = {
  ...mockPaidTopUp,
  state: "CheckoutOpen",
  flow: "Hosted",
  creditsGranted: null,
  validUntil: null,
  checkoutUrl: "https://checkout.example/abc",
  discountMinor: 1250,
  payableMinor: 1250,
};

/** What genesis HttpClient throws for a FastAPI refusal. */
export const refusal = (status: number, code: string) =>
  Object.assign(new Error("refused"), {
    status,
    errors: { detail: { code, message: "server text" } },
  });
