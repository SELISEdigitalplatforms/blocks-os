/**
 * The reason the OS server gave for refusing a save. A 400 from PlatformDataAccess carries
 * `{ isSuccess: false, errors: { [property]: message } }`; the HTTP client hands over `errors`
 * (or the whole body when there is none).
 */
export function serverMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "errors" in error) {
    const errors = (error as { errors: unknown }).errors;
    if (errors && typeof errors === "object") {
      const body = errors as Record<string, unknown>;
      const nested = body.errors && typeof body.errors === "object" ? (body.errors as Record<string, unknown>) : body;
      const messages = Object.values(nested).filter((value): value is string => typeof value === "string" && value.length > 0);
      if (messages.length > 0) return messages.join(" ");
    }
  }
  return "Something went wrong.";
}

/** True for a refusal the user can fix (400), as opposed to a failure. */
export const isRefusal = (error: unknown) =>
  typeof error === "object" && error !== null && "status" in error && (error as { status: unknown }).status === 400;
