// Shapes of the blocks-agents `/api/agent-credits` responses (camelCase JSON, UTC ISO dates).
// Credits are decimals with up to 6 places.

export interface ICreditPool {
  included: number;
  used: number;
  expired: number;
  remaining: number;
}

export interface IExpiringCredits {
  credits: number;
  expiresAtUtc: string;
}

export interface IPaidCreditPool extends ICreditPool {
  /** Earliest first; one entry per paid lot that expires and still has credits left. */
  expiries: IExpiringCredits[];
}

export type TopUpState = "Created" | "CheckoutOpen" | "Paid" | "Failed" | "Cancelled" | "Expired";

export interface ILastTopUp {
  topUpId: string;
  state: TopUpState;
  /** Set only when `state` is `Paid`. */
  creditsGranted: number | null;
  failureReason: string | null;
  createdDate: string | null;
}

export interface IOpenTopUp {
  topUpId: string;
  checkoutUrl: string | null;
  checkoutExpiresAtUtc: string | null;
  payableMinor: number;
  currencyCode: string;
}

export interface IAgentCreditsUsage {
  enabled: boolean;
  allowed: boolean;
  remaining: number;
  free: ICreditPool;
  paid: IPaidCreditPool;
  /** False for a plain member and for a service token: hide the redeem form. */
  canTopUp: boolean;
  billingProfileComplete: boolean;
  creditsPerChf: number;
  minTopUpChf: number;
  currency: string;
  openTopUp: IOpenTopUp | null;
  lastTopUp: ILastTopUp | null;
}

export interface IRedeemCouponPayload {
  couponCode: string;
  /** Optional: without one the server makes its own, and the coupon's one use per project stops a repeat. */
  requestId?: string;
}

/** A redeemed coupon: the credits are already in the project's wallet. */
export interface IRedeemCouponResponse {
  topUpId: string;
  creditsGranted: number;
  /** Null means the credits never expire. */
  validUntil: string | null;
}
