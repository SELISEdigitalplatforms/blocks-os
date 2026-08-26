/**
 * Reads the HTTP status off a rejected request, whatever threw it.
 *
 * Structural rather than an `instanceof HttpError` check: the same shape arrives from
 * genesis-os's client and from anything else that rejects with a status, and a transport
 * failure (server unreachable, CORS, DNS) carries no status at all -- which is exactly what
 * callers need to tell apart.
 */
export const getHttpErrorStatus = (error: unknown): number | undefined => {
  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof (error as { status: unknown }).status === "number"
  ) {
    return (error as { status: number }).status;
  }

  return undefined;
};

export const isHttpErrorStatus = (error: unknown, status: number): boolean => {
  return getHttpErrorStatus(error) === status;
};
