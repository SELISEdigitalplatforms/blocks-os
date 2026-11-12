import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { isAccessGrantRefused, isErrorWithErrors } from "@/lib/error";
import { IUserStatusChangeResponse } from "@blocks-idp/iam/models/user";

type Translate = (key: string) => string;

/** The two texts that differ between deactivate and activate; the forbidden text is shared. */
export type StatusChangeKeys = {
  success: string;
  somethingWentWrong: string;
};

const FORBIDDEN_KEY = "USER_STATUS_ACTION.FORBIDDEN";

// A missing `mutate-users` permission is a 403 with no body; a per-user refusal is a 403 that
// names Access_Grant_Not_Allowed. Both get the same message.
const isForbidden = (error: unknown) =>
  (typeof error === "object" && error !== null && (error as { status?: unknown }).status === 403) ||
  isAccessGrantRefused(error);

const hasText = (value: unknown) =>
  typeof value === "string"
    ? value.trim().length > 0
    : Array.isArray(value) && value.some((item) => typeof item === "string" && item.trim() !== "");

// Keys that only appear when the HTTP client used a whole response body as `errors`, because the
// body had no `errors` of its own: IAM's result envelope, or an ASP.NET problem details body.
const BODY_ONLY_KEYS = ["isSuccess", "itemId", "traceId", "title", "type"];

/**
 * The server's own messages, or null when there are none to show. Only a client error (4xx) or a
 * result without success carries them. The HTTP client also wraps a request that got no response as
 * status 500 whose `errors` is the original Error object, which carries nothing an operator can read.
 */
const serverMessages = (error: unknown) => {
  if (!isErrorWithErrors(error)) return null;
  const status = (error as { status?: unknown }).status;
  if (typeof status === "number" && (status < 400 || status >= 500)) return null;
  const { errors } = error;
  if (Object.getPrototypeOf(errors) !== Object.prototype) return null;
  if (BODY_ONLY_KEYS.some((key) => key in errors)) return null;
  return Object.values(errors).some(hasText) ? errors : null;
};

export const showStatusChangeError = (error: unknown, t: Translate, keys: StatusChangeKeys) => {
  if (isForbidden(error)) {
    showErrorToast({ errors: t(FORBIDDEN_KEY) });
    return;
  }
  showErrorToast({ errors: serverMessages(error) ?? t(keys.somethingWentWrong) });
};

export const showStatusChangeResult = (
  result: IUserStatusChangeResponse,
  t: Translate,
  keys: StatusChangeKeys,
) => {
  if (result.isSuccess) {
    showSuccessToast({ description: t(keys.success) });
    return;
  }
  showStatusChangeError({ errors: result.errors }, t, keys);
};
