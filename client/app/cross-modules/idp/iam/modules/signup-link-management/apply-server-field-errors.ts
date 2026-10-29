import { UseFormReturn, Path } from "react-hook-form";
import { SIGNUP_LINK_CONFIGURATION_FIELD_ERROR_MAP } from "../../models/signup-link-configuration";
import { SignupLinkConfigurationFormValues } from "./configuration-form-schema";

type FormLike = UseFormReturn<SignupLinkConfigurationFormValues>;

/**
 * Routes IAM `errors` onto form fields. Unmapped keys (including ItemId) become a single
 * form-level message returned for rendering above the actions. Returns true if any field
 * received an error (so the caller can focus the first one).
 */
export const applyServerFieldErrors = (
  form: FormLike,
  errors: Record<string, string | string[]> | undefined,
): { formLevelError: string | null; routedAField: boolean } => {
  let formLevelError: string | null = null;
  let routedAField = false;
  const fieldOrder: Path<SignupLinkConfigurationFormValues>[] = [
    "name",
    "clientId",
    "redirectUri",
    "defaultForwardedTo",
    "credentialMode",
    "requireExistingUserPassword",
    "defaultLifetimeMinutes",
    "defaultMaxRedemptions",
    "defaultRoles",
    "defaultPermissions",
    "description",
  ];
  const routed = new Set<string>();

  Object.entries(errors ?? {}).forEach(([code, message]) => {
    const text = Array.isArray(message) ? message.join(" ") : message;
    if (code === "ItemId") {
      formLevelError = formLevelError ? `${formLevelError} ${text}` : text;
      return;
    }
    const field = SIGNUP_LINK_CONFIGURATION_FIELD_ERROR_MAP[code];
    if (field) {
      form.setError(field, { type: "server", message: text });
      routed.add(field);
      routedAField = true;
    } else {
      formLevelError = formLevelError ? `${formLevelError} ${text}` : text;
    }
  });

  if (routedAField) {
    const first = fieldOrder.find((f) => routed.has(f));
    if (first) form.setFocus(first);
  }

  return { formLevelError, routedAField };
};
