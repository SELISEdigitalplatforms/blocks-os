import { z } from "zod";

export type ActivationErrorState = "invalid" | "expired" | "already_activated";

// An already-activated account is not an invalid link: the validate call fails, but the failure means
// "you have already set up this account, please sign in". The backend signals it either structurally
// (status / isAlreadyActive) or through an error key/message; recognise the key/message form here so the
// correct screen shows even before the backend adds the structured field.
const ALREADY_ACTIVE_PATTERN = /already[\s_-]?(activ|sign)/i;

export const isAlreadyActivatedSignal = (errors: unknown): boolean => {
  if (errors == null) return false;
  if (typeof errors === "string") return ALREADY_ACTIVE_PATTERN.test(errors);
  if (typeof errors === "object") {
    for (const [key, value] of Object.entries(errors as Record<string, unknown>)) {
      if (ALREADY_ACTIVE_PATTERN.test(key)) return true;
      if (typeof value === "string" && ALREADY_ACTIVE_PATTERN.test(value)) return true;
    }
  }
  return false;
};

export const activationFormDefaultValue = {
  firstname: "",
  lastname: "",
  password: "",
  confirmPassword: "",
};

const hasWhitespace = /\s/;
const noWhitespaceMessage = "Password must not contain spaces";

const passwordSchema = z
  .string()
  .superRefine((value, ctx) => {
    if (value && hasWhitespace.test(value)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: noWhitespaceMessage });
    }
  })
  .transform((value) => value.trim());

export const activationFormSchema = z.object({
  firstname: z.string().min(1, "First name is required"),
  lastname: z.string().min(1, "Last name is required"),
  password: passwordSchema,
  confirmPassword: passwordSchema,
});
