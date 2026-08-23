import { isErrorWithErrors } from "@/lib/error";
import { isHttpErrorStatus } from "@/lib/http/http-error.util";
import { SECRET_ERROR_REASON } from "@/cross-modules/secrets/models/secret.model";

/**
 * Normalised view of a failed secret call.
 *
 * The API fails with `BaseResponse` — `{ isSuccess: false, errors: { <key>: "<message>",
 * reason: "<CODE>" } }` — at a status that says which class of failure it was. Both halves
 * matter: the status decides the shape of the UI response, the reason code decides which field
 * (if any) the message belongs to.
 */
export interface SecretErrorInfo {
  status?: number;
  /** Machine-readable code from `errors.reason`, e.g. `NAME_INVALID`. */
  reason?: string;
  /** Message safe to show a user. */
  message: string;
  /** A 400 caused by a named field rather than by the request as a whole. */
  field?: "name" | "description" | "value" | "type";
}

const STATUS_MESSAGES: Record<number, string> = {
  403: "You do not have permission to perform this action.",
  404: "That secret no longer exists. The list has been refreshed.",
  409: "The secret's status has changed. Refresh and try again.",
  // Deliberately generic, and it matches what the backend already sends: the underlying vault
  // error can name hosts and credential types that must not reach a user.
  502: "The secret store is currently unavailable. Please try again.",
};

const REASON_FIELDS: Record<string, SecretErrorInfo["field"]> = {
  [SECRET_ERROR_REASON.NameRequired]: "name",
  [SECRET_ERROR_REASON.NameTooLong]: "name",
  [SECRET_ERROR_REASON.NameInvalid]: "name",
  [SECRET_ERROR_REASON.DescriptionTooLong]: "description",
  [SECRET_ERROR_REASON.ValueRequired]: "value",
  [SECRET_ERROR_REASON.ValueTooLarge]: "value",
  [SECRET_ERROR_REASON.InvalidType]: "type",
};

const REASON_MESSAGES: Record<string, string> = {
  [SECRET_ERROR_REASON.NameInvalid]:
    "Use letters, digits, dot, underscore or hyphen, starting with a letter or digit.",
  [SECRET_ERROR_REASON.NameTooLong]: "The name is too long.",
  [SECRET_ERROR_REASON.NameRequired]: "A name is required.",
  [SECRET_ERROR_REASON.DescriptionTooLong]: "The description is too long.",
  [SECRET_ERROR_REASON.ValueRequired]: "A value is required.",
  [SECRET_ERROR_REASON.ValueTooLarge]: "The value is larger than the 25 KB limit.",
  [SECRET_ERROR_REASON.InvalidType]: "That secret type is not recognised.",
  [SECRET_ERROR_REASON.BatchTooLarge]: "Too many secrets in one request.",
  [SECRET_ERROR_REASON.DuplicateNameInBatch]: "The batch contains the same name twice.",
};

const statusOf = (error: unknown): number | undefined => {
  for (const status of [400, 403, 404, 409, 502]) {
    if (isHttpErrorStatus(error, status)) return status;
  }
  if (typeof error === "object" && error !== null && "status" in error) {
    const value = (error as { status: unknown }).status;
    if (typeof value === "number") return value;
  }
  return undefined;
};

const firstString = (value: string | string[] | undefined): string | undefined => {
  if (typeof value === "string") return value || undefined;
  if (Array.isArray(value)) return value.find((item) => !!item);
  return undefined;
};

export const describeSecretError = (
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): SecretErrorInfo => {
  const status = statusOf(error);
  const errors = isErrorWithErrors(error) ? error.errors : undefined;
  const reason = firstString(errors?.reason);

  // Prefer the reason-specific copy, then the status-level copy, then whatever the server sent
  // under its error key. The server's own 400 messages are user-safe and more specific than
  // anything generic, so they beat the fallback.
  const serverMessage = errors
    ? firstString(
        Object.entries(errors).find(([key]) => key !== "reason")?.[1] as
          | string
          | string[]
          | undefined,
      )
    : undefined;

  const message =
    (reason ? REASON_MESSAGES[reason] : undefined) ??
    (status ? STATUS_MESSAGES[status] : undefined) ??
    serverMessage ??
    fallback;

  return {
    status,
    reason,
    message,
    field: reason ? REASON_FIELDS[reason] : undefined,
  };
};

/** The row the user is looking at is out of date — refetch before letting them retry. */
export const isStaleSecretError = (error: unknown): boolean => {
  const status = statusOf(error);
  return status === 404 || status === 409;
};

export const isSecretPermissionError = (error: unknown): boolean => statusOf(error) === 403;
