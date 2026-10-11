/**
 * Orders, cards and progress.
 *
 * Every call is scoped to a project group — never to one environment's tenant, and never inferred
 * from whoever is calling.
 */

/** A card as the console is allowed to see it. Holds nothing secret. */
export interface IPaymentMethodView {
  paymentMethodId: string;
  providerName: string;
  brand: string;
  lastFour: string;
  expiryMonth: number;
  expiryYear: number;
  isDefault: boolean;
  isExpired: boolean;
  addedByUserId: string;
  createdAtUtc: string;
  lastChargedAtUtc?: string | null;
}

export interface IPaymentMethodListResponse {
  cards: IPaymentMethodView[];
}

export interface ITopUpSelection {
  environment: string;
  /** Meter id as the catalogue spells it, e.g. `api.calls`. */
  meter: string;
  /** Purchasable steps, not units. */
  steps: number;
}

export interface IStartCheckoutPayload {
  tenantGroupId: string;
  environments: string[];
  topUps: ITopUpSelection[];
  market?: string;
  /** An order this session already started, to re-price in place rather than start another. */
  orderId?: string;
  /** Take the catalogue's free-tier environment at the free price (one per project). */
  freeTier?: boolean;
  /** Move the project's free-tier environment to its paid price (limits rise at once). */
  upgradeFreeTier?: boolean;
}

export interface ICheckoutLine {
  kind: "environment" | "topup" | string;
  label: string;
  environment: string;
  meter: string;
  units: number;
  amount: number;
  /** `once` carries until spent; `rent` is charged again every period it is held. */
  billing: "once" | "rent" | string;
}

export interface IStartCheckoutResult {
  isSuccess: boolean;
  orderId: string;
  /** Minted by the server when checkout opens. Returned unchanged on every pay attempt. */
  idempotencyKey: string;
  market: string;
  subtotal: number;
  vat: number;
  total: number;
  recurringMonthly: number;
  lines: ICheckoutLine[];
  reason: string;
}

/**
 * A refused checkout still answers 200: `isSuccess` false, the reason under `errors.checkout`
 * and no `checkout`. Callers must check before reading it.
 */
export interface IStartCheckoutResponse {
  isSuccess?: boolean;
  errors?: Record<string, string>;
  checkout: IStartCheckoutResult | null;
}

export interface IPayCheckoutPayload {
  tenantGroupId: string;
  orderId: string;
  /** The same key every time. A fresh one would be a second charge. */
  idempotencyKey: string;
  paymentMethodId?: string;
}

/**
 * Order states.
 *
 * There is deliberately no failure state after `paid`: once money has moved the customer is only
 * ever shown progress. `declined` happens before any charge, so nothing was created.
 */
export type OrderState =
  "pending" | "paid" | "creating" | "created" | "declined" | "expired" | string;

export interface IEnvironmentProgressView {
  tenantId: string;
  environment: string;
  stepsDone: number;
  stepsTotal: number;
  /** Plain words, e.g. "Installing certificates". Empty once the environment is ready. */
  step: string;
  status: "queued" | "building" | "retrying" | "ready" | string;
  /** Only set once a step has actually been retried. */
  attempt: number;
}

export interface IOrderView {
  orderId: string;
  /** The project the order belongs to. Older servers leave it out. */
  tenantGroupId?: string;
  state: OrderState;
  total: number;
  market: string;
  stepsDone: number;
  stepsTotal: number;
  currentStep: string;
  currentEnvironment: string;
  attempt: number;
  maxAttempts: number;
  declineReason: string;
  chargedAtUtc?: string | null;
  completedAtUtc?: string | null;
  environments: IEnvironmentProgressView[];
}

export interface IOrderResponse {
  isSuccess?: boolean;
  /** A refused or declined payment: the reason under `errors.checkout`. */
  errors?: Record<string, string>;
  order: IOrderView | null;
}

/** Plain words for every refusal code checkout and pay can return. */
export const checkoutReasonMessage = (reason: string | undefined | null): string => {
  switch (reason) {
    case "checkout_nothing_selected":
      return "Pick at least one environment or top-up.";
    case "checkout_unknown_environment":
    case "checkout_unknown_meter":
      return "Something you picked is no longer offered. Go back and choose again.";
    case "checkout_meter_not_purchasable":
      return "One of the top-ups can't be bought.";
    case "checkout_cap_exceeded":
      return "A top-up goes past what that environment may hold. Lower it and try again.";
    case "checkout_free_tier":
      return "The free development environment can't be topped up. Switch it to Paid.";
    case "checkout_free_tier_taken":
      return "This project already has its free development environment.";
    case "checkout_environment_exists":
      return "This project already has one of these environments.";
    case "checkout_no_price":
      return "One of the items has no price yet. Please contact us.";
    case "checkout_no_card_on_file":
      return "Add a card before paying.";
    case "checkout_order_not_found":
    case "checkout_order_expired":
    case "checkout_key_mismatch":
      return "This checkout has expired. It has been opened again — please review the total.";
    case "declined":
    case "checkout_declined":
      return "Your bank refused the payment. You have not been charged.";
    case "checkout_nothing_to_upgrade":
      return "There is no free environment to upgrade on this project.";
    case "checkout_free_tier_unavailable":
      return "No environment in this selection has a free tier.";
    case "checkout_environment_not_held":
      return "A top-up is for an environment this project doesn't have. Add the environment too.";
    default:
      return reason
        ? `The payment could not be completed (${reason}).`
        : "The payment could not be completed.";
  }
};

/** The refusal code in a checkout or pay response, if it was refused. */
export const checkoutRefusal = (response: {
  isSuccess?: boolean;
  errors?: Record<string, string>;
}): string | null => {
  if (response.isSuccess !== false) return null;
  return response.errors?.checkout ?? Object.values(response.errors ?? {})[0] ?? "unknown";
};

/** True while the order is still doing something the screen should show. */
export const isOrderInFlight = (state: OrderState): boolean =>
  state === "pending" || state === "paid" || state === "creating";

/** How far along, 0–100. Steps rather than environments, because that is what actually moves. */
export const orderPercent = (order: IOrderView): number =>
  order.stepsTotal > 0 ? Math.round((order.stepsDone * 100) / order.stepsTotal) : 0;

/** What the browser needs to open the provider's card form. Carries no secret of ours. */
export interface ICardSessionView {
  isSuccess: boolean;
  sessionId: string;
  sessionData: string;
  clientKey: string;
  /** "test" or "live" — which provider environment the component should talk to. */
  environment: string;
  reason: string;
}

export interface ICardSessionResponse {
  session: ICardSessionView;
}

export interface ISubscriptionLineView {
  environment: string;
  label: string;
  meter: string;
  units: number;
  amount: number;
  kind?: "environment" | "topup" | string;
  /** Always "rent" on the subscription: only recurring lines live here. */
  billing?: "rent" | "once" | string;
  /** When a removal takes effect (the next period boundary). Null while nothing is planned. */
  endsAtUtc?: string | null;
  pendingRemoval?: boolean;
}

/**
 * The standing arrangement: what recurs, and what a previous period failed to collect.
 *
 * `pastDue` never means suspended. A decline carries the amount to the next invoice and everything
 * keeps running, so the screen should say what is owed, not warn about losing access.
 */
export interface ISubscriptionView {
  tenantGroupId: string;
  market: string;
  state: "active" | "pastDue" | "cancelled" | string;
  monthlyBeforeTax: number;
  monthlyTotal: number;
  carriedBalance: number;
  nextChargeAtUtc: string;
  lastChargedAtUtc?: string | null;
  lines: ISubscriptionLineView[];
}

export interface ISubscriptionResponse {
  isSuccess?: boolean;
  errors?: Record<string, string>;
  subscription: ISubscriptionView | null;
}

/** Remove / keep an environment. `effectiveUtc` is when billing for it stops. */
export interface IEnvironmentBillingResponse {
  isSuccess?: boolean;
  errors?: Record<string, string>;
  effectiveUtc?: string | null;
}

export interface IRetryPaymentResponse {
  isSuccess?: boolean;
  errors?: Record<string, string>;
  state?: string;
  carriedBalance?: number;
}

/** Plain words for billing refusal codes (`errors.billing`, `errors.invoice`). */
export const billingReasonMessage = (reason: string | undefined | null): string => {
  switch (reason) {
    case "billing_environment_not_found":
      return "That environment isn't billed on this project.";
    case "billing_nothing_owed":
      return "Nothing is owed right now.";
    case "billing_no_card_on_file":
      return "Add a card first.";
    case "billing_payment_declined":
      return "The bank refused the payment. Nothing was charged.";
    case "billing_payment_pending":
      return "The bank hasn't answered yet. Nothing has changed; check back in a few minutes.";
    case "payment_method_not_found":
      return "That card is no longer on this project.";
    case "payment_method_secret_unavailable":
    case "payment_method_invalid":
      return "That card can't be used. Add it again.";
    case "billing_invoice_not_found":
      return "This invoice doesn't exist on this project.";
    default:
      return reason ? `That didn't work (${reason}).` : "That didn't work.";
  }
};

/** The refusal code in a billing response, if refused. */
export const billingRefusal = (response: {
  isSuccess?: boolean;
  errors?: Record<string, string>;
}) =>
  response.isSuccess === false ? (Object.values(response.errors ?? {})[0] ?? "unknown") : null;

export interface IInvoiceLineView {
  label: string;
  environment: string;
  units: number;
  amount: number;
  /** "once" is spent money whose units carry; "rent" can be reduced at the next boundary. */
  billing: "once" | "rent" | string;
}

export interface IInvoiceView {
  invoiceId: string;
  number: string;
  market: string;
  subtotal: number;
  vat: number;
  total: number;
  /** Brought in from a period that could not be collected. */
  carriedIn: number;
  state: "paid" | "unpaid" | string;
  issuedAtUtc: string;
  paidAtUtc?: string | null;
  lines: IInvoiceLineView[];
  periodStartUtc?: string | null;
  periodEndUtc?: string | null;
  /** Set when the invoice was written for a checkout order rather than a renewal. */
  orderId?: string | null;
  paymentMethodBrand?: string | null;
  paymentMethodLastFour?: string | null;
  declinedAtUtc?: string | null;
  /** Only while unpaid. */
  nextRetryUtc?: string | null;
}

export interface IInvoiceResponse {
  isSuccess?: boolean;
  errors?: Record<string, string>;
  invoice: IInvoiceView | null;
}

export interface IInvoiceListResponse {
  invoices: IInvoiceView[];
}
