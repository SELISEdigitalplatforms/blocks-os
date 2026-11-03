import { isErrorWithErrors } from "@/lib/error";
import { isHttpErrorStatus } from "@/lib/http/http-error.util";
import { SECRET_ERROR_REASON } from "@/cross-modules/secrets/models/secret.model";
import { tStatic } from "@seliseblocks/genesis-os";

const I18N_MODULE = "os.secrets";

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
  get 403() {
    return tStatic(I18N_MODULE, "SECRET_ERROR.YOU_DO_NOT_HAVE_PERMISSION");
  },
  get 404() {
    return tStatic(I18N_MODULE, "SECRET_ERROR.THAT_SECRET_NO_LONGER_EXISTS");
  },
  get 409() {
    return tStatic(I18N_MODULE, "SECRET_ERROR.THE_SECRETS_STATUS_HAS_CHANGED");
  },
  // Deliberately generic, and it matches what the backend already sends: the underlying vault
  // error can name hosts and credential types that must not reach a user.
  get 502() {
    return tStatic(I18N_MODULE, "SECRET_ERROR.THE_SECRET_STORE_IS_CURRENTLY");
  },
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
  get [SECRET_ERROR_REASON.NameInvalid]() {
    return tStatic(I18N_MODULE, "SECRET_ERROR.USE_LETTERS_DIGITS_DOT_UNDERSCORE");
  },
  get [SECRET_ERROR_REASON.NameTooLong]() {
    return tStatic(I18N_MODULE, "SECRET_ERROR.THE_NAME_IS_TOO_LONG");
  },
  get [SECRET_ERROR_REASON.NameRequired]() {
    return tStatic(I18N_MODULE, "SECRET_ERROR.A_NAME_IS_REQUIRED");
  },
  get [SECRET_ERROR_REASON.DescriptionTooLong]() {
    return tStatic(I18N_MODULE, "SECRET_ERROR.THE_DESCRIPTION_IS_TOO_LONG");
  },
  get [SECRET_ERROR_REASON.ValueRequired]() {
    return tStatic(I18N_MODULE, "SECRET_ERROR.A_VALUE_IS_REQUIRED");
  },
  get [SECRET_ERROR_REASON.ValueTooLarge]() {
    return tStatic(I18N_MODULE, "SECRET_ERROR.THE_VALUE_IS_LARGER_THAN");
  },
  get [SECRET_ERROR_REASON.InvalidType]() {
    return tStatic(I18N_MODULE, "SECRET_ERROR.THAT_SECRET_TYPE_IS_NOT");
  },
  get [SECRET_ERROR_REASON.BatchTooLarge]() {
    return tStatic(I18N_MODULE, "SECRET_ERROR.TOO_MANY_SECRETS_IN_ONE");
  },
  get [SECRET_ERROR_REASON.DuplicateNameInBatch]() {
    return tStatic(I18N_MODULE, "SECRET_ERROR.THE_BATCH_CONTAINS_THE_SAME");
  },
};

/**
 * Reason codes whose meaning depends on the status they arrive with. `STATUS_DELETED` on a
 * value read (400) means "archived, restore to read"; on a lifecycle action it still arrives as
 * a 409 and is a stale view, which the status-level copy already explains.
 */
const REASON_STATUS_MESSAGES: Record<string, Partial<Record<number, string>>> = {
  [SECRET_ERROR_REASON.StatusDeleted]: {
    get 400() {
      return tStatic(I18N_MODULE, "SECRET_ERROR.THIS_SECRET_IS_ARCHIVED_RESTORE");
    },
  },
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
  fallback = tStatic(I18N_MODULE, "SECRET_ERROR.SOMETHING_WENT_WRONG_PLEASE_TRY"),
): SecretErrorInfo => {
  const status = statusOf(error);
  const errors = isErrorWithErrors(error) ? error.errors : undefined;
  const reason = firstString(errors?.reason);

  // Prefer the reason-specific copy, then the status-level copy, then whatever the server sent
  // under its error key. The server's own 400 messages are user-safe and more specific than
  // anything generic, so they beat the fallback.
  const serverMessage = errors
    ? firstString(Object.entries(errors).find(([key]) => key !== "reason")?.[1])
    : undefined;

  const message =
    (reason && status ? REASON_STATUS_MESSAGES[reason]?.[status] : undefined) ??
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
  if (status === 404 || status === 409) return true;

  // A value read on an archived secret answers 400 rather than 409, but it means the same
  // thing: the row still shows the secret as readable, and it is not any more.
  if (status === 400) {
    const errors = isErrorWithErrors(error) ? error.errors : undefined;
    return firstString(errors?.reason) === SECRET_ERROR_REASON.StatusDeleted;
  }

  return false;
};

export const isSecretPermissionError = (error: unknown): boolean => statusOf(error) === 403;
