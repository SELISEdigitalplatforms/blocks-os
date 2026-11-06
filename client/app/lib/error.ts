import { tStatic } from "@seliseblocks/genesis-os";

const I18N_MODULE = "os.shared";

/** Access grant: the server refused a grant the caller does not hold (HTTP 403). */
export const ACCESS_GRANT_NOT_ALLOWED = "Access_Grant_Not_Allowed";
export const getAccessGrantNotAllowedMessage = () =>
  tStatic(I18N_MODULE, "ERROR.ACCESS_GRANT_NOT_ALLOWED");

/** Messages every toast gets, so no screen has to map these server keys itself. */
const defaultErrorMessages = (): Record<string, string> => ({
  [ACCESS_GRANT_NOT_ALLOWED]: getAccessGrantNotAllowedMessage(),
});

export const isErrorWithErrors = (
  error: unknown,
): error is { errors: Record<string, string | string[]> } => {
  return (
    typeof error === "object" &&
    error !== null &&
    "errors" in error &&
    typeof (error as { errors: unknown }).errors === "object" &&
    (error as { errors: unknown }).errors !== null
  );
};

/** True when a rejected request carries the access-grant refusal, as key or value. */
export const isAccessGrantRefused = (error: unknown): boolean => {
  if (!isErrorWithErrors(error)) return false;
  return Object.entries(error.errors).some(([key, value]) => {
    if (key === ACCESS_GRANT_NOT_ALLOWED) return true;
    return Array.isArray(value)
      ? value.includes(ACCESS_GRANT_NOT_ALLOWED)
      : value === ACCESS_GRANT_NOT_ALLOWED;
  });
};

export const hasErrorCode = (errors: Record<string, string | string[]>, code: string): boolean => {
  const value = errors[code];
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.length > 0;
  return value.length > 0;
};

// The message for one error entry, or null when it has none to show.
const entryMessage = (
  key: string,
  value: string | string[],
  messageMap: Record<string, string>,
): string | null => {
  // Value before key. Server errors that carry a reason code put it in the value and reuse a
  // small set of category keys, so a key lookup cannot tell those reasons apart -- "forbidden"
  // alone covers five different ones on the IAM archive endpoints. Key lookup is kept as the
  // fallback so callers that map by key are unaffected.
  if (typeof value === "string" && messageMap[value]) return messageMap[value];
  if (messageMap[key]) return messageMap[key];

  if (typeof value === "string") {
    // A blank value used to be pushed verbatim, which rendered an empty toast line. Skipping it
    // lets the "Something went wrong." fallback below take over.
    return value.trim().length > 0 ? value : null;
  }
  if (!Array.isArray(value) || value.length === 0) return null;
  // Map each element, not the joined string: ASP.NET dictionaries can carry the reason codes
  // as a string[], and joining first meant the map never saw them.
  const mapped = value
    .filter((item) => typeof item === "string" && item.trim().length > 0)
    .map((item) => messageMap[item] ?? item);
  return mapped.length ? mapped.join(", ") : null;
};

export const getErrorMessage = (
  error: Record<string, string | string[]>,
  messageMap: Record<string, string> = {},
): string | string[] => {
  if (!error || Object.keys(error).length === 0) {
    return tStatic(I18N_MODULE, "ERROR.SOMETHING_WENT_WRONG");
  }

  const messages: string[] = [];

  for (const key in error) {
    const message = entryMessage(key, error[key], messageMap);
    if (message !== null) messages.push(message);
  }

  return messages.length ? messages : tStatic(I18N_MODULE, "ERROR.SOMETHING_WENT_WRONG");
};

export const handleErrorMessages = (
  errors: unknown,
  customMessages?: Record<string, string>,
): string | string[] => {
  if (typeof errors === "string") return errors;

  if (errors && typeof errors === "object" && !Array.isArray(errors)) {
    return getErrorMessage(errors as Record<string, string | string[]>, {
      ...defaultErrorMessages(),
      ...customMessages,
    });
  }

  return tStatic(I18N_MODULE, "ERROR.UNEXPECTED");
};
