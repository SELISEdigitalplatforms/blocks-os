// blocks-agents agent-credits routes. The project is the tenant in the token, so no route takes a
// project key: the page must run under the impersonated environment routes.
export const AI_CREDITS_ENDPOINTS = {
  USAGE_CURRENT: "/api/agent-credits/usage/current",
  REDEEM_COUPON: "/api/agent-credits/coupons/redeem",
} as const;

export const COUPON_CODE_LENGTH = 8;
