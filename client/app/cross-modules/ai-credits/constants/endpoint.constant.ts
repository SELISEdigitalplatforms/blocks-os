// blocks-agents agent-credits routes. The project is the tenant in the token, so no route takes a
// project key: the page must run under the impersonated environment routes.
export const AI_CREDITS_ENDPOINTS = {
  USAGE_CURRENT: "/api/agent-credits/usage/current",
  TOP_UPS: "/api/agent-credits/topups",
} as const;

// Coupon-only release: there is no amount field, so every redeem asks for this list price. A
// coupon that covers it in full grants the credits at once; anything less would need a payment,
// which this page does not offer yet.
export const COUPON_TOP_UP_AMOUNT_CHF = 25;

export const COUPON_CODE_LENGTH = 8;
