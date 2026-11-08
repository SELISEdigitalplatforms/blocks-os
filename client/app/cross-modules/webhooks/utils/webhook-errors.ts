import { tStatic } from "@seliseblocks/genesis-os";
import { isErrorWithErrors } from "@/lib/error";
import { WEBHOOK_ERROR_CODES, WEBHOOKS_I18N_MODULE } from "../constants/webhooks.constant";

const text = (key: string) => tStatic(WEBHOOKS_I18N_MODULE, key);

/** The `errors.code` value of a failed Webhooks call, or null when there is none. */
export const getErrorCode = (error: unknown): string | null => {
  if (!isErrorWithErrors(error)) return null;
  const code = error.errors.code;
  return (Array.isArray(code) ? code[0] : code) ?? null;
};

/** One clear sentence per server code, for toasts. Built when read so a language change applies. */
export const webhookErrorMessages = (): Record<string, string> => ({
  [WEBHOOK_ERROR_CODES.NameRequired]: text("FORM.NAME_REQUIRED"),
  [WEBHOOK_ERROR_CODES.NameTaken]: text("ERRORS.WEBHOOK_NAME_TAKEN"),
  [WEBHOOK_ERROR_CODES.UrlNotAllowed]: text("ERRORS.URL_NOT_ALLOWED"),
  [WEBHOOK_ERROR_CODES.SecretRequired]: text("FORM.SECRET_REQUIRED"),
  [WEBHOOK_ERROR_CODES.SecretInvalid]: text("ERRORS.SECRET_INVALID_SHORT"),
  [WEBHOOK_ERROR_CODES.SecretMissing]: text("ERRORS.SECRET_MISSING"),
  [WEBHOOK_ERROR_CODES.ActionsRequired]: text("FORM.ACTIONS_REQUIRED"),
  [WEBHOOK_ERROR_CODES.ActionNotFound]: text("ERRORS.ACTION_NOT_FOUND"),
  [WEBHOOK_ERROR_CODES.WebhookNotFound]: text("ERRORS.WEBHOOK_NOT_FOUND"),
  [WEBHOOK_ERROR_CODES.WebhookIdRequired]: text("ERRORS.WEBHOOK_NOT_FOUND"),
  [WEBHOOK_ERROR_CODES.WebhookDeleted]: text("ERRORS.WEBHOOK_DELETED"),
  [WEBHOOK_ERROR_CODES.WebhookInactive]: text("ERRORS.WEBHOOK_INACTIVE"),
  [WEBHOOK_ERROR_CODES.DeliveryNotFound]: text("ERRORS.DELIVERY_NOT_FOUND"),
  [WEBHOOK_ERROR_CODES.DeliveryNotResendable]: text("ERRORS.DELIVERY_NOT_RESENDABLE"),
  [WEBHOOK_ERROR_CODES.DeliveryInFlight]: text("ERRORS.DELIVERY_IN_FLIGHT"),
});
