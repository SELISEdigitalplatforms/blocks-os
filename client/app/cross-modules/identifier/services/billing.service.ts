import { http } from "@/lib/http/http-client";
import {
  BILLING_ENDPOINTS,
  CHECKOUT_ENDPOINTS,
} from "@blocks-identifier/constants/endpoint.constant";
import {
  ICardSessionResponse,
  IInvoiceListResponse,
  IOrderResponse,
  IPayCheckoutPayload,
  IPaymentMethodListResponse,
  IStartCheckoutPayload,
  IStartCheckoutResponse,
  ISubscriptionResponse,
} from "@blocks-identifier/models/billing.model";

/**
 * Buying things, and watching what was bought get built.
 *
 * Every method names the project group. Nothing here infers it from the session — the server
 * refuses a call that leaves it out, so passing it is not optional.
 */
export class BillingService {
  getCards(tenantGroupId: string): Promise<IPaymentMethodListResponse> {
    return http.get(
      `${BILLING_ENDPOINTS.CARDS}?tenantGroupId=${encodeURIComponent(tenantGroupId)}`,
    );
  }

  setDefaultCard(tenantGroupId: string, paymentMethodId: string) {
    return http.post(BILLING_ENDPOINTS.SET_DEFAULT_CARD, { tenantGroupId, paymentMethodId });
  }

  removeCard(tenantGroupId: string, paymentMethodId: string) {
    return http.post(BILLING_ENDPOINTS.REMOVE_CARD, { tenantGroupId, paymentMethodId });
  }

  /**
   * Opens a provider session so the browser can add a card.
   *
   * The number, expiry and security code go from the browser to the provider and never through
   * Blocks. The card is filed later, from a signed notification — not from anything the browser
   * hands back, which could be forged.
   */
  createCardSession(
    tenantGroupId: string,
    market = "CHF",
    returnUrl?: string,
  ): Promise<ICardSessionResponse> {
    return http.post(BILLING_ENDPOINTS.CARD_SESSION, { tenantGroupId, market, returnUrl });
  }

  /**
   * Downloads an invoice.
   *
   * Goes through fetch rather than the shared client because the response is a file, not JSON,
   * and opening the URL directly would lose the session headers the client attaches.
   */
  async downloadInvoice(tenantGroupId: string, invoiceId: string, number: string): Promise<void> {
    const response = await fetch(
      `${BILLING_ENDPOINTS.INVOICE_PDF(invoiceId)}?tenantGroupId=${encodeURIComponent(tenantGroupId)}`,
      { credentials: "include" },
    );

    if (!response.ok) {
      throw new Error("The invoice could not be downloaded.");
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);

    try {
      const link = document.createElement("a");
      link.href = url;
      link.download = `${number}.pdf`;
      link.click();
    } finally {
      // The object URL pins the blob in memory until it is released.
      URL.revokeObjectURL(url);
    }
  }

  /** Stops the monthly charge. Environments and their data are left alone. */
  unsubscribe(tenantGroupId: string): Promise<{ outstandingBalance: number }> {
    return http.post(BILLING_ENDPOINTS.UNSUBSCRIBE, { tenantGroupId });
  }

  getSubscription(tenantGroupId: string): Promise<ISubscriptionResponse> {
    return http.get(
      `${BILLING_ENDPOINTS.SUBSCRIPTION}?tenantGroupId=${encodeURIComponent(tenantGroupId)}`,
    );
  }

  getInvoices(tenantGroupId: string): Promise<IInvoiceListResponse> {
    return http.get(
      `${BILLING_ENDPOINTS.INVOICES}?tenantGroupId=${encodeURIComponent(tenantGroupId)}`,
    );
  }

  /**
   * Prices a selection without creating anything.
   *
   * What the screen calls while someone is still choosing. Pricing through `startCheckout` on
   * every change would leave an abandoned order behind every tick of a checkbox.
   */
  quote(payload: IStartCheckoutPayload): Promise<IStartCheckoutResponse> {
    return http.post(CHECKOUT_ENDPOINTS.QUOTE, payload);
  }

  /**
   * Prices the purchase and returns the idempotency key.
   *
   * Called when the checkout screen opens, not when Pay is pressed — a key minted on the press
   * would give a double-click two keys, and two charges.
   */
  startCheckout(payload: IStartCheckoutPayload): Promise<IStartCheckoutResponse> {
    return http.post(CHECKOUT_ENDPOINTS.START, payload);
  }

  /**
   * Charges the card. Returns the order, not a project: building environments takes minutes and
   * happens after this call returns.
   *
   * Safe to repeat with the same key — the server returns the existing order rather than charging
   * again, so a retry after a lost response costs nothing.
   */
  pay(payload: IPayCheckoutPayload): Promise<IOrderResponse> {
    return http.post(CHECKOUT_ENDPOINTS.PAY, payload);
  }

  getOrder(tenantGroupId: string, orderId: string): Promise<IOrderResponse> {
    return http.get(
      `${CHECKOUT_ENDPOINTS.ORDER}?tenantGroupId=${encodeURIComponent(tenantGroupId)}` +
        `&orderId=${encodeURIComponent(orderId)}`,
    );
  }

  /**
   * The order still being worked on, if any.
   *
   * Read once when the console loads. Live progress arrives by push and is not persisted, so after
   * a refresh there is nothing to draw from until this answers. One request, not a poll.
   */
  getActiveOrder(tenantGroupId: string): Promise<IOrderResponse> {
    return http.get(
      `${CHECKOUT_ENDPOINTS.ACTIVE}?tenantGroupId=${encodeURIComponent(tenantGroupId)}`,
    );
  }
}

export const billingService = new BillingService();
