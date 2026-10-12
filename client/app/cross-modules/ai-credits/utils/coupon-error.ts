// The server sends stable codes (`{"detail": {"code", "message"}}`); the wording shown to the user
// lives here. genesis HttpClient wraps the JSON body as `HttpError.errors`, so the code is at
// `errors.detail.code`. Auth refusals are plain text: `{"detail": "..."}` with status 403.

export const NOT_FULLY_COVERED_MESSAGE = "This coupon does not cover the full amount.";
const GENERIC_MESSAGE = "Something went wrong. Try again.";

const MESSAGES: Record<string, string> = {
  coupon_not_found: "We could not find this coupon. Check the code and try again.",
  coupon_expired: "This coupon has expired.",
  coupon_not_started: "This coupon is not active yet.",
  coupon_already_used: "This project has already used this coupon.",
  coupon_exhausted: "This coupon has been fully used.",
  coupon_not_applicable: "This coupon cannot be used for this top-up.",
  coupon_in_use: "This coupon is already being redeemed. Try again in a few minutes.",
  // A payment would be needed: the coupon leaves something to pay.
  billing_profile_incomplete: NOT_FULLY_COVERED_MESSAGE,
  payable_below_minimum: NOT_FULLY_COVERED_MESSAGE,
  billing_unavailable: NOT_FULLY_COVERED_MESSAGE,
  payment_provider_missing: NOT_FULLY_COVERED_MESSAGE,
  payment_forbidden: NOT_FULLY_COVERED_MESSAGE,
  payment_unavailable: "The service is not available right now. Try again.",
};

const FORBIDDEN_MESSAGE = "You do not have permission to redeem coupons in this project.";

type ErrorLike = { status?: unknown; errors?: { detail?: unknown } };

export const getRefusalCode = (error: unknown): string | undefined => {
  const detail = (error as ErrorLike | null)?.errors?.detail;
  if (detail && typeof detail === "object" && "code" in detail) {
    const code = (detail as { code: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
};

export const getCouponErrorMessage = (error: unknown): string => {
  const code = getRefusalCode(error);
  if (code && MESSAGES[code]) return MESSAGES[code];
  if (!code && (error as ErrorLike | null)?.status === 403) return FORBIDDEN_MESSAGE;
  return GENERIC_MESSAGE;
};
