// The server sends stable codes (`{"detail": {"code", "message"}}`); the wording shown to the user
// lives here. genesis HttpClient wraps the JSON body as `HttpError.errors`, so the code is at
// `errors.detail.code`. Auth refusals are plain text: `{"detail": "..."}` with status 403.

const GENERIC_MESSAGE = "Something went wrong. Try again.";

const MESSAGES: Record<string, string> = {
  coupon_not_found: "We could not find this voucher. Check the code and try again.",
  coupon_expired: "This voucher has expired.",
  coupon_not_started: "This voucher is not active yet.",
  coupon_already_used: "This project has already used this voucher.",
  coupon_exhausted: "This voucher has been fully used.",
  coupon_not_applicable: "This voucher cannot be used here.",
  coupon_in_use: "This voucher is already being redeemed. Try again in a few minutes.",
  // A discount voucher: it lowers the price of a paid top-up instead of adding credits.
  coupon_lowers_price: "This voucher gives a discount on a top-up. It does not add credits here.",
};

const FORBIDDEN_MESSAGE = "You do not have permission to redeem vouchers in this project.";

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
