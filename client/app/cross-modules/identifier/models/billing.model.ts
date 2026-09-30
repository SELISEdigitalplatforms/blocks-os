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

export interface IStartCheckoutResponse {
  checkout: IStartCheckoutResult;
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
  | "pending"
  | "paid"
  | "creating"
  | "created"
  | "declined"
  | "expired"
  | string;

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
  order: IOrderView | null;
}

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
  subscription: ISubscriptionView | null;
}

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
}

export interface IInvoiceListResponse {
  invoices: IInvoiceView[];
}
