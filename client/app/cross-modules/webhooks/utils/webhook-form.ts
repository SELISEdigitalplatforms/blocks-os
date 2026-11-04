import { z } from "zod";
import { tStatic } from "@seliseblocks/genesis-os";
import {
  MIN_SECRET_LENGTH,
  WEBHOOK_ERROR_CODES,
  WEBHOOKS_I18N_MODULE,
} from "../constants/webhooks.constant";
import type { ISaveWebhookPayload, IWebhook } from "../models/webhook.model";

const text = (key: string, values?: Record<string, string | number>) =>
  tStatic(WEBHOOKS_I18N_MODULE, key, values);

const HTTPS_PREFIX = "https://";

/** Create needs a secret of at least 32 characters; edit may leave it empty to keep the old one. */
export const createWebhookFormSchema = (isEdit: boolean) =>
  z.object({
    name: z.string().trim().min(1, text("FORM.NAME_REQUIRED")),
    url: z
      .string()
      .trim()
      .refine(
        (value) => value.toLowerCase().startsWith(HTTPS_PREFIX),
        text("FORM.URL_MUST_BE_HTTPS"),
      ),
    secret: z.string().superRefine((value, ctx) => {
      if (value.length === 0) {
        if (!isEdit) ctx.addIssue({ code: "custom", message: text("FORM.SECRET_REQUIRED") });
        return;
      }
      if (value.length < MIN_SECRET_LENGTH) {
        ctx.addIssue({
          code: "custom",
          message: text("FORM.SECRET_TOO_SHORT", { min: MIN_SECRET_LENGTH }),
        });
      }
    }),
    isActive: z.boolean(),
    actions: z.array(z.string()).min(1, text("FORM.ACTIONS_REQUIRED")),
  });

export type WebhookFormValues = z.infer<ReturnType<typeof createWebhookFormSchema>>;

export const emptyWebhookForm: WebhookFormValues = {
  name: "",
  url: "",
  secret: "",
  isActive: true,
  actions: [],
};

/** The secret is never loaded back: the API does not send it. */
export const toWebhookFormValues = (
  webhook: IWebhook | null | undefined,
  allowedActions: readonly string[],
): WebhookFormValues =>
  webhook
    ? {
        name: webhook.name,
        url: webhook.url,
        secret: "",
        isActive: webhook.isActive,
        actions: webhook.actions.filter((name) => allowedActions.includes(name)),
      }
    : emptyWebhookForm;

/**
 * Actions the form cannot show (their Webhook switch is off now) are kept as they were: turning a switch off
 * must not silently remove the action from a webhook the admin edits for another reason.
 */
export const toSavePayload = (
  values: WebhookFormValues,
  webhook: IWebhook | null | undefined,
  allowedActions: readonly string[] = [],
): ISaveWebhookPayload => ({
  ...(webhook ? { id: webhook.id } : {}),
  name: values.name.trim(),
  url: values.url.trim(),
  ...(values.secret ? { secret: values.secret } : {}),
  isActive: values.isActive,
  actions: [
    ...values.actions,
    ...(webhook?.actions ?? []).filter((name) => !allowedActions.includes(name) && !values.actions.includes(name)),
  ],
});

export type WebhookFormField = keyof WebhookFormValues;

/** Which form field a server error belongs to, and the message to show on it. */
export const fieldErrorForCode = (
  code: string,
): { field: WebhookFormField; message: string } | null => {
  switch (code) {
    case WEBHOOK_ERROR_CODES.NameRequired:
      return { field: "name", message: text("FORM.NAME_REQUIRED") };
    case WEBHOOK_ERROR_CODES.NameTaken:
      return { field: "name", message: text("ERRORS.WEBHOOK_NAME_TAKEN") };
    case WEBHOOK_ERROR_CODES.UrlNotAllowed:
      return { field: "url", message: text("ERRORS.URL_NOT_ALLOWED") };
    case WEBHOOK_ERROR_CODES.SecretRequired:
      return { field: "secret", message: text("FORM.SECRET_REQUIRED") };
    case WEBHOOK_ERROR_CODES.SecretInvalid:
      return {
        field: "secret",
        message: text("ERRORS.SECRET_INVALID", { min: MIN_SECRET_LENGTH }),
      };
    case WEBHOOK_ERROR_CODES.ActionsRequired:
      return { field: "actions", message: text("FORM.ACTIONS_REQUIRED") };
    case WEBHOOK_ERROR_CODES.ActionNotFound:
      return { field: "actions", message: text("ERRORS.ACTION_NOT_FOUND") };
    default:
      return null;
  }
};
