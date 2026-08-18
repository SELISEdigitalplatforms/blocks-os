/**
 * Human-readable copy for every rejection the two IAM archive endpoints can return.
 *
 * The backend keys its error dictionary by *category* (`forbidden`, `ItemId`, `archived`,
 * `dependency`) and puts the specific reason in the *value*, so this map is keyed on the value:
 * `forbidden` alone covers five distinct reasons across the two endpoints, and the other three
 * categories cover two each. Mapping by key could not tell them apart.
 *
 * Deliberately feature-local rather than a global registry — see the ticket's out-of-scope list.
 * An unmapped code falls through to the raw value in `getErrorMessage`, so if the backend ever
 * adds a reason the toast degrades to today's behaviour instead of going blank.
 */
export const ARCHIVE_ERROR_MESSAGES: Record<string, string> = {
  // DELETE /iam/permissions/{id}
  Not_Allowed_To_Archive_Permission_Outside_Default_Organization:
    "Permissions can only be archived from the default organization.",
  Permission_Not_Found: "This permission no longer exists. Refresh the list and try again.",
  Permission_Not_A_Default_Organization_Record:
    "This is another organization's copy of the permission. Archive the default-organization record instead.",
  Permission_Already_Archived: "This permission is already archived.",
  Only_Root_Tenant_Can_Archive_Built_In_Permission:
    "Built-in permissions can only be archived by a root-tenant administrator.",

  // DELETE /iam/roles/{id}
  Role_Not_Found: "This role no longer exists. Refresh the list and try again.",
  Can_Not_Archive_Default_Copied_Role:
    "This role was copied from the default organization and cannot be archived here.",
  Not_Allowed_To_Archive_Role_From_Another_Organization:
    "This role belongs to another organization.",
  Role_Already_Archived: "This role is already archived.",
  Role_Has_Child_Roles: "Archive or reassign this role's child roles first.",
  Role_Has_Active_User_Assignments:
    "This role is still assigned to active users. Remove those assignments first.",
};

/**
 * What the archive endpoints resolve with on success. Failures do not arrive this way — they are
 * thrown — but the shape is declared so the hooks can defend against a 200 that carries
 * `isSuccess: false`, which the HTTP client would otherwise pass through as a success.
 */
export type ArchiveResponse = {
  isSuccess?: boolean;
  itemId?: string;
  errors?: Record<string, string | string[]>;
  Errors?: Record<string, string | string[]>;
};

/**
 * Pulls the error dictionary off whatever the failure turned out to be.
 *
 * `throwIfNotOk` reads a lowercase `errors` off the response body; if the wire format were ever
 * PascalCase the whole body would land on `HttpError.errors` instead, and no code would match.
 * ASP.NET Core's defaults produce lowercase and blocks-iam sets no naming policy, but that is a
 * different repo on a different deploy cadence, so both spellings are accepted here rather than
 * betting on it.
 */
export const normalizeArchiveErrors = (
  source: unknown,
): Record<string, string | string[]> | undefined => {
  if (typeof source !== "object" || source === null) return undefined;

  const candidate = source as { errors?: unknown; Errors?: unknown };
  const errors = candidate.errors ?? candidate.Errors;
  if (typeof errors !== "object" || errors === null) return undefined;

  const nested = errors as { errors?: unknown; Errors?: unknown };
  const unwrapped = nested.errors ?? nested.Errors;
  const resolved = typeof unwrapped === "object" && unwrapped !== null ? unwrapped : errors;

  return resolved as Record<string, string | string[]>;
};
