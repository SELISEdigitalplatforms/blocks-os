import { tStatic } from "@seliseblocks/genesis-os";

const I18N_MODULE = "os.ai-credits";
// The server sends stable codes (`{"detail": {"code", "message"}}`); the wording shown to the user
// lives here. genesis HttpClient wraps the JSON body as `HttpError.errors`, so the code is at
// `errors.detail.code`. Auth refusals are plain text: `{"detail": "..."}` with status 403.

const GENERIC_MESSAGE = () => tStatic(I18N_MODULE, "COUPON_ERROR.SOMETHING_WENT_WRONG_TRY_AGAIN");

const MESSAGES: Record<string, string> = {
  get coupon_not_found() {
    return tStatic(I18N_MODULE, "COUPON_ERROR.WE_COULD_NOT_FIND_THIS");
  },
  get coupon_expired() {
    return tStatic(I18N_MODULE, "COUPON_ERROR.THIS_VOUCHER_HAS_EXPIRED");
  },
  get coupon_not_started() {
    return tStatic(I18N_MODULE, "COUPON_ERROR.THIS_VOUCHER_IS_NOT_ACTIVE");
  },
  get coupon_already_used() {
    return tStatic(I18N_MODULE, "COUPON_ERROR.THIS_PROJECT_HAS_ALREADY_USED");
  },
  get coupon_exhausted() {
    return tStatic(I18N_MODULE, "COUPON_ERROR.THIS_VOUCHER_HAS_BEEN_FULLY");
  },
  get coupon_not_applicable() {
    return tStatic(I18N_MODULE, "COUPON_ERROR.THIS_VOUCHER_CANNOT_BE_USED");
  },
  get coupon_in_use() {
    return tStatic(I18N_MODULE, "COUPON_ERROR.THIS_VOUCHER_IS_ALREADY_BEING");
  },
  // A discount voucher: it lowers the price of a paid top-up instead of adding credits.
  get coupon_lowers_price() {
    return tStatic(I18N_MODULE, "COUPON_ERROR.THIS_VOUCHER_GIVES_A_DISCOUNT");
  },
};

const FORBIDDEN_MESSAGE = () => tStatic(I18N_MODULE, "COUPON_ERROR.YOU_DO_NOT_HAVE_PERMISSION");

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
  if (!code && (error as ErrorLike | null)?.status === 403) return FORBIDDEN_MESSAGE();
  return GENERIC_MESSAGE();
};
