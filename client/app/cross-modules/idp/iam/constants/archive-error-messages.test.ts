import { describe, expect, it } from "vitest";
import { getErrorMessage } from "@/lib/error";
import { ARCHIVE_ERROR_MESSAGES, normalizeArchiveErrors } from "./archive-error-messages";

/**
 * The exact set of reason codes the two archive endpoints can return, taken from the blocks-iam
 * source rather than from prose: five from ArchivePermissionAsync and six from ArchiveRoleAsync.
 * Each is pinned by an XUnit assertion there, so this list drifting means the backend changed.
 */
const BACKEND_CODES = [
  "Not_Allowed_To_Archive_Permission_Outside_Default_Organization",
  "Permission_Not_Found",
  "Permission_Not_A_Default_Organization_Record",
  "Permission_Already_Archived",
  "Only_Root_Tenant_Can_Archive_Built_In_Permission",
  "Role_Not_Found",
  "Can_Not_Archive_Default_Copied_Role",
  "Not_Allowed_To_Archive_Role_From_Another_Organization",
  "Role_Already_Archived",
  "Role_Has_Child_Roles",
  "Role_Has_Active_User_Assignments",
];

describe("ARCHIVE_ERROR_MESSAGES", () => {
  it("covers exactly the codes the backend emits, no more and no fewer", () => {
    // Equality, not containment: a missing code means a blank-looking toast, and an extra one
    // means dead copy that will quietly rot.
    expect(Object.keys(ARCHIVE_ERROR_MESSAGES).sort()).toEqual([...BACKEND_CODES].sort());
  });

  it.each(BACKEND_CODES)("maps %s to non-empty copy", (code) => {
    expect(ARCHIVE_ERROR_MESSAGES[code]?.trim().length).toBeGreaterThan(0);
  });

  it("resolves a real backend payload to its specific message", () => {
    // The category key is ambiguous -- "forbidden" alone covers five reasons -- so this is the
    // end-to-end check that the value is what gets looked up.
    expect(
      getErrorMessage({ dependency: "Role_Has_Child_Roles" }, ARCHIVE_ERROR_MESSAGES),
    ).toEqual([ARCHIVE_ERROR_MESSAGES.Role_Has_Child_Roles]);
  });

  it("falls back to the raw code if the backend adds a reason", () => {
    // C7: drift degrades to today's behaviour rather than producing a blank toast.
    expect(getErrorMessage({ forbidden: "Some_Future_Code" }, ARCHIVE_ERROR_MESSAGES)).toEqual([
      "Some_Future_Code",
    ]);
  });
});

describe("normalizeArchiveErrors", () => {
  it("reads a lowercase errors dictionary", () => {
    expect(normalizeArchiveErrors({ errors: { archived: "Role_Already_Archived" } })).toEqual({
      archived: "Role_Already_Archived",
    });
  });

  it("reads a PascalCase Errors dictionary", () => {
    // throwIfNotOk only looks for lowercase `errors`, so a PascalCase wire body would arrive with
    // the whole response object on HttpError.errors and nothing would ever match.
    expect(normalizeArchiveErrors({ Errors: { archived: "Role_Already_Archived" } })).toEqual({
      archived: "Role_Already_Archived",
    });
  });

  it("unwraps the nested shape the client produces for a PascalCase body", () => {
    // What HttpError.errors actually holds when the body was { isSuccess, Errors }.
    expect(
      normalizeArchiveErrors({
        errors: { isSuccess: false, Errors: { dependency: "Role_Has_Child_Roles" } },
      }),
    ).toEqual({ dependency: "Role_Has_Child_Roles" });
  });

  it("returns undefined for anything else", () => {
    expect(normalizeArchiveErrors(new Error("boom"))).toBeUndefined();
    expect(normalizeArchiveErrors(null)).toBeUndefined();
    expect(normalizeArchiveErrors("nope")).toBeUndefined();
  });
});
