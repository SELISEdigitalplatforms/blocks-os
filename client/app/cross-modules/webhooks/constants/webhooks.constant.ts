export const WEBHOOKS_I18N_MODULE = "os.webhooks";

/** URL key the layout header uses to open the "Add webhook" form on the list page. */
export const ADD_WEBHOOK_QUERY_KEY = "addWebhook";

/** Server rule: a signing secret has at least this many characters. */
export const MIN_SECRET_LENGTH = 32;

export const HISTORY_PAGE_SIZE = 10;

/** Error codes the Webhooks API returns in `errors.code`. */
export const WEBHOOK_ERROR_CODES = {
  NameRequired: "NAME_REQUIRED",
  NameTaken: "WEBHOOK_NAME_TAKEN",
  UrlNotAllowed: "URL_NOT_ALLOWED",
  SecretRequired: "SECRET_REQUIRED",
  SecretInvalid: "SECRET_INVALID",
  SecretMissing: "SECRET_MISSING",
  ActionsRequired: "ACTIONS_REQUIRED",
  ActionNotFound: "ACTION_NOT_FOUND",
  WebhookNotFound: "WEBHOOK_NOT_FOUND",
  WebhookIdRequired: "WEBHOOK_ID_REQUIRED",
  WebhookDeleted: "WEBHOOK_DELETED",
  WebhookInactive: "WEBHOOK_INACTIVE",
  DeliveryNotFound: "DELIVERY_NOT_FOUND",
  DeliveryNotResendable: "DELIVERY_NOT_RESENDABLE",
  DeliveryInFlight: "DELIVERY_IN_FLIGHT",
} as const;
