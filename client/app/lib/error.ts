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

export const hasErrorCode = (errors: Record<string, string | string[]>, code: string): boolean => {
  const value = errors[code];
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.length > 0;
  return value.length > 0;
};

export const getErrorMessage = (
  error: Record<string, string | string[]>,
  messageMap: Record<string, string> = {},
): string | string[] => {
  if (!error || Object.keys(error).length === 0) {
    return "Something went wrong.";
  }

  const messages: string[] = [];

  for (const key in error) {
    const value = error[key];

    // Value before key. Server errors that carry a reason code put it in the value and reuse a
    // small set of category keys, so a key lookup cannot tell those reasons apart -- "forbidden"
    // alone covers five different ones on the IAM archive endpoints. Key lookup is kept as the
    // fallback so callers that map by key are unaffected.
    if (typeof value === "string" && messageMap[value]) {
      messages.push(messageMap[value]);
      continue;
    }

    if (messageMap[key]) {
      messages.push(messageMap[key]);
      continue;
    }

    if (typeof value === "string") {
      // A blank value used to be pushed verbatim, which rendered an empty toast line. Skipping it
      // lets the "Something went wrong." fallback below take over.
      if (value.trim().length > 0) messages.push(value);
    } else if (Array.isArray(value) && value.length > 0) {
      // Map each element, not the joined string: ASP.NET dictionaries can carry the reason codes
      // as a string[], and joining first meant the map never saw them.
      const mapped = value
        .filter((item) => typeof item === "string" && item.trim().length > 0)
        .map((item) => messageMap[item] ?? item);
      if (mapped.length) messages.push(mapped.join(", "));
    }
  }

  return messages.length ? messages : "Something went wrong.";
};

export const handleErrorMessages = (
  errors: unknown,
  customMessages?: Record<string, string>,
): string | string[] => {
  if (typeof errors === "string") return errors;

  if (errors && typeof errors === "object" && !Array.isArray(errors)) {
    return getErrorMessage(errors as Record<string, string | string[]>, customMessages);
  }

  return "An unexpected error occurred.";
};
